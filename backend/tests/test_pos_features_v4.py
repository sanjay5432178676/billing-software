"""Iteration 4 backend tests:
- Stock adjustments (POST/GET)
- Quotations (POST/GET/DELETE)
- Bill return (POST /bills/{id}/return)
- Reports: day-close, profit-loss
- Expiring products
- New product fields (cost_price/wholesale_price/expiry_date)
- New bill fields (discount_type, payment_splits, loyalty_earned/redeemed, is_return)
- Settings: logo_url, receipt_header/footer/size, loyalty_*
"""
import os
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def test_product(session):
    """Create a product to use across stock-adjust/return tests."""
    payload = {
        "name": f"TEST_V4_Prod_{uuid.uuid4().hex[:6]}",
        "category": "Test",
        "price": 100.0,
        "cost_price": 60.0,
        "wholesale_price": 80.0,
        "stock": 50,
        "barcode": f"TESTV4{uuid.uuid4().hex[:8]}",
        "unit": "pcs",
        "hsn_code": "9999",
        "expiry_date": (datetime.now(timezone.utc) + timedelta(days=15)).date().isoformat(),
    }
    r = session.post(f"{API}/products", json=payload)
    assert r.status_code == 200, r.text
    return r.json()


# ---------- New Product fields ----------
def test_product_new_fields_persist(session, test_product):
    pid = test_product["id"]
    r = session.get(f"{API}/products/{pid}")
    assert r.status_code == 200
    p = r.json()
    assert p["cost_price"] == 60.0
    assert p["wholesale_price"] == 80.0
    assert p["expiry_date"] is not None
    assert p["stock"] == 50


# ---------- Stock Adjustments ----------
def test_create_stock_adjustment_increase(session, test_product):
    pid = test_product["id"]
    r = session.post(f"{API}/stock-adjustments", json={
        "product_id": pid,
        "quantity_change": 10,
        "reason": "Restock",
    })
    assert r.status_code == 200, r.text
    adj = r.json()
    assert adj["quantity_change"] == 10
    assert adj["reason"] == "Restock"
    assert adj["product_id"] == pid
    assert adj["new_stock"] == 60  # 50 + 10

    # verify product stock updated
    p = session.get(f"{API}/products/{pid}").json()
    assert p["stock"] == 60


def test_create_stock_adjustment_decrease(session, test_product):
    pid = test_product["id"]
    r = session.post(f"{API}/stock-adjustments", json={
        "product_id": pid,
        "quantity_change": -5,
        "reason": "Damaged",
    })
    assert r.status_code == 200, r.text
    assert r.json()["new_stock"] == 55  # 60 - 5


def test_stock_adjustment_negative_stock_rejected(session, test_product):
    pid = test_product["id"]
    r = session.post(f"{API}/stock-adjustments", json={
        "product_id": pid,
        "quantity_change": -10000,
        "reason": "Test negative",
    })
    assert r.status_code == 400


def test_stock_adjustment_invalid_product(session):
    r = session.post(f"{API}/stock-adjustments", json={
        "product_id": "no-such-product-xyz",
        "quantity_change": 1,
        "reason": "Test",
    })
    assert r.status_code == 404


def test_list_stock_adjustments(session, test_product):
    r = session.get(f"{API}/stock-adjustments")
    assert r.status_code == 200
    adjs = r.json()
    assert isinstance(adjs, list)
    # Our test product should appear in adjustments
    assert any(a["product_id"] == test_product["id"] for a in adjs)


# ---------- Quotations ----------
@pytest.fixture(scope="module")
def created_quote(session, test_product):
    payload = {
        "quote_no": f"QT-V4-{uuid.uuid4().hex[:8]}",
        "items": [{
            "product_id": test_product["id"],
            "name": test_product["name"],
            "price": 100.0,
            "quantity": 2,
            "hsn_code": "9999",
        }],
        "subtotal": 200.0,
        "discount_amount": 20.0,
        "tax_amount": 32.4,
        "total": 212.4,
        "customer_name": "TEST_QT",
        "customer_phone": "9000000001",
        "notes": "iteration 4 quote",
    }
    r = session.post(f"{API}/quotations", json=payload)
    assert r.status_code == 200, r.text
    return r.json()


