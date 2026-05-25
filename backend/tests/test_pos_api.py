"""POS Billing System API tests"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # fallback to frontend/.env
    from pathlib import Path
    for line in Path('/app/frontend/.env').read_text().splitlines():
        if line.startswith('REACT_APP_BACKEND_URL='):
            BASE_URL = line.split('=', 1)[1].strip().rstrip('/')

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# Health / Products
def test_root(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200


def test_get_products(session):
    r = session.get(f"{API}/products")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 20
    assert "name" in data[0] and "price" in data[0] and "hsn_code" in data[0]


def test_get_products_category_filter(session):
    r = session.get(f"{API}/products", params={"category": "Food"})
    assert r.status_code == 200
    for p in r.json():
        assert p["category"] == "Food"


def test_get_products_search(session):
    r = session.get(f"{API}/products", params={"search": "Burger"})
    assert r.status_code == 200
    names = [p["name"] for p in r.json()]
    assert any("Burger" in n for n in names)


def test_get_products_barcode(session):
    r = session.get(f"{API}/products", params={"barcode": "F001"})
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["barcode"] == "F001"


def test_product_crud_full(session):
    payload = {
        "name": "TEST_Widget", "category": "Stationery", "price": 99.5,
        "stock": 25, "barcode": f"TEST{uuid.uuid4().hex[:6]}",
        "unit": "pcs", "hsn_code": "12345678"
    }
    r = session.post(f"{API}/products", json=payload)
    assert r.status_code == 200, r.text
    created = r.json()
    pid = created["id"]
    assert created["name"] == payload["name"]
    assert created["price"] == 99.5

    # GET by id
    r = session.get(f"{API}/products/{pid}")
    assert r.status_code == 200
    assert r.json()["name"] == "TEST_Widget"

    # Update
    r = session.put(f"{API}/products/{pid}", json={"price": 150.0, "stock": 10})
    assert r.status_code == 200
    assert r.json()["price"] == 150.0
    assert r.json()["stock"] == 10

    # Verify persistence
    r = session.get(f"{API}/products/{pid}")
    assert r.json()["price"] == 150.0

    # Delete
    r = session.delete(f"{API}/products/{pid}")
    assert r.status_code == 200

    # Verify gone
    r = session.get(f"{API}/products/{pid}")
    assert r.status_code == 404


def test_product_not_found(session):
    r = session.get(f"{API}/products/nonexistent-id")
    assert r.status_code == 404


# Held carts
def test_held_carts_flow(session):
    cart = {
        "items": [{"product_id": "p1", "name": "Test", "price": 50.0, "quantity": 2, "hsn_code": ""}],
        "customer_name": "TEST_John", "customer_phone": "9999999999"
    }
    r = session.post(f"{API}/carts/hold", json=cart)
    assert r.status_code == 200
    cart_id = r.json()["id"]

    r = session.get(f"{API}/carts/held")
    assert r.status_code == 200
    ids = [c["id"] for c in r.json()]
    assert cart_id in ids

    r = session.delete(f"{API}/carts/held/{cart_id}")
    assert r.status_code == 200

    r = session.delete(f"{API}/carts/held/{cart_id}")
    assert r.status_code == 404


# Bills + customer auto-save + stock decrement
def test_bill_creation_full_flow(session):
    # Create a product to use
    barcode = f"BTEST{uuid.uuid4().hex[:6]}"
    p = session.post(f"{API}/products", json={
        "name": "TEST_BillProd", "category": "Food", "price": 100,
        "stock": 50, "barcode": barcode, "unit": "pcs", "hsn_code": "111"
    }).json()
    pid = p["id"]
    phone = f"9{uuid.uuid4().int % 1000000000:09d}"

    bill = {
        "invoice_no": f"INV-{uuid.uuid4().hex[:8]}",
        "items": [{"product_id": pid, "name": "TEST_BillProd", "price": 100, "quantity": 3, "hsn_code": "111"}],
        "subtotal": 300, "discount_percent": 10, "discount_amount": 30,
        "tax_amount": 48.6, "total": 318.6,
        "payment_method": "Cash", "cash_received": 400, "change_given": 81.4,
        "customer_name": "TEST_Cust", "customer_phone": phone
    }
    r = session.post(f"{API}/bills", json=bill)
    assert r.status_code == 200, r.text
    bid = r.json()["id"]

    # Verify bill listed
    r = session.get(f"{API}/bills")
    assert r.status_code == 200
    assert any(b["id"] == bid for b in r.json())

    # Verify individual bill
    r = session.get(f"{API}/bills/{bid}")
    assert r.status_code == 200
    assert r.json()["total"] == 318.6

    # Stock decremented
    r = session.get(f"{API}/products/{pid}")
    assert r.json()["stock"] == 47

    # Customer auto-saved
    r = session.get(f"{API}/customers")
    custs = [c for c in r.json() if c["phone"] == phone]
    assert len(custs) == 1
    assert custs[0]["visit_count"] == 1
    assert abs(custs[0]["total_purchases"] - 318.6) < 0.01

    # Second bill with same customer increments visit_count
    bill2 = dict(bill, invoice_no=f"INV-{uuid.uuid4().hex[:8]}", total=100, subtotal=100,
                 discount_amount=0, tax_amount=0, discount_percent=0,
                 items=[{"product_id": pid, "name": "TEST_BillProd", "price": 100, "quantity": 1, "hsn_code": "111"}])
    session.post(f"{API}/bills", json=bill2)
    r = session.get(f"{API}/customers")
    cust = [c for c in r.json() if c["phone"] == phone][0]
    assert cust["visit_count"] == 2

    # cleanup
    session.delete(f"{API}/products/{pid}")


def test_bill_not_found(session):
    r = session.get(f"{API}/bills/nonexistent")
    assert r.status_code == 404


# Reports
@pytest.mark.parametrize("period", ["today", "week", "month", "all"])
def test_reports_summary(session, period):
    r = session.get(f"{API}/reports/summary", params={"period": period})
    assert r.status_code == 200
    data = r.json()
    for k in ["total_revenue", "total_bills", "total_tax", "total_discount", "top_products", "payment_breakdown"]:
        assert k in data
    assert isinstance(data["top_products"], list)
    assert len(data["top_products"]) <= 5


# Settings
def test_settings_get_and_update(session):
    r = session.get(f"{API}/settings")
    assert r.status_code == 200
    orig = r.json()
    assert "shop_name" in orig

    r = session.put(f"{API}/settings", json={
        "shop_name": "TEST_Shop", "low_stock_threshold": 7,
        "tax_enabled": True, "auto_print": False
    })
    assert r.status_code == 200
    assert r.json()["shop_name"] == "TEST_Shop"
    assert r.json()["low_stock_threshold"] == 7

    # restore
    session.put(f"{API}/settings", json={
        "shop_name": orig.get("shop_name", "My Shop"),
        "low_stock_threshold": orig.get("low_stock_threshold", 10)
    })


def test_settings_empty_update(session):
    r = session.put(f"{API}/settings", json={})
    assert r.status_code == 400
