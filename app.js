// Robust IndexedDB Storage Wrapper
const DB_NAME = 'THF_Database';
const DB_VERSION = 1;
let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('state')) {
                db.createObjectStore('state');
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };
        request.onerror = (e) => reject('IndexedDB error');
    });
}

async function saveToDB(key, data) {
    if (!db) await initDB();
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put(data, key);
    return tx.complete;
}

async function loadFromDB(key) {
    if (!db) await initDB();
    return new Promise((resolve) => {
        const tx = db.transaction('state', 'readonly');
        const request = tx.objectStore('state').get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}

// Request Persistent Storage (Prevents browser from auto-clearing data)
if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then(persistent => {
        if (persistent) console.log("Storage will not be cleared except by explicit user action");
        else console.log("Storage may be cleared under storage pressure.");
    });
}

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
    { id: 9, name: "Chicken biriyani [curd rice]", prices: [130, 140] }
];

// Helper to save state (Dual sync: IDB + LocalStorage)
async function save() {
    const data = {
        orders: state.orders,
        inventory: state.inventory,
        spending: state.spending
    };
    await saveToDB('thf_state', data);
    localStorage.setItem('thf_backup', JSON.stringify(data));
    console.log('Data saved securely');
}

// Initialization
async function initApp() {
    await initDB();
    let savedState = await loadFromDB('thf_state');
    
    // Fallback to LocalStorage if IDB is empty
    if (!savedState) {
        const backup = localStorage.getItem('thf_backup');
        if (backup) savedState = JSON.parse(backup);
    }

    if (savedState) {
        state.orders = savedState.orders || [];
        state.inventory = savedState.inventory || [];
        state.spending = savedState.spending || [];
    }
    renderView('dashboard');
    checkBackupReminder();
}

function checkBackupReminder() {
    const lastBackup = localStorage.getItem('thf_last_backup_prompt');
    const today = new Date().toDateString();
    if (lastBackup !== today && new Date().getDay() === 0) { // Prompt on Sundays
        alert("Friendly Reminder: Please Export a Backup today to keep your data safe!");
        localStorage.setItem('thf_last_backup_prompt', today);
    }
}