def test_create_quotation(created_quote):
    assert created_quote["quote_no"].startswith("QT-V4-")
    assert created_quote["total"] == 212.4
    assert len(created_quote["items"]) == 1
    assert created_quote["status"] == "pending"
    assert "id" in created_quote


def test_list_quotations(session, created_quote):
    r = session.get(f"{API}/quotations")
    assert r.status_code == 200
    quotes = r.json()
    assert any(q["id"] == created_quote["id"] for q in quotes)


def test_delete_quotation(session):
    # Create a fresh one and delete
    payload = {
        "quote_no": f"QT-DEL-{uuid.uuid4().hex[:6]}",
        "items": [{"product_id": "x", "name": "x", "price": 1, "quantity": 1, "hsn_code": ""}],
        "subtotal": 1.0,
        "total": 1.0,
    }
    r = session.post(f"{API}/quotations", json=payload)
    qid = r.json()["id"]

    d = session.delete(f"{API}/quotations/{qid}")
    assert d.status_code == 200

    # Verify gone
    quotes = session.get(f"{API}/quotations").json()
    assert not any(q["id"] == qid for q in quotes)


def test_delete_quotation_404(session):
    r = session.delete(f"{API}/quotations/no-such-quote-id")
    assert r.status_code == 404


# ---------- Bill Return ----------
def _make_bill(session, test_product, payment_splits=None, discount_type="percent"):
    item = {
        "product_id": test_product["id"],
        "name": test_product["name"],
        "price": 100.0,
        "quantity": 2,
        "hsn_code": "9999",
    }
    payload = {
        "invoice_no": f"INV-V4-{uuid.uuid4().hex[:8]}",
        "items": [item],
        "subtotal": 200.0,
        "discount_percent": 0,
        "discount_amount": 0,
        "discount_type": discount_type,
        "tax_amount": 36.0,
        "tax_percent": 18.0,
        "total": 236.0,
        "payment_method": "Cash" if not payment_splits else "Split",
        "payment_splits": payment_splits or [],
        "cash_received": 236.0,
        "change_given": 0,
        "balance_amount": 0,
        "customer_name": "TEST_V4",
        "customer_phone": "9000000099",
        "loyalty_earned": 2,
        "loyalty_redeemed": 0,
    }
    return session.post(f"{API}/bills", json=payload)


def test_bill_new_fields_persisted(session, test_product):
    splits = [
        {"method": "Cash", "amount": 100.0},
        {"method": "UPI", "amount": 136.0},
    ]
    r = _make_bill(session, test_product, payment_splits=splits, discount_type="amount")
    assert r.status_code == 200, r.text
    bill = r.json()
    assert bill["discount_type"] == "amount"
    assert bill["payment_splits"] == splits
    assert bill["loyalty_earned"] == 2
    assert bill["is_return"] is False


def test_return_bill_creates_negative_and_restores_stock(session, test_product):
    # Make a bill (2 units) — POST /bills decrements stock by 2.
    r = _make_bill(session, test_product)
    assert r.status_code == 200
    bill = r.json()

    # Stock after bill (post-decrement)
    after_bill = session.get(f"{API}/products/{test_product['id']}").json()["stock"]

    # Return it — should restore +2
    rr = session.post(f"{API}/bills/{bill['id']}/return")
    assert rr.status_code == 200, rr.text
    rb = rr.json()
    assert rb["invoice_no"].startswith("RET-")
    assert rb["is_return"] is True
    assert rb["original_bill_id"] == bill["id"]
    assert rb["total"] == -bill["total"]
    assert rb["subtotal"] == -bill["subtotal"]

    # Stock restored by +2 from the post-bill level (bill items had qty 2)
    after_return = session.get(f"{API}/products/{test_product['id']}").json()["stock"]
    assert after_return == after_bill + 2, \
        f"Expected stock restored by 2: after_bill={after_bill}, after_return={after_return}"


