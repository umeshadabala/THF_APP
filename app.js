// Supabase Configuration is now loaded from config.js
let db; // Global Supabase client instance

const ADMIN_PASSWORD = 'THF@123';
const PROFIT_PER_ORDER = 40;

let state = {
    orders: [],
    inventory: [],
    spending: [],
    currentView: 'dashboard',
    orderDateFrom: '',
    orderDateTo: ''
};

function isSameCalendarDay(dateStr, refDate = new Date()) {
    const d = new Date(dateStr);
    return d.getFullYear() === refDate.getFullYear()
        && d.getMonth() === refDate.getMonth()
        && d.getDate() === refDate.getDate();
}

function orderProfit() {
    return PROFIT_PER_ORDER;
}

function orderCostPortion(order) {
    return Math.max(0, Number(order.price) - PROFIT_PER_ORDER);
}

function getPendingOrders() {
    return state.orders.filter(o => (o.status || '').toLowerCase() === 'pending');
}

function getFilteredOrders() {
    let list = [...state.orders];
    if (state.orderDateFrom) {
        const from = new Date(state.orderDateFrom);
        from.setHours(0, 0, 0, 0);
        list = list.filter(o => new Date(o.date) >= from);
    }
    if (state.orderDateTo) {
        const to = new Date(state.orderDateTo);
        to.setHours(23, 59, 59, 999);
        list = list.filter(o => new Date(o.date) <= to);
    }
    return list;
}

function getOrderProfitStats(orders) {
    return {
        count: orders.length,
        profit: orders.length * PROFIT_PER_ORDER,
        costPortion: orders.reduce((sum, o) => sum + orderCostPortion(o), 0),
        grossRevenue: orders.reduce((sum, o) => sum + Number(o.price), 0)
    };
}

function getHomeStats() {
    const todayOrders = state.orders.filter(o => isSameCalendarDay(o.date));
    return {
        todayCount: todayOrders.length,
        todayEarnings: todayOrders.length * PROFIT_PER_ORDER,
        totalOrders: state.orders.length,
        totalProfit: state.orders.length * PROFIT_PER_ORDER,
        totalOrderCosts: state.orders.reduce((sum, o) => sum + orderCostPortion(o), 0)
    };
}

function formatDateRangeLabel() {
    if (state.orderDateFrom && state.orderDateTo) {
        return `${state.orderDateFrom} → ${state.orderDateTo}`;
    }
    if (state.orderDateFrom) return `from ${state.orderDateFrom}`;
    if (state.orderDateTo) return `until ${state.orderDateTo}`;
    return 'All dates';
}

const MENU = [
    { id: 1, name: "Bagara rice + chicken curry/fry", prices: [130, 140] },
    { id: 2, name: "Bagara rice + egg curry", prices: [100, 110] },
    { id: 3, name: "Chicken meal", prices: [100, 110] },
    { id: 4, name: "Egg Meal", prices: [80, 90] },
    { id: 5, name: "Curd rice", prices: [40] },
    { id: 6, name: "Chicken combo", prices: [160, 170] },
    { id: 7, name: "Bagara rice + veg curry", prices: [100, 110] },
    { id: 8, name: "Chicken combo [curd rice]", prices: [160, 170] },
    { id: 9, name: "Chicken biriyani [curd rice]", prices: [130, 140] },
    { id: 999, name: "Others", prices: [] } // Manual price entry, matching existing data
];

// Helper to verify admin (async modal-based)
function verifyAdmin() {
    return new Promise((resolve) => {
        const pwModal = document.getElementById('password-modal');
        const pwInput = document.getElementById('admin-password-input');
        const pwError = document.getElementById('password-error');
        const pwSubmit = document.getElementById('password-submit-btn');
        const pwClose = document.querySelector('.close-password-modal');

        // Reset state
        pwInput.value = '';
        pwError.style.display = 'none';
        pwModal.classList.remove('hidden');
        pwInput.focus();

        function cleanup() {
            pwModal.classList.add('hidden');
            pwSubmit.removeEventListener('click', handleSubmit);
            pwInput.removeEventListener('keydown', handleKey);
            pwClose.removeEventListener('click', handleClose);
        }

        function handleSubmit() {
            if (pwInput.value === ADMIN_PASSWORD) {
                cleanup();
                resolve(true);
            } else {
                pwError.style.display = 'block';
                pwInput.value = '';
                pwInput.focus();
            }
        }

        function handleKey(e) {
            if (e.key === 'Enter') handleSubmit();
        }

        function handleClose() {
            cleanup();
            resolve(false);
        }

        pwSubmit.addEventListener('click', handleSubmit);
        pwInput.addEventListener('keydown', handleKey);
        pwClose.addEventListener('click', handleClose);
    });
}