// Views
const views = {
    dashboard: () => {
        const today = new Date().toLocaleDateString();
        const todayOrders = state.orders.filter(o => new Date(o.date).toLocaleDateString() === today);
        const totalRevenue = todayOrders.reduce((sum, o) => sum + o.price, 0);
        
        return `
            <div class="stats-grid">
                <div class="stat-card glass">
                    <span class="stat-value">${todayOrders.length}</span>
                    <span class="stat-label">Today's Orders</span>
                </div>
                <div class="stat-card glass">
                    <span class="stat-value">₹${totalRevenue}</span>
                    <span class="stat-label">Today's Revenue</span>
                </div>
            </div>

            <div style="display:flex; gap:10px; margin-bottom:25px;">
                <button onclick="exportData()" class="glass" style="flex:1; padding:10px; border:none; font-size:0.8rem;">📤 Export Backup</button>
                <button onclick="document.getElementById('import-input').click()" class="glass" style="flex:1; padding:10px; border:none; font-size:0.8rem;">📥 Import Backup</button>
                <input type="file" id="import-input" style="display:none" onchange="importData(event)">
            </div>
            
            <section class="recent-orders">
                <h3 style="margin-bottom: 15px;">Today's Activity</h3>
                ${todayOrders.length === 0 ? '<p style="color:var(--text-muted)">No orders yet today.</p>' : 
                    todayOrders.slice(0, 5).map(o => `
                        <div class="card glass item-row">
                            <div>
                                <strong>${o.customer || 'Guest'}</strong>
                                <div style="font-size:0.8rem; color:var(--text-muted)">${o.itemName}</div>
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
                ${state.orders.sort((a,b) => new Date(b.date) - new Date(a.date)).map(o => `
                    <div class="card glass">
                        <div class="item-row" style="margin-bottom:10px;">
                            <strong>${o.customer || 'Guest'}</strong>
                            <span class="badge badge-${o.status.toLowerCase()}">${o.status}</span>
                        </div>
                        <div style="font-size:0.9rem; margin-bottom:5px;">${o.itemName} - ₹${o.price}</div>
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
            ${state.spending.sort((a,b) => new Date(b.date) - new Date(a.date)).map(s => `
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
    
    // Update nav active state
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
window.showOrderForm = () => {
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
                <label>Select Variant (Price)</label>
                <select id="variant-select">
                    <!-- Dynamic -->
                </select>
            </div>
            <button type="submit" class="btn-primary">Place Order</button>
        </form>
    `);

    document.getElementById('order-form').onsubmit = (e) => {
        e.preventDefault();
        const itemId = document.getElementById('menu-select').value;
        if (!itemId) return alert('Please select an item');
        
        const item = MENU.find(m => m.id == itemId);
        const variantSelect = document.getElementById('variant-select');
        const price = item.prices.length > 1 ? parseInt(variantSelect.value) : item.prices[0];
        
        const newOrder = {
            id: Date.now().toString(),
            customer: document.getElementById('cust-name').value,
            itemId: item.id,
            itemName: item.name,
            price: price,
            status: 'Pending',
            date: new Date().toISOString()
        };
        
        state.orders.push(newOrder);
        save();
        modal.classList.add('hidden');
        renderView(state.currentView);
    };
};

window.handleMenuChange = (val) => {
    const item = MENU.find(m => m.id == val);
    const container = document.getElementById('variant-container');
    const select = document.getElementById('variant-select');
    
    if (item && item.prices.length > 1) {
        container.classList.remove('hidden');
        select.innerHTML = item.prices.map((p, index) => 
            `<option value="${p}">${index === 0 ? 'First' : 'Second'} Variant - ₹${p}</option>`
        ).join('');
    } else {
        container.classList.add('hidden');
    }
};

window.updateOrderStatus = (id, status) => {
    const order = state.orders.find(o => o.id === id);
    if (order) {
        order.status = status;
        save();
        renderView(state.currentView);
    }
};

window.deleteOrder = (id) => {
    if (confirm('Delete this order?')) {
        state.orders = state.orders.filter(o => o.id !== id);
        save();
        renderView(state.currentView);
    }
};

// Inventory Actions
window.showInventoryModal = () => {
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
    
    document.getElementById('inventory-form').onsubmit = (e) => {
        e.preventDefault();
        state.inventory.push({
            id: Date.now().toString(),
            name: document.getElementById('inv-name').value,
            quantity: parseFloat(document.getElementById('inv-qty').value),
            unit: document.getElementById('inv-unit').value
        });
        save();
        modal.classList.add('hidden');
        renderView('inventory');
    };
};

window.updateStock = (id, change) => {
    const item = state.inventory.find(i => i.id === id);
    if (item) {
        item.quantity = Math.max(0, item.quantity + change);
        save();
        renderView('inventory');
    }
};

window.deleteInventory = (id) => {
    if (confirm('Delete this item?')) {
        state.inventory = state.inventory.filter(i => i.id !== id);
        save();
        renderView('inventory');
    }
};

// Spending Actions
window.showSpendingModal = () => {
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
    
    document.getElementById('spending-form').onsubmit = (e) => {
        e.preventDefault();
        state.spending.push({
            id: Date.now().toString(),
            amount: document.getElementById('sp-amount').value,
            category: document.getElementById('sp-cat').value,
            note: document.getElementById('sp-note').value,
            date: new Date().toISOString()
        });
        save();
        modal.classList.add('hidden');
        renderView('spending');
    };
};

window.deleteSpending = (id) => {
    if (confirm('Delete this expense?')) {
        state.spending = state.spending.filter(s => s.id !== id);
        save();
        renderView('spending');
    }
};

// Backup Logic
window.exportData = () => {
    const data = JSON.stringify(state);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `THF_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
};

window.importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedState = JSON.parse(e.target.result);
            state.orders = importedState.orders || [];
            state.inventory = importedState.inventory || [];
            state.spending = importedState.spending || [];
            save();
            alert('Data imported successfully!');
            renderView('dashboard');
        } catch (err) {
            alert('Invalid backup file');
        }
    };
    reader.readAsText(file);
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
