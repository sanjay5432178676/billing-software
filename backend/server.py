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
            new_balance = customer.get('balance', 0.0) + bill.balance_amount
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
                balance=bill.balance_amount
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