def test_return_bill_twice_rejected(session, test_product):
    r = _make_bill(session, test_product)
    bill_id = r.json()["id"]
    r1 = session.post(f"{API}/bills/{bill_id}/return")
    assert r1.status_code == 200
    r2 = session.post(f"{API}/bills/{bill_id}/return")
    assert r2.status_code == 400


def test_return_bill_404(session):
    r = session.post(f"{API}/bills/no-such-bill/return")
    assert r.status_code == 404


def test_bills_list_includes_returns_with_negative_total(session):
    bills = session.get(f"{API}/bills").json()
    returns = [b for b in bills if b.get("is_return")]
    assert len(returns) >= 1
    assert all(b["total"] <= 0 for b in returns)
    assert all(b["invoice_no"].startswith("RET-") for b in returns)


# ---------- Day Close Report ----------
def test_day_close_report_today(session, test_product):
    # Make a sales bill today to ensure data
    _make_bill(session, test_product)
    r = session.get(f"{API}/reports/day-close")
    assert r.status_code == 200
    data = r.json()
    for k in ["date", "total_sales", "total_returns", "net_revenue",
              "bill_count", "return_count", "payment_breakdown",
              "total_tax", "total_discount"]:
        assert k in data, f"Missing key {k}"
    assert data["total_sales"] >= 0
    assert isinstance(data["payment_breakdown"], dict)


def test_day_close_report_specific_date(session):
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat()
    r = session.get(f"{API}/reports/day-close", params={"date": yesterday})
    assert r.status_code == 200
    data = r.json()
    assert "total_sales" in data


# ---------- Profit & Loss ----------
def test_profit_loss_report(session):
    r = session.get(f"{API}/reports/profit-loss")
    assert r.status_code == 200
    data = r.json()
    for k in ["total_revenue", "total_cost", "gross_profit", "profit_margin"]:
        assert k in data
    assert data["gross_profit"] == data["total_revenue"] - data["total_cost"]


# ---------- Expiring Products ----------
def test_expiring_products(session, test_product):
    r = session.get(f"{API}/products/expiring", params={"days": 30})
    assert r.status_code == 200
    items = r.json()
    # Our test_product has expiry in 15 days so should appear
    assert any(p["id"] == test_product["id"] for p in items), \
        f"Expected test_product in expiring list, got {[p.get('id') for p in items]}"


def test_expiring_products_zero_days(session):
    r = session.get(f"{API}/products/expiring", params={"days": 0})
    assert r.status_code == 200
    # may or may not return items; just check it doesn't error
    assert isinstance(r.json(), list)


# ---------- Settings new fields ----------
def test_settings_update_new_fields(session):
    payload = {
        "logo_url": "data:image/png;base64,iVBORw0KGgoAAAANS",
        "receipt_header": "TEST_V4 Header",
        "receipt_footer": "TEST_V4 Footer",
        "receipt_size": "80mm",
        "loyalty_enabled": True,
        "loyalty_rate": 2.0,
        "loyalty_redeem_rate": 0.25,
        "expiry_alert_days": 45,
    }
    r = session.put(f"{API}/settings", json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    for k, v in payload.items():
        assert body[k] == v, f"settings {k}: expected {v}, got {body[k]}"

    # Verify persisted via GET
    g = session.get(f"{API}/settings").json()
    for k, v in payload.items():
        assert g[k] == v


def test_settings_receipt_size_values(session):
    for size in ["A4", "80mm", "58mm"]:
        r = session.put(f"{API}/settings", json={"receipt_size": size})
        assert r.status_code == 200
        assert r.json()["receipt_size"] == size
