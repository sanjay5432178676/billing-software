import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TAX_RATE = 0.18;
const DISCOUNT_OPTIONS = [0, 5, 10, 15, 20];
const CATEGORIES = ['All', 'Food', 'Beverages', 'Electronics', 'Clothing', 'Medicines', 'Stationery'];
const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Credit', 'Wallet'];
const VIEWS = {
  POS: 'pos',
  INVENTORY: 'inventory',
  BILLS: 'bills',
  CUSTOMERS: 'customers',
  REPORTS: 'reports',
  SETTINGS: 'settings'
};

const BillingPOS = () => {
  const [view, setView] = useState(VIEWS.POS);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [heldCarts, setHeldCarts] = useState([]);
  const [bills, setBills] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState({
    shop_name: 'My Shop',
    gstin: '',
    address: '',
    phone: '',
    email: '',
    tax_enabled: true,
    auto_print: false,
    low_stock_threshold: 10
  });
  
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [customDiscount, setCustomDiscount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [cashReceived, setCashReceived] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  const [notification, setNotification] = useState(null);
  const [showReceipt, setShowReceipt] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({
    name: '', category: 'Food', price: '', stock: '', barcode: '', unit: 'pcs', hsn_code: ''
  });
  const [reportPeriod, setReportPeriod] = useState('all');
  const [reportData, setReportData] = useState(null);
  
  const barcodeRef = useRef(null);

  useEffect(() => {
    loadData();
    seedDataIfEmpty();
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
  }, [view, reportPeriod]);

  const loadData = async () => {
    try {
      const [productsRes, billsRes, customersRes, settingsRes, heldCartsRes] = await Promise.all([
        axios.get(`${API}/products`),
        axios.get(`${API}/bills`),
        axios.get(`${API}/customers`),
        axios.get(`${API}/settings`),
        axios.get(`${API}/carts/held`)
      ]);
      setProducts(productsRes.data);
      setBills(billsRes.data);
      setCustomers(customersRes.data);
      setSettings(settingsRes.data);
      setHeldCarts(heldCartsRes.data);
    } catch (error) {
      showNotification('Error loading data', 'error');
    }
  };

  const seedDataIfEmpty = async () => {
    try {
      await axios.post(`${API}/seed`);
      loadData();
    } catch (error) {
      console.log('Seed error (probably already seeded)');
    }
  };

  const fetchReportData = async () => {
    try {
      const res = await axios.get(`${API}/reports/summary`, { params: { period: reportPeriod } });
      setReportData(res.data);
    } catch (error) {
      showNotification('Error fetching report', 'error');
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
    const taxAmount = settings.tax_enabled ? taxableAmount * TAX_RATE : 0;
    const total = taxableAmount + taxAmount;
    
    return { subtotal, discountAmount, taxAmount, total, discount };
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      showNotification('Cart is empty', 'error');
      return;
    }

    const { subtotal, discountAmount, taxAmount, total, discount } = calculateBill();
    
    if (paymentMethod === 'Cash') {
      const received = parseFloat(cashReceived) || 0;
      if (received < total) {
        showNotification('Insufficient cash received', 'error');
        return;
      }
    }

    try {
      const billData = {
        invoice_no: generateInvoiceNo(),
        items: cart,
        subtotal,
        discount_percent: discount,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total,
        payment_method: paymentMethod,
        cash_received: paymentMethod === 'Cash' ? parseFloat(cashReceived) || 0 : 0,
        change_given: paymentMethod === 'Cash' ? Math.max(0, (parseFloat(cashReceived) || 0) - total) : 0,
        customer_name: customerName,
        customer_phone: customerPhone
      };

      const res = await axios.post(`${API}/bills`, billData);
      showNotification('Bill generated successfully', 'success');
      setShowReceipt(res.data);
      
      setCart([]);
      setDiscountPercent(0);
      setCustomDiscount('');
      setCashReceived('');
      setCustomerName('');
      setCustomerPhone('');
      
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

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.barcode.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const lowStockProducts = products.filter(p => p.stock <= settings.low_stock_threshold && p.stock > 0);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0f' }}>
      {/* Sidebar */}
      <div style={{
        width: 240,
        background: '#141418',
        borderRight: '1px solid #252530',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 0'
      }}>
        <div style={{ padding: '0 20px', marginBottom: 30 }}>
          <h1 style={{ color: '#f5a623', fontSize: 28, fontWeight: 'bold' }}>POS</h1>
          <p style={{ color: '#666', fontSize: 12 }}>Point of Sale System</p>
        </div>
        
        {[
          { id: VIEWS.POS, icon: '🛒', label: 'Point of Sale' },
          { id: VIEWS.INVENTORY, icon: '📦', label: 'Inventory' },
          { id: VIEWS.BILLS, icon: '🧾', label: 'Bill History' },
          { id: VIEWS.CUSTOMERS, icon: '👥', label: 'Customers' },
          { id: VIEWS.REPORTS, icon: '📊', label: 'Reports' },
          { id: VIEWS.SETTINGS, icon: '⚙️', label: 'Settings' }
        ].map(item => (
          <div
            key={item.id}
            data-testid={`nav-${item.id}`}
            onClick={() => setView(item.id)}
            style={{
              padding: '14px 20px',
              cursor: 'pointer',
              background: view === item.id ? '#1a1a1f' : 'transparent',
              borderLeft: view === item.id ? '3px solid #f5a623' : '3px solid transparent',
              color: view === item.id ? '#f5a623' : '#e8e4d4',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              transition: 'all 0.2s',
              fontSize: 14
            }}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            {item.label}
          </div>
        ))}

        {lowStockProducts.length > 0 && (
          <div style={{ margin: '20px', marginTop: 'auto', padding: 12, background: '#1a1a1f', borderRadius: 6, border: '1px solid #ff9800' }}>
            <div style={{ color: '#ff9800', fontSize: 12, fontWeight: 'bold', marginBottom: 8 }}>⚠️ LOW STOCK ALERT</div>
            <div style={{ fontSize: 11, color: '#999' }}>{lowStockProducts.length} items need restocking</div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* POS View */}
        {view === VIEWS.POS && (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Product Panel */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20, overflow: 'hidden' }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <input
                  data-testid="barcode-input"
                  ref={barcodeRef}
                  className="input"
                  placeholder="Scan or enter barcode..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeSearch}
                  style={{ flex: 1, minWidth: 250 }}
                />
                <input
                  data-testid="search-input"
                  className="input"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ flex: 1, minWidth: 250 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    data-testid={`category-${cat.toLowerCase()}`}
                    className="btn"
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      background: selectedCategory === cat ? '#f5a623' : '#1a1a1f',
                      color: selectedCategory === cat ? '#0a0a0f' : '#e8e4d4',
                      borderColor: selectedCategory === cat ? '#f5a623' : '#333'
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8 }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 16
                }}>
                  {filteredProducts.map(product => {
                    const stockStatus = getStockStatus(product.stock);
                    return (
                      <div
                        key={product.id}
                        data-testid={`product-${product.barcode}`}
                        className="product-card"
                        onClick={() => product.stock > 0 && addToCart(product)}
                        style={{ opacity: product.stock === 0 ? 0.5 : 1, cursor: product.stock === 0 ? 'not-allowed' : 'pointer' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span className="tag" style={{ background: getCategoryColor(product.category), color: '#fff', fontSize: 10 }}>
                            {product.category}
                          </span>
                          <span style={{ color: stockStatus.color, fontSize: 11, fontWeight: 'bold' }}>
                            {stockStatus.text}
                          </span>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 'bold', color: '#e8e4d4' }}>{product.name}</div>
                        <div style={{ fontSize: 11, color: '#999' }}>Code: {product.barcode}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                          <span style={{ fontSize: 18, color: '#f5a623', fontWeight: 'bold' }}>{formatCurrency(product.price)}</span>
                          <span style={{ fontSize: 12, color: '#666' }}>Stock: {product.stock}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Cart Panel */}
            <div style={{
              width: 420,
              background: '#141418',
              borderLeft: '1px solid #252530',
              display: 'flex',
              flexDirection: 'column',
              padding: 20,
              overflowY: 'auto'
            }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: '#f5a623', marginBottom: 16 }}>
                Current Bill
              </div>

              {heldCarts.length > 0 && (
                <div style={{ marginBottom: 16, padding: 12, background: '#1a1a1f', borderRadius: 6, border: '1px solid #f5a623' }}>
                  <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: '#f5a623' }}>HELD CARTS ({heldCarts.length})</div>
                  {heldCarts.map(hc => (
                    <button
                      key={hc.id}
                      data-testid={`resume-cart-${hc.id}`}
                      className="btn"
                      onClick={() => handleResumeCart(hc)}
                      style={{ width: '100%', marginBottom: 6, textAlign: 'left', fontSize: 11 }}
                    >
                      {hc.customer_name || 'Unnamed'} - {hc.items.length} items
                    </button>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <input
                  data-testid="customer-name-input"
                  className="input"
                  placeholder="Customer Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={{ marginBottom: 8 }}
                />
                <input
                  data-testid="customer-phone-input"
                  className="input"
                  placeholder="Customer Phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>

              <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16, minHeight: 200 }}>
                {cart.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#666', padding: 40 }}>
                    Cart is empty
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.product_id} className="cart-item" data-testid={`cart-item-${item.product_id}`} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 'bold', fontSize: 13 }}>{item.name}</span>
                        <button
                          data-testid={`remove-item-${item.product_id}`}
                          className="btn btn-danger"
                          onClick={() => removeFromCart(item.product_id)}
                          style={{ padding: '4px 8px', fontSize: 11 }}
                        >
                          ✕
                        </button>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            data-testid={`decrease-qty-${item.product_id}`}
                            className="btn"
                            onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                            style={{ padding: '4px 10px', fontSize: 14 }}
                          >
                            −
                          </button>
                          <input
                            data-testid={`qty-input-${item.product_id}`}
                            className="input"
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 1)}
                            style={{ width: 60, textAlign: 'center', padding: '4px' }}
                          />
                          <button
                            data-testid={`increase-qty-${item.product_id}`}
                            className="btn"
                            onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                            style={{ padding: '4px 10px', fontSize: 14 }}
                          >
                            +
                          </button>
                        </div>
                        <span style={{ color: '#f5a623', fontWeight: 'bold' }}>
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#666' }}>
                        {formatCurrency(item.price)} × {item.quantity}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, marginBottom: 8, color: '#999' }}>Discount:</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      {DISCOUNT_OPTIONS.map(disc => (
                        <button
                          key={disc}
                          data-testid={`discount-${disc}`}
                          className="btn"
                          onClick={() => { setDiscountPercent(disc); setCustomDiscount(''); }}
                          style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            background: discountPercent === disc && !customDiscount ? '#f5a623' : '#1a1a1f',
                            color: discountPercent === disc && !customDiscount ? '#0a0a0f' : '#e8e4d4'
                          }}
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
                      style={{ fontSize: 12 }}
                    />
                  </div>

                  <div style={{ background: '#1a1a1f', padding: 16, borderRadius: 6, marginBottom: 16 }}>
                    {(() => {
                      const { subtotal, discountAmount, taxAmount, total } = calculateBill();
                      return (
                        <>
                          <div className="receipt-line">
                            <span>Subtotal:</span>
                            <span data-testid="subtotal">{formatCurrency(subtotal)}</span>
                          </div>
                          <div className="receipt-line">
                            <span>Discount:</span>
                            <span data-testid="discount" style={{ color: '#4caf50' }}>- {formatCurrency(discountAmount)}</span>
                          </div>
                          {settings.tax_enabled && (
                            <div className="receipt-line">
                              <span>GST (18%):</span>
                              <span data-testid="tax">{formatCurrency(taxAmount)}</span>
                            </div>
                          )}
                          <div className="receipt-line" style={{ fontSize: 18, fontWeight: 'bold', color: '#f5a623', borderTop: '2px solid #f5a623', paddingTop: 12 }}>
                            <span>Total:</span>
                            <span data-testid="total">{formatCurrency(total)}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, marginBottom: 8, color: '#999' }}>Payment Method:</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {PAYMENT_METHODS.map(method => (
                        <button
                          key={method}
                          data-testid={`payment-${method.toLowerCase()}`}
                          className="btn"
                          onClick={() => setPaymentMethod(method)}
                          style={{
                            padding: '8px 12px',
                            fontSize: 12,
                            background: paymentMethod === method ? '#f5a623' : '#1a1a1f',
                            color: paymentMethod === method ? '#0a0a0f' : '#e8e4d4'
                          }}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  {paymentMethod === 'Cash' && (
                    <div style={{ marginBottom: 16 }}>
                      <input
                        data-testid="cash-received-input"
                        className="input"
                        placeholder="Cash Received"
                        type="number"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                      />
                      {cashReceived && (
                        <div style={{ marginTop: 8, fontSize: 14, color: '#4caf50' }}>
                          Change: {formatCurrency(Math.max(0, parseFloat(cashReceived) - calculateBill().total))}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      data-testid="hold-cart-btn"
                      className="btn"
                      onClick={handleHoldCart}
                      style={{ flex: 1 }}
                    >
                      Hold
                    </button>
                    <button
                      data-testid="checkout-btn"
                      className="btn btn-primary"
                      onClick={handleCheckout}
                      style={{ flex: 2 }}
                    >
                      Checkout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Inventory View */}
        {view === VIEWS.INVENTORY && (
          <div style={{ padding: 20, overflowY: 'auto' }}>
            <div className="section-title">Inventory Management</div>
            
            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 16, color: '#f5a623' }}>Add New Product</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
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
              </div>
              <button data-testid="add-product-btn" className="btn btn-primary" onClick={handleAddProduct}>
                Add Product
              </button>
            </div>

            <div className="table-wrapper">
              <table>
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
                          <span className="tag" style={{ background: getCategoryColor(product.category), color: '#fff' }}>
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
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              data-testid={`edit-product-${product.barcode}`}
                              className="btn"
                              onClick={() => setEditProduct(product)}
                              style={{ padding: '6px 12px', fontSize: 11 }}
                            >
                              Edit
                            </button>
                            <button
                              data-testid={`delete-product-${product.barcode}`}
                              className="btn btn-danger"
                              onClick={() => handleDeleteProduct(product.id)}
                              style={{ padding: '6px 12px', fontSize: 11 }}
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
          <div style={{ padding: 20, overflowY: 'auto' }}>
            <div className="section-title">Bill History</div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map(bill => (
                    <tr key={bill.id} data-testid={`bill-row-${bill.invoice_no}`}>
                      <td style={{ color: '#f5a623', fontWeight: 'bold' }}>{bill.invoice_no}</td>
                      <td>{new Date(bill.created_at).toLocaleString()}</td>
                      <td>{bill.customer_name || 'Guest'}<br/><span style={{ fontSize: 11, color: '#666' }}>{bill.customer_phone}</span></td>
                      <td>{bill.items.length}</td>
                      <td style={{ color: '#4caf50', fontWeight: 'bold' }}>{formatCurrency(bill.total)}</td>
                      <td>
                        <span className="tag" style={{ background: '#1a1a1f' }}>{bill.payment_method}</span>
                      </td>
                      <td>
                        <button
                          data-testid={`view-bill-${bill.invoice_no}`}
                          className="btn"
                          onClick={() => setShowReceipt(bill)}
                          style={{ padding: '6px 12px', fontSize: 11 }}
                        >
                          View
                        </button>
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
          <div style={{ padding: 20, overflowY: 'auto' }}>
            <div className="section-title">Customer Management</div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div className="stat-card">
                <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>Total Customers</div>
                <div style={{ fontSize: 32, fontWeight: 'bold', color: '#f5a623' }}>{customers.length}</div>
              </div>
              <div className="stat-card">
                <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>Total Revenue</div>
                <div style={{ fontSize: 32, fontWeight: 'bold', color: '#4caf50' }}>
                  {formatCurrency(customers.reduce((sum, c) => sum + c.total_purchases, 0))}
                </div>
              </div>
              <div className="stat-card">
                <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>Total Visits</div>
                <div style={{ fontSize: 32, fontWeight: 'bold', color: '#45b7d1' }}>
                  {customers.reduce((sum, c) => sum + c.visit_count, 0)}
                </div>
              </div>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Total Purchases</th>
                    <th>Visits</th>
                    <th>Avg Bill</th>
                    <th>Since</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(customer => (
                    <tr key={customer.id} data-testid={`customer-row-${customer.phone}`}>
                      <td>{customer.name}</td>
                      <td>{customer.phone}</td>
                      <td style={{ color: '#4caf50', fontWeight: 'bold' }}>
                        {formatCurrency(customer.total_purchases)}
                      </td>
                      <td>{customer.visit_count}</td>
                      <td>{formatCurrency(customer.total_purchases / customer.visit_count)}</td>
                      <td>{new Date(customer.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reports View */}
        {view === VIEWS.REPORTS && (
          <div style={{ padding: 20, overflowY: 'auto' }}>
            <div className="section-title">Sales Reports</div>
            
            <div style={{ marginBottom: 24, display: 'flex', gap: 8 }}>
              {['today', 'week', 'month', 'all'].map(period => (
                <button
                  key={period}
                  data-testid={`report-${period}`}
                  className="btn"
                  onClick={() => setReportPeriod(period)}
                  style={{
                    background: reportPeriod === period ? '#f5a623' : '#1a1a1f',
                    color: reportPeriod === period ? '#0a0a0f' : '#e8e4d4'
                  }}
                >
                  {period === 'today' ? 'Today' : period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'All Time'}
                </button>
              ))}
            </div>

            {reportData && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
                  <div className="stat-card">
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>Total Revenue</div>
                    <div style={{ fontSize: 32, fontWeight: 'bold', color: '#4caf50' }} data-testid="report-revenue">
                      {formatCurrency(reportData.total_revenue)}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>Bills Generated</div>
                    <div style={{ fontSize: 32, fontWeight: 'bold', color: '#45b7d1' }} data-testid="report-bills">
                      {reportData.total_bills}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>Tax Collected</div>
                    <div style={{ fontSize: 32, fontWeight: 'bold', color: '#ff9800' }} data-testid="report-tax">
                      {formatCurrency(reportData.total_tax)}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>Discounts Given</div>
                    <div style={{ fontSize: 32, fontWeight: 'bold', color: '#f093fb' }} data-testid="report-discount">
                      {formatCurrency(reportData.total_discount)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                  <div className="card">
                    <div style={{ fontSize: 16, fontWeight: 'bold', color: '#f5a623', marginBottom: 16 }}>Top 5 Selling Products</div>
                    {reportData.top_products.map((product, idx) => (
                      <div key={idx} style={{ padding: '10px 0', borderBottom: '1px solid #252530', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{product.name}</span>
                        <span style={{ color: '#f5a623', fontWeight: 'bold' }}>{product.quantity} sold</span>
                      </div>
                    ))}
                  </div>

                  <div className="card">
                    <div style={{ fontSize: 16, fontWeight: 'bold', color: '#f5a623', marginBottom: 16 }}>Payment Method Breakdown</div>
                    {Object.entries(reportData.payment_breakdown).map(([method, amount]) => (
                      <div key={method} style={{ padding: '10px 0', borderBottom: '1px solid #252530', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{method}</span>
                        <span style={{ color: '#4caf50', fontWeight: 'bold' }}>{formatCurrency(amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Settings View */}
        {view === VIEWS.SETTINGS && (
          <div style={{ padding: 20, overflowY: 'auto' }}>
            <div className="section-title">Settings</div>
            
            <div className="card" style={{ maxWidth: 600, marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 16, color: '#f5a623' }}>Shop Information</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  data-testid="settings-shop-name"
                  className="input"
                  placeholder="Shop Name"
                  value={settings.shop_name}
                  onChange={(e) => setSettings({ ...settings, shop_name: e.target.value })}
                />
                <input
                  data-testid="settings-gstin"
                  className="input"
                  placeholder="GSTIN"
                  value={settings.gstin}
                  onChange={(e) => setSettings({ ...settings, gstin: e.target.value })}
                />
                <input
                  data-testid="settings-address"
                  className="input"
                  placeholder="Address"
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                />
                <input
                  data-testid="settings-phone"
                  className="input"
                  placeholder="Phone"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                />
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

            <div className="card" style={{ maxWidth: 600 }}>
              <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 16, color: '#f5a623' }}>POS Options</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Enable GST (18%)</span>
                  <button
                    data-testid="settings-tax-toggle"
                    className="btn"
                    onClick={() => setSettings({ ...settings, tax_enabled: !settings.tax_enabled })}
                    style={{
                      background: settings.tax_enabled ? '#4caf50' : '#d32f2f',
                      color: '#fff'
                    }}
                  >
                    {settings.tax_enabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Auto Print Receipt</span>
                  <button
                    data-testid="settings-autoprint-toggle"
                    className="btn"
                    onClick={() => setSettings({ ...settings, auto_print: !settings.auto_print })}
                    style={{
                      background: settings.auto_print ? '#4caf50' : '#d32f2f',
                      color: '#fff'
                    }}
                  >
                    {settings.auto_print ? 'ON' : 'OFF'}
                  </button>
                </div>
                <div>
                  <div style={{ marginBottom: 8 }}>Low Stock Alert Threshold</div>
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
              style={{ marginTop: 20 }}
            >
              Save Settings
            </button>
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      {showReceipt && (
        <div className="modal-overlay" onClick={() => setShowReceipt(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} data-testid="receipt-modal">
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <h2 style={{ color: '#f5a623', fontSize: 24, marginBottom: 8 }}>{settings.shop_name}</h2>
              {settings.gstin && <div style={{ fontSize: 12, color: '#999' }}>GSTIN: {settings.gstin}</div>}
              {settings.address && <div style={{ fontSize: 12, color: '#999' }}>{settings.address}</div>}
              {settings.phone && <div style={{ fontSize: 12, color: '#999' }}>Phone: {settings.phone}</div>}
              {settings.email && <div style={{ fontSize: 12, color: '#999' }}>Email: {settings.email}</div>}
            </div>

            <div style={{ borderTop: '2px dashed #333', borderBottom: '2px dashed #333', padding: '12px 0', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: '#f5a623', fontWeight: 'bold' }}>Invoice: {showReceipt.invoice_no}</span>
                <span style={{ fontSize: 11, color: '#999' }}>{new Date(showReceipt.created_at).toLocaleString()}</span>
              </div>
              {showReceipt.customer_name && (
                <div style={{ fontSize: 12 }}>Customer: {showReceipt.customer_name}</div>
              )}
              {showReceipt.customer_phone && (
                <div style={{ fontSize: 12 }}>Phone: {showReceipt.customer_phone}</div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <table style={{ width: '100%', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #333' }}>
                    <th style={{ textAlign: 'left', padding: '8px 0' }}>Item</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {showReceipt.items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '6px 0' }}>
                        {item.name}
                        {item.hsn_code && <div style={{ fontSize: 10, color: '#666' }}>HSN: {item.hsn_code}</div>}
                      </td>
                      <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.price)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.price * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ borderTop: '1px solid #333', paddingTop: 12 }}>
              <div className="receipt-line">
                <span>Subtotal:</span>
                <span>{formatCurrency(showReceipt.subtotal)}</span>
              </div>
              {showReceipt.discount_amount > 0 && (
                <div className="receipt-line">
                  <span>Discount ({showReceipt.discount_percent}%):</span>
                  <span style={{ color: '#4caf50' }}>- {formatCurrency(showReceipt.discount_amount)}</span>
                </div>
              )}
              {showReceipt.tax_amount > 0 && (
                <div className="receipt-line">
                  <span>GST (18%):</span>
                  <span>{formatCurrency(showReceipt.tax_amount)}</span>
                </div>
              )}
              <div className="receipt-line" style={{ fontSize: 18, fontWeight: 'bold', color: '#f5a623', borderTop: '2px solid #f5a623', paddingTop: 12 }}>
                <span>Total:</span>
                <span>{formatCurrency(showReceipt.total)}</span>
              </div>
              <div className="receipt-line">
                <span>Payment Method:</span>
                <span>{showReceipt.payment_method}</span>
              </div>
              {showReceipt.payment_method === 'Cash' && (
                <>
                  <div className="receipt-line">
                    <span>Cash Received:</span>
                    <span>{formatCurrency(showReceipt.cash_received)}</span>
                  </div>
                  {showReceipt.change_given > 0 && (
                    <div className="receipt-line">
                      <span>Change Given:</span>
                      <span style={{ color: '#4caf50' }}>{formatCurrency(showReceipt.change_given)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 20, borderTop: '2px dashed #333', fontSize: 12, color: '#666' }}>
              Thank you for your business!
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className="btn" onClick={() => window.print()} style={{ flex: 1 }} data-testid="print-receipt-btn">
                Print
              </button>
              <button className="btn btn-primary" onClick={() => setShowReceipt(null)} style={{ flex: 1 }} data-testid="close-receipt-btn">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editProduct && (
        <div className="modal-overlay" onClick={() => setEditProduct(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }} data-testid="edit-product-modal">
            <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#f5a623' }}>Edit Product</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button className="btn" onClick={() => setEditProduct(null)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button data-testid="save-product-btn" className="btn btn-primary" onClick={handleUpdateProduct} style={{ flex: 1 }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div
          className="notification"
          data-testid="notification"
          style={{
            background: notification.type === 'error' ? '#d32f2f' : '#1a1a1f',
            borderColor: notification.type === 'error' ? '#d32f2f' : '#f5a623'
          }}
        >
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default BillingPOS;
