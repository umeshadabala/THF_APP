// Supabase Configuration is now loaded from config.js
let db; // Global Supabase client instance

const ADMIN_PASSWORD = 'THF@123';

let state = {
    orders: [],
    inventory: [],
    spending: [],
    currentView: 'dashboard'
};

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
        const today = new Date().toLocaleDateString();
        const todayOrders = state.orders.filter(o => new Date(o.date).toLocaleDateString() === today);
        const todayRevenue = todayOrders.reduce((sum, o) => sum + o.price, 0);
        
        const totalOrders = state.orders.length;
        const totalRevenue = state.orders.reduce((sum, o) => sum + o.price, 0);
        
        return `
            <div class="stats-grid">
                <div class="stat-card glass">
                    <span class="stat-value">${todayOrders.length}</span>
                    <span class="stat-label">Daily Orders</span>
                </div>
                <div class="stat-card glass">
                    <span class="stat-value">₹${todayRevenue}</span>
                    <span class="stat-label">Daily Earning</span>
                </div>
                <div class="stat-card glass">
                    <span class="stat-value">${totalOrders}</span>
                    <span class="stat-label">Total Orders</span>
                </div>
                <div class="stat-card glass">
                    <span class="stat-value">₹${totalRevenue}</span>
                    <span class="stat-label">Total Revenue</span>
                </div>
            </div>

            <div style="display:flex; gap:10px; margin-bottom:25px;">
                <button onclick="fetchData()" class="glass" style="flex:1; padding:10px; border:none; font-size:0.8rem;">🔄 Sync Cloud</button>
            </div>
            
            <section class="recent-orders">
                <h3 style="margin-bottom: 15px;">Recent Activity</h3>
                ${state.orders.length === 0 ? '<p style="color:var(--text-muted)">No data available. Add items or sync.</p>' : 
                    state.orders.slice(0, 5).map(o => `
                        <div class="card glass item-row">
                            <div>
                                <strong>${o.customer || 'Guest'}</strong>
                                <div style="font-size:0.8rem; color:var(--text-muted)">${o.itemname}</div>
                            </div>
                            <span class="badge badge-${o.status.toLowerCase()}">${o.status}</span>
                        </div>
                    `).join('')
                }
            </section>
        `;
    },
    
    orders: () => {
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2>All Orders</h2>
                <div style="font-size:0.8rem; color:var(--text-muted)">Total: ${state.orders.length}</div>
            </div>
            <div id="orders-list">
                ${state.orders.map(o => `
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
                    <div class="card glass item-row">
                        <div>
                            <strong>${item.name}</strong>
                            <div style="font-size:0.8rem; color:var(--text-muted)">Stock: ${item.quantity} ${item.unit}</div>
                        </div>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <button onclick="updateStock('${item.id}', -1)" style="padding:5px 10px; border-radius:5px; border:1px solid #ddd;">-</button>
                            <button onclick="updateStock('${item.id}', 1)" style="padding:5px 10px; border-radius:5px; border:1px solid #ddd;">+</button>
                            <button onclick="deleteInventory('${item.id}')" style="background:none; border:none;">🗑️</button>
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
        <form id="inventory-form">
            <div class="form-group">
                <label>Item Name</label>
                <input type="text" id="inv-name" required placeholder="e.g. Rice, Chicken">
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

        const newItem = {
            id: Date.now().toString(),
            name: document.getElementById('inv-name').value,
            quantity: parseFloat(document.getElementById('inv-qty').value),
            unit: document.getElementById('inv-unit').value
        };

        const { error } = await db.from('inventory').insert([newItem]);
        if (error) alert('Error saving inventory');
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

initApp();
