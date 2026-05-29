import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DISCOUNT_OPTIONS = [0, 5, 10, 15, 20];
const CATEGORIES = ['All', 'Food', 'Beverages', 'Electronics', 'Clothing', 'Medicines', 'Stationery'];
const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Credit', 'Wallet'];
const VIEWS = {
  DASHBOARD: 'dashboard',
  POS: 'pos',
  INVENTORY: 'inventory',
  BILLS: 'bills',
  CUSTOMERS: 'customers',
  REPORTS: 'reports',
  BALANCE: 'balance',
  LOW_STOCK: 'low_stock',
  DAY_CLOSE: 'day_close',
  STOCK_ADJUSTMENTS: 'stock_adjustments',
  QUOTATIONS: 'quotations',
  RETURNS: 'returns',
  EXPENSES: 'expenses',
  SETTINGS: 'settings',
  SUPPLIERS: 'suppliers',
  PURCHASE_ORDERS: 'purchase_orders',
  BRANCHES: 'branches',
  USERS: 'users',
  LOYALTY: 'loyalty',
  ANALYTICS: 'analytics',
  THERMAL_PRINT: 'thermal_print',
  BARCODE_LABELS: 'barcode_labels',
};

const TAX_RATES = [0, 5, 12, 18, 28];

const BillingPOS = () => {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [view, setView] = useState(VIEWS.DASHBOARD);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [heldCarts, setHeldCarts] = useState([]);
  const [bills, setBills] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState({
    shop_name: 'My Shop',
    software_name: 'POS System',
    gstin: '',
    address: '',
    phone: '',
    email: '',
    tax_enabled: true,
    tax_percent: 18,
    auto_print: false,
    low_stock_threshold: 10
  });
  
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [customDiscount, setCustomDiscount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [customerPaid, setCustomerPaid] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  const [billSearch, setBillSearch] = useState('');
  const [billStartDate, setBillStartDate] = useState('');
  const [billEndDate, setBillEndDate] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [balanceSearch, setBalanceSearch] = useState('');
  
  const [customerHistory, setCustomerHistory] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  
  const [notification, setNotification] = useState(null);
  const [showReceipt, setShowReceipt] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({
    name: '', category: 'Food', price: '', stock: '', barcode: '', unit: 'pcs', hsn_code: ''
  });
  const [reportPeriod, setReportPeriod] = useState('all');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportData, setReportData] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dayCloseDate, setDayCloseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dayCloseData, setDayCloseData] = useState(null);
  const [dayCloseLoading, setDayCloseLoading] = useState(false);
  
  // Stock Adjustments state
  const [stockAdjustments, setStockAdjustments] = useState([]);
  const [adjProduct, setAdjProduct] = useState('');
  const [adjType, setAdjType] = useState('add');
  const [adjQty, setAdjQty] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjLoading, setAdjLoading] = useState(false);

  // Quotations state
  const [quotations, setQuotations] = useState([]);
  const [quotCart, setQuotCart] = useState([]);
  const [quotCustomerName, setQuotCustomerName] = useState('');
  const [quotCustomerPhone, setQuotCustomerPhone] = useState('');
  const [quotDiscount, setQuotDiscount] = useState(0);
  const [quotValidUntil, setQuotValidUntil] = useState('');
  const [quotNotes, setQuotNotes] = useState('');
  const [showQuotation, setShowQuotation] = useState(null);
  const [quotSearch, setQuotSearch] = useState('');

  // Dashboard state
  const [dashData, setDashData] = useState(null);

  // Returns state
  const [returnBillNo, setReturnBillNo] = useState('');
  const [returnBill, setReturnBill] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState('');
  const [returnLoading, setReturnLoading] = useState(false);
  const [returns, setReturns] = useState(() => JSON.parse(localStorage.getItem('pos_returns') || '[]'));

  // Expenses state
  const [expenses, setExpenses] = useState(() => JSON.parse(localStorage.getItem('pos_expenses') || '[]'));
  const [expenseForm, setExpenseForm] = useState({ category: 'Rent', amount: '', description: '', date: new Date().toISOString().slice(0,10) });
  const [expenseSearch, setExpenseSearch] = useState('');
  const EXPENSE_CATEGORIES = ['Rent', 'Electricity', 'Salary', 'Purchase', 'Transport', 'Maintenance', 'Other'];

  // Suppliers & Purchase Orders
  const [suppliers, setSuppliers] = useState([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierForm, setSupplierForm] = useState({ name:'', phone:'', email:'', address:'', gstin:'', contact_person:'' });
  const [editSupplier, setEditSupplier] = useState(null);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [poForm, setPoForm] = useState({ supplier_id:'', supplier_name:'', notes:'', expected_date:'', items:[] });
  const [poProductSearch, setPoProductSearch] = useState('');
  const [poView, setPoView] = useState('list');
  const [poFilter, setPoFilter] = useState('all');

  // Branches & Users
  const [branches, setBranches] = useState([]);
  const [branchForm, setBranchForm] = useState({ name:'', address:'', phone:'', gstin:'' });
  const [editBranch, setEditBranch] = useState(null);
  const [appUsers, setAppUsers] = useState([]);
  const [userForm, setUserForm] = useState({ name:'', username:'', role:'cashier', branch_id:'', branch_name:'', pin:'' });
  const [editUser, setEditUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(() => JSON.parse(localStorage.getItem('pos_current_user') || 'null'));
  const [loginForm, setLoginForm] = useState({ username:'', pin:'' });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [multibranchTab, setMultibranchTab] = useState('branches');

  // Loyalty
  const [loyaltySettings, setLoyaltySettings] = useState({ enabled:true, points_per_rupee:1.0, rupees_per_point:0.10, min_redeem_points:100, expiry_days:365 });
  const [loyaltyInfo, setLoyaltyInfo] = useState(null);
  const [redeemPoints, setRedeemPoints] = useState('');
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);

  // Analytics / P&L
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('month');
  const [analyticsStart, setAnalyticsStart] = useState('');
  const [analyticsEnd, setAnalyticsEnd] = useState('');

  // Thermal Print
  const [thermalWidth, setThermalWidth] = useState(() => localStorage.getItem('thermal_width') || '80');
  const [thermalFont, setThermalFont] = useState(() => localStorage.getItem('thermal_font') || '12');

  // Barcode Labels
  const [barcodeProducts, setBarcodeProducts] = useState([]);
  const [barcodeSearch, setBarcodeSearchState] = useState('');
  const [barcodeQty, setBarcodeQty] = useState({});
  const [labelSize, setLabelSize] = useState('small');

  const barcodeRef = useRef(null);

  useEffect(() => {
    loadData();
    seedDataIfEmpty();
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  useEffect(() => {
    if (view === VIEWS.POS && barcodeRef.current) {
      barcodeRef.current.focus();
    }
  }, [view]);

  useEffect(() => {
    if (view === VIEWS.REPORTS) {
      fetchReportData();
    }
  }, [view, reportPeriod, reportStartDate, reportEndDate]);

  useEffect(() => {
    if (view === VIEWS.DAY_CLOSE) {
      fetchDayClose();
    }
  }, [view, dayCloseDate]);

  useEffect(() => {
    if (view === VIEWS.STOCK_ADJUSTMENTS) {
      fetchStockAdjustments();
    }
  }, [view]);

  useEffect(() => {
    if (view === VIEWS.QUOTATIONS) {
      fetchQuotations();
    }
  }, [view]);

  useEffect(() => {
    if (view === VIEWS.DASHBOARD) {
      fetchDashboard();
    }
  }, [view]);

  useEffect(() => {
    if (view === VIEWS.BILLS) {
      fetchBills();
    }
  }, [view, billSearch, billStartDate, billEndDate]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      switch(e.key) {
        case 'F1': e.preventDefault(); setView(VIEWS.DASHBOARD); break;
        case 'F2': e.preventDefault(); setView(VIEWS.POS); break;
        case 'F3': e.preventDefault(); setView(VIEWS.BILLS); break;
        case 'F4': e.preventDefault(); setView(VIEWS.INVENTORY); break;
        case 'F5': e.preventDefault(); setView(VIEWS.CUSTOMERS); break;
        case 'F6': e.preventDefault(); setView(VIEWS.QUOTATIONS); break;
        case 'F7': e.preventDefault(); setView(VIEWS.RETURNS); break;
        case 'F8': e.preventDefault(); setView(VIEWS.EXPENSES); break;
        case 'F9': e.preventDefault(); setView(VIEWS.REPORTS); break;
        case 'Escape': setShowReceipt(null); setEditProduct(null); setCustomerHistory(null); setEditingCustomer(null); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    if (view === VIEWS.CUSTOMERS) {
      fetchCustomers();
    }
  }, [view, customerSearch]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (view === VIEWS.SUPPLIERS) fetchSuppliers();
    if (view === VIEWS.PURCHASE_ORDERS) { fetchSuppliers(); fetchPurchaseOrders(); }
    if (view === VIEWS.BRANCHES || view === VIEWS.USERS) { fetchBranches(); fetchAppUsers(); }
    if (view === VIEWS.LOYALTY) fetchLoyaltySettings();
    if (view === VIEWS.ANALYTICS) fetchAnalytics();
    if (view === VIEWS.BARCODE_LABELS) setBarcodeProducts(products);
  }, [view]);

  useEffect(() => {
    if (view === VIEWS.ANALYTICS) fetchAnalytics();
  }, [analyticsPeriod, analyticsStart, analyticsEnd]);

  useEffect(() => {
    if (customerPhone && customerPhone.length >= 10 && loyaltySettings.enabled) {
      fetchLoyaltyInfo(customerPhone);
    } else {
      setLoyaltyInfo(null);
      setLoyaltyDiscount(0);
      setRedeemPoints('');
    }
  }, [customerPhone]);

  const loadData = async () => {
    try {
      const [productsRes, billsRes, customersRes, settingsRes, heldCartsRes] = await Promise.all([
        axios.get(`${API}/products`),
        axios.get(`${API}/bills`),
        axios.get(`${API}/customers`),
        axios.get(`${API}/settings`),
        axios.get(`${API}/carts/held`)
      ]);
      setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
      setBills(Array.isArray(billsRes.data) ? billsRes.data : []);
      setCustomers(Array.isArray(customersRes.data) ? customersRes.data : []);
      setSettings(settingsRes.data && typeof settingsRes.data === 'object' ? settingsRes.data : settings);
      setHeldCarts(Array.isArray(heldCartsRes.data) ? heldCartsRes.data : []);
    } catch (error) {
      console.error('Load data error:', error);
      showNotification('Error loading data - check backend connection', 'error');
    }
  };

  const seedDataIfEmpty = async () => {
    if (!BACKEND_URL) return;
    try {
      await axios.post(`${API}/seed`);
      loadData();
    } catch (error) {
      console.log('Seed error (already seeded)');
    }
  };

  const fetchReportData = async () => {
    try {
      const params = {};
      if (reportStartDate && reportEndDate) {
        params.start_date = new Date(reportStartDate).toISOString();
        params.end_date = new Date(reportEndDate + 'T23:59:59').toISOString();
      } else {
        params.period = reportPeriod;
      }
      const res = await axios.get(`${API}/reports/summary`, { params });
      setReportData(res.data);
    } catch (error) {
      showNotification('Error fetching report', 'error');
    }
  };

  const fetchDayClose = async () => {
    setDayCloseLoading(true);
    try {
      const res = await axios.get(`${API}/reports/day-close`, { params: { date: dayCloseDate } });
      setDayCloseData(res.data);
    } catch (error) {
      showNotification('Error fetching day close report', 'error');
      setDayCloseData(null);
    } finally {
      setDayCloseLoading(false);
    }
  };

  const exportDayClose = () => {
    if (!dayCloseData) return;
    const rows = (dayCloseData.bills || []).map(b => ({
      Invoice: b.invoice_no,
      Customer: b.customer_name || '-',
      Phone: b.customer_phone || '-',
      Items: b.items.length,
      Subtotal: b.subtotal,
      Discount: b.discount_amount,
      Tax: b.tax_amount,
      Total: b.total,
      Payment: b.payment_method,
      Settled: b.settled ? 'Yes' : 'No',
      Time: new Date(b.created_at).toLocaleTimeString()
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Day Close');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf]), `day-close-${dayCloseDate}.xlsx`);
  };

  const fetchDashboard = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [summaryRes, dayRes, customersRes, productsRes, billsRes] = await Promise.all([
        axios.get(`${API}/reports/summary`, { params: { period: 'today' } }),
        axios.get(`${API}/reports/day-close`, { params: { date: today } }),
        axios.get(`${API}/customers`),
        axios.get(`${API}/products`),
        axios.get(`${API}/bills`)
      ]);
      setDashData({
        today: summaryRes.data,
        dayClose: dayRes.data,
        totalCustomers: customersRes.data.length,
        totalProducts: productsRes.data.length,
        outstandingBalance: billsRes.data.filter(b => !b.settled && b.balance_amount > 0).reduce((s, b) => s + (b.balance_amount || 0), 0),
        lowStockCount: productsRes.data.filter(p => p.stock <= 10 && p.stock > 0).length,
        outOfStock: productsRes.data.filter(p => p.stock === 0).length,
      });
    } catch (error) {
      console.error('Dashboard error:', error);
    }
  };

  const fetchStockAdjustments = async () => {
    try {
      const res = await axios.get(`${API}/stock-adjustments`);
      setStockAdjustments(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      showNotification('Error fetching adjustments', 'error');
    }
  };

  const handleStockAdjustment = async () => {
    if (!adjProduct || !adjQty) {
      showNotification('Select product and enter quantity', 'error');
      return;
    }
    setAdjLoading(true);
    try {
      await axios.post(`${API}/stock-adjustments`, {
        product_id: adjProduct,
        adjustment_type: adjType,
        quantity: parseInt(adjQty),
        reason: adjReason
      });
      showNotification('Stock adjusted successfully', 'success');
      setAdjProduct('');
      setAdjQty('');
      setAdjReason('');
      await fetchStockAdjustments();
      await loadData();
    } catch (error) {
      showNotification('Error adjusting stock', 'error');
    } finally {
      setAdjLoading(false);
    }
  };

  const fetchQuotations = async () => {
    try {
      const res = await axios.get(`${API}/quotations`);
      setQuotations(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      showNotification('Error fetching quotations', 'error');
    }
  };

  const addToQuotCart = (product) => {
    const existing = quotCart.find(i => i.product_id === product.id);
    if (existing) {
      setQuotCart(quotCart.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setQuotCart([...quotCart, { product_id: product.id, name: product.name, price: product.price, quantity: 1, hsn_code: product.hsn_code || '' }]);
    }
  };

  const calculateQuotation = () => {
    const subtotal = quotCart.reduce((s, i) => s + i.price * i.quantity, 0);
    const discountAmount = subtotal * (quotDiscount / 100);
    const taxable = subtotal - discountAmount;
    const taxAmount = settings.tax_enabled ? taxable * (settings.tax_percent / 100) : 0;
    const total = taxable + taxAmount;
    return { subtotal, discountAmount, taxAmount, total };
  };

  const handleCreateQuotation = async () => {
    if (quotCart.length === 0) { showNotification('Add items to quotation', 'error'); return; }
    const { subtotal, discountAmount, taxAmount, total } = calculateQuotation();
    const quotNo = 'QT-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.floor(Math.random()*10000).toString().padStart(4,'0');
    try {
      const res = await axios.post(`${API}/quotations`, {
        quotation_no: quotNo,
        items: quotCart,
        subtotal,
        discount_percent: quotDiscount,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        tax_percent: settings.tax_percent,
        total,
        customer_name: quotCustomerName,
        customer_phone: quotCustomerPhone,
        valid_until: quotValidUntil || null,
        notes: quotNotes
      });
      showNotification('Quotation created!', 'success');
      setShowQuotation(res.data);
      setQuotCart([]);
      setQuotCustomerName('');
      setQuotCustomerPhone('');
      setQuotDiscount(0);
      setQuotValidUntil('');
      setQuotNotes('');
      fetchQuotations();
    } catch (error) {
      showNotification('Error creating quotation', 'error');
    }
  };

  const handleConvertQuotation = async (quotation) => {
    setCart(quotation.items);
    setCustomerName(quotation.customer_name || '');
    setCustomerPhone(quotation.customer_phone || '');
    await axios.put(`${API}/quotations/${quotation.id}/status`, null, { params: { status: 'converted' } });
    fetchQuotations();
    setView(VIEWS.POS);
    showNotification('Quotation loaded into POS!', 'success');
  };

  const handleDeleteQuotation = async (id) => {
    if (!window.confirm('Delete this quotation?')) return;
    try {
      await axios.delete(`${API}/quotations/${id}`);
      showNotification('Quotation deleted', 'success');
      fetchQuotations();
    } catch (error) {
      showNotification('Error deleting quotation', 'error');
    }
  };

  const downloadBillPDF = (bill) => {
    const win = window.open('', '_blank');
    const shopName = (typeof settings !== 'undefined' && settings.shop_name) ? settings.shop_name : 'Shop';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Invoice ${bill.invoice_no}</title>
    <style>
      body{font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:20px;font-size:13px;}
      h2{text-align:center;margin:0 0 4px;}
      .center{text-align:center;} .bold{font-weight:bold;}
      table{width:100%;border-collapse:collapse;margin:12px 0;}
      th,td{padding:6px 4px;border-bottom:1px solid #eee;text-align:left;}
      th{background:#f5f5f5;}
      .total-row{font-weight:bold;font-size:15px;}
      .divider{border-top:1px dashed #999;margin:10px 0;}
      .right{text-align:right;}
      @media print{body{max-width:100%;}}
    </style></head><body>
    <h2>${shopName}</h2>
    <div class="center">${settings.gstin ? 'GSTIN: ' + settings.gstin + '<br/>' : ''}${settings.address || ''}<br/>${settings.phone ? 'Ph: ' + settings.phone : ''}</div>
    <div class="divider"></div>
    <div><span class="bold">Invoice:</span> ${bill.invoice_no}</div>
    <div><span class="bold">Date:</span> ${new Date(bill.created_at).toLocaleString()}</div>
    ${bill.customer_name ? '<div><span class="bold">Customer:</span> ' + bill.customer_name + '</div>' : ''}
    ${bill.customer_phone ? '<div><span class="bold">Phone:</span> ' + bill.customer_phone + '</div>' : ''}
    <div class="divider"></div>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th class="right">Amt</th></tr></thead>
    <tbody>${bill.items.map(i => `<tr><td>${i.name}${i.hsn_code ? '<br/><small>HSN: ' + i.hsn_code + '</small>' : ''}</td><td>${i.quantity}</td><td>₹${i.price.toFixed(2)}</td><td class="right">₹${(i.price * i.quantity).toFixed(2)}</td></tr>`).join('')}</tbody></table>
    <div class="divider"></div>
    <table>
      <tr><td>Subtotal</td><td class="right">₹${bill.subtotal.toFixed(2)}</td></tr>
      ${bill.discount_amount > 0 ? '<tr><td>Discount (' + bill.discount_percent + '%)</td><td class="right">- ₹' + bill.discount_amount.toFixed(2) + '</td></tr>' : ''}
      ${bill.tax_amount > 0 ? '<tr><td>GST (' + bill.tax_percent + '%)</td><td class="right">₹' + bill.tax_amount.toFixed(2) + '</td></tr>' : ''}
      <tr class="total-row"><td>TOTAL</td><td class="right">₹${bill.total.toFixed(2)}</td></tr>
      ${bill.balance_amount > 0 ? '<tr><td style="color:red">Balance Due</td><td class="right" style="color:red">₹' + bill.balance_amount.toFixed(2) + '</td></tr>' : ''}
      <tr><td>Payment</td><td class="right">${bill.payment_method}</td></tr>
    </table>
    <div class="divider"></div>
    <div class="center">Thank you for your business!<br/><small>Powered by SS Technologies</small></div>
    </body></html>`;
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  const searchReturnBill = async () => {
    if (!returnBillNo.trim()) { showNotification('Enter invoice number', 'error'); return; }
    setReturnLoading(true);
    try {
      const res = await axios.get(`${API}/bills`, { params: { search: returnBillNo } });
      const found = res.data.find(b => b.invoice_no.toLowerCase() === returnBillNo.toLowerCase());
      if (found) {
        setReturnBill(found);
        setReturnItems(found.items.map(i => ({ ...i, return_qty: 0 })));
      } else {
        showNotification('Bill not found', 'error');
        setReturnBill(null);
      }
    } catch (e) {
      showNotification('Error searching bill', 'error');
    } finally {
      setReturnLoading(false);
    }
  };

  const processReturn = async () => {
    const itemsToReturn = returnItems.filter(i => i.return_qty > 0);
    if (itemsToReturn.length === 0) { showNotification('Select items to return', 'error'); return; }
    const refundAmount = itemsToReturn.reduce((s, i) => s + i.price * i.return_qty, 0);
    const returnRecord = {
      id: Date.now().toString(),
      original_invoice: returnBill.invoice_no,
      return_no: 'RET-' + Date.now(),
      items: itemsToReturn,
      refund_amount: refundAmount,
      reason: returnReason,
      customer_name: returnBill.customer_name,
      customer_phone: returnBill.customer_phone,
      created_at: new Date().toISOString()
    };
    for (const item of itemsToReturn) {
      await axios.post(`${API}/stock-adjustments`, {
        product_id: item.product_id,
        adjustment_type: 'add',
        quantity: item.return_qty,
        reason: `Return from ${returnBill.invoice_no}`
      });
    }
    const updated = [returnRecord, ...returns];
    setReturns(updated);
    localStorage.setItem('pos_returns', JSON.stringify(updated));
    showNotification(`Return processed! Refund: ₹${refundAmount.toFixed(2)}`, 'success');
    setReturnBill(null);
    setReturnBillNo('');
    setReturnItems([]);
    setReturnReason('');
    await loadData();
  };

  const addExpense = () => {
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
      showNotification('Enter valid amount', 'error'); return;
    }
    const expense = { id: Date.now().toString(), ...expenseForm, amount: parseFloat(expenseForm.amount) };
    const updated = [expense, ...expenses];
    setExpenses(updated);
    localStorage.setItem('pos_expenses', JSON.stringify(updated));
    setExpenseForm({ category: 'Rent', amount: '', description: '', date: new Date().toISOString().slice(0,10) });
    showNotification('Expense added', 'success');
  };

  const deleteExpense = (id) => {
    const updated = expenses.filter(e => e.id !== id);
    setExpenses(updated);
    localStorage.setItem('pos_expenses', JSON.stringify(updated));
    showNotification('Expense deleted', 'success');
  };

  const exportExpenses = () => {
    const data = expenses.map(e => ({ Date: e.date, Category: e.category, Description: e.description, Amount: e.amount }));
    exportToExcel(data, 'expenses');
    showNotification('Expenses exported', 'success');
  };

  const fetchBills = async () => {
    try {
      const params = {};
      if (billSearch) params.search = billSearch;
      if (billStartDate) params.start_date = new Date(billStartDate).toISOString();
      if (billEndDate) params.end_date = new Date(billEndDate + 'T23:59:59').toISOString();
      const res = await axios.get(`${API}/bills`, { params });
      setBills(res.data);
    } catch (error) {
      showNotification('Error fetching bills', 'error');
    }
  };

  const fetchCustomers = async () => {
    try {
      const params = customerSearch ? { search: customerSearch } : {};
      const res = await axios.get(`${API}/customers`, { params });
      setCustomers(res.data);
    } catch (error) {
      showNotification('Error fetching customers', 'error');
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const generateInvoiceNo = () => {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${dateStr}-${randomNum}`;
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toFixed(2)}`;
  };

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.product_id === product.id);
    if (existingItem) {
      updateQuantity(product.id, existingItem.quantity + 1);
    } else {
      setCart([...cart, {
        product_id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        hsn_code: product.hsn_code
      }]);
    }
    showNotification(`${product.name} added to cart`);
  };

  const updateQuantity = (productId, newQty) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(cart.map(item =>
      item.product_id === productId ? { ...item, quantity: newQty } : item
    ));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const handleBarcodeSearch = async (e) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      try {
        const res = await axios.get(`${API}/products`, { params: { barcode: barcodeInput } });
        if (res.data.length > 0) {
          addToCart(res.data[0]);
          setBarcodeInput('');
        } else {
          showNotification('Product not found', 'error');
        }
      } catch (error) {
        showNotification('Error searching product', 'error');
      }
    }
  };

  const calculateBill = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = parseFloat(customDiscount) || discountPercent;
    const discountAmount = subtotal * (discount / 100);
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = settings.tax_enabled ? taxableAmount * (settings.tax_percent / 100) : 0;
    const total = taxableAmount + taxAmount;
    
    return { subtotal, discountAmount, taxAmount, total, discount };
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      showNotification('Cart is empty', 'error');
      return;
    }

    const { subtotal, discountAmount, taxAmount, total, discount } = calculateBill();
    const effectiveTotal = Math.max(0, total - loyaltyDiscount);
    const paidEntry = customerPaid.toString().trim();
    const paid = paidEntry === '' ? effectiveTotal : (parseFloat(paidEntry) || 0);

    let finalBalanceAmount = 0;
    let finalCashReceived = 0;
    let finalChangeGiven = 0;

    if (paidEntry === '' || paid >= effectiveTotal) {
      finalCashReceived = paid;
      finalChangeGiven = Math.max(0, paid - effectiveTotal);
      finalBalanceAmount = 0;
    } else {
      finalCashReceived = paid;
      finalBalanceAmount = effectiveTotal - paid;
      finalChangeGiven = 0;
      if (!customerPhone) {
        showNotification('Customer phone required for partial payment', 'error');
        return;
      }
    }

    try {
      const invoiceNo = generateInvoiceNo();
      const billData = {
        invoice_no: invoiceNo,
        items: cart,
        subtotal,
        discount_percent: discount,
        discount_amount: discountAmount + loyaltyDiscount,
        tax_amount: taxAmount,
        tax_percent: settings.tax_percent,
        total: effectiveTotal,
        payment_method: paymentMethod,
        cash_received: finalCashReceived,
        change_given: finalChangeGiven,
        balance_amount: finalBalanceAmount,
        settled: finalBalanceAmount <= 0,
        customer_name: customerName,
        customer_phone: customerPhone
      };

      const res = await axios.post(`${API}/bills`, billData);
      showNotification('Bill generated successfully', 'success');
      setShowReceipt(res.data);

      if (customerPhone && loyaltySettings.enabled) {
        const earnPhone = customerPhone;
        const earnName = customerName || 'Customer';
        if (loyaltyDiscount > 0 && redeemPoints) {
          try { await axios.post(`${API}/loyalty/redeem`, null, { params: { customer_phone: earnPhone, customer_name: earnName, points: parseInt(redeemPoints), invoice_no: invoiceNo } }); } catch(e) {}
        }
        try { await axios.post(`${API}/loyalty/earn`, null, { params: { customer_phone: earnPhone, customer_name: earnName, bill_total: effectiveTotal, invoice_no: invoiceNo } }); } catch(e) {}
      }

      setCart([]);
      setDiscountPercent(0);
      setCustomDiscount('');
      setCustomerPaid('');
      setCustomerName('');
      setCustomerPhone('');
      setLoyaltyDiscount(0);
      setRedeemPoints('');
      setLoyaltyInfo(null);
      
      await loadData();
      
      if (settings.auto_print) {
        setTimeout(() => window.print(), 500);
      }
    } catch (error) {
      showNotification('Error generating bill', 'error');
    }
  };

  const handleHoldCart = async () => {
    if (cart.length === 0) {
      showNotification('Cart is empty', 'error');
      return;
    }

    try {
      await axios.post(`${API}/carts/hold`, {
        items: cart,
        customer_name: customerName,
        customer_phone: customerPhone
      });
      showNotification('Cart held successfully', 'success');
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      loadData();
    } catch (error) {
      showNotification('Error holding cart', 'error');
    }
  };

  const handleResumeCart = async (heldCart) => {
    setCart(heldCart.items);
    setCustomerName(heldCart.customer_name || '');
    setCustomerPhone(heldCart.customer_phone || '');
    try {
      await axios.delete(`${API}/carts/held/${heldCart.id}`);
      loadData();
      showNotification('Cart resumed', 'success');
    } catch (error) {
      showNotification('Error resuming cart', 'error');
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.price || !newProduct.stock || !newProduct.barcode) {
      showNotification('Please fill all required fields', 'error');
      return;
    }

    try {
      await axios.post(`${API}/products`, {
        ...newProduct,
        price: parseFloat(newProduct.price),
        stock: parseInt(newProduct.stock)
      });
      showNotification('Product added successfully', 'success');
      setNewProduct({ name: '', category: 'Food', price: '', stock: '', barcode: '', unit: 'pcs', hsn_code: '' });
      loadData();
    } catch (error) {
      showNotification('Error adding product', 'error');
    }
  };

  const handleUpdateProduct = async () => {
    if (!editProduct) return;

    try {
      await axios.put(`${API}/products/${editProduct.id}`, {
        name: editProduct.name,
        category: editProduct.category,
        price: parseFloat(editProduct.price),
        stock: parseInt(editProduct.stock),
        barcode: editProduct.barcode,
        unit: editProduct.unit,
        hsn_code: editProduct.hsn_code
      });
      showNotification('Product updated successfully', 'success');
      setEditProduct(null);
      loadData();
    } catch (error) {
      showNotification('Error updating product', 'error');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      await axios.delete(`${API}/products/${productId}`);
      showNotification('Product deleted successfully', 'success');
      loadData();
    } catch (error) {
      showNotification('Error deleting product', 'error');
    }
  };

  const handleUpdateSettings = async () => {
    try {
      await axios.put(`${API}/settings`, settings);
      showNotification('Settings updated successfully', 'success');
    } catch (error) {
      showNotification('Error updating settings', 'error');
    }
  };

  const sendWhatsAppReminder = (customer) => {
    const message = encodeURIComponent(
      `Hello ${customer.name},\n\nThis is a reminder about your pending balance of ${formatCurrency(customer.balance)} at ${settings.shop_name}.\n\nPlease clear the balance at your earliest convenience.\n\nThank you!`
    );
    window.open(`https://wa.me/${customer.phone}?text=${message}`, '_blank');
  };

  const fetchSuppliers = async () => {
    try {
      const res = await axios.get(`${API}/suppliers`);
      setSuppliers(Array.isArray(res.data) ? res.data : []);
    } catch (e) { showNotification('Error fetching suppliers', 'error'); }
  };

  const handleSaveSupplier = async () => {
    if (!supplierForm.name) { showNotification('Supplier name required', 'error'); return; }
    try {
      if (editSupplier) {
        await axios.put(`${API}/suppliers/${editSupplier.id}`, supplierForm);
        setEditSupplier(null);
      } else {
        await axios.post(`${API}/suppliers`, supplierForm);
      }
      setSupplierForm({ name:'', phone:'', email:'', address:'', gstin:'', contact_person:'' });
      showNotification('Supplier saved', 'success');
      fetchSuppliers();
    } catch (e) { showNotification('Error saving supplier', 'error'); }
  };

  const handleDeleteSupplier = async (id) => {
    if (!window.confirm('Delete this supplier?')) return;
    await axios.delete(`${API}/suppliers/${id}`);
    showNotification('Supplier deleted', 'success');
    fetchSuppliers();
  };

  const fetchPurchaseOrders = async () => {
    try {
      const params = poFilter !== 'all' ? { status: poFilter } : {};
      const res = await axios.get(`${API}/purchase-orders`, { params });
      setPurchaseOrders(Array.isArray(res.data) ? res.data : []);
    } catch (e) { showNotification('Error fetching purchase orders', 'error'); }
  };

  const addPoItem = (product) => {
    const exists = poForm.items.find(i => i.product_id === product.id);
    if (exists) {
      setPoForm(f => ({ ...f, items: f.items.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1, total_cost: (i.quantity + 1) * i.unit_cost } : i) }));
    } else {
      setPoForm(f => ({ ...f, items: [...f.items, { product_id: product.id, product_name: product.name, quantity: 1, unit_cost: product.price * 0.7, total_cost: product.price * 0.7, hsn_code: product.hsn_code || '' }] }));
    }
  };

  const updatePoItem = (pid, field, val) => {
    setPoForm(f => ({ ...f, items: f.items.map(i => {
      if (i.product_id !== pid) return i;
      const updated = { ...i, [field]: parseFloat(val) || 0 };
      updated.total_cost = updated.quantity * updated.unit_cost;
      return updated;
    })}));
  };

  const removePoItem = (pid) => {
    setPoForm(f => ({ ...f, items: f.items.filter(i => i.product_id !== pid) }));
  };

  const handleCreatePO = async () => {
    if (!poForm.supplier_id || poForm.items.length === 0) { showNotification('Select supplier and add items', 'error'); return; }
    const subtotal = poForm.items.reduce((s, i) => s + i.total_cost, 0);
    const poNumber = 'PO-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.floor(Math.random()*10000).toString().padStart(4,'0');
    try {
      await axios.post(`${API}/purchase-orders`, { ...poForm, po_number: poNumber, subtotal, total: subtotal });
      showNotification('Purchase order created!', 'success');
      setPoForm({ supplier_id:'', supplier_name:'', notes:'', expected_date:'', items:[] });
      setPoView('list');
      fetchPurchaseOrders();
    } catch (e) { showNotification('Error creating PO', 'error'); }
  };

  const handleReceivePO = async (id) => {
    if (!window.confirm('Mark this PO as received? This will update inventory stock.')) return;
    try {
      await axios.put(`${API}/purchase-orders/${id}/receive`);
      showNotification('PO received! Stock updated.', 'success');
      fetchPurchaseOrders();
      loadData();
    } catch (e) { showNotification(e.response?.data?.detail || 'Error receiving PO', 'error'); }
  };

  const handleCancelPO = async (id) => {
    if (!window.confirm('Cancel this purchase order?')) return;
    try {
      await axios.put(`${API}/purchase-orders/${id}/cancel`);
      showNotification('PO cancelled', 'success');
      fetchPurchaseOrders();
    } catch (e) { showNotification('Error cancelling PO', 'error'); }
  };

  const fetchBranches = async () => {
    try {
      const res = await axios.get(`${API}/branches`);
      setBranches(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.error(e); }
  };

  const fetchAppUsers = async () => {
    try {
      const res = await axios.get(`${API}/users`);
      setAppUsers(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.error(e); }
  };

  const handleSaveBranch = async () => {
    if (!branchForm.name) { showNotification('Branch name required', 'error'); return; }
    try {
      if (editBranch) {
        await axios.put(`${API}/branches/${editBranch.id}`, branchForm);
        setEditBranch(null);
      } else {
        await axios.post(`${API}/branches`, branchForm);
      }
      setBranchForm({ name:'', address:'', phone:'', gstin:'' });
      showNotification('Branch saved', 'success');
      fetchBranches();
    } catch (e) { showNotification('Error saving branch', 'error'); }
  };

  const handleDeleteBranch = async (id) => {
    if (!window.confirm('Delete this branch?')) return;
    await axios.delete(`${API}/branches/${id}`);
    showNotification('Branch deleted', 'success');
    fetchBranches();
  };

  const handleSaveUser = async () => {
    if (!userForm.name || !userForm.username) { showNotification('Name and username required', 'error'); return; }
    if (!userForm.pin || userForm.pin.length !== 4) { showNotification('4-digit PIN required', 'error'); return; }
    try {
      if (editUser) {
        await axios.put(`${API}/users/${editUser.id}`, userForm);
        setEditUser(null);
      } else {
        await axios.post(`${API}/users`, userForm);
      }
      setUserForm({ name:'', username:'', role:'cashier', branch_id:'', branch_name:'', pin:'' });
      showNotification('User saved', 'success');
      fetchAppUsers();
    } catch (e) { showNotification(e.response?.data?.detail || 'Error saving user', 'error'); }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    await axios.delete(`${API}/users/${id}`);
    showNotification('User deleted', 'success');
    fetchAppUsers();
  };

  const handleLogin = async () => {
    if (!loginForm.username || !loginForm.pin) { showNotification('Enter username and PIN', 'error'); return; }
    try {
      const res = await axios.post(`${API}/users/verify-pin`, null, { params: { username: loginForm.username, pin: loginForm.pin } });
      setCurrentUser(res.data);
      localStorage.setItem('pos_current_user', JSON.stringify(res.data));
      setShowLoginModal(false);
      setLoginForm({ username:'', pin:'' });
      showNotification(`Welcome, ${res.data.name}!`, 'success');
    } catch (e) { showNotification('Invalid username or PIN', 'error'); }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('pos_current_user');
    showNotification('Logged out', 'success');
  };

  const fetchLoyaltySettings = async () => {
    try {
      const res = await axios.get(`${API}/loyalty/settings`);
      setLoyaltySettings(res.data);
    } catch (e) { console.error(e); }
  };

  const fetchLoyaltyInfo = async (phone) => {
    try {
      const res = await axios.get(`${API}/loyalty/customer/${phone}`);
      setLoyaltyInfo(res.data);
    } catch (e) { setLoyaltyInfo(null); }
  };

  const handleRedeemLoyalty = () => {
    const pts = parseInt(redeemPoints) || 0;
    if (pts <= 0) { showNotification('Enter points to redeem', 'error'); return; }
    if (!loyaltyInfo) { showNotification('Customer has no loyalty points yet', 'error'); return; }
    if (pts < loyaltySettings.min_redeem_points) { showNotification(`Minimum ${loyaltySettings.min_redeem_points} points required`, 'error'); return; }
    if (pts > loyaltyInfo.points) { showNotification(`Only ${loyaltyInfo.points} points available`, 'error'); return; }
    const discount = pts * loyaltySettings.rupees_per_point;
    setLoyaltyDiscount(discount);
    showNotification(`₹${discount.toFixed(2)} loyalty discount applied!`, 'success');
  };

  const handleSaveLoyaltySettings = async () => {
    try {
      await axios.put(`${API}/loyalty/settings`, { id: 'loyalty_settings', ...loyaltySettings });
      showNotification('Loyalty settings saved', 'success');
    } catch (e) { showNotification('Error saving loyalty settings', 'error'); }
  };

  const fetchAnalytics = async () => {
    try {
      const params = { period: analyticsPeriod };
      if (analyticsStart) params.start_date = new Date(analyticsStart).toISOString();
      if (analyticsEnd) params.end_date = new Date(analyticsEnd + 'T23:59:59').toISOString();
      const res = await axios.get(`${API}/reports/profit-loss`, { params });
      const localExpenses = JSON.parse(localStorage.getItem('pos_expenses') || '[]');
      const totalExpenses = localExpenses.reduce((s, e) => s + (e.amount || 0), 0);
      setAnalyticsData({ ...res.data, total_expenses: totalExpenses, net_profit: res.data.gross_profit - totalExpenses });
    } catch (e) { showNotification('Error fetching analytics', 'error'); }
  };

  const printThermal = (bill) => {
    const w = parseInt(thermalWidth);
    const font = parseInt(thermalFont);
    const shopName = settings.shop_name || 'My Shop';
    const win = window.open('', '_blank', 'width=400,height=700');
    if (!win) { showNotification('Allow popups to print receipts', 'error'); return; }
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Receipt</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: 'Courier New', monospace; font-size:${font}px; width:${w}mm; padding:4mm; }
      .center { text-align:center; }
      .bold { font-weight:bold; }
      .right { text-align:right; }
      .flex { display:flex; justify-content:space-between; }
      .sep { border-top:1px dashed #000; margin:4px 0; }
      .big { font-size:${font + 2}px; font-weight:bold; }
      @media print { @page { margin:0; size:${w}mm auto; } body { padding:2mm; } }
    </style></head><body>
    <div class="center bold big">${shopName}</div>
    ${settings.gstin ? `<div class="center">GSTIN: ${settings.gstin}</div>` : ''}
    ${settings.address ? `<div class="center">${settings.address}</div>` : ''}
    ${settings.phone ? `<div class="center">Ph: ${settings.phone}</div>` : ''}
    <div class="sep"></div>
    <div class="flex"><span>Invoice: ${bill.invoice_no}</span></div>
    <div class="flex"><span>Date: ${new Date(bill.created_at).toLocaleString()}</span></div>
    ${bill.customer_name ? `<div>Customer: ${bill.customer_name}</div>` : ''}
    ${bill.customer_phone ? `<div>Phone: ${bill.customer_phone}</div>` : ''}
    <div class="sep"></div>
    ${bill.items.map(i => `
      <div class="bold">${i.name}</div>
      <div class="flex"><span>  ${i.quantity} x ₹${i.price.toFixed(2)}</span><span>₹${(i.price*i.quantity).toFixed(2)}</span></div>
    `).join('')}
    <div class="sep"></div>
    <div class="flex"><span>Subtotal</span><span>₹${bill.subtotal.toFixed(2)}</span></div>
    ${bill.discount_amount > 0 ? `<div class="flex"><span>Discount (${bill.discount_percent}%)</span><span>-₹${bill.discount_amount.toFixed(2)}</span></div>` : ''}
    ${bill.tax_amount > 0 ? `<div class="flex"><span>GST (${bill.tax_percent}%)</span><span>₹${bill.tax_amount.toFixed(2)}</span></div>` : ''}
    <div class="sep"></div>
    <div class="flex big"><span>TOTAL</span><span>₹${bill.total.toFixed(2)}</span></div>
    ${bill.balance_amount > 0 ? `<div class="flex" style="color:red"><span>Balance Due</span><span>₹${bill.balance_amount.toFixed(2)}</span></div>` : ''}
    <div class="flex"><span>Payment: ${bill.payment_method}</span>${bill.cash_received > 0 ? `<span>Cash: ₹${bill.cash_received.toFixed(2)}</span>` : ''}</div>
    ${bill.change_given > 0 ? `<div class="flex"><span>Change</span><span>₹${bill.change_given.toFixed(2)}</span></div>` : ''}
    <div class="sep"></div>
    <div class="center">Thank you! Visit again.</div>
    <div class="center" style="font-size:10px">Powered by SS Technologies</div>
    <br/><br/>
    </body></html>`;
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); win.onafterprint = () => win.close(); };
  };

  const sendBillWhatsAppAuto = (bill) => {
    if (!bill.customer_phone) { showNotification('No customer phone number', 'error'); return; }
    sendBillViaWhatsApp(bill);
    showNotification('Opening WhatsApp...', 'success');
  };

  const printBarcodeLabels = () => {
    const selected = barcodeProducts.filter(p => barcodeQty[p.id] > 0);
    if (selected.length === 0) { showNotification('Select at least one product', 'error'); return; }
    const sizes = { small: { w: '40mm', h: '25mm', font: 10 }, medium: { w: '60mm', h: '35mm', font: 12 }, large: { w: '80mm', h: '50mm', font: 14 } };
    const s = sizes[labelSize];
    let labels = '';
    for (const p of selected) {
      const qty = barcodeQty[p.id] || 1;
      for (let i = 0; i < qty; i++) {
        labels += `<div class="label">
          <div class="shop">${settings.shop_name || 'Shop'}</div>
          <div class="name">${p.name}</div>
          <div class="price">₹${p.price.toFixed(2)}</div>
          <div class="barcode">||||| ${p.barcode} |||||</div>
          <div class="barcode-text">${p.barcode}</div>
          ${p.hsn_code ? `<div class="hsn">HSN: ${p.hsn_code}</div>` : ''}
        </div>`;
      }
    }
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Barcode Labels</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: Arial, sans-serif; background: white; }
      .labels { display:flex; flex-wrap:wrap; gap:2mm; padding:5mm; }
      .label { width:${s.w}; height:${s.h}; border:1px solid #000; padding:2mm; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; overflow:hidden; }
      .shop { font-size:${s.font - 2}px; color:#555; }
      .name { font-size:${s.font}px; font-weight:bold; }
      .price { font-size:${s.font + 2}px; font-weight:bold; color:#000; }
      .barcode { font-size:${s.font + 6}px; letter-spacing:2px; font-family:monospace; }
      .barcode-text { font-size:${s.font - 1}px; font-family:monospace; letter-spacing:3px; }
      .hsn { font-size:${s.font - 3}px; color:#777; }
      @media print { @page { margin:5mm; } body { } }
    </style></head><body>
    <div class="labels">${labels}</div>
    </body></html>`);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  const sendBillViaWhatsApp = (bill) => {
    const itemList = bill.items.map(i => `${i.name} x${i.quantity} = ${formatCurrency(i.price * i.quantity)}`).join('\n');
    const message = encodeURIComponent(
      `🧾 *${settings.shop_name}*\n\n*Invoice:* ${bill.invoice_no}\n*Date:* ${new Date(bill.created_at).toLocaleString()}\n\n*Items:*\n${itemList}\n\n*Subtotal:* ${formatCurrency(bill.subtotal)}\n*Discount:* ${formatCurrency(bill.discount_amount)}\n*GST (${bill.tax_percent}%):* ${formatCurrency(bill.tax_amount)}\n*Total:* ${formatCurrency(bill.total)}\n${bill.balance_amount > 0 ? `*Balance Due:* ${formatCurrency(bill.balance_amount)}\n` : ''}\nPayment: ${bill.payment_method}\n\nThank you for your business!`
    );
    window.open(`https://wa.me/${bill.customer_phone}?text=${message}`, '_blank');
  };

  const viewCustomerHistory = async (customer) => {
    try {
      const res = await axios.get(`${API}/customers/${customer.phone}/bills`);
      setCustomerHistory({ customer, bills: res.data });
    } catch (error) {
      showNotification('Error loading customer history', 'error');
    }
  };

  const toggleBillSettled = async (bill) => {
    try {
      await axios.put(`${API}/bills/${bill.id}/settle`, null, {
        params: { settled: !bill.settled }
      });
      showNotification(`Bill marked as ${!bill.settled ? 'settled' : 'not settled'}`, 'success');
      if (customerHistory) {
        const res = await axios.get(`${API}/customers/${customerHistory.customer.phone}/bills`);
        setCustomerHistory({ ...customerHistory, bills: res.data });
      }
      await loadData();
    } catch (error) {
      showNotification('Error updating bill', 'error');
    }
  };

  const handleUpdateCustomerBalance = async () => {
    if (!editingCustomer) return;
    if (!editingCustomer.name.trim()) { showNotification('Name is required', 'error'); return; }
    if (!editingCustomer.phone.trim()) { showNotification('Phone is required', 'error'); return; }
    try {
      await axios.put(`${API}/customers/${editingCustomer._originalPhone || editingCustomer.phone}/info`, {
        name: editingCustomer.name.trim(),
        phone: editingCustomer.phone.trim()
      });
      showNotification('Customer updated', 'success');
      setEditingCustomer(null);
      await loadData();
    } catch (error) {
      showNotification('Error updating customer', 'error');
    }
  };

  const handleDeleteCustomer = async (phone) => {
    if (!window.confirm('Delete this customer? This action cannot be undone.')) return;
    try {
      await axios.delete(`${API}/customers/${phone}`);
      showNotification('Customer deleted', 'success');
      await loadData();
    } catch (error) {
      showNotification('Error deleting customer', 'error');
    }
  };

  const exportBalance = () => {
    const data = balanceCustomers.map(c => ({
      'Name': c.name,
      'Phone': c.phone,
      'Balance': c.balance || 0,
      'Total Purchases': c.total_purchases,
      'Visits': c.visit_count,
      'Since': new Date(c.created_at).toLocaleDateString()
    }));
    exportToExcel(data, 'balance-report');
    showNotification('Balance exported to Excel', 'success');
  };

  const exportToExcel = (data, filename) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${filename}.xlsx`);
  };

  const exportBills = () => {
    const data = bills.map(b => ({
      'Invoice No': b.invoice_no,
      'Date': new Date(b.created_at).toLocaleString(),
      'Customer': b.customer_name || 'Guest',
      'Phone': b.customer_phone,
      'Items': b.items.length,
      'Subtotal': b.subtotal,
      'Discount': b.discount_amount,
      'Tax': b.tax_amount,
      'Total': b.total,
      'Payment': b.payment_method,
      'Balance': b.balance_amount
    }));
    exportToExcel(data, 'bills');
    showNotification('Bills exported to Excel', 'success');
  };

  const exportCustomers = () => {
    const data = customers.map(c => ({
      'Name': c.name,
      'Phone': c.phone,
      'Total Purchases': c.total_purchases,
      'Visits': c.visit_count,
      'Avg Bill': (c.total_purchases / c.visit_count).toFixed(2),
      'Balance': c.balance || 0,
      'Since': new Date(c.created_at).toLocaleDateString()
    }));
    exportToExcel(data, 'customers');
    showNotification('Customers exported to Excel', 'success');
  };

  const exportReport = () => {
    if (!reportData) return;
    const data = [
      { 'Metric': 'Total Revenue', 'Value': reportData.total_revenue },
      { 'Metric': 'Bills Generated', 'Value': reportData.total_bills },
      { 'Metric': 'Tax Collected', 'Value': reportData.total_tax },
      { 'Metric': 'Discounts Given', 'Value': reportData.total_discount }
    ];
    exportToExcel(data, 'sales-report');
    showNotification('Report exported to Excel', 'success');
  };

  const getCategoryColor = (category) => {
    const colors = {
      Food: '#ff6b6b',
      Beverages: '#4ecdc4',
      Electronics: '#45b7d1',
      Clothing: '#f093fb',
      Medicines: '#4facfe',
      Stationery: '#43e97b'
    };
    return colors[category] || '#f5a623';
  };

  const getStockStatus = (stock) => {
    if (stock === 0) return { text: 'Out of Stock', color: '#d32f2f' };
    if (stock <= settings.low_stock_threshold) return { text: 'Low Stock', color: '#ff9800' };
    return { text: 'In Stock', color: '#4caf50' };
  };

  const filteredProducts = (Array.isArray(products) ? products : []).filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.barcode.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const lowStockProducts = (Array.isArray(products) ? products : []).filter(p => p.stock <= settings.low_stock_threshold && p.stock > 0);
  const balanceCustomers = (Array.isArray(customers) ? customers : []).filter(c => (c.balance || 0) > 0);

  return (
    <div className="pos-container">
      {/* Sidebar Navigation */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h1 className="logo">{settings.software_name || 'POS'}</h1>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        
        <nav className="nav-menu">
          {[
            { id: VIEWS.DASHBOARD, icon: '🏠', label: 'Dashboard' },
            { id: VIEWS.POS, icon: '🛒', label: 'Point of Sale' },
            { id: VIEWS.INVENTORY, icon: '📦', label: 'Inventory' },
            { id: VIEWS.STOCK_ADJUSTMENTS, icon: '🔧', label: 'Stock Adjust' },
            { id: VIEWS.QUOTATIONS, icon: '📋', label: 'Quotations' },
            { id: VIEWS.BILLS, icon: '🧾', label: 'Bill History' },
            { id: VIEWS.CUSTOMERS, icon: '👥', label: 'Customers' },
            { id: VIEWS.BALANCE, icon: '💰', label: 'Balance' },
            { id: VIEWS.LOW_STOCK, icon: '⚠️', label: 'Low Stock' },
            { id: VIEWS.REPORTS, icon: '📊', label: 'Reports' },
            { id: VIEWS.DAY_CLOSE, icon: '🔒', label: 'Day Close' },
            { id: VIEWS.RETURNS, icon: '↩️', label: 'Returns' },
            { id: VIEWS.EXPENSES, icon: '💸', label: 'Expenses' },
            { id: VIEWS.ANALYTICS, icon: '📈', label: 'P&L Analytics' },
            { id: VIEWS.SUPPLIERS, icon: '🏭', label: 'Suppliers' },
            { id: VIEWS.PURCHASE_ORDERS, icon: '📥', label: 'Purchase Orders' },
            { id: VIEWS.BRANCHES, icon: '🏢', label: 'Branches & Users' },
            { id: VIEWS.LOYALTY, icon: '⭐', label: 'Loyalty Points' },
            { id: VIEWS.BARCODE_LABELS, icon: '🏷️', label: 'Barcode Labels' },
            { id: VIEWS.SETTINGS, icon: '⚙️', label: 'Settings' }
          ].map(item => (
            <div
              key={item.id}
              data-testid={`nav-${item.id}`}
              onClick={() => { setView(item.id); setSidebarOpen(false); }}
              className={`nav-item ${view === item.id ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </div>
          ))}
        </nav>

        {lowStockProducts.length > 0 && (
          <div
            className="low-stock-alert clickable"
            data-testid="low-stock-alert"
            onClick={() => { setView(VIEWS.LOW_STOCK); setSidebarOpen(false); }}
          >
            <div className="alert-header">⚠️ LOW STOCK ({lowStockProducts.length})</div>
            <div className="alert-content">
              {lowStockProducts.slice(0, 3).map(p => (
                <div key={p.id} className="alert-item">
                  {p.name}: {p.stock}
                </div>
              ))}
              {lowStockProducts.length > 3 && (
                <div className="alert-more">+{lowStockProducts.length - 3} more (click to view)</div>
              )}
            </div>
          </div>
        )}

        <div className="theme-toggle">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="theme-btn">
            {theme === 'dark' ? '☀️' : '🌙'} {theme === 'dark' ? 'Light' : 'Dark'} Mode
          </button>
          <div style={{ padding: '8px', borderTop: '1px solid var(--border)', fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11 }}>⌨️ Shortcuts</div>
            <div>F1 Dashboard &nbsp; F2 POS</div>
            <div>F3 Bills &nbsp; F4 Inventory</div>
            <div>F5 Customers &nbsp; F6 Quotations</div>
            <div>F7 Returns &nbsp; F8 Expenses</div>
            <div>Esc Close modal</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)' }}>
            <div style={{ fontWeight: '600', fontSize: '12px', color: 'var(--accent)' }}>SS Technologies</div>
          </div>
        </div>
      </div>

      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>

      {/* Main Container Dashboard Area */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>
        
        {/* Point Of Sale Grid Panel */}
        {view === VIEWS.POS && (
          <div style={{ display:'flex', flexDirection:'row', flex:1, minHeight:0, overflow:'hidden', height:'100%' }}>
            <div style={{ flex:1, minWidth:0, overflowY:'auto', overflowX:'hidden', padding:20 }}>
              <div className="search-bar">
                <input
                  data-testid="barcode-input"
                  ref={barcodeRef}
                  className="input"
                  placeholder="Scan or enter barcode..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeSearch}
                />
                <input
                  data-testid="search-input"
                  className="input"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="category-filters">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    data-testid={`category-${cat.toLowerCase()}`}
                    className={`btn category-btn ${selectedCategory === cat ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="products-grid">
                {filteredProducts.map(product => {
                  const stockStatus = getStockStatus(product.stock);
                  return (
                    <div
                      key={product.id}
                      data-testid={`product-${product.barcode}`}
                      className="product-card"
                      onClick={(e) => { e.currentTarget.blur(); product.stock > 0 && addToCart(product); }}
                      style={{ opacity: product.stock === 0 ? 0.5 : 1, cursor: product.stock === 0 ? 'not-allowed' : 'pointer' }}
                    >
                      <div className="product-header">
                        <span className="tag" style={{ background: getCategoryColor(product.category) }}>
                          {product.category}
                        </span>
                        <span className="stock-status" style={{ color: stockStatus.color }}>
                          {stockStatus.text}
                        </span>
                      </div>
                      <div className="product-name">{product.name}</div>
                      <div className="product-code">Code: {product.barcode}</div>
                      <div className="product-footer">
                        <span className="product-price">{formatCurrency(product.price)}</span>
                        <span className="product-stock">Stock: {product.stock}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Checkout Panel Sidebar */}
            <div style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', borderLeft: '2px solid var(--accent)', overflowY: 'auto', overflowX: 'hidden', padding: 20, height: '100%' }}>
              
              <div className="cart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Current Bill</span>
                {cart.length > 0 && (
                  <button
                    className="btn btn-sm btn-danger"
                    style={{ fontSize: 12, padding: '4px 12px' }}
                    onClick={() => {
                      if (window.confirm('Clear all items from this bill?')) {
                        setCart([]);
                        setDiscountPercent(0);
                        setCustomDiscount('');
                        setCustomerPaid('');
                        setCustomerName('');
                        setCustomerPhone('');
                        setLoyaltyDiscount(0);
                        setRedeemPoints('');
                        setLoyaltyInfo(null);
                        showNotification('Bill cleared', 'success');
                      }
                    }}
                  >
                    🗑️ Clear Bill
                  </button>
                )}
              </div>

              {heldCarts.length > 0 && (
                <div className="held-carts">
                  <div className="held-carts-header">HELD CARTS ({heldCarts.length})</div>
                  {heldCarts.map(hc => (
                    <button
                      key={hc.id}
                      data-testid={`resume-cart-${hc.id}`}
                      className="btn held-cart-btn"
                      onClick={() => handleResumeCart(hc)}
                    >
                      {hc.customer_name || 'Unnamed'} - {hc.items.length} items
                    </button>
                  ))}
                </div>
              )}

              {/* ── 1. Cart Items (Fixed Order Sorting) ── */}
              <div className="cart-items">
                {cart.length === 0 ? (
                  <div className="empty-cart">Cart is empty</div>
                ) : (
                  [...cart]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(item => (
                      <div key={item.product_id} className="cart-item" data-testid={`cart-item-${item.product_id}`}>
                        <div className="cart-item-header">
                          <span className="cart-item-name">{item.name}</span>
                          <button
                            data-testid={`remove-item-${item.product_id}`}
                            className="btn btn-danger btn-sm"
                            onClick={() => removeFromCart(item.product_id)}
                          >
                            ✕
                          </button>
                        </div>
                        <div className="cart-item-controls">
                          <div className="qty-controls">
                            <button
                              data-testid={`decrease-qty-${item.product_id}`}
                              className="btn btn-sm"
                              onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                            >
                              −
                            </button>
                            <input
                              data-testid={`qty-input-${item.product_id}`}
                              className="input qty-input"
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 1)}
                            />
                            <button
                              data-testid={`increase-qty-${item.product_id}`}
                              className="btn btn-sm"
                              onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                            >
                              +
                            </button>
                          </div>
                          <span className="cart-item-total">{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                        <div className="cart-item-detail">
                          {formatCurrency(item.price)} × {item.quantity}
                        </div>
                      </div>
                    ))
                )}
              </div>

              {/* ── 2. Discount + Bill Summary ── */}
              {cart.length > 0 && (
                <>
                  <div className="discount-section">
                    <div className="section-label">Discount:</div>
                    <div className="discount-options">
                      {DISCOUNT_OPTIONS.map(disc => (
                        <button
                          key={disc}
                          data-testid={`discount-${disc}`}
                          className={`btn btn-sm ${discountPercent === disc && !customDiscount ? 'active' : ''}`}
                          onClick={() => { setDiscountPercent(disc); setCustomDiscount(''); }}
                        >
                          {disc}%
                        </button>
                      ))}
                    </div>
                    <input
                      data-testid="custom-discount-input"
                      className="input"
                      placeholder="Custom discount %"
                      type="number"
                      value={customDiscount}
                      onChange={(e) => { setCustomDiscount(e.target.value); setDiscountPercent(0); }}
                    />
                  </div>

                  <div className="bill-summary">
                    {(() => {
                      const { subtotal, discountAmount, taxAmount, total } = calculateBill();
                      return (
                        <>
                          <div className="summary-line">
                            <span>Subtotal:</span>
                            <span data-testid="subtotal">{formatCurrency(subtotal)}</span>
                          </div>
                          <div className="summary-line">
                            <span>Discount:</span>
                            <span data-testid="discount" className="discount-text">- {formatCurrency(discountAmount)}</span>
                          </div>
                          {settings.tax_enabled && (
                            <div className="summary-line">
                              <span>GST ({settings.tax_percent}%):</span>
                              <span data-testid="tax">{formatCurrency(taxAmount)}</span>
                            </div>
                          )}
                          <div className="summary-line total-line">
                            <span>Total:</span>
                            <span data-testid="total">{formatCurrency(total)}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* ── 3. Customer Details ── */}
                  <div className="customer-inputs">
                    <input
                      data-testid="customer-name-input"
                      className="input"
                      placeholder="Customer Name (optional)"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                    <input
                      data-testid="customer-phone-input"
                      className="input"
                      placeholder="Customer Phone (optional)"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                  </div>

                  {/* ── 4. Loyalty Points ── */}
                  {customerPhone && customerPhone.length >= 10 && loyaltySettings.enabled && (
                    <div className="payment-section" style={{ border: '1px solid var(--accent)', borderRadius: 8, padding: '10px 12px', background: 'var(--bg-tertiary)' }}>
                      <div className="section-label" style={{ color: 'var(--accent)' }}>
                        ⭐ Loyalty Points: {loyaltyInfo ? loyaltyInfo.points : 0} pts
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                        Min redeem: {loyaltySettings.min_redeem_points} pts | 1 pt = ₹{loyaltySettings.rupees_per_point}
                      </div>
                      {loyaltyDiscount > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: 'var(--success)' }}>✓ ₹{loyaltyDiscount.toFixed(2)} discount applied ({redeemPoints} pts)</span>
                          <button className="btn btn-sm" style={{ padding: '2px 8px' }} onClick={() => { setLoyaltyDiscount(0); setRedeemPoints(''); }}>✕</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input className="input" placeholder="Points to redeem" type="number" style={{ flex: 1 }}
                            value={redeemPoints} onChange={e => setRedeemPoints(e.target.value)} />
                          <button className="btn btn-sm btn-primary" onClick={handleRedeemLoyalty}>Redeem</button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── 5. Payment Method ── */}
                  <div className="payment-section">
                    <div className="section-label">Payment Method:</div>
                    <div className="payment-methods">
                      {PAYMENT_METHODS.map(method => (
                        <button
                          key={method}
                          data-testid={`payment-${method.toLowerCase()}`}
                          className={`btn btn-sm ${paymentMethod === method ? 'active' : ''}`}
                          onClick={() => setPaymentMethod(method)}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── 6. Amount Paid ── */}
                  <div className="cash-section">
                    <div className="section-label">Amount Paid (leave blank = full payment):</div>
                    <input
                      data-testid="customer-paid-input"
                      className="input"
                      placeholder="Enter amount paid"
                      type="number"
                      value={customerPaid}
                      onChange={(e) => setCustomerPaid(e.target.value)}
                    />
                    {customerPaid && (() => {
                      const { total } = calculateBill();
                      const paid = parseFloat(customerPaid) || 0;
                      if (paid >= total) {
                        return <div className="change-info">Change: {formatCurrency(paid - total)}</div>;
                      } else {
                        return <div className="balance-info balance-text">Balance Due: {formatCurrency(total - paid)}</div>;
                      }
                    })()}
                  </div>

                  {/* ── 7. Actions ── */}
                  <div className="cart-actions">
                    <button
                      data-testid="hold-cart-btn"
                      className="btn"
                      onClick={handleHoldCart}
                    >
                      Hold
                    </button>
                    <button
                      data-testid="checkout-btn"
                      className="btn btn-primary"
                      onClick={handleCheckout}
                    >
                      Checkout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Low Stock View Dashboard */}
        {view === VIEWS.LOW_STOCK && (
          <div className="content-view">
            <div className="view-header">
              <h2 className="section-title">Low Stock Products</h2>
              <button className="btn btn-primary" onClick={() => exportToExcel(
                lowStockProducts.map(p => ({
                  'Name': p.name,
                  'Category': p.category,
                  'Stock': p.stock,
                  'Price': p.price,
                  'Barcode': p.barcode,
                  'Unit': p.unit,
                  'HSN': p.hsn_code
                })), 'low-stock-products'
              )}>Export to Excel</button>
            </div>
            
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Total Low Stock Items</div>
                <div className="stat-value balance-text">{lowStockProducts.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Out of Stock Items</div>
                <div className="stat-value" style={{ color: 'var(--danger)' }}>
                  {products.filter(p => p.stock === 0).length}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Threshold</div>
                <div className="stat-value">≤ {settings.low_stock_threshold}</div>
              </div>
            </div>

            {lowStockProducts.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                <h3 className="card-title">🎉 All Good!</h3>
                <p>No products are currently below the low stock threshold.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>Category</th>
                      <th>Current Stock</th>
                      <th>Price</th>
                      <th>Barcode</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockProducts.map(p => (
                      <tr key={p.id} data-testid={`low-stock-row-${p.barcode}`}>
                        <td><strong>{p.name}</strong></td>
                        <td>
                          <span className="tag" style={{ background: getCategoryColor(p.category) }}>
                            {p.category}
                          </span>
                        </td>
                        <td className="balance-text">{p.stock} {p.unit}</td>
                        <td>{formatCurrency(p.price)}</td>
                        <td>{p.barcode}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => setEditProduct(p)}
                          >
                            Restock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Inventory View */}
        {view === VIEWS.INVENTORY && (
          <div className="content-view">
            <div className="view-header">
              <h2 className="section-title">Inventory Management</h2>
            </div>
            
            <div className="card add-product-card">
              <h3 className="card-title">Add New Product</h3>
              <div className="form-grid">
                <input
                  data-testid="new-product-name"
                  className="input"
                  placeholder="Product Name *"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                />
                <select
                  data-testid="new-product-category"
                  className="input"
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                >
                  {CATEGORIES.filter(c => c !== 'All').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <input
                  data-testid="new-product-price"
                  className="input"
                  placeholder="Price *"
                  type="number"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                />
                <input
                  data-testid="new-product-stock"
                  className="input"
                  placeholder="Stock *"
                  type="number"
                  value={newProduct.stock}
                  onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                />
                <input
                  data-testid="new-product-barcode"
                  className="input"
                  placeholder="Barcode *"
                  value={newProduct.barcode}
                  onChange={(e) => setNewProduct({ ...newProduct, stock: newProduct.stock, barcode: e.target.value })}
                />
                <input
                  data-testid="new-product-unit"
                  className="input"
                  placeholder="Unit (pcs, kg, etc)"
                  value={newProduct.unit}
                  onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                />
                <input
                  data-testid="new-product-hsn"
                  className="input"
                  placeholder="HSN Code"
                  value={newProduct.hsn_code}
                  onChange={(e) => setNewProduct({ ...newProduct, hsn_code: e.target.value })}
                />
                <div className="form-group">
                  <label>GST Rate (%)</label>
                  <select className="input" value={newProduct.tax_percent || settings.tax_percent}
                    onChange={(e) => setNewProduct({ ...newProduct, tax_percent: parseFloat(e.target.value) })}>
                    {TAX_RATES.map(r => <option key={r} value={r}>{r}% GST</option>)}
                  </select>
                </div>
              </div>
              <button data-testid="add-product-btn" className="btn btn-primary" onClick={handleAddProduct}>
                Add Product
              </button>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Barcode</th>
                    <th>HSN</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(product => {
                    const stockStatus = getStockStatus(product.stock);
                    return (
                      <tr key={product.id} data-testid={`inventory-row-${product.barcode}`}>
                        <td>{product.name}</td>
                        <td>
                          <span className="tag" style={{ background: getCategoryColor(product.category) }}>
                            {product.category}
                          </span>
                        </td>
                        <td>{formatCurrency(product.price)}</td>
                        <td>{product.stock}</td>
                        <td>{product.barcode}</td>
                        <td>{product.hsn_code}</td>
                        <td style={{ color: stockStatus.color, fontWeight: 'bold' }}>
                          {stockStatus.text}
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              data-testid={`edit-product-${product.barcode}`}
                              className="btn btn-sm"
                              onClick={() => setEditProduct(product)}
                            >
                              Edit
                            </button>
                            <button
                              data-testid={`delete-product-${product.barcode}`}
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteProduct(product.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bills View */}
        {view === VIEWS.BILLS && (
          <div className="content-view">
            <div className="view-header">
              <h2 className="section-title">Bill History</h2>
              <button className="btn btn-primary" onClick={exportBills}>Export to Excel</button>
            </div>
            
            <div className="filters-bar">
              <input
                className="input"
                placeholder="Search by invoice, customer, or phone..."
                value={billSearch}
                onChange={(e) => setBillSearch(e.target.value)}
              />
              <input
                className="input date-input"
                type="date"
                placeholder="Start Date"
                value={billStartDate}
                onChange={(e) => setBillStartDate(e.target.value)}
              />
              <input
                className="input date-input"
                type="date"
                placeholder="End Date"
                value={billEndDate}
                onChange={(e) => setBillEndDate(e.target.value)}
              />
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Balance</th>
                    <th>Payment</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map(bill => (
                    <tr key={bill.id} data-testid={`bill-row-${bill.invoice_no}`}>
                      <td className="invoice-no">{bill.invoice_no}</td>
                      <td>{new Date(bill.created_at).toLocaleString()}</td>
                      <td>
                        {bill.customer_name || 'Guest'}
                        <br/>
                        <span className="sub-text">{bill.customer_phone}</span>
                      </td>
                      <td>{bill.items.length}</td>
                      <td className="amount-text">{formatCurrency(bill.total)}</td>
                      <td className={bill.balance_amount > 0 ? 'balance-text' : ''}>{formatCurrency(bill.balance_amount || 0)}</td>
                      <td>
                        <span className="tag">{bill.payment_method}</span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            data-testid={`view-bill-${bill.invoice_no}`}
                            className="btn btn-sm"
                            onClick={() => setShowReceipt(bill)}
                          >
                            View
                          </button>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => downloadBillPDF(bill)}
                          >
                            📄 PDF
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => printThermal(bill)}
                            title="Thermal Print"
                          >
                            🖨️
                          </button>
                          {bill.customer_phone && (
                            <button
                              className="btn btn-sm"
                              onClick={() => sendBillWhatsAppAuto(bill)}
                              title="Send via WhatsApp"
                            >
                              📱
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Customers View */}
        {view === VIEWS.CUSTOMERS && (
          <div className="content-view">
            <div className="view-header">
              <h2 className="section-title">Customer Management</h2>
              <button className="btn btn-primary" onClick={exportCustomers}>Export to Excel</button>
            </div>
            
            <div className="filters-bar">
              <input
                className="input"
                placeholder="Search by name or phone..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Total Customers</div>
                <div className="stat-value">{customers.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Revenue</div>
                <div className="stat-value amount-text">
                  {formatCurrency(customers.reduce((sum, c) => sum + c.total_purchases, 0))}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Visits</div>
                <div className="stat-value">
                  {customers.reduce((sum, c) => sum + c.visit_count, 0)}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Outstanding Balance</div>
                <div className="stat-value balance-text">
                  {formatCurrency(bills.filter(b => !b.settled && b.balance_amount > 0).reduce((sum, b) => sum + (b.balance_amount || 0), 0))}
                </div>
              </div>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Total Purchases</th>
                    <th>Visits</th>
                    <th>Avg Bill</th>
                    <th>Balance</th>
                    <th>Since</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(customer => (
                    <tr key={customer.id} data-testid={`customer-row-${customer.phone}`}>
                      <td>{customer.name}</td>
                      <td>{customer.phone}</td>
                      <td className="amount-text">{formatCurrency(customer.total_purchases)}</td>
                      <td>{customer.visit_count}</td>
                      <td>{formatCurrency(customer.total_purchases / customer.visit_count)}</td>
                      <td className={customer.balance > 0 ? 'balance-text' : ''}>{formatCurrency(customer.balance || 0)}</td>
                      <td>{new Date(customer.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Balance View */}
        {view === VIEWS.BALANCE && (
          <div className="content-view">
            <div className="view-header">
              <h2 className="section-title">Customer Balance Management</h2>
              <button className="btn btn-primary" onClick={exportBalance}>Export to Excel</button>
            </div>
            
            <div className="filters-bar">
              <input
                className="input"
                placeholder="Search by name or phone..."
                value={balanceSearch}
                onChange={(e) => setBalanceSearch(e.target.value)}
              />
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Customers with Balance</div>
                <div className="stat-value">{balanceCustomers.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Outstanding</div>
                <div className="stat-value balance-text">
                  {formatCurrency(balanceCustomers.reduce((sum, c) => sum + (c.balance || 0), 0))}
                </div>
              </div>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Balance</th>
                    <th>Total Purchases</th>
                    <th>Visits</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {balanceCustomers
                    .filter(c => 
                      !balanceSearch || 
                      c.name.toLowerCase().includes(balanceSearch.toLowerCase()) ||
                      c.phone.includes(balanceSearch)
                    )
                    .map(customer => (
                      <tr key={customer.id}>
                        <td><strong>{customer.name}</strong></td>
                        <td>{customer.phone}</td>
                        <td className="balance-text">{formatCurrency(customer.balance)}</td>
                        <td className="amount-text">{formatCurrency(customer.total_purchases)}</td>
                        <td>{customer.visit_count}</td>
                        <td>
                          <div className="table-actions" style={{ flexWrap: 'wrap' }}>
                            <button
                              className="btn btn-sm"
                              onClick={() => viewCustomerHistory(customer)}
                              data-testid={`history-${customer.phone}`}
                            >
                              📋 History
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={() => setEditingCustomer({ ...customer, _originalPhone: customer.phone })}
                              data-testid={`edit-balance-${customer.phone}`}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={() => sendWhatsAppReminder(customer)}
                            >
                              📱 WhatsApp
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleDeleteCustomer(customer.phone)}
                              data-testid={`delete-customer-${customer.phone}`}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reports View Summary */}
        {view === VIEWS.REPORTS && (
          <div className="content-view">
            <div className="view-header">
              <h2 className="section-title">Sales Reports</h2>
              <button className="btn btn-primary" onClick={exportReport}>Export to Excel</button>
            </div>
            
            <div className="filters-bar">
              <div className="period-filters">
                {['today', 'week', 'month', 'all'].map(period => (
                  <button
                    key={period}
                    data-testid={`report-${period}`}
                    className={`btn ${reportPeriod === period && !reportStartDate ? 'active' : ''}`}
                    onClick={() => { setReportPeriod(period); setReportStartDate(''); setReportEndDate(''); }}
                  >
                    {period === 'today' ? 'Today' : period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'All Time'}
                  </button>
                ))}
              </div>
              <div className="date-range">
                <input
                  className="input date-input"
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                />
                <span>to</span>
                <input
                  className="input date-input"
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                />
              </div>
            </div>

            {reportData && (
              <>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-label">Total Revenue</div>
                    <div className="stat-value amount-text" data-testid="report-revenue">
                      {formatCurrency(reportData.total_revenue)}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Bills Generated</div>
                    <div className="stat-value" data-testid="report-bills">
                      {reportData.total_bills}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Tax Collected</div>
                    <div className="stat-value" data-testid="report-tax">
                      {formatCurrency(reportData.total_tax)}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Discounts Given</div>
                    <div className="stat-value" data-testid="report-discount">
                      {formatCurrency(reportData.total_discount)}
                    </div>
                  </div>
                </div>

                <div className="report-cards">
                  <div className="card">
                    <h3 className="card-title">Top 5 Selling Products</h3>
                    {reportData.top_products.map((product, idx) => (
                      <div key={idx} className="report-item">
                        <span>{product.name}</span>
                        <span className="report-value">{product.quantity} sold</span>
                      </div>
                    ))}
                  </div>

                  <div className="card">
                    <h3 className="card-title">Payment Method Breakdown</h3>
                    {Object.entries(reportData.payment_breakdown).map(([method, amount]) => (
                      <div key={method} className="report-item">
                        <span>{method}</span>
                        <span className="report-value amount-text">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Day Close Lock View Dashboard */}
        {view === VIEWS.DAY_CLOSE && (
          <div className="content-view">
            <div className="view-header">
              <h2 className="section-title">🔒 Day Close Report</h2>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="date"
                  className="input date-input"
                  value={dayCloseDate}
                  onChange={e => setDayCloseDate(e.target.value)}
                />
                <button className="btn btn-primary" onClick={fetchDayClose}>Refresh</button>
                {dayCloseData && (
                  <button className="btn btn-secondary" onClick={exportDayClose}>Export Excel</button>
                )}
              </div>
            </div>

            {dayCloseLoading && (
              <div style={{ textAlign: 'center', padding: '40px', fontSize: '18px' }}>
                ⏳ Loading...
              </div>
            )}

            {!dayCloseLoading && dayCloseData && (
              <>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-label">Total Bills</div>
                    <div className="stat-value">{dayCloseData.total_bills}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Total Revenue</div>
                    <div className="stat-value amount-text">{formatCurrency(dayCloseData.total_revenue)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Tax Collected</div>
                    <div className="stat-value">{formatCurrency(dayCloseData.total_tax)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Discounts Given</div>
                    <div className="stat-value">{formatCurrency(dayCloseData.total_discount)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Settled Amount</div>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>{formatCurrency(dayCloseData.settled_amount)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Unsettled / Credit</div>
                    <div className="stat-value" style={{ color: 'var(--danger)' }}>{formatCurrency(dayCloseData.unsettled_amount)}</div>
                  </div>
                </div>

                <div className="report-cards">
                  <div className="card">
                    <h3 className="card-title">Payment Breakdown</h3>
                    {Object.entries(dayCloseData.payment_breakdown).map(([method, amount]) => (
                      <div key={method} className="report-item">
                        <span style={{ textTransform: 'capitalize' }}>{method}</span>
                        <span className="report-value amount-text">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                    {Object.keys(dayCloseData.payment_breakdown).length === 0 && (
                      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No transactions</div>
                    )}
                  </div>

                  <div className="card">
                    <h3 className="card-title">Top Products</h3>
                    {dayCloseData.top_products.map((product, idx) => (
                      <div key={idx} className="report-item">
                        <span>{product.name}</span>
                        <span className="report-value">{product.quantity} sold · {formatCurrency(product.revenue)}</span>
                      </div>
                    ))}
                    {dayCloseData.top_products.length === 0 && (
                      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No products sold</div>
                    )}
                  </div>
                </div>

                {dayCloseData.bills && dayCloseData.bills.length > 0 && (
                  <div className="card" style={{ marginTop: '20px' }}>
                    <h3 className="card-title">Bills for {dayCloseDate}</h3>
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Invoice</th>
                            <th>Customer</th>
                            <th>Items</th>
                            <th>Total</th>
                            <th>Payment</th>
                            <th>Status</th>
                            <th>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dayCloseData.bills.map(bill => (
                            <tr key={bill.id}>
                              <td><strong>{bill.invoice_no}</strong></td>
                              <td>{bill.customer_name || '-'}</td>
                              <td>{bill.items.length} items</td>
                              <td className="amount-text">{formatCurrency(bill.total)}</td>
                              <td style={{ textTransform: 'capitalize' }}>{bill.payment_method}</td>
                              <td>
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  background: bill.settled ? 'var(--success)' : 'var(--danger)',
                                  color: 'white'
                                }}>
                                  {bill.settled ? 'Settled' : 'Pending'}
                                </span>
                              </td>
                              <td>{new Date(bill.created_at).toLocaleTimeString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {dayCloseData.total_bills === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '18px' }}>
                    📭 No bills found for {dayCloseDate}
                  </div>
                )}
              </>
            )}

            {!dayCloseLoading && !dayCloseData && (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '18px' }}>
                Select a date and click Refresh to load the report.
              </div>
            )}
          </div>
        )}

        {/* Home Base Dashboard View Panel */}
        {view === VIEWS.DASHBOARD && (
          <div className="content-view">
            <div className="view-header">
              <h2 className="section-title">🏠 Dashboard</h2>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>

            {!dashData ? (
              <div style={{ textAlign: 'center', padding: '60px', fontSize: '18px' }}>⏳ Loading dashboard...</div>
            ) : (
              <>
                <div style={{ marginBottom: '8px', fontWeight: 600, color: 'var(--text-muted)', fontSize: '13px', letterSpacing: 1 }}>TODAY'S SUMMARY</div>
                <div className="stats-grid">
                  <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setView(VIEWS.BILLS)}>
                    <div className="stat-label">Today's Revenue</div>
                    <div className="stat-value amount-text">{formatCurrency(dashData.today.total_revenue || 0)}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4 }}>{dashData.today.total_bills || 0} bills</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Tax Collected</div>
                    <div className="stat-value">{formatCurrency(dashData.today.total_tax || 0)}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4 }}>GST</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Discounts Given</div>
                    <div className="stat-value" style={{ color: 'var(--warning)' }}>{formatCurrency(dashData.today.total_discount || 0)}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4 }}>Today</div>
                  </div>
                  <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setView(VIEWS.BALANCE)}>
                    <div className="stat-label">Outstanding Balance</div>
                    <div className="stat-value" style={{ color: 'var(--danger)' }}>{formatCurrency(bills.filter(b => !b.settled && b.balance_amount > 0).reduce((s, b) => s + (b.balance_amount || 0), 0))}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4 }}>Credit due</div>
                  </div>
                  <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setView(VIEWS.CUSTOMERS)}>
                    <div className="stat-label">Total Customers</div>
                    <div className="stat-value">{dashData.totalCustomers}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4 }}>Registered</div>
                  </div>
                  <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setView(VIEWS.LOW_STOCK)}>
                    <div className="stat-label">Low Stock Items</div>
                    <div className="stat-value" style={{ color: dashData.lowStockCount > 0 ? 'var(--warning)' : 'var(--success)' }}>{dashData.lowStockCount}</div>
                    <div style={{ fontSize: '12px', color: 'var(--danger)', marginTop: 4 }}>{dashData.outOfStock} out of stock</div>
                  </div>
                </div>

                <div className="report-cards" style={{ marginTop: 20 }}>
                  <div className="card">
                    <h3 className="card-title">💳 Today's Payment Breakdown</h3>
                    {dashData.dayClose && Object.entries(dashData.dayClose.payment_breakdown || {}).length > 0 ? (
                      Object.entries(dashData.dayClose.payment_breakdown).map(([method, amount]) => (
                        <div key={method} className="report-item">
                          <span style={{ textTransform: 'capitalize' }}>{method}</span>
                          <span className="report-value amount-text">{formatCurrency(amount)}</span>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No transactions today</div>
                    )}
                  </div>

                  <div className="card">
                    <h3 className="card-title">🏆 Top Selling Today</h3>
                    {dashData.dayClose && dashData.dayClose.top_products && dashData.dayClose.top_products.length > 0 ? (
                      dashData.dayClose.top_products.slice(0, 5).map((p, i) => (
                        <div key={i} className="report-item">
                          <span>{i + 1}. {p.name}</span>
                          <span className="report-value">{p.quantity} sold</span>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No sales today</div>
                    )}
                  </div>
                </div>

                <div className="report-cards" style={{ marginTop: 0 }}>
                  <div className="card">
                    <h3 className="card-title">⚡ Quick Actions</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
                      <button className="btn btn-primary" onClick={() => setView(VIEWS.POS)}>🛒 New Sale</button>
                      <button className="btn" onClick={() => setView(VIEWS.QUOTATIONS)}>📋 New Quotation</button>
                      <button className="btn" onClick={() => setView(VIEWS.STOCK_ADJUSTMENTS)}>🔧 Adjust Stock</button>
                      <button className="btn" onClick={() => setView(VIEWS.DAY_CLOSE)}>🔒 Day Close</button>
                      <button className="btn" onClick={() => setView(VIEWS.REPORTS)}>📊 Reports</button>
                    </div>
                  </div>

                  <div className="card">
                    <h3 className="card-title">📦 Inventory Status</h3>
                    <div className="report-item">
                      <span>Total Products</span>
                      <span className="report-value">{dashData.totalProducts}</span>
                    </div>
                    <div className="report-item">
                      <span>Low Stock</span>
                      <span className="report-value" style={{ color: 'var(--warning)' }}>{dashData.lowStockCount} items</span>
                    </div>
                    <div className="report-item">
                      <span>Out of Stock</span>
                      <span className="report-value" style={{ color: 'var(--danger)' }}>{dashData.outOfStock} items</span>
                    </div>
                    <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setView(VIEWS.INVENTORY)}>View Inventory →</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Stock Adjustments Panel */}
        {view === VIEWS.STOCK_ADJUSTMENTS && (
          <div className="content-view">
            <div className="view-header">
              <h2 className="section-title">🔧 Stock Adjustments</h2>
            </div>

            <div className="card add-product-card">
              <h3 className="card-title">New Adjustment</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Product *</label>
                  <select className="input" value={adjProduct} onChange={e => setAdjProduct(e.target.value)}>
                    <option value="">-- Select Product --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Current: {p.stock} {p.unit})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Adjustment Type *</label>
                  <select className="input" value={adjType} onChange={e => setAdjType(e.target.value)}>
                    <option value="add">➕ Add Stock</option>
                    <option value="remove">➖ Remove Stock</option>
                    <option value="set">🔄 Set Stock (Override)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Quantity *</label>
                  <input className="input" type="number" min="1" placeholder="Enter quantity" value={adjQty} onChange={e => setAdjQty(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Reason</label>
                  <input className="input" placeholder="e.g. Damaged goods, New purchase, Stock count..." value={adjReason} onChange={e => setAdjReason(e.target.value)} />
                </div>
              </div>
              {adjProduct && adjQty && (() => {
                const prod = products.find(p => p.id === adjProduct);
                if (!prod) return null;
                const qty = parseInt(adjQty) || 0;
                const newStock = adjType === 'add' ? prod.stock + qty : adjType === 'remove' ? Math.max(0, prod.stock - qty) : qty;
                return (
                  <div style={{ padding: '10px 16px', background: 'var(--card-bg)', borderRadius: 8, marginBottom: 12, fontSize: 14 }}>
                    Preview: <strong>{prod.name}</strong> stock will change from <strong style={{ color: 'var(--warning)' }}>{prod.stock}</strong> → <strong style={{ color: 'var(--success)' }}>{newStock}</strong>
                  </div>
                );
              })()}
              <button className="btn btn-primary" onClick={handleStockAdjustment} disabled={adjLoading}>
                {adjLoading ? '⏳ Saving...' : '✅ Apply Adjustment'}
              </button>
            </div>

            <div className="card" style={{ marginTop: 20 }}>
              <h3 className="card-title">Adjustment History</h3>
              {stockAdjustments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No adjustments yet</div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Type</th>
                        <th>Qty</th>
                        <th>Before</th>
                        <th>After</th>
                        <th>Reason</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockAdjustments.map(a => (
                        <tr key={a.id}>
                          <td><strong>{a.product_name}</strong></td>
                          <td>
                            <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: a.adjustment_type === 'add' ? 'var(--success)' : a.adjustment_type === 'remove' ? 'var(--danger)' : 'var(--warning)', color: 'white' }}>
                              {a.adjustment_type === 'add' ? '➕ Add' : a.adjustment_type === 'remove' ? '➖ Remove' : '🔄 Set'}
                            </span>
                          </td>
                          <td>{a.quantity}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{a.previous_stock}</td>
                          <td style={{ color: 'var(--success)', fontWeight: 600 }}>{a.new_stock}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{a.reason || '-'}</td>
                          <td>{new Date(a.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quotations Management View */}
        {view === VIEWS.QUOTATIONS && (
          <div className="content-view">
            <div className="view-header">
              <h2 className="section-title">📋 Quotations</h2>
            </div>

            <div className="card add-product-card">
              <h3 className="card-title">Create New Quotation</h3>
              <div className="form-grid">
                <input className="input" placeholder="Customer Name" value={quotCustomerName} onChange={e => setQuotCustomerName(e.target.value)} />
                <input className="input" placeholder="Customer Phone" value={quotCustomerPhone} onChange={e => setQuotCustomerPhone(e.target.value)} />
                <div className="form-group">
                  <label>Valid Until</label>
                  <input className="input date-input" type="date" value={quotValidUntil} onChange={e => setQuotValidUntil(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Discount %</label>
                  <input className="input" type="number" min="0" max="100" placeholder="0" value={quotDiscount} onChange={e => setQuotDiscount(parseFloat(e.target.value) || 0)} />
                </div>
              </div>
              <input className="input" placeholder="Notes (optional)" value={quotNotes} onChange={e => setQuotNotes(e.target.value)} style={{ marginBottom: 12 }} />

              <div style={{ marginBottom: 10, fontWeight: 600, fontSize: 13, color: 'var(--text-muted)' }}>ADD PRODUCTS</div>
              <div className="products-grid" style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 12 }}>
                {products.map(p => (
                  <div key={p.id} className="product-card" onClick={() => addToQuotCart(p)} style={{ cursor: 'pointer' }}>
                    <div className="product-name">{p.name}</div>
                    <div className="product-footer">
                      <span className="product-price">{formatCurrency(p.price)}</span>
                      <span className="product-stock">Stock: {p.stock}</span>
                    </div>
                  </div>
                ))}
              </div>

              {quotCart.length > 0 && (
                <>
                  <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: 'var(--text-muted)' }}>QUOTATION ITEMS</div>
                  <div className="table-container" style={{ marginBottom: 12 }}>
                    <table className="data-table">
                      <thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Total</th><th></th></tr></thead>
                      <tbody>
                        {quotCart.map(item => (
                          <tr key={item.product_id}>
                            <td>{item.name}</td>
                            <td>{formatCurrency(item.price)}</td>
                            <td>
                              <input type="number" className="input qty-input" min="1" value={item.quantity}
                                onChange={e => setQuotCart(quotCart.map(i => i.product_id === item.product_id ? { ...i, quantity: parseInt(e.target.value) || 1 } : i))} />
                            </td>
                            <td>{formatCurrency(item.price * item.quantity)}</td>
                            <td><button className="btn btn-danger btn-sm" onClick={() => setQuotCart(quotCart.filter(i => i.product_id !== item.product_id))}>✕</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {(() => {
                    const { subtotal, discountAmount, taxAmount, total } = calculateQuotation();
                    return (
                      <div className="bill-summary" style={{ marginBottom: 12 }}>
                        <div className="summary-line"><span>Subtotal:</span><span>{formatCurrency(subtotal)}</span></div>
                        {discountAmount > 0 && <div className="summary-line"><span>Discount ({quotDiscount}%):</span><span className="discount-text">- {formatCurrency(discountAmount)}</span></div>}
                        {settings.tax_enabled && <div className="summary-line"><span>GST ({settings.tax_percent}%):</span><span>{formatCurrency(taxAmount)}</span></div>}
                        <div className="summary-line total-line"><span>Total:</span><span>{formatCurrency(total)}</span></div>
                      </div>
                    );
                  })()}
                  <button className="btn btn-primary" onClick={handleCreateQuotation}>📋 Save Quotation</button>
                </>
              )}
            </div>

            <div className="card" style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 className="card-title" style={{ margin: 0 }}>All Quotations</h3>
                <input className="input" placeholder="Search quotations..." value={quotSearch} onChange={e => setQuotSearch(e.target.value)} style={{ width: 220 }} />
              </div>
              {quotations.filter(q => !quotSearch || q.quotation_no.toLowerCase().includes(quotSearch.toLowerCase()) || (q.customer_name || '').toLowerCase().includes(quotSearch.toLowerCase())).length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No quotations found</div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr><th>Quotation No</th><th>Customer</th><th>Items</th><th>Total</th><th>Valid Until</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {quotations
                        .filter(q => !quotSearch || q.quotation_no.toLowerCase().includes(quotSearch.toLowerCase()) || (q.customer_name || '').toLowerCase().includes(quotSearch.toLowerCase()))
                        .map(q => (
                          <tr key={q.id}>
                            <td><strong>{q.quotation_no}</strong></td>
                            <td>{q.customer_name || '-'}<br/><span className="sub-text">{q.customer_phone}</span></td>
                            <td>{q.items.length} items</td>
                            <td className="amount-text">{formatCurrency(q.total)}</td>
                            <td>{q.valid_until ? new Date(q.valid_until).toLocaleDateString() : '-'}</td>
                            <td>
                              <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: q.status === 'converted' ? 'var(--success)' : q.status === 'expired' ? 'var(--danger)' : 'var(--warning)', color: 'white' }}>
                                {q.status}
                              </span>
                            </td>
                            <td>
                              <div className="table-actions">
                                <button className="btn btn-sm" onClick={() => setShowQuotation(q)}>View</button>
                                {q.status === 'pending' && (
                                  <button className="btn btn-sm btn-primary" onClick={() => handleConvertQuotation(q)}>→ POS</button>
                                )}
                                <button className="btn btn-sm btn-danger" onClick={() => handleDeleteQuotation(q.id)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Returns View Terminal */}
        {view === VIEWS.RETURNS && (
          <div className="content-view">
            <div className="view-header">
              <h2 className="section-title">↩️ Returns & Refunds</h2>
            </div>

            <div className="card add-product-card">
              <h3 className="card-title">Process Return</h3>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <input className="input" placeholder="Enter Invoice Number..."
                  value={returnBillNo} onChange={e => setReturnBillNo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchReturnBill()} />
                <button className="btn btn-primary" onClick={searchReturnBill} disabled={returnLoading}>
                  {returnLoading ? '⏳' : '🔍 Search'}
                </button>
              </div>

              {returnBill && (
                <>
                  <div style={{ padding: '10px 14px', background: 'var(--card-bg)', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                    <strong>{returnBill.invoice_no}</strong> — {returnBill.customer_name || 'Guest'} — {new Date(returnBill.created_at).toLocaleDateString()} — Total: {formatCurrency(returnBill.total)}
                  </div>

                  <div className="table-container" style={{ marginBottom: 12 }}>
                    <table className="data-table">
                      <thead><tr><th>Item</th><th>Sold Qty</th><th>Return Qty</th><th>Refund</th></tr></thead>
                      <tbody>
                        {returnItems.map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.name}</td>
                            <td>{item.quantity}</td>
                            <td>
                              <input type="number" className="input qty-input" min="0" max={item.quantity}
                                value={item.return_qty}
                                onChange={e => setReturnItems(returnItems.map((i, ii) => ii === idx ? { ...i, return_qty: Math.min(parseInt(e.target.value) || 0, i.quantity) } : i))} />
                            </td>
                            <td className="amount-text">{formatCurrency(item.price * item.return_qty)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--card-bg)', borderRadius: 8, fontWeight: 600 }}>
                    Total Refund: <span className="amount-text">{formatCurrency(returnItems.reduce((s, i) => s + i.price * i.return_qty, 0))}</span>
                  </div>

                  <input className="input" placeholder="Reason for return..."
                    value={returnReason} onChange={e => setReturnReason(e.target.value)} style={{ marginBottom: 12 }} />

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary" onClick={processReturn}>✅ Process Return</button>
                    <button className="btn" onClick={() => { setReturnBill(null); setReturnBillNo(''); setReturnItems([]); }}>Cancel</button>
                  </div>
                </>
              )}
            </div>

            <div className="card" style={{ marginTop: 20 }}>
              <h3 className="card-title">Return History ({returns.length})</h3>
              {returns.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No returns processed yet</div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead><tr><th>Return No</th><th>Original Invoice</th><th>Customer</th><th>Items</th><th>Refund</th><th>Reason</th><th>Date</th></tr></thead>
                    <tbody>
                      {returns.map(r => (
                        <tr key={r.id}>
                          <td><strong>{r.return_no}</strong></td>
                          <td>{r.original_invoice}</td>
                          <td>{r.customer_name || '-'}</td>
                          <td>{r.items.length} items</td>
                          <td className="amount-text">{formatCurrency(r.refund_amount)}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{r.reason || '-'}</td>
                          <td>{new Date(r.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Expenses View (Fixed Dropdown expression) */}
        {view === VIEWS.EXPENSES && (
          <div className="content-view">
            <div className="view-header">
              <h2 className="section-title">💸 Expense Tracking</h2>
              <button className="btn btn-primary" onClick={exportExpenses}>Export Excel</button>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Total Expenses</div>
                <div className="stat-value" style={{ color: 'var(--danger)' }}>{formatCurrency(expenses.reduce((s, e) => s + e.amount, 0))}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">This Month</div>
                <div className="stat-value" style={{ color: 'var(--warning)' }}>
                  {formatCurrency(expenses.filter(e => e.date && e.date.slice(0,7) === new Date().toISOString().slice(0,7)).reduce((s, e) => s + e.amount, 0))}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Today</div>
                <div className="stat-value">
                  {formatCurrency(expenses.filter(e => e.date === new Date().toISOString().slice(0,10)).reduce((s, e) => s + e.amount, 0))}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Entries</div>
                <div className="stat-value">{expenses.length}</div>
              </div>
            </div>

            <div className="card add-product-card">
              <h3 className="card-title">Add Expense</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Category *</label>
                  <select className="input" value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Amount *</label>
                  <input className="input" type="number" min="0" placeholder="Enter amount" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input className="input date-input" type="date" value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <input className="input" placeholder="Details..." value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} />
                </div>
              </div>
              <button className="btn btn-primary" onClick={addExpense}>➕ Add Expense</button>
            </div>

            <div className="card" style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 className="card-title" style={{ margin: 0 }}>Expense History</h3>
                <input className="input" placeholder="Search expenses..." value={expenseSearch} onChange={e => setExpenseSearch(e.target.value)} style={{ width: 220 }} />
              </div>
              {expenses.filter(e => !expenseSearch || e.category.toLowerCase().includes(expenseSearch.toLowerCase()) || (e.description || '').toLowerCase().includes(expenseSearch.toLowerCase())).length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No expenses recorded</div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Action</th></tr></thead>
                    <tbody>
                      {expenses
                        .filter(e => !expenseSearch || e.category.toLowerCase().includes(expenseSearch.toLowerCase()) || (e.description || '').toLowerCase().includes(expenseSearch.toLowerCase()))
                        .map(e => (
                          <tr key={e.id}>
                            <td>{e.date}</td>
                            <td><span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: 'var(--accent)', color: 'white' }}>{e.category}</span></td>
                            <td style={{ color: 'var(--text-muted)' }}>{e.description || '-'}</td>
                            <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{formatCurrency(e.amount)}</td>
                            <td><button className="btn btn-sm btn-danger" onClick={() => deleteExpense(e.id)}>Delete</button></td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {expenses.length > 0 && (
              <div className="card" style={{ marginTop: 20 }}>
                <h3 className="card-title">By Category</h3>
                {EXPENSE_CATEGORIES.map(cat => {
                  const total = expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0);
                  if (total === 0) return null;
                  return (
                    <div key={cat} className="report-item">
                      <span>{cat}</span>
                      <span className="report-value" style={{ color: 'var(--danger)' }}>{formatCurrency(total)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Settings Configurations Panel */}
        {view === VIEWS.SETTINGS && (
          <div className="content-view">
            <div className="view-header">
              <h2 className="section-title">Settings</h2>
            </div>
            
            <div className="settings-container">
              <div className="card">
                <h3 className="card-title">Shop Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Software Name</label>
                    <input
                      data-testid="settings-software-name"
                      className="input"
                      placeholder="Software Name"
                      value={settings.software_name}
                      onChange={(e) => setSettings({ ...settings, software_name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Shop Name</label>
                    <input
                      data-testid="settings-shop-name"
                      className="input"
                      placeholder="Shop Name"
                      value={settings.shop_name}
                      onChange={(e) => setSettings({ ...settings, shop_name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>GSTIN</label>
                    <input
                      data-testid="settings-gstin"
                      className="input"
                      placeholder="GSTIN"
                      value={settings.gstin}
                      onChange={(e) => setSettings({ ...settings, gstin: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Address</label>
                    <input
                      data-testid="settings-address"
                      className="input"
                      placeholder="Address"
                      value={settings.address}
                      onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      data-testid="settings-phone"
                      className="input"
                      placeholder="Phone"
                      value={settings.phone}
                      onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      data-testid="settings-email"
                      className="input"
                      placeholder="Email"
                      type="email"
                      value={settings.settings_email || settings.email}
                      onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="card-title">POS Options</h3>
                <div className="settings-options">
                  <div className="setting-item">
                    <span>Enable GST</span>
                    <button
                      data-testid="settings-tax-toggle"
                      className={`btn ${settings.tax_enabled ? 'btn-success' : 'btn-danger'}`}
                      onClick={() => setSettings({ ...settings, tax_enabled: !settings.tax_enabled })}
                    >
                      {settings.tax_enabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  {settings.tax_enabled && (
                    <div className="form-group">
                      <label>GST Percentage (%)</label>
                      <input
                        data-testid="settings-tax-percent"
                        className="input"
                        type="number"
                        value={settings.tax_percent}
                        onChange={(e) => setSettings({ ...settings, tax_percent: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  )}
                  <div className="setting-item">
                    <span>Auto Print Receipt</span>
                    <button
                      data-testid="settings-autoprint-toggle"
                      className={`btn ${settings.auto_print ? 'btn-success' : 'btn-danger'}`}
                      onClick={() => setSettings({ ...settings, auto_print: !settings.auto_print })}
                    >
                      {settings.auto_print ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  <div className="form-group">
                    <label>Low Stock Alert Threshold</label>
                    <input
                      data-testid="settings-low-stock"
                      className="input"
                      type="number"
                      value={settings.low_stock_threshold}
                      onChange={(e) => setSettings({ ...settings, low_stock_threshold: parseInt(e.target.value) || 10 })}
                    />
                  </div>
                </div>
              </div>

              <button
                data-testid="save-settings-btn"
                className="btn btn-primary"
                onClick={handleUpdateSettings}
              >
                Save Settings
              </button>
            </div>
          </div>
        )}

        {/* ANALYTICS VIEW */}
        {view === VIEWS.ANALYTICS && (
          <div className="content-view">
            <div className="view-header">
              <h2 className="section-title">📈 Profit & Loss Analytics</h2>
              <button className="btn btn-primary" onClick={fetchAnalytics}>Refresh</button>
            </div>
            <div className="filters-bar">
              <div className="period-filters">
                {['today','week','month','year','all'].map(p => (
                  <button key={p} className={`btn ${analyticsPeriod === p && !analyticsStart ? 'active' : ''}`}
                    onClick={() => { setAnalyticsPeriod(p); setAnalyticsStart(''); setAnalyticsEnd(''); }}>
                    {p === 'today' ? 'Today' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : p === 'year' ? 'Year' : 'All'}
                  </button>
                ))}
              </div>
              <div className="date-range">
                <input className="input date-input" type="date" value={analyticsStart} onChange={e => setAnalyticsStart(e.target.value)} />
                <span>to</span>
                <input className="input date-input" type="date" value={analyticsEnd} onChange={e => setAnalyticsEnd(e.target.value)} />
              </div>
            </div>
            {analyticsData && (
              <>
                <div className="stats-grid">
                  <div className="stat-card"><div className="stat-label">Total Revenue</div><div className="stat-value amount-text">{formatCurrency(analyticsData.total_revenue)}</div></div>
                  <div className="stat-card"><div className="stat-label">Cost of Goods (COGS)</div><div className="stat-value" style={{ color: 'var(--danger)' }}>{formatCurrency(analyticsData.total_cogs)}</div></div>
                  <div className="stat-card"><div className="stat-label">Gross Profit</div><div className="stat-value" style={{ color: 'var(--success)' }}>{formatCurrency(analyticsData.gross_profit)}</div></div>
                  <div className="stat-card"><div className="stat-label">Gross Margin</div><div className="stat-value">{analyticsData.gross_margin_percent}%</div></div>
                  <div className="stat-card"><div className="stat-label">Expenses</div><div className="stat-value" style={{ color: 'var(--danger)' }}>{formatCurrency(analyticsData.total_expenses)}</div></div>
                  <div className="stat-card"><div className="stat-label">Net Profit</div><div className="stat-value" style={{ color: analyticsData.net_profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatCurrency(analyticsData.net_profit)}</div></div>
                  <div className="stat-card"><div className="stat-label">Total Bills</div><div className="stat-value">{analyticsData.total_bills}</div></div>
                  <div className="stat-card"><div className="stat-label">Avg Bill Value</div><div className="stat-value">{formatCurrency(analyticsData.avg_bill_value)}</div></div>
                </div>
                <div className="report-cards">
                  <div className="card">
                    <h3 className="card-title">Tax & Discounts</h3>
                    <div className="report-item"><span>Tax Collected (GST)</span><span className="report-value amount-text">{formatCurrency(analyticsData.total_tax_collected)}</span></div>
                    <div className="report-item"><span>Discounts Given</span><span className="report-value" style={{ color: 'var(--danger)' }}>{formatCurrency(analyticsData.total_discounts)}</span></div>
                  </div>
                  <div className="card">
                    <h3 className="card-title">Top 10 Revenue Items</h3>
                    {(analyticsData.top_items || []).map((item, i) => (
                      <div key={i} className="report-item"><span>{item.name}</span><span className="report-value amount-text">{formatCurrency(item.revenue)}</span></div>
                    ))}
                  </div>
                </div>
                {analyticsData.daily_trend && analyticsData.daily_trend.length > 0 && (
                  <div className="card" style={{ marginTop: 16 }}>
                    <h3 className="card-title">Daily Revenue Trend</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table">
                        <thead><tr><th>Date</th><th>Revenue</th></tr></thead>
                        <tbody>
                          {analyticsData.daily_trend.slice(-30).map((d, i) => (
                            <tr key={i}><td>{d.date}</td><td className="amount-text">{formatCurrency(d.revenue)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
            {!analyticsData && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading analytics...</div>}
          </div>
        )}

        {/* SUPPLIERS VIEW */}
        {view === VIEWS.SUPPLIERS && (
          <div className="content-view">
            <div className="view-header"><h2 className="section-title">🏭 Supplier Management</h2></div>
            <div className="report-cards">
              <div className="card">
                <h3 className="card-title">{editSupplier ? 'Edit Supplier' : 'Add Supplier'}</h3>
                {[['name','Name *'],['phone','Phone'],['email','Email'],['contact_person','Contact Person'],['gstin','GSTIN'],['address','Address']].map(([k,l]) => (
                  <input key={k} className="input" style={{ marginBottom: 8 }} placeholder={l}
                    value={editSupplier ? editSupplier[k] || '' : supplierForm[k] || ''}
                    onChange={e => editSupplier ? setEditSupplier({ ...editSupplier, [k]: e.target.value }) : setSupplierForm({ ...supplierForm, [k]: e.target.value })} />
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-primary" onClick={handleSaveSupplier}>{editSupplier ? 'Update' : 'Add Supplier'}</button>
                  {editSupplier && <button className="btn" onClick={() => setEditSupplier(null)}>Cancel</button>}
                </div>
              </div>
              <div className="card" style={{ flex: 2 }}>
                <h3 className="card-title">Suppliers ({suppliers.length})</h3>
                <input className="input" placeholder="Search suppliers..." value={supplierSearch}
                  onChange={e => setSupplierSearch(e.target.value)} style={{ marginBottom: 12 }} />
                <div className="table-container">
                  <table className="data-table">
                    <thead><tr><th>Name</th><th>Phone</th><th>GSTIN</th><th>Contact</th><th>Actions</th></tr></thead>
                    <tbody>
                      {suppliers.filter(s => !supplierSearch || s.name.toLowerCase().includes(supplierSearch.toLowerCase()) || s.phone.includes(supplierSearch)).map(s => (
                        <tr key={s.id}>
                          <td><strong>{s.name}</strong><br/><span className="sub-text">{s.email}</span></td>
                          <td>{s.phone}</td>
                          <td>{s.gstin || '-'}</td>
                          <td>{s.contact_person || '-'}</td>
                          <td>
                            <div className="table-actions">
                              <button className="btn btn-sm" onClick={() => setEditSupplier({ ...s })}>✏️</button>
                              <button className="btn btn-sm btn-danger" onClick={() => handleDeleteSupplier(s.id)}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PURCHASE ORDERS VIEW */}
        {view === VIEWS.PURCHASE_ORDERS && (
          <div className="content-view">
            <div className="view-header">
              <h2 className="section-title">📥 Purchase Orders</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {['all','pending','received','cancelled'].map(f => (
                  <button key={f} className={`btn btn-sm ${poFilter === f ? 'active' : ''}`}
                    onClick={() => { setPoFilter(f); fetchPurchaseOrders(); }}>{f.charAt(0).toUpperCase()+f.slice(1)}</button>
                ))}
                <button className="btn btn-primary" onClick={() => setPoView(poView === 'create' ? 'list' : 'create')}>
                  {poView === 'create' ? '← Back to List' : '+ New PO'}
                </button>
              </div>
            </div>

            {poView === 'create' ? (
              <div className="report-cards">
                <div className="card">
                  <h3 className="card-title">New Purchase Order</h3>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Supplier *</label>
                    <select className="input" value={poForm.supplier_id}
                      onChange={e => { const s = suppliers.find(x => x.id === e.target.value); setPoForm({ ...poForm, supplier_id: e.target.value, supplier_name: s?.name || '' }); }}>
                      <option value="">Select Supplier</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}><label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Expected Date</label>
                      <input type="date" className="input" value={poForm.expected_date} onChange={e => setPoForm({ ...poForm, expected_date: e.target.value })} /></div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Notes</label>
                    <input className="input" placeholder="Notes..." value={poForm.notes} onChange={e => setPoForm({ ...poForm, notes: e.target.value })} />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Search Products</label>
                    <input className="input" placeholder="Search products..." value={poProductSearch} onChange={e => setPoProductSearch(e.target.value)} />
                    <div style={{ maxHeight: 150, overflowY: 'auto', marginTop: 4 }}>
                      {products.filter(p => !poProductSearch || p.name.toLowerCase().includes(poProductSearch.toLowerCase())).slice(0, 10).map(p => (
                        <div key={p.id} style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}
                          onClick={() => addPoItem(p)}>
                          <span>{p.name}</span><span className="sub-text">Stock: {p.stock} | ₹{p.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <h4 style={{ margin: '12px 0 8px' }}>Items ({poForm.items.length})</h4>
                  {poForm.items.map(item => (
                    <div key={item.product_id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: 8, background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                      <span style={{ flex: 2 }}>{item.product_name}</span>
                      <input type="number" className="input" style={{ width: 70 }} placeholder="Qty" value={item.quantity} onChange={e => updatePoItem(item.product_id, 'quantity', e.target.value)} />
                      <input type="number" className="input" style={{ width: 90 }} placeholder="Cost" value={item.unit_cost} onChange={e => updatePoItem(item.product_id, 'unit_cost', e.target.value)} />
                      <span style={{ minWidth: 70 }} className="amount-text">₹{item.total_cost.toFixed(2)}</span>
                      <button className="btn btn-sm btn-danger" onClick={() => removePoItem(item.product_id)}>✕</button>
                    </div>
                  ))}
                  {poForm.items.length > 0 && (
                    <div style={{ textAlign: 'right', marginTop: 8, fontSize: 16, fontWeight: 'bold' }}>
                      Total: ₹{poForm.items.reduce((s, i) => s + i.total_cost, 0).toFixed(2)}
                    </div>
                  )}
                  <button className="btn btn-primary" style={{ marginTop: 16, width: '100%' }} onClick={handleCreatePO}>Create Purchase Order</button>
                </div>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead><tr><th>PO Number</th><th>Supplier</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
                  <tbody>
                    {purchaseOrders.map(po => (
                      <tr key={po.id}>
                        <td className="invoice-no">{po.po_number}</td>
                        <td>{po.supplier_name}</td>
                        <td>{po.items.length} items</td>
                        <td className="amount-text">{formatCurrency(po.total)}</td>
                        <td><span className={`tag ${po.status === 'received' ? 'tag-success' : po.status === 'cancelled' ? 'tag-danger' : ''}`}>{po.status}</span></td>
                        <td>{new Date(po.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="table-actions">
                            {po.status === 'pending' && <>
                              <button className="btn btn-sm btn-primary" onClick={() => handleReceivePO(po.id)}>✓ Receive</button>
                              <button className="btn btn-sm" onClick={() => handleCancelPO(po.id)}>Cancel</button>
                            </>}
                            {po.status !== 'pending' && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{po.received_date ? `Received: ${new Date(po.received_date).toLocaleDateString()}` : po.status}</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {purchaseOrders.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 30 }}>No purchase orders found</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* BRANCHES & USERS VIEW */}
        {view === VIEWS.BRANCHES && (
          <div className="content-view">
            <div className="view-header">
              <h2 className="section-title">🏢 Branches & Users</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={`btn ${multibranchTab === 'branches' ? 'active' : ''}`} onClick={() => setMultibranchTab('branches')}>🏢 Branches</button>
                <button className={`btn ${multibranchTab === 'users' ? 'active' : ''}`} onClick={() => setMultibranchTab('users')}>👤 Users</button>
                {currentUser ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                    <span style={{ fontSize: 12 }}>👤 {currentUser.name} ({currentUser.role})</span>
                    <button className="btn btn-sm" onClick={handleLogout}>Logout</button>
                  </div>
                ) : (
                  <button className="btn btn-primary" onClick={() => setShowLoginModal(true)}>🔐 Login</button>
                )}
              </div>
            </div>

            {multibranchTab === 'branches' ? (
              <div className="report-cards">
                <div className="card">
                  <h3 className="card-title">{editBranch ? 'Edit Branch' : 'Add Branch'}</h3>
                  {[['name','Branch Name *'],['address','Address'],['phone','Phone'],['gstin','GSTIN']].map(([k,l]) => (
                    <input key={k} className="input" style={{ marginBottom: 8 }} placeholder={l}
                      value={editBranch ? editBranch[k] || '' : branchForm[k] || ''}
                      onChange={e => editBranch ? setEditBranch({ ...editBranch, [k]: e.target.value }) : setBranchForm({ ...branchForm, [k]: e.target.value })} />
                ))}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" onClick={handleSaveBranch}>{editBranch ? 'Update' : 'Add Branch'}</button>
                    {editBranch && <button className="btn" onClick={() => setEditBranch(null)}>Cancel</button>}
                  </div>
                </div>
                <div className="card" style={{ flex: 2 }}>
                  <h3 className="card-title">Branches ({branches.length})</h3>
                  {branches.length === 0 ? <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>No branches added yet</div> : (
                    <div className="table-container">
                      <table className="data-table">
                        <thead><tr><th>Name</th><th>Phone</th><th>GSTIN</th><th>Actions</th></tr></thead>
                        <tbody>
                          {branches.map(b => (
                            <tr key={b.id}>
                              <td><strong>{b.name}</strong><br/><span className="sub-text">{b.address}</span></td>
                              <td>{b.phone}</td><td>{b.gstin || '-'}</td>
                              <td><div className="table-actions">
                                <button className="btn btn-sm" onClick={() => setEditBranch({ ...b })}>✏️</button>
                                <button className="btn btn-sm btn-danger" onClick={() => handleDeleteBranch(b.id)}>🗑️</button>
                              </div></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="report-cards">
                <div className="card">
                  <h3 className="card-title">{editUser ? 'Edit User' : 'Add User'}</h3>
                  {[['name','Full Name *'],['username','Username *'],['pin','4-digit PIN *']].map(([k,l]) => (
                    <input key={k} className="input" style={{ marginBottom: 8 }} placeholder={l} type={k === 'pin' ? 'password' : 'text'} maxLength={k === 'pin' ? 4 : undefined}
                      value={editUser ? editUser[k] || '' : userForm[k] || ''}
                      onChange={e => editUser ? setEditUser({ ...editUser, [k]: e.target.value }) : setUserForm({ ...userForm, [k]: e.target.value })} />
                  ))}
                  <select className="input" style={{ marginBottom: 8 }} value={editUser ? editUser.role : userForm.role}
                    onChange={e => editUser ? setEditUser({ ...editUser, role: e.target.value }) : setUserForm({ ...userForm, role: e.target.value })}>
                    <option value="cashier">Cashier</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                  <select className="input" style={{ marginBottom: 8 }} value={editUser ? editUser.branch_id : userForm.branch_id}
                    onChange={e => { const br = branches.find(b => b.id === e.target.value); editUser ? setEditUser({ ...editUser, branch_id: e.target.value, branch_name: br?.name||'' }) : setUserForm({ ...userForm, branch_id: e.target.value, branch_name: br?.name||'' }); }}>
                    <option value="">No Branch</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" onClick={handleSaveUser}>{editUser ? 'Update' : 'Add User'}</button>
                    {editUser && <button className="btn" onClick={() => setEditUser(null)}>Cancel</button>}
                  </div>
                </div>
                <div className="card" style={{ flex: 2 }}>
                  <h3 className="card-title">Users ({appUsers.length})</h3>
                  {appUsers.length === 0 ? <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>No users added yet</div> : (
                    <div className="table-container">
                      <table className="data-table">
                        <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Branch</th><th>Actions</th></tr></thead>
                        <tbody>
                          {appUsers.map(u => (
                            <tr key={u.id}>
                              <td>{u.name}</td><td>{u.username}</td>
                              <td><span className="tag">{u.role}</span></td>
                              <td>{u.branch_name || '-'}</td>
                              <td><div className="table-actions">
                                <button className="btn btn-sm" onClick={() => setEditUser({ ...u })}>✏️</button>
                                <button className="btn btn-sm btn-danger" onClick={() => handleDeleteUser(u.id)}>🗑️</button>
                              </div></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* LOYALTY POINTS VIEW */}
        {view === VIEWS.LOYALTY && (
          <div className="content-view">
            <div className="view-header"><h2 className="section-title">⭐ Loyalty Points Program</h2></div>
            <div className="report-cards">
              <div className="card">
                <h3 className="card-title">Program Settings</h3>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={loyaltySettings.enabled} onChange={e => setLoyaltySettings({ ...loyaltySettings, enabled: e.target.checked })} />
                    <span>Enable Loyalty Program</span>
                  </label>
                </div>
                {[
                  ['points_per_rupee', 'Points earned per ₹1 spent', 'number'],
                  ['rupees_per_point', '₹ value of 1 point on redemption', 'number'],
                  ['min_redeem_points', 'Minimum points to redeem', 'number'],
                  ['expiry_days', 'Points expiry (days)', 'number'],
                ].map(([k, l, t]) => (
                  <div key={k} style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{l}</label>
                    <input className="input" type={t} value={loyaltySettings[k]}
                      onChange={e => setLoyaltySettings({ ...loyaltySettings, [k]: parseFloat(e.target.value) || 0 })} />
                  </div>
                ))}
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 6, padding: 12, marginBottom: 12, fontSize: 13 }}>
                  <strong>How it works:</strong><br/>
                  Customer earns <strong>{loyaltySettings.points_per_rupee} pt</strong> per ₹1 spent.<br/>
                  Minimum <strong>{loyaltySettings.min_redeem_points} pts</strong> needed to redeem.<br/>
                  1 point = ₹<strong>{loyaltySettings.rupees_per_point}</strong> discount.
                </div>
                <button className="btn btn-primary" onClick={handleSaveLoyaltySettings}>Save Settings</button>
              </div>
              <div className="card" style={{ flex: 2 }}>
                <h3 className="card-title">Customer Points Lookup</h3>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input className="input" placeholder="Enter customer phone..." id="loyalty-phone-input" />
                  <button className="btn btn-primary" onClick={() => {
                    const phone = document.getElementById('loyalty-phone-input').value.trim();
                    if (phone) fetchLoyaltyInfo(phone);
                  }}>Lookup</button>
                </div>
                {loyaltyInfo && (
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--accent)', marginBottom: 8 }}>
                      ⭐ {loyaltyInfo.points} Points
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                      Redeemable value: ₹{(loyaltyInfo.points * loyaltySettings.rupees_per_point).toFixed(2)}
                    </div>
                    <h4 style={{ marginBottom: 8 }}>Recent Transactions</h4>
                    <div className="table-container">
                      <table className="data-table">
                        <thead><tr><th>Type</th><th>Points</th><th>Reference</th><th>Date</th></tr></thead>
                        <tbody>
                          {(loyaltyInfo.transactions || []).map((t, i) => (
                            <tr key={i}>
                              <td><span className={`tag ${t.type === 'earned' ? 'tag-success' : 'tag-danger'}`}>{t.type}</span></td>
                              <td style={{ color: t.points > 0 ? 'var(--success)' : 'var(--danger)' }}>{t.points > 0 ? '+' : ''}{t.points}</td>
                              <td>{t.reference}</td>
                              <td>{new Date(t.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                          {loyaltyInfo.transactions?.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No transactions</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* BARCODE LABELS VIEW */}
        {view === VIEWS.BARCODE_LABELS && (
          <div className="content-view">
            <div className="view-header">
              <h2 className="section-title">🏷️ Barcode Label Printing</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13 }}>Label size:</span>
                {['small','medium','large'].map(s => (
                  <button key={s} className={`btn btn-sm ${labelSize === s ? 'active' : ''}`} onClick={() => setLabelSize(s)}>
                    {s === 'small' ? '40×25mm' : s === 'medium' ? '60×35mm' : '80×50mm'}
                  </button>
                ))}
                <button className="btn btn-primary" onClick={printBarcodeLabels}>🖨️ Print Labels</button>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <input className="input" placeholder="Search products..." value={barcodeSearch}
                onChange={e => { setBarcodeSearchState(e.target.value); setBarcodeProducts(products.filter(p => !e.target.value || p.name.toLowerCase().includes(e.target.value.toLowerCase()) || p.barcode.includes(e.target.value))); }} />
            </div>
            <div style={{ marginBottom: 10, display: 'flex', gap: 10 }}>
              <button className="btn btn-sm" onClick={() => { const q = {}; barcodeProducts.forEach(p => q[p.id] = 1); setBarcodeQty(q); }}>Select All</button>
              <button className="btn btn-sm" onClick={() => setBarcodeQty({})}>Clear All</button>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>
                {Object.values(barcodeQty).reduce((s, v) => s + (v || 0), 0)} labels to print
              </span>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>Product</th><th>Barcode</th><th>Price</th><th>Category</th><th># Labels</th></tr></thead>
                <tbody>
                  {barcodeProducts.map(p => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td style={{ fontFamily: 'monospace', letterSpacing: 2 }}>{p.barcode}</td>
                      <td className="amount-text">₹{p.price}</td>
                      <td>{p.category}</td>
                      <td style={{ width: 100 }}>
                        <input type="number" className="input" style={{ width: 80 }} min={0} max={100}
                          value={barcodeQty[p.id] || 0}
                          onChange={e => setBarcodeQty({ ...barcodeQty, [p.id]: parseInt(e.target.value) || 0 })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STAFF LOGIN MODAL */}
        {showLoginModal && (
          <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
              <h3 style={{ marginBottom: 16 }}>🔐 Staff Login</h3>
              <input className="input" placeholder="Username" style={{ marginBottom: 8 }}
                value={loginForm.username} onChange={e => setLoginForm({ ...loginForm, username: e.target.value })} />
              <input className="input" type="password" placeholder="4-digit PIN" maxLength={4} style={{ marginBottom: 16 }}
                value={loginForm.pin} onChange={e => setLoginForm({ ...loginForm, pin: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={handleLogin}>Login</button>
                <button className="btn" onClick={() => setShowLoginModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Receipt Preview Popup Window */}
      {showReceipt && (
        <div className="modal-overlay" onClick={() => setShowReceipt(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} data-testid="receipt-modal">
            <div className="receipt-header">
              <h2>{settings.shop_name}</h2>
              {settings.gstin && <div>GSTIN: {settings.gstin}</div>}
              {settings.address && <div>{settings.address}</div>}
              {settings.phone && <div>Phone: {settings.phone}</div>}
              {settings.email && <div>Email: {settings.email}</div>}
            </div>

            <div className="receipt-info">
              <div>
                <strong>Invoice: {showReceipt.invoice_no}</strong>
              </div>
              <div>{new Date(showReceipt.created_at).toLocaleString()}</div>
              {showReceipt.customer_name && <div>Customer: {showReceipt.customer_name}</div>}
              {showReceipt.customer_phone && <div>Phone: {showReceipt.customer_phone}</div>}
            </div>

            <div className="receipt-items">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {showReceipt.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        {item.name}
                        {item.hsn_code && <div className="sub-text">HSN: {item.hsn_code}</div>}
                      </td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.price)}</td>
                      <td>{formatCurrency(item.price * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="receipt-totals">
              <div className="summary-line">
                <span>Subtotal:</span>
                <span>{formatCurrency(showReceipt.subtotal)}</span>
              </div>
              {showReceipt.discount_amount > 0 && (
                <div className="summary-line">
                  <span>Discount ({showReceipt.discount_percent}%):</span>
                  <span className="discount-text">- {formatCurrency(showReceipt.discount_amount)}</span>
                </div>
              )}
              {showReceipt.tax_amount > 0 && (
                <div className="summary-line">
                  <span>GST ({showReceipt.tax_percent}%):</span>
                  <span>{formatCurrency(showReceipt.tax_amount)}</span>
                </div>
              )}
              <div className="summary-line total-line">
                <span>Total:</span>
                <span>{formatCurrency(showReceipt.total)}</span>
              </div>
              {showReceipt.balance_amount > 0 && (
                <div className="summary-line balance-line">
                  <span>Balance (Credit):</span>
                  <span className="balance-text">{formatCurrency(showReceipt.balance_amount)}</span>
                </div>
              )}
              <div className="summary-line">
                <span>Payment Method:</span>
                <span>{showReceipt.payment_method}</span>
              </div>
              {showReceipt.payment_method === 'Cash' && (
                <>
                  <div className="summary-line">
                    <span>Cash Received:</span>
                    <span>{formatCurrency(showReceipt.cash_received)}</span>
                  </div>
                  {showReceipt.change_given > 0 && (
                    <div className="summary-line">
                      <span>Change Given:</span>
                      <span>{formatCurrency(showReceipt.change_given)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="receipt-footer">
              Thank you for your business!
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => window.print()} data-testid="print-receipt-btn">
                🖨️ Print
              </button>
              <button className="btn btn-primary" onClick={() => downloadBillPDF(showReceipt)}>
                📄 Download PDF
              </button>
              <button className="btn" onClick={() => setShowReceipt(null)} data-testid="close-receipt-btn">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Inventory Product Details Modal */}
      {editProduct && (
        <div className="modal-overlay" onClick={() => setEditProduct(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} data-testid="edit-product-modal">
            <h3 className="modal-title">Edit Product</h3>
            <div className="form-grid">
              <input
                data-testid="edit-product-name"
                className="input"
                placeholder="Product Name"
                value={editProduct.name}
                onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
              />
              <select
                data-testid="edit-product-category"
                className="input"
                value={editProduct.category}
                onChange={(e) => setEditProduct({ ...editProduct, category: e.target.value })}
              >
                {CATEGORIES.filter(c => c !== 'All').map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <input
                data-testid="edit-product-price"
                className="input"
                placeholder="Price"
                type="number"
                value={editProduct.price}
                onChange={(e) => setEditProduct({ ...editProduct, price: e.target.value })}
              />
              <input
                data-testid="edit-product-stock"
                className="input"
                placeholder="Stock"
                type="number"
                value={editProduct.stock}
                onChange={(e) => setEditProduct({ ...editProduct, stock: e.target.value })}
              />
              <input
                data-testid="edit-product-barcode"
                className="input"
                placeholder="Barcode"
                value={editProduct.barcode}
                onChange={(e) => setEditProduct({ ...editProduct, barcode: e.target.value })}
              />
              <input
                data-testid="edit-product-unit"
                className="input"
                placeholder="Unit"
                value={editProduct.unit}
                onChange={(e) => setEditProduct({ ...editProduct, unit: e.target.value })}
              />
              <input
                data-testid="edit-product-hsn"
                className="input"
                placeholder="HSN Code"
                value={editProduct.hsn_code}
                onChange={(e) => setEditProduct({ ...editProduct, hsn_code: e.target.value })}
              />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setEditProduct(null)}>
                Cancel
              </button>
              <button data-testid="save-product-btn" className="btn btn-primary" onClick={handleUpdateProduct}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Purchase History Log Modal */}
      {customerHistory && (
        <div className="modal-overlay" onClick={() => setCustomerHistory(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900 }} data-testid="customer-history-modal">
            <div className="view-header">
              <div>
                <h3 className="modal-title">{customerHistory.customer.name}</h3>
                <div className="sub-text">{customerHistory.customer.phone}</div>
              </div>
              <button className="btn btn-sm" onClick={() => setCustomerHistory(null)}>✕ Close</button>
            </div>

            <div className="stats-grid" style={{ marginBottom: 16 }}>
              <div className="stat-card">
                <div className="stat-label">Total Bills</div>
                <div className="stat-value">{customerHistory.bills.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Current Balance</div>
                <div className="stat-value balance-text">{formatCurrency(customerHistory.customer.balance || 0)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Spent</div>
                <div className="stat-value amount-text">{formatCurrency(customerHistory.customer.total_purchases)}</div>
              </div>
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customerHistory.bills.map(bill => (
                    <tr key={bill.id}>
                      <td className="invoice-no">{bill.invoice_no}</td>
                      <td>{new Date(bill.created_at).toLocaleDateString()}</td>
                      <td className="amount-text">{formatCurrency(bill.total)}</td>
                      <td className={bill.balance_amount > 0 ? 'balance-text' : ''}>
                        {formatCurrency(bill.balance_amount || 0)}
                      </td>
                      <td>
                        <span className="tag" style={{
                          background: bill.settled ? 'var(--success)' : 'var(--warning)',
                          cursor: 'pointer'
                        }}
                        onClick={() => toggleBillSettled(bill)}
                        data-testid={`settle-toggle-${bill.invoice_no}`}>
                          {bill.settled ? '✓ Settled' : '⏱ Not Settled'}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions" style={{ flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-sm"
                            onClick={() => setShowReceipt(bill)}
                          >
                            View
                          </button>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => sendBillViaWhatsApp(bill)}
                            data-testid={`whatsapp-bill-${bill.invoice_no}`}
                          >
                            📱 Send Bill
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Profiles Base Modal */}
      {editingCustomer && (
        <div className="modal-overlay" onClick={() => setEditingCustomer(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }} data-testid="edit-balance-modal">
            <h3 className="modal-title">Edit Customer</h3>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="form-group">
                <label>Customer Name</label>
                <input
                  className="input"
                  value={editingCustomer.name}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  className="input"
                  value={editingCustomer.phone}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setEditingCustomer(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUpdateCustomerBalance} data-testid="save-balance-btn">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Quotation Info Popup Window */}
      {showQuotation && (
        <div className="modal-overlay" onClick={() => setShowQuotation(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="receipt-header">
              <h2>{settings.shop_name}</h2>
              {settings.gstin && <div>GSTIN: {settings.gstin}</div>}
              {settings.address && <div>{settings.address}</div>}
              {settings.phone && <div>Phone: {settings.phone}</div>}
            </div>
            <div className="receipt-info">
              <div><strong>Quotation: {showQuotation.quotation_no}</strong></div>
              <div>{new Date(showQuotation.created_at).toLocaleString()}</div>
              {showQuotation.customer_name && <div>Customer: {showQuotation.customer_name}</div>}
              {showQuotation.customer_phone && <div>Phone: {showQuotation.customer_phone}</div>}
              {showQuotation.valid_until && <div>Valid Until: {new Date(showQuotation.valid_until).toLocaleDateString()}</div>}
            </div>
            <div className="receipt-items">
              <table>
                <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                <tbody>
                  {showQuotation.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.price)}</td>
                      <td>{formatCurrency(item.price * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="receipt-totals">
              <div className="summary-line"><span>Subtotal:</span><span>{formatCurrency(showQuotation.subtotal)}</span></div>
              {showQuotation.discount_amount > 0 && <div className="summary-line"><span>Discount ({showQuotation.discount_percent}%):</span><span className="discount-text">- {formatCurrency(showQuotation.discount_amount)}</span></div>}
              {showQuotation.tax_amount > 0 && <div className="summary-line"><span>GST ({showQuotation.tax_percent}%):</span><span>{formatCurrency(showQuotation.tax_amount)}</span></div>}
              <div className="summary-line total-line"><span>Total:</span><span>{formatCurrency(showQuotation.total)}</span></div>
            </div>
            {showQuotation.notes && <div style={{ padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text-muted)' }}>Notes: {showQuotation.notes}</div>}
            <div className="receipt-footer">This is a quotation, not a tax invoice.</div>
            <div className="modal-actions">
              <button className="btn" onClick={() => window.print()}>Print</button>
              {showQuotation.status === 'pending' && <button className="btn btn-primary" onClick={() => { handleConvertQuotation(showQuotation); setShowQuotation(null); }}>→ Convert to Bill</button>}
              <button className="btn" onClick={() => setShowQuotation(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Banner Notification Trigger */}
      {notification && (
        <div
          className={`notification ${notification.type}`}
          data-testid="notification"
        >
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default BillingPOS;
