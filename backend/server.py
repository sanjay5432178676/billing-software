from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
from fastapi.middleware.cors import CORSMiddleware
api_router = APIRouter(prefix="/api")

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    category: str
    price: float
    stock: int
    barcode: str
    unit: str = "pcs"
    hsn_code: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    name: str
    category: str
    price: float
    stock: int
    barcode: str
    unit: str = "pcs"
    hsn_code: str = ""

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None
    barcode: Optional[str] = None
    unit: Optional[str] = None
    hsn_code: Optional[str] = None

class CartItem(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int
    hsn_code: str = ""

class HeldCart(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    items: List[CartItem]
    customer_name: str = ""
    customer_phone: str = ""
    held_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Customer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    total_purchases: float = 0.0
    visit_count: int = 0
    balance: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BillItem(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int
    hsn_code: str = ""

class Bill(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_no: str
    items: List[BillItem]
    subtotal: float
    discount_percent: float
    discount_amount: float
    tax_amount: float
    tax_percent: float = 18.0
    total: float
    payment_method: str
    cash_received: float = 0.0
    change_given: float = 0.0
    balance_amount: float = 0.0
    settled: bool = True
    customer_name: str = ""
    customer_phone: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BillCreate(BaseModel):
    invoice_no: str
    items: List[BillItem]
    subtotal: float
    discount_percent: float
    discount_amount: float
    tax_amount: float
    tax_percent: float = 18.0
    total: float
    payment_method: str
    cash_received: float = 0.0
    change_given: float = 0.0
    balance_amount: float = 0.0
    settled: bool = True
    customer_name: str = ""
    customer_phone: str = ""

class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "settings"
    shop_name: str = "My Shop"
    software_name: str = "POS System"
    gstin: str = ""
    address: str = ""
    phone: str = ""
    email: str = ""
    tax_enabled: bool = True
    tax_percent: float = 18.0
    auto_print: bool = False
    low_stock_threshold: int = 10

class SettingsUpdate(BaseModel):
    shop_name: Optional[str] = None
    software_name: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    tax_enabled: Optional[bool] = None
    tax_percent: Optional[float] = None
    auto_print: Optional[bool] = None
    low_stock_threshold: Optional[int] = None

# ── Stock Adjustment Models ───────────────────────────────────────────────────
class StockAdjustment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    product_name: str
    adjustment_type: str  # "add" | "remove" | "set"
    quantity: int
    previous_stock: int
    new_stock: int
    reason: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StockAdjustmentCreate(BaseModel):
    product_id: str
    adjustment_type: str  # "add" | "remove" | "set"
    quantity: int
    reason: str = ""

# ── Quotation Models ──────────────────────────────────────────────────────────
class QuotationItem(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int
    hsn_code: str = ""

class Quotation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quotation_no: str
    items: List[QuotationItem]
    subtotal: float
    discount_percent: float = 0.0
    discount_amount: float = 0.0
    tax_amount: float = 0.0
    tax_percent: float = 18.0
    total: float
    customer_name: str = ""
    customer_phone: str = ""
    valid_until: Optional[str] = None
    status: str = "pending"  # "pending" | "converted" | "expired"
    notes: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class QuotationCreate(BaseModel):
    quotation_no: str
    items: List[QuotationItem]
    subtotal: float
    discount_percent: float = 0.0
    discount_amount: float = 0.0
    tax_amount: float = 0.0
    tax_percent: float = 18.0
    total: float
    customer_name: str = ""
    customer_phone: str = ""
    valid_until: Optional[str] = None
    notes: str = ""

@api_router.get("/")
async def root():
    return {"message": "POS API"}

@api_router.post("/products", response_model=Product)
async def create_product(product: ProductCreate):
    product_obj = Product(**product.model_dump())
    doc = product_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.products.insert_one(doc)
    return product_obj

@api_router.get("/products", response_model=List[Product])
async def get_products(
    category: Optional[str] = None,
    search: Optional[str] = None,
    barcode: Optional[str] = None
):
    query = {}
    if category:
        query['category'] = category
    if barcode:
        query['barcode'] = barcode
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'barcode': {'$regex': search, '$options': 'i'}}
        ]
    
    products = await db.products.find(query, {"_id": 0}).to_list(1000)
    for p in products:
        if isinstance(p.get('created_at'), str):
            p['created_at'] = datetime.fromisoformat(p['created_at'])
    return products

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if isinstance(product.get('created_at'), str):
        product['created_at'] = datetime.fromisoformat(product['created_at'])
    return product

@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, update: ProductUpdate):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.products.update_one(
        {"id": product_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if isinstance(product.get('created_at'), str):
        product['created_at'] = datetime.fromisoformat(product['created_at'])
    return product

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

@api_router.post("/products/{product_id}/stock")
async def update_stock(product_id: str, quantity: int):
    result = await db.products.update_one(
        {"id": product_id},
        {"$inc": {"stock": quantity}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if isinstance(product.get('created_at'), str):
        product['created_at'] = datetime.fromisoformat(product['created_at'])
    return product

@api_router.post("/carts/hold", response_model=HeldCart)
async def hold_cart(cart: HeldCart):
    doc = cart.model_dump()
    doc['held_at'] = doc['held_at'].isoformat()
    await db.held_carts.insert_one(doc)
    return cart

@api_router.get("/carts/held", response_model=List[HeldCart])
async def get_held_carts():
    carts = await db.held_carts.find({}, {"_id": 0}).to_list(100)
    for c in carts:
        if isinstance(c.get('held_at'), str):
            c['held_at'] = datetime.fromisoformat(c['held_at'])
    return carts

@api_router.delete("/carts/held/{cart_id}")
async def delete_held_cart(cart_id: str):
    result = await db.held_carts.delete_one({"id": cart_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cart not found")
    return {"message": "Cart deleted"}

@api_router.post("/bills", response_model=Bill)
async def create_bill(bill: BillCreate):
    bill_data = bill.model_dump()
    bill_data['settled'] = bill.balance_amount <= 0
    bill_obj = Bill(**bill_data)
    doc = bill_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.bills.insert_one(doc)
    
    for item in bill.items:
        await db.products.update_one(
            {"id": item.product_id},
            {"$inc": {"stock": -item.quantity}}
        )
    
    if bill.customer_phone:
        customer = await db.customers.find_one({"phone": bill.customer_phone}, {"_id": 0})
        if customer:
            # Only add to balance if cashier explicitly entered a partial payment
            new_balance = customer.get('balance', 0.0) + (bill.balance_amount if bill.balance_amount > 0 else 0)
            await db.customers.update_one(
                {"phone": bill.customer_phone},
                {
                    "$inc": {"total_purchases": bill.total, "visit_count": 1},
                    "$set": {"name": bill.customer_name, "balance": new_balance}
                }
            )
        else:
            new_customer = Customer(
                name=bill.customer_name,
                phone=bill.customer_phone,
                total_purchases=bill.total,
                visit_count=1,
                balance=bill.balance_amount if bill.balance_amount > 0 else 0.0
            )
            customer_doc = new_customer.model_dump()
            customer_doc['created_at'] = customer_doc['created_at'].isoformat()
            await db.customers.insert_one(customer_doc)
    
    return bill_obj

@api_router.get("/bills", response_model=List[Bill])
async def get_bills(
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    query = {}
    
    if search:
        query['$or'] = [
            {'invoice_no': {'$regex': search, '$options': 'i'}},
            {'customer_name': {'$regex': search, '$options': 'i'}},
            {'customer_phone': {'$regex': search, '$options': 'i'}}
        ]
    
    if start_date:
        query['created_at'] = {'$gte': start_date}
    if end_date:
        if 'created_at' not in query:
            query['created_at'] = {}
        query['created_at']['$lte'] = end_date
    
    bills = await db.bills.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for b in bills:
        if isinstance(b.get('created_at'), str):
            b['created_at'] = datetime.fromisoformat(b['created_at'])
        if 'tax_percent' not in b:
            b['tax_percent'] = 18.0
        if 'balance_amount' not in b:
            b['balance_amount'] = 0.0
        if 'settled' not in b:
            b['settled'] = b.get('balance_amount', 0) <= 0
    return bills

@api_router.put("/bills/{bill_id}/settle")
async def settle_bill(bill_id: str, settled: bool = True):
    bill = await db.bills.find_one({"id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    old_settled = bill.get('settled', bill.get('balance_amount', 0) <= 0)
    balance_amount = bill.get('balance_amount', 0)
    
    await db.bills.update_one(
        {"id": bill_id},
        {"$set": {"settled": settled}}
    )
    
    # Adjust customer balance based on settlement change
    if bill.get('customer_phone') and balance_amount > 0 and old_settled != settled:
        delta = -balance_amount if settled else balance_amount
        await db.customers.update_one(
            {"phone": bill['customer_phone']},
            {"$inc": {"balance": delta}}
        )
    
    return {"message": "Bill settlement updated", "settled": settled}

@api_router.get("/customers/{phone}/bills", response_model=List[Bill])
async def get_customer_bills(phone: str):
    bills = await db.bills.find({"customer_phone": phone}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for b in bills:
        if isinstance(b.get('created_at'), str):
            b['created_at'] = datetime.fromisoformat(b['created_at'])
        if 'tax_percent' not in b:
            b['tax_percent'] = 18.0
        if 'balance_amount' not in b:
            b['balance_amount'] = 0.0
        if 'settled' not in b:
            b['settled'] = b.get('balance_amount', 0) <= 0
    return bills

@api_router.put("/customers/{phone}/balance")
async def update_customer_balance(phone: str, balance: float):
    result = await db.customers.update_one(
        {"phone": phone},
        {"$set": {"balance": max(0, balance)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Balance updated", "balance": max(0, balance)}

@api_router.delete("/customers/{phone}")
async def delete_customer(phone: str):
    result = await db.customers.delete_one({"phone": phone})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted"}

@api_router.get("/bills/{bill_id}", response_model=Bill)
async def get_bill(bill_id: str):
    bill = await db.bills.find_one({"id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    if isinstance(bill.get('created_at'), str):
        bill['created_at'] = datetime.fromisoformat(bill['created_at'])
    if 'tax_percent' not in bill:
        bill['tax_percent'] = 18.0
    if 'balance_amount' not in bill:
        bill['balance_amount'] = 0.0
    if 'settled' not in bill:
        bill['settled'] = bill.get('balance_amount', 0) <= 0
    return bill

@api_router.get("/customers", response_model=List[Customer])
async def get_customers(search: Optional[str] = None):
    query = {}
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'phone': {'$regex': search, '$options': 'i'}}
        ]
    customers = await db.customers.find(query, {"_id": 0}).to_list(1000)
    for c in customers:
        if isinstance(c.get('created_at'), str):
            c['created_at'] = datetime.fromisoformat(c['created_at'])
    return customers

@api_router.get("/customers/balance", response_model=List[Customer])
async def get_customers_with_balance():
    customers = await db.customers.find({"balance": {"$gt": 0}}, {"_id": 0}).to_list(1000)
    for c in customers:
        if isinstance(c.get('created_at'), str):
            c['created_at'] = datetime.fromisoformat(c['created_at'])
        if 'balance' not in c:
            c['balance'] = 0.0
    return customers

@api_router.post("/customers/{phone}/pay-balance")
async def pay_customer_balance(phone: str, amount: float):
    customer = await db.customers.find_one({"phone": phone}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    current_balance = customer.get('balance', 0.0)
    new_balance = max(0, current_balance - amount)
    
    await db.customers.update_one(
        {"phone": phone},
        {"$set": {"balance": new_balance}}
    )
    
    return {"message": "Balance updated", "new_balance": new_balance}

@api_router.get("/reports/summary")
async def get_report_summary(
    period: str = "all",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    from datetime import timedelta
    
    query = {}
    if start_date and end_date:
        query['created_at'] = {"$gte": start_date, "$lte": end_date}
    elif period != "all":
        now = datetime.now(timezone.utc)
        if period == "today":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "week":
            start = now - timedelta(days=7)
        elif period == "month":
            start = now - timedelta(days=30)
        else:
            start = None
        
        if start:
            query['created_at'] = {"$gte": start.isoformat()}
    
    bills = await db.bills.find(query, {"_id": 0}).to_list(10000)
    
    total_revenue = sum(b['total'] for b in bills)
    total_bills = len(bills)
    total_tax = sum(b['tax_amount'] for b in bills)
    total_discount = sum(b['discount_amount'] for b in bills)
    
    product_sales = {}
    for bill in bills:
        for item in bill['items']:
            pid = item['product_id']
            if pid not in product_sales:
                product_sales[pid] = {'name': item['name'], 'quantity': 0}
            product_sales[pid]['quantity'] += item['quantity']
    
    top_products = sorted(
        [{'name': v['name'], 'quantity': v['quantity']} for v in product_sales.values()],
        key=lambda x: x['quantity'],
        reverse=True
    )[:5]
    
    payment_breakdown = {}
    for bill in bills:
        method = bill['payment_method']
        payment_breakdown[method] = payment_breakdown.get(method, 0) + bill['total']
    
    return {
        "total_revenue": total_revenue,
        "total_bills": total_bills,
        "total_tax": total_tax,
        "total_discount": total_discount,
        "top_products": top_products,
        "payment_breakdown": payment_breakdown
    }

@api_router.get("/settings", response_model=Settings)
async def get_settings():
    settings = await db.settings.find_one({"id": "settings"}, {"_id": 0})
    if not settings:
        default_settings = Settings()
        doc = default_settings.model_dump()
        await db.settings.insert_one(doc)
        return default_settings
    return settings

@api_router.put("/settings", response_model=Settings)
async def update_settings(update: SettingsUpdate):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    await db.settings.update_one(
        {"id": "settings"},
        {"$set": update_data},
        upsert=True
    )
    
    settings = await db.settings.find_one({"id": "settings"}, {"_id": 0})
    return settings

@api_router.post("/seed")
async def seed_data():
    existing = await db.products.count_documents({})
    if existing > 0:
        return {"message": "Database already seeded"}
    
    initial_products = [
        {"name": "Burger", "category": "Food", "price": 120, "stock": 50, "barcode": "F001", "unit": "pcs", "hsn_code": "21069030"},
        {"name": "Pizza", "category": "Food", "price": 350, "stock": 30, "barcode": "F002", "unit": "pcs", "hsn_code": "21069030"},
        {"name": "Pasta", "category": "Food", "price": 180, "stock": 40, "barcode": "F003", "unit": "pcs", "hsn_code": "19021100"},
        {"name": "Sandwich", "category": "Food", "price": 80, "stock": 60, "barcode": "F004", "unit": "pcs", "hsn_code": "21069030"},
        {"name": "Coffee", "category": "Beverages", "price": 50, "stock": 100, "barcode": "B001", "unit": "cup", "hsn_code": "09011100"},
        {"name": "Tea", "category": "Beverages", "price": 30, "stock": 120, "barcode": "B002", "unit": "cup", "hsn_code": "09021000"},
        {"name": "Coke", "category": "Beverages", "price": 40, "stock": 80, "barcode": "B003", "unit": "bottle", "hsn_code": "22021000"},
        {"name": "Juice", "category": "Beverages", "price": 60, "stock": 70, "barcode": "B004", "unit": "glass", "hsn_code": "20099090"},
        {"name": "Laptop", "category": "Electronics", "price": 45000, "stock": 5, "barcode": "E001", "unit": "pcs", "hsn_code": "84713010"},
        {"name": "Mobile Phone", "category": "Electronics", "price": 15000, "stock": 15, "barcode": "E002", "unit": "pcs", "hsn_code": "85171200"},
        {"name": "Headphones", "category": "Electronics", "price": 2000, "stock": 25, "barcode": "E003", "unit": "pcs", "hsn_code": "85183000"},
        {"name": "Smartwatch", "category": "Electronics", "price": 8000, "stock": 12, "barcode": "E004", "unit": "pcs", "hsn_code": "91021100"},
        {"name": "T-Shirt", "category": "Clothing", "price": 500, "stock": 50, "barcode": "C001", "unit": "pcs", "hsn_code": "61091000"},
        {"name": "Jeans", "category": "Clothing", "price": 1200, "stock": 35, "barcode": "C002", "unit": "pcs", "hsn_code": "62034200"},
        {"name": "Jacket", "category": "Clothing", "price": 2500, "stock": 20, "barcode": "C003", "unit": "pcs", "hsn_code": "62011100"},
        {"name": "Shoes", "category": "Clothing", "price": 1800, "stock": 30, "barcode": "C004", "unit": "pair", "hsn_code": "64039900"},
        {"name": "Paracetamol", "category": "Medicines", "price": 20, "stock": 200, "barcode": "M001", "unit": "strip", "hsn_code": "30049099"},
        {"name": "Cough Syrup", "category": "Medicines", "price": 85, "stock": 100, "barcode": "M002", "unit": "bottle", "hsn_code": "30049099"},
        {"name": "Bandage", "category": "Medicines", "price": 30, "stock": 150, "barcode": "M003", "unit": "roll", "hsn_code": "30059010"},
        {"name": "Vitamin C", "category": "Medicines", "price": 120, "stock": 80, "barcode": "M004", "unit": "bottle", "hsn_code": "29362700"},
        {"name": "Notebook", "category": "Stationery", "price": 40, "stock": 200, "barcode": "S001", "unit": "pcs", "hsn_code": "48201030"},
        {"name": "Pen", "category": "Stationery", "price": 10, "stock": 500, "barcode": "S002", "unit": "pcs", "hsn_code": "96081010"},
        {"name": "Pencil", "category": "Stationery", "price": 5, "stock": 600, "barcode": "S003", "unit": "pcs", "hsn_code": "96091000"},
        {"name": "Eraser", "category": "Stationery", "price": 5, "stock": 400, "barcode": "S004", "unit": "pcs", "hsn_code": "40169990"}
    ]
    
    for p in initial_products:
        product = Product(**p)
        doc = product.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.products.insert_one(doc)
    
    return {"message": f"Seeded {len(initial_products)} products"}

# ── Stock Adjustment Routes ───────────────────────────────────────────────────
@api_router.get("/stock-adjustments", response_model=List[StockAdjustment])
async def get_stock_adjustments(
    product_id: Optional[str] = None,
    limit: int = 100
):
    query = {}
    if product_id:
        query['product_id'] = product_id
    adjustments = await db.stock_adjustments.find(query, {"_id": 0}) \
        .sort("created_at", -1).to_list(limit)
    for a in adjustments:
        if isinstance(a.get('created_at'), str):
            a['created_at'] = datetime.fromisoformat(a['created_at'])
    return adjustments

@api_router.post("/stock-adjustments", response_model=StockAdjustment)
async def create_stock_adjustment(data: StockAdjustmentCreate):
    product = await db.products.find_one({"id": data.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    previous_stock = product.get('stock', 0)
    if data.adjustment_type == "add":
        new_stock = previous_stock + data.quantity
    elif data.adjustment_type == "remove":
        new_stock = max(0, previous_stock - data.quantity)
    elif data.adjustment_type == "set":
        new_stock = data.quantity
    else:
        raise HTTPException(status_code=400, detail="adjustment_type must be 'add', 'remove', or 'set'")

    await db.products.update_one({"id": data.product_id}, {"$set": {"stock": new_stock}})

    adj = StockAdjustment(
        product_id=data.product_id,
        product_name=product['name'],
        adjustment_type=data.adjustment_type,
        quantity=data.quantity,
        previous_stock=previous_stock,
        new_stock=new_stock,
        reason=data.reason
    )
    doc = adj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.stock_adjustments.insert_one(doc)
    return adj

@api_router.delete("/stock-adjustments/{adjustment_id}")
async def delete_stock_adjustment(adjustment_id: str):
    result = await db.stock_adjustments.delete_one({"id": adjustment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Adjustment not found")
    return {"message": "Adjustment deleted"}

# ── Quotation Routes ──────────────────────────────────────────────────────────
@api_router.get("/quotations", response_model=List[Quotation])
async def get_quotations(
    status: Optional[str] = None,
    search: Optional[str] = None
):
    query = {}
    if status:
        query['status'] = status
    if search:
        query['$or'] = [
            {'customer_name': {'$regex': search, '$options': 'i'}},
            {'customer_phone': {'$regex': search, '$options': 'i'}},
            {'quotation_no': {'$regex': search, '$options': 'i'}}
        ]
    quotations = await db.quotations.find(query, {"_id": 0}) \
        .sort("created_at", -1).to_list(1000)
    for q in quotations:
        if isinstance(q.get('created_at'), str):
            q['created_at'] = datetime.fromisoformat(q['created_at'])
    return quotations

@api_router.post("/quotations", response_model=Quotation)
async def create_quotation(data: QuotationCreate):
    quotation = Quotation(**data.model_dump())
    doc = quotation.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.quotations.insert_one(doc)
    return quotation

@api_router.get("/quotations/{quotation_id}", response_model=Quotation)
async def get_quotation(quotation_id: str):
    q = await db.quotations.find_one({"id": quotation_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if isinstance(q.get('created_at'), str):
        q['created_at'] = datetime.fromisoformat(q['created_at'])
    return q

@api_router.put("/quotations/{quotation_id}/status")
async def update_quotation_status(quotation_id: str, status: str):
    valid_statuses = {"pending", "converted", "expired"}
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"status must be one of {valid_statuses}")
    result = await db.quotations.update_one(
        {"id": quotation_id}, {"$set": {"status": status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return {"message": "Status updated", "status": status}

@api_router.delete("/quotations/{quotation_id}")
async def delete_quotation(quotation_id: str):
    result = await db.quotations.delete_one({"id": quotation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return {"message": "Quotation deleted"}

# ── Day-Close Report Route ────────────────────────────────────────────────────
@api_router.get("/reports/day-close")
async def get_day_close_report(date: str):
    """
    Returns a full day-close / Z-report for the given date (YYYY-MM-DD).
    """
    try:
        day_start = datetime.fromisoformat(f"{date}T00:00:00+00:00")
        day_end   = datetime.fromisoformat(f"{date}T23:59:59+00:00")
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be in YYYY-MM-DD format")

    bills = await db.bills.find(
        {"created_at": {"$gte": day_start.isoformat(), "$lte": day_end.isoformat()}},
        {"_id": 0}
    ).to_list(10000)

    total_bills      = len(bills)
    total_revenue    = sum(b['total']           for b in bills)
    total_tax        = sum(b['tax_amount']       for b in bills)
    total_discount   = sum(b['discount_amount']  for b in bills)
    total_cash       = sum(b['total'] for b in bills if b.get('payment_method') == 'cash')
    total_upi        = sum(b['total'] for b in bills if b.get('payment_method') == 'upi')
    total_card       = sum(b['total'] for b in bills if b.get('payment_method') == 'card')
    total_credit     = sum(b['total'] for b in bills if b.get('payment_method') == 'credit')
    total_settled    = sum(b['total'] for b in bills if b.get('settled', True))
    total_unsettled  = sum(b['total'] for b in bills if not b.get('settled', True))

    product_sales: Dict[str, Any] = {}
    for bill in bills:
        for item in bill['items']:
            pid = item['product_id']
            if pid not in product_sales:
                product_sales[pid] = {'name': item['name'], 'quantity': 0, 'revenue': 0.0}
            product_sales[pid]['quantity'] += item['quantity']
            product_sales[pid]['revenue']  += item['price'] * item['quantity']

    top_products = sorted(
        [{'name': v['name'], 'quantity': v['quantity'], 'revenue': v['revenue']}
         for v in product_sales.values()],
        key=lambda x: x['quantity'],
        reverse=True
    )[:10]

    return {
        "date": date,
        "total_bills": total_bills,
        "total_revenue": total_revenue,
        "total_tax": total_tax,
        "total_discount": total_discount,
        "payment_breakdown": {
            "cash": total_cash,
            "upi": total_upi,
            "card": total_card,
            "credit": total_credit
        },
        "settled_amount": total_settled,
        "unsettled_amount": total_unsettled,
        "top_products": top_products,
        "bills": bills
    }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ═══════════════════════════════════════════════════════════════════════════════
# NEW FEATURE MODELS
# ═══════════════════════════════════════════════════════════════════════════════

# ── Supplier & Purchase Order ─────────────────────────────────────────────────
class Supplier(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str = ""
    email: str = ""
    address: str = ""
    gstin: str = ""
    contact_person: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SupplierCreate(BaseModel):
    name: str
    phone: str = ""
    email: str = ""
    address: str = ""
    gstin: str = ""
    contact_person: str = ""

class POItem(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    unit_cost: float
    total_cost: float
    hsn_code: str = ""

class PurchaseOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    po_number: str
    supplier_id: str
    supplier_name: str
    items: List[POItem]
    subtotal: float
    tax_amount: float = 0.0
    total: float
    status: str = "pending"   # pending | received | cancelled
    notes: str = ""
    expected_date: Optional[str] = None
    received_date: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PurchaseOrderCreate(BaseModel):
    po_number: str
    supplier_id: str
    supplier_name: str
    items: List[POItem]
    subtotal: float
    tax_amount: float = 0.0
    total: float
    notes: str = ""
    expected_date: Optional[str] = None

# ── Branch & User ─────────────────────────────────────────────────────────────
class Branch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str = ""
    phone: str = ""
    gstin: str = ""
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BranchCreate(BaseModel):
    name: str
    address: str = ""
    phone: str = ""
    gstin: str = ""

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    username: str
    role: str = "cashier"   # admin | manager | cashier
    branch_id: str = ""
    branch_name: str = ""
    is_active: bool = True
    pin: str = ""            # 4-digit PIN (stored as plain text for simplicity)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    name: str
    username: str
    role: str = "cashier"
    branch_id: str = ""
    branch_name: str = ""
    pin: str = ""

# ── Loyalty Points ────────────────────────────────────────────────────────────
class LoyaltyTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_phone: str
    customer_name: str
    points: int                  # positive = earned, negative = redeemed
    type: str                    # "earned" | "redeemed" | "adjusted"
    reference: str = ""          # invoice_no or description
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LoyaltySettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "loyalty_settings"
    enabled: bool = True
    points_per_rupee: float = 1.0     # points earned per ₹ spent
    rupees_per_point: float = 0.10    # ₹ value of 1 point on redemption
    min_redeem_points: int = 100
    expiry_days: int = 365

# ── P&L Report Expense Categories ────────────────────────────────────────────
class ProfitLossReport(BaseModel):
    period: str
    total_revenue: float
    total_cogs: float
    gross_profit: float
    total_expenses: float
    net_profit: float
    margin_percent: float


# ═══════════════════════════════════════════════════════════════════════════════
# SUPPLIER ROUTES
# ═══════════════════════════════════════════════════════════════════════════════
@api_router.get("/suppliers", response_model=List[Supplier])
async def get_suppliers(search: Optional[str] = None):
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]
    docs = await db.suppliers.find(query, {"_id": 0}).to_list(1000)
    for d in docs:
        if isinstance(d.get("created_at"), str):
            d["created_at"] = datetime.fromisoformat(d["created_at"])
    return docs

@api_router.post("/suppliers", response_model=Supplier)
async def create_supplier(data: SupplierCreate):
    obj = Supplier(**data.model_dump())
    doc = obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.suppliers.insert_one(doc)
    return obj

@api_router.put("/suppliers/{supplier_id}", response_model=Supplier)
async def update_supplier(supplier_id: str, data: SupplierCreate):
    await db.suppliers.update_one({"id": supplier_id}, {"$set": data.model_dump()})
    doc = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Supplier not found")
    if isinstance(doc.get("created_at"), str):
        doc["created_at"] = datetime.fromisoformat(doc["created_at"])
    return doc

@api_router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str):
    result = await db.suppliers.delete_one({"id": supplier_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return {"message": "Supplier deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# PURCHASE ORDER ROUTES
# ═══════════════════════════════════════════════════════════════════════════════
@api_router.get("/purchase-orders", response_model=List[PurchaseOrder])
async def get_purchase_orders(status: Optional[str] = None, supplier_id: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    if supplier_id:
        query["supplier_id"] = supplier_id
    docs = await db.purchase_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for d in docs:
        if isinstance(d.get("created_at"), str):
            d["created_at"] = datetime.fromisoformat(d["created_at"])
    return docs

@api_router.post("/purchase-orders", response_model=PurchaseOrder)
async def create_purchase_order(data: PurchaseOrderCreate):
    obj = PurchaseOrder(**data.model_dump())
    doc = obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.purchase_orders.insert_one(doc)
    return obj

@api_router.put("/purchase-orders/{po_id}/receive")
async def receive_purchase_order(po_id: str):
    po = await db.purchase_orders.find_one({"id": po_id}, {"_id": 0})
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    if po["status"] == "received":
        raise HTTPException(status_code=400, detail="PO already received")
    # Update stock for each item
    for item in po["items"]:
        await db.products.update_one(
            {"id": item["product_id"]},
            {"$inc": {"stock": item["quantity"]}}
        )
        # Log stock adjustment
        from datetime import timezone as tz
        adj = {
            "id": str(uuid.uuid4()),
            "product_id": item["product_id"],
            "product_name": item["product_name"],
            "adjustment_type": "add",
            "quantity": item["quantity"],
            "previous_stock": 0,
            "new_stock": 0,
            "reason": f"Purchase Order {po['po_number']}",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.stock_adjustments.insert_one(adj)
    from datetime import timezone as _tz
    await db.purchase_orders.update_one(
        {"id": po_id},
        {"$set": {"status": "received", "received_date": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "PO received, stock updated"}

@api_router.put("/purchase-orders/{po_id}/cancel")
async def cancel_purchase_order(po_id: str):
    result = await db.purchase_orders.update_one(
        {"id": po_id, "status": "pending"},
        {"$set": {"status": "cancelled"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="PO not found or not pending")
    return {"message": "PO cancelled"}

@api_router.delete("/purchase-orders/{po_id}")
async def delete_purchase_order(po_id: str):
    result = await db.purchase_orders.delete_one({"id": po_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="PO not found")
    return {"message": "PO deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# BRANCH ROUTES
# ═══════════════════════════════════════════════════════════════════════════════
@api_router.get("/branches", response_model=List[Branch])
async def get_branches():
    docs = await db.branches.find({}, {"_id": 0}).to_list(100)
    for d in docs:
        if isinstance(d.get("created_at"), str):
            d["created_at"] = datetime.fromisoformat(d["created_at"])
    return docs

@api_router.post("/branches", response_model=Branch)
async def create_branch(data: BranchCreate):
    obj = Branch(**data.model_dump())
    doc = obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.branches.insert_one(doc)
    return obj

@api_router.put("/branches/{branch_id}", response_model=Branch)
async def update_branch(branch_id: str, data: BranchCreate):
    await db.branches.update_one({"id": branch_id}, {"$set": data.model_dump()})
    doc = await db.branches.find_one({"id": branch_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Branch not found")
    if isinstance(doc.get("created_at"), str):
        doc["created_at"] = datetime.fromisoformat(doc["created_at"])
    return doc

@api_router.delete("/branches/{branch_id}")
async def delete_branch(branch_id: str):
    result = await db.branches.delete_one({"id": branch_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Branch not found")
    return {"message": "Branch deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# USER ROUTES
# ═══════════════════════════════════════════════════════════════════════════════
@api_router.get("/users", response_model=List[User])
async def get_users():
    docs = await db.users.find({}, {"_id": 0}).to_list(200)
    for d in docs:
        if isinstance(d.get("created_at"), str):
            d["created_at"] = datetime.fromisoformat(d["created_at"])
    return docs

@api_router.post("/users", response_model=User)
async def create_user(data: UserCreate):
    existing = await db.users.find_one({"username": data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    obj = User(**data.model_dump())
    doc = obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.users.insert_one(doc)
    return obj

@api_router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, data: UserCreate):
    await db.users.update_one({"id": user_id}, {"$set": data.model_dump()})
    doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    if isinstance(doc.get("created_at"), str):
        doc["created_at"] = datetime.fromisoformat(doc["created_at"])
    return doc

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

@api_router.post("/users/verify-pin")
async def verify_pin(username: str, pin: str):
    user = await db.users.find_one({"username": username, "pin": pin, "is_active": True}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if isinstance(user.get("created_at"), str):
        user["created_at"] = datetime.fromisoformat(user["created_at"])
    return user


# ═══════════════════════════════════════════════════════════════════════════════
# LOYALTY POINTS ROUTES
# ═══════════════════════════════════════════════════════════════════════════════
@api_router.get("/loyalty/settings", response_model=LoyaltySettings)
async def get_loyalty_settings():
    doc = await db.loyalty_settings.find_one({"id": "loyalty_settings"}, {"_id": 0})
    if not doc:
        default = LoyaltySettings()
        await db.loyalty_settings.insert_one(default.model_dump())
        return default
    return doc

@api_router.put("/loyalty/settings", response_model=LoyaltySettings)
async def update_loyalty_settings(data: LoyaltySettings):
    doc = data.model_dump()
    await db.loyalty_settings.update_one({"id": "loyalty_settings"}, {"$set": doc}, upsert=True)
    return data

@api_router.get("/loyalty/customer/{phone}")
async def get_customer_loyalty(phone: str):
    customer = await db.customers.find_one({"phone": phone}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    points = customer.get("loyalty_points", 0)
    txns = await db.loyalty_transactions.find(
        {"customer_phone": phone}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"points": points, "transactions": txns}

@api_router.post("/loyalty/earn")
async def earn_points(customer_phone: str, customer_name: str, bill_total: float, invoice_no: str):
    ls = await db.loyalty_settings.find_one({"id": "loyalty_settings"}, {"_id": 0})
    ppr = ls.get("points_per_rupee", 1.0) if ls else 1.0
    points = int(bill_total * ppr)
    if points <= 0:
        return {"points_earned": 0}
    await db.customers.update_one({"phone": customer_phone}, {"$inc": {"loyalty_points": points}})
    txn = LoyaltyTransaction(
        customer_phone=customer_phone,
        customer_name=customer_name,
        points=points,
        type="earned",
        reference=invoice_no
    )
    doc = txn.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.loyalty_transactions.insert_one(doc)
    return {"points_earned": points}

@api_router.post("/loyalty/redeem")
async def redeem_points(customer_phone: str, customer_name: str, points: int, invoice_no: str):
    customer = await db.customers.find_one({"phone": customer_phone}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    current_points = customer.get("loyalty_points", 0)
    if current_points < points:
        raise HTTPException(status_code=400, detail=f"Insufficient points. Available: {current_points}")
    ls = await db.loyalty_settings.find_one({"id": "loyalty_settings"}, {"_id": 0})
    rpp = ls.get("rupees_per_point", 0.10) if ls else 0.10
    discount_amount = round(points * rpp, 2)
    await db.customers.update_one({"phone": customer_phone}, {"$inc": {"loyalty_points": -points}})
    txn = LoyaltyTransaction(
        customer_phone=customer_phone,
        customer_name=customer_name,
        points=-points,
        type="redeemed",
        reference=invoice_no
    )
    doc = txn.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.loyalty_transactions.insert_one(doc)
    return {"points_redeemed": points, "discount_amount": discount_amount}


# ═══════════════════════════════════════════════════════════════════════════════
# PROFIT & LOSS REPORT ROUTE
# ═══════════════════════════════════════════════════════════════════════════════
@api_router.get("/reports/profit-loss")
async def get_profit_loss(
    period: str = "month",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    from datetime import timedelta
    query: Dict[str, Any] = {}
    if start_date and end_date:
        query["created_at"] = {"$gte": start_date, "$lte": end_date}
    elif period != "all":
        now = datetime.now(timezone.utc)
        if period == "today":
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == "week":
            start = now - timedelta(days=7)
        elif period == "month":
            start = now - timedelta(days=30)
        elif period == "year":
            start = now - timedelta(days=365)
        else:
            start = None
        if start:
            query["created_at"] = {"$gte": start.isoformat()}

    bills = await db.bills.find(query, {"_id": 0}).to_list(100000)
    pos = await db.purchase_orders.find(
        {"status": "received"}, {"_id": 0}
    ).to_list(100000)

    total_revenue = sum(b["total"] for b in bills)
    total_tax_collected = sum(b.get("tax_amount", 0) for b in bills)
    total_discounts = sum(b.get("discount_amount", 0) for b in bills)
    total_cogs = sum(
        sum(item["unit_cost"] * item["quantity"] for item in po["items"])
        for po in pos
    )
    gross_profit = total_revenue - total_cogs
    gross_margin = round((gross_profit / total_revenue * 100), 2) if total_revenue else 0

    # Sum expenses stored in a hypothetical expenses collection (frontend uses localStorage now)
    # We'll return zeros so frontend can add its own localStorage expenses
    total_expenses = 0.0
    net_profit = gross_profit - total_expenses

    # Build daily revenue trend (last 30 days or filtered period)
    from collections import defaultdict
    daily: Dict[str, float] = defaultdict(float)
    for b in bills:
        day = b["created_at"][:10] if isinstance(b["created_at"], str) else b["created_at"].isoformat()[:10]
        daily[day] += b["total"]
    daily_trend = [{"date": k, "revenue": v} for k, v in sorted(daily.items())]

    # Category breakdown
    cat_revenue: Dict[str, float] = defaultdict(float)
    for b in bills:
        for item in b.get("items", []):
            # We don't have category in bill items; group by product name as fallback
            cat_revenue[item.get("name", "Unknown")] += item["price"] * item["quantity"]
    top_items = sorted(
        [{"name": k, "revenue": v} for k, v in cat_revenue.items()],
        key=lambda x: x["revenue"], reverse=True
    )[:10]

    return {
        "period": period,
        "total_revenue": total_revenue,
        "total_cogs": total_cogs,
        "gross_profit": gross_profit,
        "gross_margin_percent": gross_margin,
        "total_tax_collected": total_tax_collected,
        "total_discounts": total_discounts,
        "total_expenses": total_expenses,
        "net_profit": net_profit,
        "total_bills": len(bills),
        "avg_bill_value": round(total_revenue / len(bills), 2) if bills else 0,
        "daily_trend": daily_trend,
        "top_items": top_items,
    }