// Data Fetching
async function fetchData() {
    if (!db) {
        console.error("Database client not initialized.");
        return;
    }
    
    const loader = document.getElementById('loader');
    if (loader) loader.classList.remove('hidden');
    
    try {
        const [ordersRes, inventoryRes, spendingRes] = await Promise.all([
            db.from('orders').select('*').order('date', { ascending: false }),
            db.from('inventory').select('*').order('name'),
            db.from('spending').select('*').order('date', { ascending: false })
        ]);

        if (ordersRes.error) throw ordersRes.error;
        if (inventoryRes.error) throw inventoryRes.error;
        if (spendingRes.error) throw spendingRes.error;

        state.orders = ordersRes.data || [];
        state.inventory = inventoryRes.data || [];
        state.spending = spendingRes.data || [];
        
        renderView(state.currentView);
    } catch (err) {
        console.error('Fetch error:', err);
        alert('Database Error: ' + (err.message || 'Could not fetch data. Ensure your tables are created in Supabase.'));
        const errLoader = document.getElementById('loader');
        if (errLoader) errLoader.innerHTML = `<p style="color:var(--danger)">Database Error: ${err.message || 'Connection failed'}</p>`;
    } finally {
        const finalLoader = document.getElementById('loader');
        if (finalLoader) finalLoader.classList.add('hidden');
    }
}

// Initialization
async function initApp() {
    // 1. Check if config.js loaded
    if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_KEY === 'undefined') {
        alert("Configuration Error: config.js not found or incomplete.");
        return;
    }

    // 2. Check if Anon Key is placeholder
    if (SUPABASE_KEY === 'YOUR_SUPABASE_ANON_KEY') {
        renderView('dashboard');
        alert("Please set your Supabase Anon Key in config.js");
        const cfgLoader = document.getElementById('loader');
        if (cfgLoader) cfgLoader.innerHTML = '<p style="color:var(--danger); padding:20px; text-align:center;">Configuration Required: Set your Supabase Anon/Public Key in <b>config.js</b> to enable cloud sync.</p>';
        return;
    }

    // 3. Initialize Client
    try {
        if (typeof supabase === 'undefined') {
            throw new Error("Supabase library failed to load. Check your internet connection.");
        }
        db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        await fetchData();
    } catch (err) {
        console.error("Init Error:", err);
        alert("Init Error: " + err.message);
    }
}

