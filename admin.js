// public/js/admin.js
// Admin Dashboard Controller (Orders Management & Menu Item CRUD)

const Admin = {
  currentTab: 'orders',
  orders: [],
  foods: [],
  categories: [],
  editingFoodId: null,

  async init() {
    this.checkAdminAuth();
    this.setupEventListeners();
    await this.loadStats();
    await this.loadOrders();
    await this.loadFoods();
  },

  // Check authentication
  checkAdminAuth() {
    const user = Auth.getUser();
    const notice = document.getElementById('admin-auth-notice');

    if (!user || user.role !== 'admin') {
      if (notice) notice.style.display = 'block';
    } else {
      if (notice) notice.style.display = 'none';
      const adminNameEl = document.getElementById('admin-user-name');
      if (adminNameEl) adminNameEl.textContent = user.name;
    }
  },

  // Quick login as admin helper
  async quickAdminLogin() {
    const res = await Auth.login('admin@foodie.com', 'admin123');
    if (res.success) {
      window.location.reload();
    } else {
      alert('Could not login as admin: ' + res.message);
    }
  },

  // ----------------------------------------------------
  // Stats Loading
  // ----------------------------------------------------
  async loadStats() {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (data.success && data.stats) {
        document.getElementById('stat-revenue').textContent = `$${data.stats.totalRevenue.toFixed(2)}`;
        document.getElementById('stat-orders').textContent = data.stats.totalOrders;
        document.getElementById('stat-active').textContent = data.stats.activeOrders;
        document.getElementById('stat-foods').textContent = data.stats.totalFoods;
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  },

  // ----------------------------------------------------
  // Orders Management
  // ----------------------------------------------------
  async loadOrders(statusFilter = 'all') {
    const tableBody = document.getElementById('orders-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading orders...</td></tr>';

    try {
      const query = statusFilter !== 'all' ? `?status=${encodeURIComponent(statusFilter)}` : '';
      const res = await fetch(`/api/orders${query}`);
      const data = await res.json();

      if (!data.success || !data.orders || data.orders.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">No orders found for this status.</td></tr>';
        return;
      }

      this.orders = data.orders;

      tableBody.innerHTML = data.orders.map(order => `
        <tr>
          <td>
            <strong style="color:var(--secondary);">${order.id}</strong>
            <div style="font-size:0.75rem; color:var(--text-muted);">${new Date(order.createdAt).toLocaleDateString()} ${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </td>
          <td>
            <strong>${order.customerName}</strong>
            <div style="font-size:0.75rem; color:var(--text-muted);">${order.customerPhone}</div>
          </td>
          <td style="max-width:240px;">
            <div style="font-size:0.8rem; line-height:1.4;">${order.deliveryAddress}</div>
            ${order.notes ? `<div style="font-size:0.75rem; color:var(--primary); font-style:italic;">Note: ${order.notes}</div>` : ''}
          </td>
          <td>
            <div style="font-size:0.85rem;">
              ${order.items.map(i => `<span style="display:inline-block; margin-right:4px; font-weight:600;">${i.quantity}x</span> ${i.name}`).join('<br>')}
            </div>
          </td>
          <td>
            <strong style="color:var(--secondary); font-size:0.95rem;">$${order.total.toFixed(2)}</strong>
            <div style="font-size:0.75rem; color:var(--text-muted);">${order.paymentMethod} (${order.paymentStatus})</div>
          </td>
          <td>
            <span class="status-badge ${order.status.toLowerCase().replace(/\s+/g, '-')}">${order.status}</span>
          </td>
          <td>
            <select class="form-control" style="padding:6px 10px; font-size:0.8rem;" onchange="Admin.updateOrderStatus('${order.id}', this.value)">
              <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="Preparing" ${order.status === 'Preparing' ? 'selected' : ''}>Preparing</option>
              <option value="Out for Delivery" ${order.status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
              <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
              <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--danger);">Error loading orders</td></tr>';
    }
  },

  async updateOrderStatus(orderId, newStatus) {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        this.loadStats();
        this.loadOrders(document.getElementById('order-status-filter')?.value || 'all');
      } else {
        alert(data.message || 'Failed to update order status');
      }
    } catch (err) {
      alert('Error updating order status: ' + err.message);
    }
  },

  // ----------------------------------------------------
  // Foods Catalog Management (CRUD)
  // ----------------------------------------------------
  async loadFoods() {
    const tableBody = document.getElementById('foods-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading menu...</td></tr>';

    try {
      const res = await fetch('/api/foods');
      const data = await res.json();

      if (!data.success || !data.foods) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px;">No menu items found.</td></tr>';
        return;
      }

      this.foods = data.foods;

      tableBody.innerHTML = data.foods.map(food => `
        <tr>
          <td>
            <img src="${food.image}" alt="${food.name}" style="width:48px; height:48px; border-radius:8px; object-fit:cover;" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80'">
          </td>
          <td>
            <strong>${food.name}</strong>
            <div style="font-size:0.75rem; color:var(--text-muted);">${food.badge ? `<span style="color:var(--primary); font-weight:700;">[${food.badge}]</span> ` : ''}${food.description.substring(0, 50)}...</div>
          </td>
          <td>
            <span style="text-transform:capitalize; font-weight:600; color:var(--text-muted);">${food.category}</span>
            <div><span class="diet-indicator ${food.dietary}" style="display:inline-block; position:static; margin-top:4px;"></span> <span style="font-size:0.75rem;">${food.dietary}</span></div>
          </td>
          <td>
            <strong style="color:var(--secondary);">$${food.price.toFixed(2)}</strong>
          </td>
          <td>
            <span style="font-weight:700; color:${food.available ? 'var(--accent)' : 'var(--danger)'};">
              <i class="fa-solid ${food.available ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${food.available ? 'In Stock' : 'Out of Stock'}
            </span>
          </td>
          <td>
            <div style="display:flex; gap:8px;">
              <button class="btn-secondary" style="padding:6px 12px; font-size:0.8rem;" onclick="Admin.openEditFoodModal('${food.id}')" title="Edit Item">
                <i class="fa-solid fa-pen-to-square"></i> Edit
              </button>
              <button class="btn-secondary" style="padding:6px 12px; font-size:0.8rem; color:var(--danger); border-color:#fee2e2;" onclick="Admin.deleteFood('${food.id}')" title="Delete Item">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--danger);">Error loading foods</td></tr>';
    }
  },

  openAddFoodModal() {
    this.editingFoodId = null;
    document.getElementById('food-modal-title').textContent = 'Add New Dish';
    document.getElementById('food-form').reset();
    document.getElementById('food-available').checked = true;
    document.getElementById('food-modal').classList.add('open');
  },

  openEditFoodModal(foodId) {
    const food = this.foods.find(f => f.id === foodId);
    if (!food) return;

    this.editingFoodId = foodId;
    document.getElementById('food-modal-title').textContent = 'Edit Dish: ' + food.name;
    document.getElementById('food-name').value = food.name;
    document.getElementById('food-category').value = food.category;
    document.getElementById('food-price').value = food.price;
    document.getElementById('food-rating').value = food.rating || 4.5;
    document.getElementById('food-preptime').value = food.prepTime || '20 mins';
    document.getElementById('food-dietary').value = food.dietary || 'veg';
    document.getElementById('food-badge').value = food.badge || '';
    document.getElementById('food-image').value = food.image || '';
    document.getElementById('food-desc').value = food.description || '';
    document.getElementById('food-available').checked = food.available !== false;

    document.getElementById('food-modal').classList.add('open');
  },

  closeFoodModal() {
    document.getElementById('food-modal').classList.remove('open');
    this.editingFoodId = null;
  },

  async handleFoodSubmit(e) {
    e.preventDefault();

    const foodData = {
      name: document.getElementById('food-name').value.trim(),
      category: document.getElementById('food-category').value,
      price: parseFloat(document.getElementById('food-price').value),
      rating: parseFloat(document.getElementById('food-rating').value),
      prepTime: document.getElementById('food-preptime').value.trim(),
      dietary: document.getElementById('food-dietary').value,
      badge: document.getElementById('food-badge').value.trim(),
      image: document.getElementById('food-image').value.trim(),
      description: document.getElementById('food-desc').value.trim(),
      available: document.getElementById('food-available').checked
    };

    if (!foodData.name || isNaN(foodData.price)) {
      alert('Please provide valid dish name and price.');
      return;
    }

    try {
      let res;
      if (this.editingFoodId) {
        // PUT update
        res = await fetch(`/api/foods/${this.editingFoodId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(foodData)
        });
      } else {
        // POST add
        res = await fetch('/api/foods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(foodData)
        });
      }

      const data = await res.json();
      if (data.success) {
        this.closeFoodModal();
        this.loadFoods();
        this.loadStats();
      } else {
        alert(data.message || 'Error saving dish.');
      }
    } catch (err) {
      alert('Network error saving dish: ' + err.message);
    }
  },

  async deleteFood(foodId) {
    const food = this.foods.find(f => f.id === foodId);
    if (!food) return;

    if (!confirm(`Are you sure you want to delete "${food.name}" from the menu?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/foods/${foodId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        this.loadFoods();
        this.loadStats();
      } else {
        alert(data.message || 'Failed to delete dish');
      }
    } catch (err) {
      alert('Error deleting dish: ' + err.message);
    }
  },

  // ----------------------------------------------------
  // Event Listeners
  // ----------------------------------------------------
  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.admin-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (!tab) return;

        document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.admin-tab-pane').forEach(p => p.style.display = 'none');
        const targetPane = document.getElementById(`tab-pane-${tab}`);
        if (targetPane) targetPane.style.display = 'block';
      });
    });

    // Orders status filter
    const statusFilter = document.getElementById('order-status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.loadOrders(e.target.value);
      });
    }

    // Food form submission
    const foodForm = document.getElementById('food-form');
    if (foodForm) {
      foodForm.addEventListener('submit', (e) => this.handleFoodSubmit(e));
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Admin.init();
});
