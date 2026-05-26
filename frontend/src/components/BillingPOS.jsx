import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, CartesianGrid } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DISCOUNT_OPTIONS = [0, 5, 10, 15, 20];
const CATEGORIES = ['All', 'Food', 'Beverages', 'Electronics', 'Clothing', 'Medicines', 'Stationery'];
const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Credit', 'Wallet'];
const VIEWS = {
  POS: 'pos',
  INVENTORY: 'inventory',
  BILLS: 'bills',
  CUSTOMERS: 'customers',
  REPORTS: 'reports',
  BALANCE: 'balance',
  LOW_STOCK: 'low_stock',
  QUOTATIONS: 'quotations',
  STOCK_ADJUSTMENTS: 'stock_adjustments',
  DAY_CLOSE: 'day_close',
  SETTINGS: 'settings'
};

const BillingPOS = () => {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [view, setView] = useState(VIEWS.POS);
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
    low_stock_threshold: 10,
    logo_url: '',
    receipt_header: '',
    receipt_footer: 'Thank you for your business!',
    receipt_size: 'A4',
    loyalty_enabled: false,
    loyalty_rate: 1,
    loyalty_redeem_rate: 0.5,
    expiry_alert_days: 30
  });
  
  const [discountType, setDiscountType] = useState('percent');
  const [splitPaymentMode, setSplitPaymentMode] = useState(false);
  const [paymentSplits, setPaymentSplits] = useState([]);
  const [loyaltyRedeem, setLoyaltyRedeem] = useState(0);
  const [quotations, setQuotations] = useState([]);
  const [stockAdjustments, setStockAdjustments] = useState([]);
  const [showStockAdjModal, setShowStockAdjModal] = useState(null);
  const [stockAdjQty, setStockAdjQty] = useState('');
  const [stockAdjReason, setStockAdjReason] = useState('');
  const [dayCloseData, setDayCloseData] = useState(null);
  const [dayCloseDate, setDayCloseDate] = useState(new Date().toISOString().slice(0, 10));
  const [showBarcodeFor, setShowBarcodeFor] = useState(null);
  
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
    if (view === VIEWS.BILLS) {
      fetchBills();
    }
  }, [view, billSearch, billStartDate, billEndDate]);

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
    if (view === VIEWS.QUOTATIONS) fetchQuotations();
    if (view === VIEWS.STOCK_ADJUSTMENTS) fetchStockAdjustments();
    if (view === VIEWS.DAY_CLOSE) fetchDayClose(dayCloseDate);
  }, [view, dayCloseDate]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      
      if (e.key === 'F1') {
        e.preventDefault();
        setView(VIEWS.POS);
        setCart([]);
      } else if (e.key === 'F2') {
        e.preventDefault();
        setView(VIEWS.POS);
        setTimeout(() => barcodeRef.current?.focus(), 100);
      } else if (e.key === 'F12') {
        e.preventDefault();
        if (view === VIEWS.POS && cart.length > 0) {
          handleCheckout();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowReceipt(null);
        setEditProduct(null);
        setCustomerHistory(null);
        setEditingCustomer(null);
        setShowStockAdjModal(null);
        setShowBarcodeFor(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, cart]);

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
    if (!BACKEND_URL) {
      console.error('REACT_APP_BACKEND_URL is not set');
      return;
    }
    try {
      await axios.post(`${API}/seed`);
      loadData();
    } catch (error) {
      console.log('Seed error (probably already seeded)');
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
    let discountAmount = 0;
    let discount = 0;
    
    if (discountType === 'amount') {
      discountAmount = parseFloat(customDiscount) || 0;
      discount = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
    } else {
      discount = parseFloat(customDiscount) || discountPercent;
      discountAmount = subtotal * (discount / 100);
    }
    
    const loyaltyRedeemAmount = (parseFloat(loyaltyRedeem) || 0) * settings.loyalty_redeem_rate;
    const taxableAmount = Math.max(0, subtotal - discountAmount - loyaltyRedeemAmount);
    const taxAmount = settings.tax_enabled ? taxableAmount * (settings.tax_percent / 100) : 0;
    const total = taxableAmount + taxAmount;
    const loyaltyEarned = settings.loyalty_enabled ? Math.floor(total / 100 * settings.loyalty_rate) : 0;
    
    return { subtotal, discountAmount, taxAmount, total, discount, loyaltyEarned, loyaltyRedeemAmount };
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      showNotification('Cart is empty', 'error');
      return;
    }

    const { subtotal, discountAmount, taxAmount, total, discount, loyaltyEarned } = calculateBill();
    const paid = parseFloat(customerPaid) || 0;
    
    let finalBalanceAmount = 0;
    let finalCashReceived = 0;
    let finalChangeGiven = 0;
    let finalPaymentSplits = [];

    if (splitPaymentMode && paymentSplits.length > 0) {
      const splitTotal = paymentSplits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
      if (splitTotal < total) {
        finalBalanceAmount = total - splitTotal;
        if (!customerPhone) {
          showNotification('Customer phone required for partial payment', 'error');
          return;
        }
      }
      finalPaymentSplits = paymentSplits.map(s => ({ method: s.method, amount: parseFloat(s.amount) || 0 }));
      finalCashReceived = paymentSplits.filter(s => s.method === 'Cash').reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
    } else {
      if (paid >= total) {
        finalCashReceived = paid;
        finalChangeGiven = paid - total;
      } else {
        finalCashReceived = paid;
        finalBalanceAmount = total - paid;
        if (!customerPhone) {
          showNotification('Customer phone required for partial payment', 'error');
          return;
        }
      }
    }

    try {
      const billData = {
        invoice_no: generateInvoiceNo(),
        items: cart,
        subtotal,
        discount_percent: discount,
        discount_amount: discountAmount,
        discount_type: discountType,
        tax_amount: taxAmount,
        tax_percent: settings.tax_percent,
        total,
        payment_method: splitPaymentMode ? 'Split' : paymentMethod,
        payment_splits: finalPaymentSplits,
        cash_received: finalCashReceived,
        change_given: finalChangeGiven,
        balance_amount: finalBalanceAmount,
        settled: finalBalanceAmount <= 0,
        customer_name: customerName,
        customer_phone: customerPhone,
        loyalty_earned: loyaltyEarned,
        loyalty_redeemed: parseInt(loyaltyRedeem) || 0
      };

      const res = await axios.post(`${API}/bills`, billData);
      showNotification('Bill generated successfully', 'success');
      setShowReceipt(res.data);
      
      setCart([]);
      setDiscountPercent(0);
      setCustomDiscount('');
      setDiscountType('percent');
      setCustomerPaid('');
      setCustomerName('');
      setCustomerPhone('');
      setSplitPaymentMode(false);
      setPaymentSplits([]);
      setLoyaltyRedeem(0);
      
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
    try {
      await axios.put(`${API}/customers/${editingCustomer.phone}/balance`, null, {
        params: { balance: parseFloat(editingCustomer.balance) || 0 }
      });
      showNotification('Balance updated', 'success');
      setEditingCustomer(null);
      await loadData();
    } catch (error) {
      showNotification('Error updating balance', 'error');
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

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      showNotification('Logo must be less than 500KB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setSettings({ ...settings, logo_url: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const addPaymentSplit = () => {
    setPaymentSplits([...paymentSplits, { method: 'Cash', amount: '' }]);
  };

  const updatePaymentSplit = (idx, field, value) => {
    const newSplits = [...paymentSplits];
    newSplits[idx][field] = value;
    setPaymentSplits(newSplits);
  };

  const removePaymentSplit = (idx) => {
    setPaymentSplits(paymentSplits.filter((_, i) => i !== idx));
  };

  const handleStockAdjustment = async () => {
    if (!showStockAdjModal || !stockAdjQty || !stockAdjReason) {
      showNotification('Fill all fields', 'error');
      return;
    }
    try {
      await axios.post(`${API}/stock-adjustments`, {
        product_id: showStockAdjModal.id,
        quantity_change: parseInt(stockAdjQty),
        reason: stockAdjReason
      });
      showNotification('Stock adjusted successfully', 'success');
      setShowStockAdjModal(null);
      setStockAdjQty('');
      setStockAdjReason('');
      await loadData();
      const res = await axios.get(`${API}/stock-adjustments`);
      setStockAdjustments(res.data);
    } catch (error) {
      showNotification(error.response?.data?.detail || 'Error adjusting stock', 'error');
    }
  };

  const handleSaveAsQuotation = async () => {
    if (cart.length === 0) {
      showNotification('Cart is empty', 'error');
      return;
    }
    const { subtotal, discountAmount, taxAmount, total } = calculateBill();
    try {
      await axios.post(`${API}/quotations`, {
        quote_no: `QT-${Date.now()}`,
        items: cart,
        subtotal,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total,
        customer_name: customerName,
        customer_phone: customerPhone,
        notes: ''
      });
      showNotification('Quotation saved', 'success');
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      const res = await axios.get(`${API}/quotations`);
      setQuotations(res.data);
    } catch (error) {
      showNotification('Error saving quotation', 'error');
    }
  };

  const convertQuotationToBill = (quote) => {
    setCart(quote.items);
    setCustomerName(quote.customer_name);
    setCustomerPhone(quote.customer_phone);
    setView(VIEWS.POS);
    showNotification('Quotation loaded — complete checkout', 'success');
  };

  const handleReturnBill = async (bill) => {
    if (!window.confirm(`Process return for ${bill.invoice_no}? Stock will be restored.`)) return;
    try {
      await axios.post(`${API}/bills/${bill.id}/return`);
      showNotification('Return processed successfully', 'success');
      await loadData();
    } catch (error) {
      showNotification(error.response?.data?.detail || 'Error processing return', 'error');
    }
  };

  const fetchDayClose = async (date) => {
    try {
      const res = await axios.get(`${API}/reports/day-close`, { params: { date } });
      setDayCloseData(res.data);
    } catch (error) {
      showNotification('Error loading day close', 'error');
    }
  };

  const fetchQuotations = async () => {
    try {
      const res = await axios.get(`${API}/quotations`);
      setQuotations(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchStockAdjustments = async () => {
    try {
      const res = await axios.get(`${API}/stock-adjustments`);
      setStockAdjustments(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const downloadBarcode = (product) => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw simple barcode bars from string hash
    let x = 20;
    ctx.fillStyle = '#000';
    for (let i = 0; i < product.barcode.length; i++) {
      const code = product.barcode.charCodeAt(i);
      const barWidth = (code % 3) + 1;
      ctx.fillRect(x, 10, barWidth, 60);
      x += barWidth + 2;
    }
    
    ctx.fillStyle = '#000';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(product.barcode, canvas.width / 2, 90);
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`${product.name} - ₹${product.price}`, canvas.width / 2, 110);
    
    canvas.toBlob(blob => {
      saveAs(blob, `barcode-${product.barcode}.png`);
    });
    showNotification('Barcode downloaded', 'success');
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
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h1 className="logo">{settings.software_name || 'POS'}</h1>
          <button className="mobile-close" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        
        <nav className="nav-menu">
          {[
            { id: VIEWS.POS, icon: '🛒', label: 'Point of Sale' },
            { id: VIEWS.INVENTORY, icon: '📦', label: 'Inventory' },
            { id: VIEWS.BILLS, icon: '🧾', label: 'Bill History' },
            { id: VIEWS.QUOTATIONS, icon: '📄', label: 'Quotations' },
            { id: VIEWS.CUSTOMERS, icon: '👥', label: 'Customers' },
            { id: VIEWS.BALANCE, icon: '💰', label: 'Balance' },
            { id: VIEWS.LOW_STOCK, icon: '⚠️', label: 'Low Stock' },
            { id: VIEWS.STOCK_ADJUSTMENTS, icon: '🔧', label: 'Stock Adjust' },
            { id: VIEWS.DAY_CLOSE, icon: '📅', label: 'Day Close' },
            { id: VIEWS.REPORTS, icon: '📊', label: 'Reports' },
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
        </div>
      </div>

      {/* Mobile Menu Button */}
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
        ☰
      </button>

      {/* Main Content */}
      <div className="main-content">
        {/* POS View */}
        {view === VIEWS.POS && (
          <div className="pos-view">
            <div className="product-panel">
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
                      onClick={() => product.stock > 0 && addToCart(product)}
                      style={{ opacity: product.stock === 0 ? 0.5 : 1 }}
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

            <div className="cart-panel">
              <div className="cart-header">Current Bill</div>

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

              <div className="customer-inputs">
                <input
                  data-testid="customer-name-input"
                  className="input"
                  placeholder="Customer Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
                <input
                  data-testid="customer-phone-input"
                  className="input"
                  placeholder="Customer Phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>

              <div className="cart-items">
                {cart.length === 0 ? (
                  <div className="empty-cart">Cart is empty</div>
                ) : (
                  cart.map(item => (
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

              {cart.length > 0 && (
                <>
                  <div className="discount-section">
                    <div className="section-label">Discount:</div>
                    <div className="discount-options" style={{ marginBottom: 8 }}>
                      <button
                        className={`btn btn-sm ${discountType === 'percent' ? 'active' : ''}`}
                        onClick={() => setDiscountType('percent')}
                      >
                        %
                      </button>
                      <button
                        className={`btn btn-sm ${discountType === 'amount' ? 'active' : ''}`}
                        onClick={() => setDiscountType('amount')}
                      >
                        ₹
                      </button>
                    </div>
                    {discountType === 'percent' && (
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
                    )}
                    <input
                      data-testid="custom-discount-input"
                      className="input"
                      placeholder={discountType === 'percent' ? 'Custom discount %' : 'Discount amount ₹'}
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

                  {settings.loyalty_enabled && customerPhone && (() => {
                    const cust = customers.find(c => c.phone === customerPhone);
                    const availablePoints = cust?.loyalty_points || 0;
                    if (availablePoints > 0) {
                      return (
                        <div className="discount-section">
                          <div className="section-label">Loyalty Points (Available: {availablePoints}):</div>
                          <input
                            className="input"
                            placeholder="Points to redeem"
                            type="number"
                            min="0"
                            max={availablePoints}
                            value={loyaltyRedeem}
                            onChange={(e) => setLoyaltyRedeem(Math.min(parseInt(e.target.value) || 0, availablePoints))}
                          />
                          <div className="sub-text" style={{ marginTop: 4 }}>
                            1 point = ₹{settings.loyalty_redeem_rate}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="payment-section">
                    <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Payment Method:</span>
                      <button
                        className={`btn btn-sm ${splitPaymentMode ? 'active' : ''}`}
                        onClick={() => { setSplitPaymentMode(!splitPaymentMode); if (!splitPaymentMode) setPaymentSplits([{ method: 'Cash', amount: '' }]); else setPaymentSplits([]); }}
                      >
                        {splitPaymentMode ? '✓ Split' : 'Split Payment'}
                      </button>
                    </div>
                    {!splitPaymentMode && (
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
                    )}
                  </div>

                  {splitPaymentMode ? (
                    <div className="cash-section">
                      <div className="section-label">Split Payment:</div>
                      {paymentSplits.map((split, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                          <select
                            className="input"
                            style={{ flex: 1 }}
                            value={split.method}
                            onChange={(e) => updatePaymentSplit(idx, 'method', e.target.value)}
                          >
                            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <input
                            className="input"
                            type="number"
                            placeholder="Amount"
                            style={{ flex: 1 }}
                            value={split.amount}
                            onChange={(e) => updatePaymentSplit(idx, 'amount', e.target.value)}
                          />
                          <button className="btn btn-danger btn-sm" onClick={() => removePaymentSplit(idx)}>✕</button>
                        </div>
                      ))}
                      <button className="btn btn-sm" onClick={addPaymentSplit} style={{ width: '100%' }}>+ Add Split</button>
                      {(() => {
                        const { total } = calculateBill();
                        const splitTotal = paymentSplits.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
                        const diff = total - splitTotal;
                        return diff > 0 ? (
                          <div className="balance-info balance-text">Balance Due: {formatCurrency(diff)}</div>
                        ) : diff < 0 ? (
                          <div className="change-info">Excess: {formatCurrency(-diff)}</div>
                        ) : (
                          <div className="change-info">✓ Fully Paid</div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="cash-section">
                      <div className="section-label">Customer Paid Amount:</div>
                      <input
                        data-testid="customer-paid-input"
                        className="input"
                        placeholder="Enter amount paid by customer"
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
                  )}

                  <div className="cart-actions" style={{ flexWrap: 'wrap' }}>
                    <button
                      data-testid="hold-cart-btn"
                      className="btn btn-sm"
                      onClick={handleHoldCart}
                    >
                      Hold
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={handleSaveAsQuotation}
                    >
                      Quote
                    </button>
                    <button
                      data-testid="checkout-btn"
                      className="btn btn-primary"
                      onClick={handleCheckout}
                      style={{ flex: 2 }}
                    >
                      Checkout (F12)
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Low Stock View */}
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

        {/* Quotations View */}
        {view === VIEWS.QUOTATIONS && (
          <div className="content-view">
            <div className="view-header">
              <h2 className="section-title">Quotations / Estimates</h2>
            </div>
            
            {quotations.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                <h3 className="card-title">No Quotations Yet</h3>
                <p>Save a cart as quotation from the POS screen using the "Quote" button.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Quote No</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotations.map(q => (
                      <tr key={q.id}>
                        <td className="invoice-no">{q.quote_no}</td>
                        <td>{new Date(q.created_at).toLocaleDateString()}</td>
                        <td>{q.customer_name || 'Guest'}<br/><span className="sub-text">{q.customer_phone}</span></td>
                        <td>{q.items.length}</td>
                        <td className="amount-text">{formatCurrency(q.total)}</td>
                        <td>
                          <div className="table-actions">
                            <button className="btn btn-sm btn-primary" onClick={() => convertQuotationToBill(q)}>
                              → Convert to Bill
                            </button>
                            <button className="btn btn-sm btn-danger" onClick={async () => {
                              if (!window.confirm('Delete this quotation?')) return;
                              await axios.delete(`${API}/quotations/${q.id}`);
                              fetchQuotations();
                              showNotification('Quotation deleted', 'success');
                            }}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Stock Adjustments View */}
        {view === VIEWS.STOCK_ADJUSTMENTS && (
          <div className="content-view">
            <div className="view-header">
              <h2 className="section-title">Stock Adjustments Log</h2>
              <button className="btn btn-primary" onClick={() => exportToExcel(
                stockAdjustments.map(a => ({
                  'Product': a.product_name,
                  'Quantity Change': a.quantity_change,
                  'New Stock': a.new_stock,
                  'Reason': a.reason,
                  'Date': new Date(a.created_at).toLocaleString()
                })), 'stock-adjustments'
              )}>Export to Excel</button>
            </div>
            
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 className="card-title">Quick Adjust Stock</h3>
              <div className="form-grid">
                <select className="input" onChange={(e) => {
                  const prod = products.find(p => p.id === e.target.value);
                  if (prod) setShowStockAdjModal(prod);
                }} value={showStockAdjModal?.id || ''}>
                  <option value="">Select Product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
                  ))}
                </select>
              </div>
            </div>

            {stockAdjustments.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                <p>No stock adjustments yet.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Product</th>
                      <th>Change</th>
                      <th>New Stock</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockAdjustments.map(a => (
                      <tr key={a.id}>
                        <td>{new Date(a.created_at).toLocaleString()}</td>
                        <td><strong>{a.product_name}</strong></td>
                        <td style={{ color: a.quantity_change > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold' }}>
                          {a.quantity_change > 0 ? '+' : ''}{a.quantity_change}
                        </td>
                        <td>{a.new_stock}</td>
                        <td>{a.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Day Close View */}
        {view === VIEWS.DAY_CLOSE && (
          <div className="content-view">
            <div className="view-header">
              <h2 className="section-title">Day Close Report</h2>
              <button className="btn btn-primary" onClick={() => {
                if (!dayCloseData) return;
                const data = [
                  { Metric: 'Total Sales', Value: dayCloseData.total_sales },
                  { Metric: 'Total Returns', Value: dayCloseData.total_returns },
                  { Metric: 'Net Revenue', Value: dayCloseData.net_revenue },
                  { Metric: 'Bills Generated', Value: dayCloseData.bill_count },
                  { Metric: 'Returns', Value: dayCloseData.return_count },
                  { Metric: 'Tax Collected', Value: dayCloseData.total_tax },
                  { Metric: 'Discounts', Value: dayCloseData.total_discount }
                ];
                Object.entries(dayCloseData.payment_breakdown || {}).forEach(([method, amount]) => {
                  data.push({ Metric: `Payment: ${method}`, Value: amount });
                });
                exportToExcel(data, `day-close-${dayCloseDate}`);
              }}>Export to Excel</button>
            </div>

            <div className="filters-bar">
              <input
                className="input date-input"
                type="date"
                value={dayCloseDate}
                onChange={(e) => setDayCloseDate(e.target.value)}
              />
            </div>

            {dayCloseData && (
              <>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-label">Total Sales</div>
                    <div className="stat-value amount-text">{formatCurrency(dayCloseData.total_sales)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Total Returns</div>
                    <div className="stat-value" style={{ color: 'var(--danger)' }}>{formatCurrency(dayCloseData.total_returns)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Net Revenue</div>
                    <div className="stat-value" style={{ color: 'var(--accent)' }}>{formatCurrency(dayCloseData.net_revenue)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Bills</div>
                    <div className="stat-value">{dayCloseData.bill_count}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Returns</div>
                    <div className="stat-value">{dayCloseData.return_count}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Tax Collected</div>
                    <div className="stat-value">{formatCurrency(dayCloseData.total_tax)}</div>
                  </div>
                </div>

                <div className="card">
                  <h3 className="card-title">Payment Method Breakdown</h3>
                  {Object.entries(dayCloseData.payment_breakdown || {}).length === 0 ? (
                    <p>No transactions on this date.</p>
                  ) : (
                    Object.entries(dayCloseData.payment_breakdown).map(([method, amount]) => (
                      <div key={method} className="report-item">
                        <span>{method}</span>
                        <span className="report-value amount-text">{formatCurrency(amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
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
                  placeholder="Sell Price *"
                  type="number"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Cost Price"
                  type="number"
                  value={newProduct.cost_price || ''}
                  onChange={(e) => setNewProduct({ ...newProduct, cost_price: e.target.value })}
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
                  onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
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
                <input
                  className="input"
                  placeholder="Expiry Date"
                  type="date"
                  value={newProduct.expiry_date || ''}
                  onChange={(e) => setNewProduct({ ...newProduct, expiry_date: e.target.value })}
                />
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
                          <div className="table-actions" style={{ flexWrap: 'wrap' }}>
                            <button
                              data-testid={`edit-product-${product.barcode}`}
                              className="btn btn-sm"
                              onClick={() => setEditProduct(product)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={() => setShowStockAdjModal(product)}
                              title="Adjust Stock"
                            >
                              🔧
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={() => setShowBarcodeFor(product)}
                              title="Show Barcode"
                            >
                              📑
                            </button>
                            <button
                              data-testid={`delete-product-${product.barcode}`}
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteProduct(product.id)}
                            >
                              🗑️
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
                    <tr key={bill.id} data-testid={`bill-row-${bill.invoice_no}`} style={bill.is_return ? { background: 'rgba(211, 47, 47, 0.1)' } : {}}>
                      <td className="invoice-no">
                        {bill.invoice_no}
                        {bill.is_return && <span className="tag" style={{ background: 'var(--danger)', marginLeft: 6 }}>RETURN</span>}
                      </td>
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
                        <div className="table-actions" style={{ flexWrap: 'wrap' }}>
                          <button
                            data-testid={`view-bill-${bill.invoice_no}`}
                            className="btn btn-sm"
                            onClick={() => setShowReceipt(bill)}
                          >
                            View
                          </button>
                          {!bill.is_return && (
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleReturnBill(bill)}
                              data-testid={`return-bill-${bill.invoice_no}`}
                            >
                              Return
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
                  {formatCurrency(customers.reduce((sum, c) => sum + (c.balance || 0), 0))}
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
                              onClick={() => setEditingCustomer({ ...customer })}
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

        {/* Reports View */}
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
                    {reportData.top_products.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={reportData.top_products}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="name" stroke="var(--text-secondary)" style={{ fontSize: 11 }} />
                          <YAxis stroke="var(--text-secondary)" />
                          <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent)' }} />
                          <Bar dataKey="quantity" fill="#f5a623" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <p>No sales data</p>}
                  </div>

                  <div className="card">
                    <h3 className="card-title">Payment Method Breakdown</h3>
                    {Object.keys(reportData.payment_breakdown).length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={Object.entries(reportData.payment_breakdown).map(([name, value]) => ({ name, value }))}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry) => `${entry.name}: ₹${entry.value.toFixed(0)}`}
                            outerRadius={80}
                            dataKey="value"
                          >
                            {Object.entries(reportData.payment_breakdown).map((_, idx) => (
                              <Cell key={idx} fill={['#f5a623', '#4ecdc4', '#45b7d1', '#f093fb', '#43e97b'][idx % 5]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <p>No payment data</p>}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Settings View */}
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
                      value={settings.email}
                      onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="card-title">Receipt & Logo</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Shop Logo</label>
                    <input
                      className="input"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                    />
                    {settings.logo_url && (
                      <div style={{ marginTop: 8 }}>
                        <img src={settings.logo_url} alt="Logo" style={{ maxHeight: 60, background: '#fff', padding: 4, borderRadius: 4 }} />
                        <button className="btn btn-sm btn-danger" style={{ marginLeft: 8 }} onClick={() => setSettings({ ...settings, logo_url: '' })}>Remove</button>
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Receipt Header Text</label>
                    <input
                      className="input"
                      placeholder="e.g. Welcome to our store"
                      value={settings.receipt_header}
                      onChange={(e) => setSettings({ ...settings, receipt_header: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Receipt Footer Text</label>
                    <input
                      className="input"
                      placeholder="e.g. Thank you for your business!"
                      value={settings.receipt_footer}
                      onChange={(e) => setSettings({ ...settings, receipt_footer: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Receipt Size</label>
                    <select
                      className="input"
                      value={settings.receipt_size}
                      onChange={(e) => setSettings({ ...settings, receipt_size: e.target.value })}
                    >
                      <option value="A4">A4 (Standard Printer)</option>
                      <option value="80mm">80mm (Thermal Printer)</option>
                      <option value="58mm">58mm (Thermal Printer Mini)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="card-title">Loyalty Program</h3>
                <div className="settings-options">
                  <div className="setting-item">
                    <span>Enable Loyalty Points</span>
                    <button
                      className={`btn ${settings.loyalty_enabled ? 'btn-success' : 'btn-danger'}`}
                      onClick={() => setSettings({ ...settings, loyalty_enabled: !settings.loyalty_enabled })}
                    >
                      {settings.loyalty_enabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  {settings.loyalty_enabled && (
                    <>
                      <div className="form-group">
                        <label>Points earned per ₹100 spent</label>
                        <input
                          className="input"
                          type="number"
                          step="0.1"
                          value={settings.loyalty_rate}
                          onChange={(e) => setSettings({ ...settings, loyalty_rate: parseFloat(e.target.value) || 1 })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Value per point when redeeming (₹)</label>
                        <input
                          className="input"
                          type="number"
                          step="0.1"
                          value={settings.loyalty_redeem_rate}
                          onChange={(e) => setSettings({ ...settings, loyalty_redeem_rate: parseFloat(e.target.value) || 0.5 })}
                        />
                      </div>
                    </>
                  )}
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
      </div>

      {/* Receipt Modal */}
      {showReceipt && (
        <div className="modal-overlay" onClick={() => setShowReceipt(null)}>
          <div className="modal receipt-modal" data-receipt-size={settings.receipt_size} onClick={(e) => e.stopPropagation()} data-testid="receipt-modal">
            <div className="receipt-header">
              {settings.logo_url && (
                <img src={settings.logo_url} alt="Logo" style={{ maxHeight: 60, marginBottom: 8, background: '#fff', padding: 4, borderRadius: 4 }} />
              )}
              <h2>{settings.shop_name}</h2>
              {settings.gstin && <div>GSTIN: {settings.gstin}</div>}
              {settings.address && <div>{settings.address}</div>}
              {settings.phone && <div>Phone: {settings.phone}</div>}
              {settings.email && <div>Email: {settings.email}</div>}
              {settings.receipt_header && <div style={{ marginTop: 8, fontStyle: 'italic' }}>{settings.receipt_header}</div>}
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
              {showReceipt.loyalty_earned > 0 && (
                <div className="summary-line">
                  <span>⭐ Loyalty Earned:</span>
                  <span>{showReceipt.loyalty_earned} points</span>
                </div>
              )}
              {showReceipt.loyalty_redeemed > 0 && (
                <div className="summary-line">
                  <span>⭐ Loyalty Redeemed:</span>
                  <span>{showReceipt.loyalty_redeemed} points</span>
                </div>
              )}
              {showReceipt.payment_splits && showReceipt.payment_splits.length > 0 ? (
                <>
                  <div className="summary-line"><strong>Payment Splits:</strong></div>
                  {showReceipt.payment_splits.map((s, i) => (
                    <div key={i} className="summary-line">
                      <span>  {s.method}:</span>
                      <span>{formatCurrency(s.amount)}</span>
                    </div>
                  ))}
                </>
              ) : (
                <div className="summary-line">
                  <span>Payment Method:</span>
                  <span>{showReceipt.payment_method}</span>
                </div>
              )}
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
              {settings.receipt_footer || 'Thank you for your business!'}
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => window.print()} data-testid="print-receipt-btn">
                Print
              </button>
              <button className="btn btn-primary" onClick={() => setShowReceipt(null)} data-testid="close-receipt-btn">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
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

      {/* Customer History Modal */}
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

      {/* Edit Customer Balance Modal */}
      {editingCustomer && (
        <div className="modal-overlay" onClick={() => setEditingCustomer(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }} data-testid="edit-balance-modal">
            <h3 className="modal-title">Edit Customer Balance</h3>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="form-group">
                <label>Customer Name</label>
                <input className="input" value={editingCustomer.name} disabled />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input className="input" value={editingCustomer.phone} disabled />
              </div>
              <div className="form-group">
                <label>Balance Amount</label>
                <input
                  data-testid="edit-balance-input"
                  className="input"
                  type="number"
                  value={editingCustomer.balance}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, balance: e.target.value })}
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

      {/* Stock Adjustment Modal */}
      {showStockAdjModal && (
        <div className="modal-overlay" onClick={() => setShowStockAdjModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <h3 className="modal-title">Adjust Stock: {showStockAdjModal.name}</h3>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="form-group">
                <label>Current Stock: <strong>{showStockAdjModal.stock} {showStockAdjModal.unit}</strong></label>
              </div>
              <div className="form-group">
                <label>Quantity Change (use - for decrease)</label>
                <input
                  className="input"
                  type="number"
                  placeholder="e.g. +10 or -5"
                  value={stockAdjQty}
                  onChange={(e) => setStockAdjQty(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Reason *</label>
                <select className="input" value={stockAdjReason} onChange={(e) => setStockAdjReason(e.target.value)}>
                  <option value="">Select reason...</option>
                  <option value="Damaged">Damaged</option>
                  <option value="Expired">Expired</option>
                  <option value="Lost/Missing">Lost/Missing</option>
                  <option value="Returned to Supplier">Returned to Supplier</option>
                  <option value="New Stock Received">New Stock Received</option>
                  <option value="Counting Error">Counting Error</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              {stockAdjQty && (
                <div className="form-group">
                  <strong>New Stock will be: {showStockAdjModal.stock + (parseInt(stockAdjQty) || 0)}</strong>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowStockAdjModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleStockAdjustment}>Save Adjustment</button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Generator Modal */}
      {showBarcodeFor && (
        <div className="modal-overlay" onClick={() => setShowBarcodeFor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, textAlign: 'center' }}>
            <h3 className="modal-title">Barcode: {showBarcodeFor.name}</h3>
            <div style={{ background: '#fff', padding: 20, borderRadius: 8, margin: '20px 0' }}>
              <svg viewBox="0 0 200 80" style={{ width: '100%', maxWidth: 280 }}>
                <rect width="200" height="80" fill="#fff" />
                {showBarcodeFor.barcode.split('').map((c, i) => {
                  const code = c.charCodeAt(0);
                  const w = (code % 3) + 1;
                  const x = 10 + i * 12;
                  return <rect key={i} x={x} y="10" width={w} height="50" fill="#000" />;
                })}
                <text x="100" y="75" textAnchor="middle" fontFamily="monospace" fontSize="12" fill="#000">
                  {showBarcodeFor.barcode}
                </text>
              </svg>
              <div style={{ color: '#000', marginTop: 8, fontWeight: 'bold' }}>
                {showBarcodeFor.name} - {formatCurrency(showBarcodeFor.price)}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowBarcodeFor(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => downloadBarcode(showBarcodeFor)}>Download PNG</button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
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
