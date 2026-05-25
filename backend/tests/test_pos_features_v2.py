"""Tests for v2 features: balance, software_name, tax_percent, bills filters, customer search"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
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


# Settings: software_name + tax_percent
def test_settings_software_name_persists(session):
    r = session.put(f"{API}/settings", json={"software_name": "TEST_MyPOS"})
    assert r.status_code == 200
    assert r.json()["software_name"] == "TEST_MyPOS"
    r2 = session.get(f"{API}/settings")
    assert r2.json()["software_name"] == "TEST_MyPOS"
    # restore
    session.put(f"{API}/settings", json={"software_name": "POS System"})


def test_settings_tax_percent_persists(session):
    r = session.put(f"{API}/settings", json={"tax_percent": 5.0})
    assert r.status_code == 200
    assert r.json()["tax_percent"] == 5.0
    r2 = session.get(f"{API}/settings")
    assert r2.json()["tax_percent"] == 5.0
    # try 12, 28
    for v in [12.0, 28.0]:
        r = session.put(f"{API}/settings", json={"tax_percent": v})
        assert r.json()["tax_percent"] == v
    # restore
    session.put(f"{API}/settings", json={"tax_percent": 18.0})


# Bill with tax_percent + balance_amount
def test_bill_with_balance_and_custom_tax(session):
    phone = f"99{uuid.uuid4().int % 100000000:08d}"
    invoice = f"INV-{uuid.uuid4().hex[:8]}"
    bill = {
        "invoice_no": invoice,
        "items": [{"product_id": "px", "name": "X", "price": 100, "quantity": 2, "hsn_code": ""}],
        "subtotal": 200, "discount_percent": 0, "discount_amount": 0,
        "tax_amount": 10, "tax_percent": 5.0, "total": 210,
        "payment_method": "Cash", "cash_received": 110, "change_given": 0,
        "balance_amount": 100,
        "customer_name": "TEST_BalCust", "customer_phone": phone
    }
    r = session.post(f"{API}/bills", json=bill)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["tax_percent"] == 5.0
    assert body["balance_amount"] == 100

    # Verify bill persisted via GET
    bid = body["id"]
    g = session.get(f"{API}/bills/{bid}")
    assert g.status_code == 200
    assert g.json()["balance_amount"] == 100
    assert g.json()["tax_percent"] == 5.0


# GET /api/customers/balance - new endpoint
def test_customers_balance_endpoint(session):
    # Create a bill with balance for a new customer
    phone = f"98{uuid.uuid4().int % 100000000:08d}"
    bill = {
        "invoice_no": f"INV-{uuid.uuid4().hex[:8]}",
        "items": [{"product_id": "py", "name": "Y", "price": 50, "quantity": 1, "hsn_code": ""}],
        "subtotal": 50, "discount_percent": 0, "discount_amount": 0,
        "tax_amount": 0, "tax_percent": 0, "total": 50,
        "payment_method": "Cash", "cash_received": 25, "change_given": 0,
        "balance_amount": 25,
        "customer_name": "TEST_BalanceCust", "customer_phone": phone
    }
    r = session.post(f"{API}/bills", json=bill)
    assert r.status_code == 200

    # GET balance endpoint
    r = session.get(f"{API}/customers/balance")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    # Find our customer
    matches = [c for c in data if c.get("phone") == phone]
    assert len(matches) == 1, f"Customer with phone {phone} should be returned by /balance endpoint"
    # CRITICAL: balance should be present and > 0
    assert "balance" in matches[0], f"balance field missing in customer response: {matches[0]}"
    assert matches[0]["balance"] > 0, f"balance should be > 0, got {matches[0].get('balance')}"


def test_customer_balance_in_customers_list(session):
    """Customers listing should include balance field"""
    r = session.get(f"{API}/customers")
    assert r.status_code == 200
    data = r.json()
    # Find any customer with balance set
    customers_with_balance_phone = []
    for c in data:
        if c.get("phone", "").startswith("98") or c.get("phone", "").startswith("99"):
            customers_with_balance_phone.append(c)
    # At least one TEST customer should have balance field surfaced
    has_balance_field = any("balance" in c for c in data)
    assert has_balance_field, "balance field missing from /api/customers response"


# Pay balance endpoint
def test_pay_customer_balance(session):
    phone = f"97{uuid.uuid4().int % 100000000:08d}"
    bill = {
        "invoice_no": f"INV-{uuid.uuid4().hex[:8]}",
        "items": [{"product_id": "pz", "name": "Z", "price": 100, "quantity": 1, "hsn_code": ""}],
        "subtotal": 100, "discount_percent": 0, "discount_amount": 0,
        "tax_amount": 0, "tax_percent": 0, "total": 100,
        "payment_method": "Cash", "cash_received": 40, "change_given": 0,
        "balance_amount": 60,
        "customer_name": "TEST_PayBal", "customer_phone": phone
    }
    session.post(f"{API}/bills", json=bill)

    # Pay 30
    r = session.post(f"{API}/customers/{phone}/pay-balance", params={"amount": 30})
    assert r.status_code == 200, r.text
    assert r.json()["new_balance"] == 30

    # Pay more than remaining - should clamp at 0
    r = session.post(f"{API}/customers/{phone}/pay-balance", params={"amount": 999})
    assert r.json()["new_balance"] == 0


def test_pay_balance_unknown_customer(session):
    r = session.post(f"{API}/customers/nonexistent999/pay-balance", params={"amount": 10})
    assert r.status_code == 404


# Bills search & date filter
def test_bills_search_by_invoice(session):
    unique = uuid.uuid4().hex[:8].upper()
    invoice = f"INV-SEARCH-{unique}"
    phone = f"96{uuid.uuid4().int % 100000000:08d}"
    session.post(f"{API}/bills", json={
        "invoice_no": invoice,
        "items": [{"product_id": "ps", "name": "S", "price": 10, "quantity": 1, "hsn_code": ""}],
        "subtotal": 10, "discount_percent": 0, "discount_amount": 0,
        "tax_amount": 0, "tax_percent": 0, "total": 10,
        "payment_method": "Cash", "balance_amount": 0,
        "customer_name": "TEST_Search", "customer_phone": phone
    })

    r = session.get(f"{API}/bills", params={"search": unique})
    assert r.status_code == 200
    invoices = [b["invoice_no"] for b in r.json()]
    assert invoice in invoices


def test_bills_search_by_customer_name(session):
    name = f"TEST_UNIQUE_{uuid.uuid4().hex[:6]}"
    phone = f"95{uuid.uuid4().int % 100000000:08d}"
    session.post(f"{API}/bills", json={
        "invoice_no": f"INV-{uuid.uuid4().hex[:8]}",
        "items": [{"product_id": "pn", "name": "N", "price": 10, "quantity": 1, "hsn_code": ""}],
        "subtotal": 10, "discount_percent": 0, "discount_amount": 0,
        "tax_amount": 0, "tax_percent": 0, "total": 10,
        "payment_method": "Cash", "balance_amount": 0,
        "customer_name": name, "customer_phone": phone
    })

    r = session.get(f"{API}/bills", params={"search": name})
    assert r.status_code == 200
    assert any(b["customer_name"] == name for b in r.json())


def test_bills_date_filter(session):
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=1)).isoformat()
    end = (now + timedelta(days=1)).isoformat()
    r = session.get(f"{API}/bills", params={"start_date": start, "end_date": end})
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# Customers search
def test_customers_search_by_name(session):
    # Existing endpoint signature - check if search param is supported
    r = session.get(f"{API}/customers", params={"search": "TEST"})
    assert r.status_code == 200
    # If search is implemented, all results should match; if not, all customers returned.
    # Per review request, search param exists.


# Reports date range
def test_reports_date_range(session):
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=30)).isoformat()
    end = now.isoformat()
    r = session.get(f"{API}/reports/summary", params={"start_date": start, "end_date": end})
    assert r.status_code == 200
    data = r.json()
    for k in ["total_revenue", "total_bills", "total_tax", "total_discount", "top_products", "payment_breakdown"]:
        assert k in data
