"""Tests for v3 iteration features: bill settle, customer mgmt (PUT balance, DELETE),
customer bills, simplified POS flow (balance_amount with phone), settled field on Bill."""
import os
import uuid
import pytest
import requests

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


def _make_bill_payload(phone, name="TEST_V3", balance_amount=0, total=100):
    return {
        "invoice_no": f"INV-V3-{uuid.uuid4().hex[:8]}",
        "items": [{"product_id": f"p-{uuid.uuid4().hex[:6]}", "name": "ItemA",
                   "price": total, "quantity": 1, "hsn_code": ""}],
        "subtotal": total, "discount_percent": 0, "discount_amount": 0,
        "tax_amount": 0, "tax_percent": 0, "total": total,
        "payment_method": "Cash", "cash_received": total - balance_amount,
        "change_given": 0, "balance_amount": balance_amount,
        "customer_name": name, "customer_phone": phone
    }


# Bill 'settled' field — auto-set based on balance_amount
def test_bill_settled_true_when_no_balance(session):
    phone = f"71{uuid.uuid4().int % 100000000:08d}"
    r = session.post(f"{API}/bills", json=_make_bill_payload(phone, balance_amount=0, total=50))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["settled"] is True
    assert body["balance_amount"] == 0


def test_bill_settled_false_when_balance_due(session):
    phone = f"72{uuid.uuid4().int % 100000000:08d}"
    r = session.post(f"{API}/bills", json=_make_bill_payload(phone, balance_amount=40, total=100))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["settled"] is False
    assert body["balance_amount"] == 40


# PUT /bills/{id}/settle  - toggle settled with side-effect on customer.balance
def test_settle_bill_endpoint_adjusts_customer_balance(session):
    phone = f"73{uuid.uuid4().int % 100000000:08d}"
    # Create unsettled bill with balance 60
    r = session.post(f"{API}/bills", json=_make_bill_payload(phone, "TEST_Settle", 60, 100))
    bill = r.json()
    assert bill["settled"] is False

    # Customer should have balance == 60
    cust_list = session.get(f"{API}/customers/balance").json()
    target = [c for c in cust_list if c["phone"] == phone]
    assert len(target) == 1
    assert target[0]["balance"] == 60

    # Mark settled=true
    r = session.put(f"{API}/bills/{bill['id']}/settle", params={"settled": True})
    assert r.status_code == 200
    data = r.json()
    assert data["settled"] is True

    # Verify bill persisted
    g = session.get(f"{API}/bills/{bill['id']}").json()
    assert g["settled"] is True

    # Customer balance should decrement by 60 -> 0
    cust_list = session.get(f"{API}/customers/balance").json()
    target = [c for c in cust_list if c["phone"] == phone]
    # Should no longer be in balance list (balance=0)
    assert target == [], f"Customer should be gone from balance list, got {target}"

    # Toggle back to unsettled
    r = session.put(f"{API}/bills/{bill['id']}/settle", params={"settled": False})
    assert r.status_code == 200
    g = session.get(f"{API}/bills/{bill['id']}").json()
    assert g["settled"] is False

    # Customer balance should be back to 60
    cust_list = session.get(f"{API}/customers/balance").json()
    target = [c for c in cust_list if c["phone"] == phone]
    assert len(target) == 1 and target[0]["balance"] == 60


def test_settle_bill_404(session):
    r = session.put(f"{API}/bills/nonexistent-id-xyz/settle", params={"settled": True})
    assert r.status_code == 404


# GET /customers/{phone}/bills
def test_get_customer_bills(session):
    phone = f"74{uuid.uuid4().int % 100000000:08d}"
    # create 3 bills
    invoices = []
    for i in range(3):
        r = session.post(f"{API}/bills", json=_make_bill_payload(phone, "TEST_Hist", 0, 50 + i))
        invoices.append(r.json()["invoice_no"])

    r = session.get(f"{API}/customers/{phone}/bills")
    assert r.status_code == 200
    bills = r.json()
    assert len(bills) == 3
    for b in bills:
        assert b["customer_phone"] == phone
        assert "settled" in b
        assert "balance_amount" in b
    fetched_invoices = {b["invoice_no"] for b in bills}
    assert set(invoices).issubset(fetched_invoices)


def test_get_customer_bills_empty(session):
    r = session.get(f"{API}/customers/no-such-phone-99999/bills")
    assert r.status_code == 200
    assert r.json() == []


# PUT /customers/{phone}/balance
def test_update_customer_balance(session):
    phone = f"75{uuid.uuid4().int % 100000000:08d}"
    session.post(f"{API}/bills", json=_make_bill_payload(phone, "TEST_BalUpd", 100, 200))

    # update balance via endpoint
    r = session.put(f"{API}/customers/{phone}/balance", params={"balance": 250})
    assert r.status_code == 200
    assert r.json()["balance"] == 250

    # verify persisted
    cust = session.get(f"{API}/customers/balance").json()
    target = [c for c in cust if c["phone"] == phone]
    assert len(target) == 1
    assert target[0]["balance"] == 250

    # negative balance should be clamped to 0
    r = session.put(f"{API}/customers/{phone}/balance", params={"balance": -50})
    assert r.status_code == 200
    assert r.json()["balance"] == 0


def test_update_customer_balance_404(session):
    r = session.put(f"{API}/customers/nonexistent-phone-9/balance", params={"balance": 100})
    assert r.status_code == 404


# DELETE /customers/{phone}
def test_delete_customer(session):
    phone = f"76{uuid.uuid4().int % 100000000:08d}"
    session.post(f"{API}/bills", json=_make_bill_payload(phone, "TEST_Del", 0, 100))

    # confirm customer exists
    cs = session.get(f"{API}/customers").json()
    assert any(c["phone"] == phone for c in cs)

    r = session.delete(f"{API}/customers/{phone}")
    assert r.status_code == 200

    cs = session.get(f"{API}/customers").json()
    assert not any(c["phone"] == phone for c in cs)


def test_delete_customer_404(session):
    r = session.delete(f"{API}/customers/no-such-phone-delete")
    assert r.status_code == 404


# Simplified POS flow: balance_amount > 0 requires customer (frontend); but backend
# should still accept it. Test backend behavior is permissive.
def test_partial_payment_creates_customer_with_balance(session):
    phone = f"77{uuid.uuid4().int % 100000000:08d}"
    r = session.post(f"{API}/bills", json=_make_bill_payload(phone, "TEST_PP", 75, 150))
    assert r.status_code == 200
    body = r.json()
    assert body["balance_amount"] == 75
    assert body["settled"] is False
    # New customer should now exist with balance=75
    cs = session.get(f"{API}/customers/balance").json()
    target = [c for c in cs if c["phone"] == phone]
    assert len(target) == 1
    assert target[0]["balance"] == 75
    assert target[0]["name"] == "TEST_PP"


def test_full_payment_no_balance(session):
    phone = f"78{uuid.uuid4().int % 100000000:08d}"
    r = session.post(f"{API}/bills", json=_make_bill_payload(phone, "TEST_Full", 0, 200))
    assert r.status_code == 200
    body = r.json()
    assert body["settled"] is True
    assert body["balance_amount"] == 0
    # Customer shouldn't appear in /balance list
    cs = session.get(f"{API}/customers/balance").json()
    assert not any(c["phone"] == phone for c in cs)


# Legacy bill (no settled field) should backfill on GET
def test_get_bills_backfills_settled(session):
    r = session.get(f"{API}/bills")
    assert r.status_code == 200
    for b in r.json()[:5]:
        assert "settled" in b
        assert "balance_amount" in b