// Views
const views = {
    dashboard: () => {
        const stats = getHomeStats();
        const pending = getPendingOrders();

        return `
            <div class="stats-grid">
                <div class="stat-card glass">
                    <span class="stat-value">${stats.todayCount}</span>
                    <span class="stat-label">Today Orders</span>
                </div>
                <div class="stat-card glass">
                    <span class="stat-value profit">₹${stats.todayEarnings}</span>
                    <span class="stat-label">Today Earnings</span>
                </div>
                <div class="stat-card glass">
                    <span class="stat-value">${stats.totalOrders}</span>
                    <span class="stat-label">Total Orders</span>
                </div>
                <div class="stat-card glass">
                    <span class="stat-value profit">₹${stats.totalProfit}</span>
                    <span class="stat-label">Total Profit</span>
                </div>
                <div class="stat-card glass" style="grid-column: 1 / -1;">
                    <span class="stat-value cost">₹${stats.totalOrderCosts}</span>
                    <span class="stat-label">Total Expenses (order cost after ₹${PROFIT_PER_ORDER} profit)</span>
                </div>
            </div>

            <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:20px; text-align:center;">
                ₹${PROFIT_PER_ORDER} profit counted per order · Expenses page tracks recorded bills separately
            </p>

            <div style="display:flex; gap:10px; margin-bottom:25px;">
                <button onclick="fetchData()" class="glass" style="flex:1; padding:10px; border:none; font-size:0.8rem;">🔄 Sync Cloud</button>
            </div>
            
            <section class="recent-orders">
                <h3 style="margin-bottom: 15px;">Pending Orders (${pending.length})</h3>
                ${pending.length === 0 ? '<p style="color:var(--text-muted)">No pending orders right now.</p>' : 
                    pending.map(o => `
                        <div class="card glass item-row">
                            <div>
                                <strong>${o.customer || 'Guest'}</strong>
                                <div style="font-size:0.8rem; color:var(--text-muted)">${o.itemname} · ₹${o.price}</div>
                                <div class="order-meta">${new Date(o.date).toLocaleString()}</div>
                            </div>
                            <span class="badge badge-pending">${o.status}</span>
                        </div>
                    `).join('')
                }
            </section>
        `;
    },
    
    orders: () => {
        const filtered = getFilteredOrders();
        const stats = getOrderProfitStats(filtered);
        const hasFilter = state.orderDateFrom || state.orderDateTo;
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2>All Orders</h2>
                <div style="font-size:0.8rem; color:var(--text-muted)">Showing: ${filtered.length} / ${state.orders.length}</div>
            </div>
            <div class="date-filter-bar glass">
                <div class="filter-field">
                    <label>From date</label>
                    <input type="date" id="order-date-from" value="${state.orderDateFrom}">
                </div>
                <div class="filter-field">
                    <label>To date</label>
                    <input type="date" id="order-date-to" value="${state.orderDateTo}">
                </div>
                <div class="filter-actions">
                    <button type="button" class="btn-filter" onclick="applyOrderDateFilter()">Filter</button>
                    <button type="button" class="btn-clear" onclick="clearOrderDateFilter()">Clear</button>
                </div>
            </div>
            <section class="filter-profit-summary">
                <h3 style="margin-bottom:12px; font-size:0.95rem;">
                    ${hasFilter ? 'Profit for selected dates' : 'Profit summary'} · ${formatDateRangeLabel()}
                </h3>
                <div class="stats-grid filter-stats-grid">
                    <div class="stat-card glass">
                        <span class="stat-value">${stats.count}</span>
                        <span class="stat-label">Orders</span>
                    </div>
                    <div class="stat-card glass">
                        <span class="stat-value profit">₹${stats.profit}</span>
                        <span class="stat-label">Profit (₹${PROFIT_PER_ORDER}/order)</span>
                    </div>
                    <div class="stat-card glass">
                        <span class="stat-value cost">₹${stats.costPortion}</span>
                        <span class="stat-label">Order costs</span>
                    </div>
                    <div class="stat-card glass">
                        <span class="stat-value">₹${stats.grossRevenue}</span>
                        <span class="stat-label">Gross revenue</span>
                    </div>
                </div>
            </section>
            <div id="orders-list">
                ${filtered.length === 0 ? '<p style="color:var(--text-muted)">No orders match this date range.</p>' : filtered.map(o => `
                    <div class="card glass">
                        <div class="item-row" style="margin-bottom:10px;">
                            <strong>${o.customer || 'Guest'}</strong>
                            <span class="badge badge-${o.status.toLowerCase()}">${o.status}</span>
                        </div>
                        <div style="font-size:0.9rem; margin-bottom:5px;">${o.itemname} - ₹${o.price}</div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:0.75rem; color:var(--text-muted)">${new Date(o.date).toLocaleString()}</span>
                            <div style="display:flex; gap:10px;">
                                <button onclick="updateOrderStatus('${o.id}', 'Delivered')" style="background:none; border:none; cursor:pointer; font-size:1rem;">✅</button>
                                <button onclick="deleteOrder('${o.id}')" style="background:none; border:none; cursor:pointer; font-size:1rem;">🗑️</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    inventory: () => {
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2>Inventory</h2>
                <button onclick="showInventoryModal()" class="glass" style="padding:5px 15px; border:none; cursor:pointer;">Add Item</button>
            </div>
            ${state.inventory.length === 0 ? '<p>No inventory items yet.</p>' : 
                state.inventory.map(item => `
                    <div class="card glass inventory-card">
                        <div class="inventory-info">
                            <strong>${item.name}</strong>
                            <div class="inventory-meta">Stock: ${item.quantity} ${item.unit}</div>
                            <div class="inventory-meta">Price: <span class="price-tag">₹${item.unitprice != null && item.unitprice !== '' ? item.unitprice : '—'}</span> per ${item.unit}</div>
                        </div>
                        <div class="inventory-actions">
                            <button type="button" class="btn-chip" onclick="updateStock('${item.id}', -1)" aria-label="Decrease stock">−</button>
                            <button type="button" class="btn-chip" onclick="updateStock('${item.id}', 1)" aria-label="Increase stock">+</button>
                            <button type="button" class="btn-chip btn-chip-primary" onclick="showInventoryEditModal('${item.id}')">Edit</button>
                            <button type="button" class="btn-icon-delete" onclick="deleteInventory('${item.id}')" aria-label="Delete">🗑️</button>
                        </div>
                    </div>
                `).join('')
            }
        `;
    },

    spending: () => {
        const total = state.spending.reduce((sum, s) => sum + parseFloat(s.amount), 0);
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2>Spending Tracker</h2>
                <div style="font-weight:700; color:var(--danger)">Total: ₹${total}</div>
            </div>
            <button onclick="showSpendingModal()" class="btn-primary" style="margin-bottom:20px;">Record Expense</button>
            ${state.spending.map(s => `
                <div class="card glass item-row">
                    <div>
                        <strong>${s.category}</strong>
                        <div style="font-size:0.8rem; color:var(--text-muted)">${s.note || 'No note'}</div>
                        <div style="font-size:0.7rem; color:var(--text-muted)">${new Date(s.date).toLocaleDateString()}</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:15px;">
                        <span style="font-weight:700; color:var(--danger)">₹${s.amount}</span>
                        <button onclick="deleteSpending('${s.id}')" style="background:none; border:none;">🗑️</button>
                    </div>
                </div>
            `).join('')}
        `;
    }
};

// Router
function renderView(viewName) {
    state.currentView = viewName;
    const content = views[viewName]();
    document.getElementById('main-content').innerHTML = content;
    
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });
}

window.applyOrderDateFilter = () => {
    const fromEl = document.getElementById('order-date-from');
    const toEl = document.getElementById('order-date-to');
    state.orderDateFrom = fromEl ? fromEl.value : '';
    state.orderDateTo = toEl ? toEl.value : '';
    if (state.orderDateFrom && state.orderDateTo && state.orderDateFrom > state.orderDateTo) {
        alert('From date cannot be after To date.');
        return;
    }
    renderView('orders');
};

window.clearOrderDateFilter = () => {
    state.orderDateFrom = '';
    state.orderDateTo = '';
    renderView('orders');
};

// Modal Handlers
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const modalTitle = document.getElementById('modal-title');

function showModal(title, content) {
    modalTitle.innerText = title;
    modalBody.innerHTML = content;
    modal.classList.remove('hidden');
}

document.querySelector('.close-modal').onclick = () => modal.classList.add('hidden');

// Global actions
window.showOrderForm = async () => {
    if (!(await verifyAdmin())) return;
    const menuOptions = MENU.map(item => `<option value="${item.id}">${item.name}</option>`).join('');
    
    showModal('New Order', `
        <form id="order-form">
            <div class="form-group">
                <label>Customer Name</label>
                <input type="text" id="cust-name" placeholder="Optional">
            </div>
            <div class="form-group">
                <label>Select Item</label>
                <select id="menu-select" onchange="handleMenuChange(this.value)">
                    <option value="">Choose an item...</option>
                    ${menuOptions}
                </select>
            </div>
            <div id="variant-container" class="form-group hidden">
                <label id="variant-label">Select Variant (Price)</label>
                <select id="variant-select">
                    <!-- Dynamic -->
                </select>
            </div>
            <div id="custom-price-container" class="form-group hidden">
                <label>Enter Price (₹)</label>
                <input type="number" id="custom-price" placeholder="Enter amount">
            </div>
            <button type="submit" class="btn-primary">Place Order</button>
        </form>
    `);

    document.getElementById('order-form').onsubmit = async (e) => {
        e.preventDefault();

        const itemId = document.getElementById('menu-select').value;
        if (!itemId) return alert('Please select an item');
        
        const item = MENU.find(m => m.id == itemId);
        let price;

        if (item.id === 999) { // Others
            price = parseInt(document.getElementById('custom-price').value);
            if (!price) return alert('Please enter a price');
        } else {
            const variantSelect = document.getElementById('variant-select');
            price = item.prices.length > 1 ? parseInt(variantSelect.value) : item.prices[0];
        }
        
        const newOrder = {
            id: Date.now().toString(),
            customer: document.getElementById('cust-name').value,
            itemid: item.id,
            itemname: item.name,
            price: price,
            status: 'Pending',
            date: new Date().toISOString()
        };
        
        const { error } = await db.from('orders').insert([newOrder]);
        if (error) alert('Error saving order');
        else {
            modal.classList.add('hidden');
            fetchData();
        }
    };
};

window.handleMenuChange = (val) => {
    const item = MENU.find(m => m.id == val);
    const varContainer = document.getElementById('variant-container');
    const customContainer = document.getElementById('custom-price-container');
    const select = document.getElementById('variant-select');
    
    varContainer.classList.add('hidden');
    customContainer.classList.add('hidden');

    if (item) {
        if (item.id === 999) {
            customContainer.classList.remove('hidden');
        } else if (item.prices.length > 1) {
            varContainer.classList.remove('hidden');
            select.innerHTML = item.prices.map((p, index) => 
                `<option value="${p}">${index === 0 ? 'Regular' : 'Large/Extra'} - ₹${p}</option>`
            ).join('');
        }
    }
};

window.updateOrderStatus = async (id, status) => {
    if (!(await verifyAdmin())) return;
    const { error } = await db.from('orders').update({ status }).eq('id', id);
    if (error) alert('Error updating status');
    else fetchData();
};

window.deleteOrder = async (id) => {
    if (!confirm('Delete this order?')) return;
    if (!(await verifyAdmin())) return;
    const { error } = await db.from('orders').delete().eq('id', id);
    if (error) alert('Error deleting order');
    else fetchData();
};

// Inventory Actions
window.showInventoryModal = async () => {
    if (!(await verifyAdmin())) return;
    showModal('Add Inventory', `
        <p class="modal-subtitle">Add stock with price per unit, same as order entry</p>
        <form id="inventory-form">
            <div class="form-group">
                <label>Item Name</label>
                <input type="text" id="inv-name" required placeholder="e.g. Rice, Chicken">
            </div>
            <div class="form-group">
                <label>Price per unit (₹)</label>
                <input type="number" id="inv-price" min="0" step="0.01" placeholder="e.g. 80">
            </div>
            <div class="form-group">
                <label>Quantity</label>
                <input type="number" id="inv-qty" required value="0">
            </div>
            <div class="form-group">
                <label>Unit</label>
                <input type="text" id="inv-unit" placeholder="kg, liters, pcs" value="kg">
            </div>
            <button type="submit" class="btn-primary">Save Item</button>
        </form>
    `);
    
    document.getElementById('inventory-form').onsubmit = async (e) => {
        e.preventDefault();

        const priceVal = document.getElementById('inv-price').value;
        const newItem = {
            id: Date.now().toString(),
            name: document.getElementById('inv-name').value,
            quantity: parseFloat(document.getElementById('inv-qty').value),
            unit: document.getElementById('inv-unit').value,
            unitprice: priceVal !== '' ? parseFloat(priceVal) : 0
        };

        let { error } = await db.from('inventory').insert([newItem]);
        if (error && String(error.message).includes('unitprice')) {
            const { unitprice, ...withoutPrice } = newItem;
            ({ error } = await db.from('inventory').insert([withoutPrice]));
            if (!error) {
                alert('Item saved. Run supabase/add_unitprice.sql in Supabase SQL Editor to enable price per unit.');
            }
        }
        if (error) alert('Error saving inventory: ' + error.message);
        else {
            modal.classList.add('hidden');
            fetchData();
        }
    };
};

window.updateStock = async (id, change) => {
    if (!(await verifyAdmin())) return;
    const item = state.inventory.find(i => i.id === id);
    if (item) {
        const newQty = Math.max(0, item.quantity + change);
        const { error } = await db.from('inventory').update({ quantity: newQty }).eq('id', id);
        if (error) alert('Error updating stock');
        else fetchData();
    }
};

window.deleteInventory = async (id) => {
    if (!confirm('Delete this item?')) return;
    if (!(await verifyAdmin())) return;
    const { error } = await db.from('inventory').delete().eq('id', id);
    if (error) alert('Error deleting inventory');
    else fetchData();
};

window.showInventoryEditModal = async (id) => {
    if (!(await verifyAdmin())) return;
    const item = state.inventory.find(i => i.id === id);
    if (!item) return;

    showModal('Edit Inventory Item', `
        <p class="modal-subtitle">Update stock and price for <strong>${item.name}</strong></p>
        <form id="inventory-edit-form">
            <div class="form-group">
                <label>Item Name</label>
                <input type="text" id="inv-edit-name" required value="${item.name.replace(/"/g, '&quot;')}">
            </div>
            <div class="form-group">
                <label>Price per unit (₹)</label>
                <input type="number" id="inv-edit-price" min="0" step="0.01" placeholder="e.g. 80" value="${item.unitprice != null && item.unitprice !== '' ? item.unitprice : ''}">
            </div>
            <div class="form-group">
                <label>Quantity</label>
                <input type="number" id="inv-edit-qty" required min="0" step="any" value="${item.quantity}">
            </div>
            <div class="form-group">
                <label>Unit</label>
                <input type="text" id="inv-edit-unit" placeholder="kg, liters, pcs" value="${item.unit}">
            </div>
            <button type="submit" class="btn-primary">Save Changes</button>
        </form>
    `);

    document.getElementById('inventory-edit-form').onsubmit = async (e) => {
        e.preventDefault();

        const priceVal = document.getElementById('inv-edit-price').value;
        const parsed = priceVal !== '' ? parseFloat(priceVal) : 0;
        if (priceVal !== '' && (isNaN(parsed) || parsed < 0)) {
            alert('Enter a valid price.');
            return;
        }

        const updates = {
            name: document.getElementById('inv-edit-name').value.trim(),
            quantity: parseFloat(document.getElementById('inv-edit-qty').value),
            unit: document.getElementById('inv-edit-unit').value.trim() || 'kg',
            unitprice: parsed
        };

        let { error } = await db.from('inventory').update(updates).eq('id', id);
        if (error && String(error.message).includes('unitprice')) {
            const { unitprice, ...withoutPrice } = updates;
            ({ error } = await db.from('inventory').update(withoutPrice).eq('id', id));
            if (!error) {
                alert('Saved without price. Run supabase/add_unitprice.sql in Supabase SQL Editor to enable price per unit.');
            }
        }
        if (error) alert('Error updating item: ' + error.message);
        else {
            modal.classList.add('hidden');
            fetchData();
        }
    };
};

// Spending Actions
window.showSpendingModal = async () => {
    if (!(await verifyAdmin())) return;
    showModal('Record Expense', `
        <form id="spending-form">
            <div class="form-group">
                <label>Amount (₹)</label>
                <input type="number" id="sp-amount" required>
            </div>
            <div class="form-group">
                <label>Category</label>
                <select id="sp-cat">
                    <option>Ingredients</option>
                    <option>Delivery/Fuel</option>
                    <option>Utilities (Gas/Light)</option>
                    <option>Wages</option>
                    <option>Packaging</option>
                    <option>Other</option>
                </select>
            </div>
            <div class="form-group">
                <label>Note</label>
                <textarea id="sp-note"></textarea>
            </div>
            <button type="submit" class="btn-primary">Save Expense</button>
        </form>
    `);
    
    document.getElementById('spending-form').onsubmit = async (e) => {
        e.preventDefault();

        const newExpense = {
            id: Date.now().toString(),
            amount: document.getElementById('sp-amount').value,
            category: document.getElementById('sp-cat').value,
            note: document.getElementById('sp-note').value,
            date: new Date().toISOString()
        };

        const { error } = await db.from('spending').insert([newExpense]);
        if (error) alert('Error saving expense');
        else {
            modal.classList.add('hidden');
            fetchData();
        }
    };
};

window.deleteSpending = async (id) => {
    if (!confirm('Delete this expense?')) return;
    if (!(await verifyAdmin())) return;
    const { error } = await db.from('spending').delete().eq('id', id);
    if (error) alert('Error deleting expense');
    else fetchData();
};



// Init
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.onclick = () => renderView(btn.dataset.view);
});

document.getElementById('quick-add').onclick = () => {
    if (state.currentView === 'spending') window.showSpendingModal();
    else if (state.currentView === 'inventory') window.showInventoryModal();
    else window.showOrderForm();
};

document.getElementById('current-date').innerText = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

// PWA install
let deferredInstallPrompt = null;
const installBtn = document.getElementById('install-app-btn');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (installBtn) installBtn.classList.remove('hidden');
});

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (!deferredInstallPrompt) {
            alert('Install from your browser menu:\n\n• Chrome/Edge: ⋮ → Install app\n• Safari (iOS): Share → Add to Home Screen');
            return;
        }
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') installBtn.classList.add('hidden');
        deferredInstallPrompt = null;
    });
}

window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.classList.add('hidden');
    deferredInstallPrompt = null;
});

if (window.matchMedia('(display-mode: standalone)').matches && installBtn) {
    installBtn.classList.add('hidden');
}

initApp();
