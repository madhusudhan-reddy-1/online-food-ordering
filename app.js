// public/js/app.js
// FoodieBite Core Storefront Application Logic

const App = {
  foods: [],
  categories: [],
  cart: [],
  activeCategory: 'all',
  activeDietary: 'all',
  searchQuery: '',
  sortBy: 'popular',
  appliedCoupon: null,
  activeTrackingTimer: null,

  // Initialize Application
  async init() {
    this.loadCartFromStorage();
    this.setupEventListeners();
    await this.fetchCategories();
    await this.fetchFoods();
    this.renderCartUI();
  },

  // ----------------------------------------------------
  // LocalStorage Cart Management
  // ----------------------------------------------------
  loadCartFromStorage() {
    try {
      const stored = localStorage.getItem('foodie_cart');
      this.cart = stored ? JSON.parse(stored) : [];
    } catch (e) {
      this.cart = [];
    }
  },

  saveCartToStorage() {
    localStorage.setItem('foodie_cart', JSON.stringify(this.cart));
    this.renderCartUI();
  },

  // ----------------------------------------------------
  // API Fetching
  // ----------------------------------------------------
  async fetchCategories() {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (data.success) {
        this.categories = data.categories;
        this.renderCategories();
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  },

  async fetchFoods() {
    try {
      const res = await fetch('/api/foods');
      const data = await res.json();
      if (data.success) {
        this.foods = data.foods;
        this.renderMenu();
      }
    } catch (err) {
      console.error('Failed to fetch foods:', err);
      this.showToast('Failed to load menu items', 'error');
    }
  },

  // ----------------------------------------------------
  // Rendering
  // ----------------------------------------------------
  renderCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;

    container.innerHTML = this.categories.map(cat => `
      <button class="cat-pill ${cat.id === this.activeCategory ? 'active' : ''}" data-category="${cat.id}">
        <i class="fa-solid ${cat.icon || 'fa-utensils'}"></i>
        <span>${cat.name}</span>
      </button>
    `).join('');

    // Attach click events
    container.querySelectorAll('.cat-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const catId = btn.getAttribute('data-category');
        this.activeCategory = catId;
        container.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderMenu();
      });
    });
  },

  renderMenu() {
    const grid = document.getElementById('foods-grid');
    if (!grid) return;

    let filtered = [...this.foods];

    // Filter by category
    if (this.activeCategory && this.activeCategory !== 'all') {
      filtered = filtered.filter(f => f.category.toLowerCase() === this.activeCategory.toLowerCase());
    }

    // Filter by dietary
    if (this.activeDietary && this.activeDietary !== 'all') {
      filtered = filtered.filter(f => f.dietary === this.activeDietary);
    }

    // Search query filter
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
      );
    }

    // Sorting
    if (this.sortBy === 'price-low') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (this.sortBy === 'price-high') {
      filtered.sort((a, b) => b.price - a.price);
    } else if (this.sortBy === 'rating') {
      filtered.sort((a, b) => b.rating - a.rating);
    }

    // Empty state
    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-utensils"></i>
          <h3>No Delicious Items Found</h3>
          <p>We couldn't find any dishes matching your filters. Try selecting a different category or clearing your search.</p>
          <button class="btn-primary" style="margin-top: 16px;" onclick="App.resetFilters()">
            <i class="fa-solid fa-rotate-left"></i> Reset Filters
          </button>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(dish => {
      const cartItem = this.cart.find(c => c.id === dish.id);
      const inCartQty = cartItem ? cartItem.quantity : 0;

      return `
        <div class="food-card" data-id="${dish.id}">
          <div class="food-card-img-wrapper">
            <img src="${dish.image}" alt="${dish.name}" class="food-card-img" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80'">
            ${dish.badge ? `<span class="food-badge">${dish.badge}</span>` : ''}
            <div class="diet-indicator ${dish.dietary}" title="${dish.dietary === 'veg' ? 'Vegetarian' : 'Non-Vegetarian'}"></div>
          </div>
          <div class="food-card-body">
            <div class="food-card-header">
              <span class="food-category-tag">${dish.category}</span>
              <span class="food-rating"><i class="fa-solid fa-star"></i> ${dish.rating.toFixed(1)}</span>
            </div>
            <h3 class="food-title">${dish.name}</h3>
            <p class="food-desc">${dish.description}</p>
            <div class="food-meta">
              <span><i class="fa-regular fa-clock"></i> ${dish.prepTime || '20 mins'}</span>
              <span><i class="fa-solid fa-fire"></i> Chef Made</span>
            </div>
            <div class="food-card-footer">
              <div class="food-price">$${dish.price.toFixed(2)}</div>
              ${inCartQty > 0 ? `
                <div class="qty-control">
                  <button class="qty-btn" onclick="App.updateCartQty('${dish.id}', -1)"><i class="fa-solid fa-minus"></i></button>
                  <span class="qty-val">${inCartQty}</span>
                  <button class="qty-btn" onclick="App.updateCartQty('${dish.id}', 1)"><i class="fa-solid fa-plus"></i></button>
                </div>
              ` : `
                <button class="btn-add-cart" onclick="App.addToCart('${dish.id}')">
                  <i class="fa-solid fa-plus"></i> Add
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  // ----------------------------------------------------
  // Cart Interactions
  // ----------------------------------------------------
  addToCart(foodId) {
    const food = this.foods.find(f => f.id === foodId);
    if (!food) return;

    const existing = this.cart.find(c => c.id === foodId);
    if (existing) {
      existing.quantity += 1;
    } else {
      this.cart.push({
        id: food.id,
        name: food.name,
        price: food.price,
        image: food.image,
        quantity: 1
      });
    }

    this.saveCartToStorage();
    this.renderMenu();
    this.showToast(`Added ${food.name} to cart!`, 'success');
  },

  updateCartQty(foodId, change) {
    const index = this.cart.findIndex(c => c.id === foodId);
    if (index === -1) return;

    this.cart[index].quantity += change;
    if (this.cart[index].quantity <= 0) {
      this.cart.splice(index, 1);
      this.showToast('Item removed from cart', 'info');
    }

    this.saveCartToStorage();
    this.renderMenu();
  },

  removeFromCart(foodId) {
    this.cart = this.cart.filter(c => c.id !== foodId);
    this.saveCartToStorage();
    this.renderMenu();
    this.showToast('Item removed from cart', 'info');
  },

  clearCart() {
    this.cart = [];
    this.appliedCoupon = null;
    this.saveCartToStorage();
    this.renderMenu();
  },

  renderCartUI() {
    // Update navbar badge count
    const totalQty = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartBadge = document.getElementById('cart-badge-count');
    if (cartBadge) {
      cartBadge.textContent = totalQty;
      cartBadge.style.display = totalQty > 0 ? 'flex' : 'none';
    }

    // Render drawer content
    const cartItemsList = document.getElementById('cart-items-list');
    const emptyView = document.getElementById('empty-cart-view');
    const cartFooter = document.getElementById('cart-drawer-footer');

    if (!cartItemsList) return;

    if (this.cart.length === 0) {
      cartItemsList.style.display = 'none';
      if (emptyView) emptyView.style.display = 'block';
      if (cartFooter) cartFooter.style.display = 'none';
      return;
    }

    if (emptyView) emptyView.style.display = 'none';
    cartItemsList.style.display = 'flex';
    if (cartFooter) cartFooter.style.display = 'flex';

    cartItemsList.innerHTML = this.cart.map(item => `
      <div class="cart-item">
        <img src="${item.image}" alt="${item.name}" class="cart-item-img" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80'">
        <div class="cart-item-info">
          <h4 class="cart-item-name">${item.name}</h4>
          <div class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</div>
          <div class="cart-item-qty">
            <button class="qty-btn" onclick="App.updateCartQty('${item.id}', -1)"><i class="fa-solid fa-minus"></i></button>
            <span class="qty-val">${item.quantity}</span>
            <button class="qty-btn" onclick="App.updateCartQty('${item.id}', 1)"><i class="fa-solid fa-plus"></i></button>
          </div>
        </div>
        <button class="cart-item-remove" onclick="App.removeFromCart('${item.id}')" title="Remove item">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `).join('');

    this.updateCartTotals();
  },

  updateCartTotals() {
    const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let discount = 0;

    if (this.appliedCoupon) {
      if (this.appliedCoupon.discountPercent) {
        discount = (subtotal * this.appliedCoupon.discountPercent) / 100;
      } else if (this.appliedCoupon.discountFixed) {
        discount = Math.min(this.appliedCoupon.discountFixed, subtotal);
      }
    }

    const discountedSubtotal = Math.max(0, subtotal - discount);
    const tax = discountedSubtotal * 0.05;
    const deliveryFee = (discountedSubtotal >= 30.00 || discountedSubtotal === 0) ? 0.00 : 2.99;
    const total = discountedSubtotal + tax + deliveryFee;

    const elSubtotal = document.getElementById('cart-subtotal');
    const elTax = document.getElementById('cart-tax');
    const elDelivery = document.getElementById('cart-delivery');
    const elDiscount = document.getElementById('cart-discount');
    const elTotal = document.getElementById('cart-total');
    const elDiscountRow = document.getElementById('cart-discount-row');

    if (elSubtotal) elSubtotal.textContent = `$${subtotal.toFixed(2)}`;
    if (elTax) elTax.textContent = `$${tax.toFixed(2)}`;
    if (elDelivery) elDelivery.textContent = deliveryFee === 0 ? 'FREE' : `$${deliveryFee.toFixed(2)}`;
    if (elTotal) elTotal.textContent = `$${total.toFixed(2)}`;

    if (elDiscountRow) {
      if (discount > 0) {
        elDiscountRow.style.display = 'flex';
        if (elDiscount) elDiscount.textContent = `-$${discount.toFixed(2)}`;
      } else {
        elDiscountRow.style.display = 'none';
      }
    }

    // Coupon tag display
    const couponTag = document.getElementById('coupon-applied-tag');
    if (couponTag) {
      if (this.appliedCoupon) {
        couponTag.style.display = 'flex';
        couponTag.innerHTML = `
          <span><i class="fa-solid fa-tag"></i> Code: <strong>${this.appliedCoupon.code}</strong> (${this.appliedCoupon.description})</span>
          <button onclick="App.removeCoupon()" style="color:var(--danger); font-weight:700;"><i class="fa-solid fa-xmark"></i></button>
        `;
      } else {
        couponTag.style.display = 'none';
      }
    }
  },

  // ----------------------------------------------------
  // Coupon Verification
  // ----------------------------------------------------
  async applyCoupon() {
    const input = document.getElementById('coupon-code-input');
    if (!input || !input.value.trim()) {
      this.showToast('Please enter a coupon code', 'info');
      return;
    }

    const code = input.value.trim().toUpperCase();
    try {
      const res = await fetch(`/api/coupon/validate?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (data.success) {
        this.appliedCoupon = data.coupon;
        input.value = '';
        this.updateCartTotals();
        this.showToast(`Coupon ${code} applied successfully!`, 'success');
      } else {
        this.showToast(data.message || 'Invalid coupon code', 'error');
      }
    } catch (err) {
      this.showToast('Error validating coupon', 'error');
    }
  },

  removeCoupon() {
    this.appliedCoupon = null;
    this.updateCartTotals();
    this.showToast('Coupon removed', 'info');
  },

  // ----------------------------------------------------
  // Checkout & Ordering
  // ----------------------------------------------------
  openCheckout() {
    if (this.cart.length === 0) {
      this.showToast('Your cart is empty! Add dishes to checkout.', 'info');
      return;
    }

    this.toggleCartDrawer(false);

    // Pre-fill user profile if logged in
    const user = Auth.getUser();
    if (user) {
      const elName = document.getElementById('checkout-name');
      const elEmail = document.getElementById('checkout-email');
      const elPhone = document.getElementById('checkout-phone');
      const elAddress = document.getElementById('checkout-address');

      if (elName && !elName.value) elName.value = user.name || '';
      if (elEmail && !elEmail.value) elEmail.value = user.email || '';
      if (elPhone && !elPhone.value) elPhone.value = user.phone || '';
      if (elAddress && !elAddress.value) elAddress.value = user.address || '';
    }

    // Populate checkout summary
    const summaryList = document.getElementById('checkout-summary-items');
    if (summaryList) {
      summaryList.innerHTML = this.cart.map(item => `
        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.85rem;">
          <span>${item.quantity}x ${item.name}</span>
          <strong>$${(item.price * item.quantity).toFixed(2)}</strong>
        </div>
      `).join('');
    }

    // Set checkout total display
    const totalEl = document.getElementById('checkout-final-total');
    const currentTotal = document.getElementById('cart-total');
    if (totalEl && currentTotal) {
      totalEl.textContent = currentTotal.textContent;
    }

    document.getElementById('checkout-modal').classList.add('open');
  },

  closeCheckout() {
    const modal = document.getElementById('checkout-modal');
    if (modal) modal.classList.remove('open');
  },

  async handleCheckoutSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('checkout-name').value.trim();
    const phone = document.getElementById('checkout-phone').value.trim();
    const email = document.getElementById('checkout-email').value.trim();
    const address = document.getElementById('checkout-address').value.trim();
    const city = document.getElementById('checkout-city').value.trim();
    const zip = document.getElementById('checkout-zip').value.trim();
    const notes = document.getElementById('checkout-notes').value.trim();
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value || 'Cash on Delivery';

    if (!name || !phone || !address || !city) {
      this.showToast('Please fill in all required delivery details.', 'error');
      return;
    }

    const fullAddress = `${address}, ${city} ${zip ? `(${zip})` : ''}`;
    const user = Auth.getUser();

    const orderPayload = {
      userId: user ? user.id : 'guest',
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      deliveryAddress: fullAddress,
      notes: notes,
      items: this.cart,
      couponCode: this.appliedCoupon ? this.appliedCoupon.code : null,
      paymentMethod: paymentMethod
    };

    const submitBtn = document.getElementById('btn-submit-order');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Placing Order...';
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to place order');
      }

      // Success! Clear cart & close checkout
      this.clearCart();
      this.closeCheckout();
      this.showToast('🎉 Order placed successfully!', 'success');

      // Open Live Order Tracking
      this.openOrderTracker(data.order);
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Complete & Place Order';
      }
    }
  },

  // ----------------------------------------------------
  // Live Order Status Tracker
  // ----------------------------------------------------
  openOrderTracker(order) {
    const modal = document.getElementById('tracker-modal');
    if (!modal) return;

    document.getElementById('tracker-order-id').textContent = order.id;
    document.getElementById('tracker-address').textContent = order.deliveryAddress;
    document.getElementById('tracker-total').textContent = `$${order.total.toFixed(2)}`;

    const itemsContainer = document.getElementById('tracker-items-list');
    if (itemsContainer) {
      itemsContainer.innerHTML = order.items.map(it => `
        <li style="display:flex; justify-content:space-between; font-size:0.85rem; padding:4px 0;">
          <span>${it.quantity}x ${it.name}</span>
          <span>$${(it.price * it.quantity).toFixed(2)}</span>
        </li>
      `).join('');
    }

    this.updateTrackerStepsUI(order.status);
    modal.classList.add('open');

    // Poll for status updates every 6 seconds while tracker is open
    if (this.activeTrackingTimer) clearInterval(this.activeTrackingTimer);
    this.activeTrackingTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}`);
        const data = await res.json();
        if (data.success && data.order) {
          this.updateTrackerStepsUI(data.order.status);
        }
      } catch (e) {
        // Silent catch during poll
      }
    }, 6000);
  },

  updateTrackerStepsUI(status) {
    const steps = ['Pending', 'Preparing', 'Out for Delivery', 'Delivered'];
    const statusIdx = steps.indexOf(status);

    const stepElements = document.querySelectorAll('.tracker-steps .step-item');
    stepElements.forEach((el, idx) => {
      el.classList.remove('active', 'completed');
      if (idx < statusIdx) {
        el.classList.add('completed');
      } else if (idx === statusIdx) {
        el.classList.add('active');
      }
    });

    const statusBadge = document.getElementById('tracker-current-status');
    if (statusBadge) {
      statusBadge.textContent = status;
      statusBadge.className = `status-badge ${status.toLowerCase().replace(/\s+/g, '-')}`;
    }
  },

  closeOrderTracker() {
    const modal = document.getElementById('tracker-modal');
    if (modal) modal.classList.remove('open');
    if (this.activeTrackingTimer) {
      clearInterval(this.activeTrackingTimer);
      this.activeTrackingTimer = null;
    }
  },

  // ----------------------------------------------------
  // "My Orders" History Modal
  // ----------------------------------------------------
  async openOrdersModal() {
    const modal = document.getElementById('my-orders-modal');
    const container = document.getElementById('my-orders-list');
    if (!modal || !container) return;

    modal.classList.add('open');
    container.innerHTML = '<div style="text-align:center; padding:30px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p>Loading orders...</p></div>';

    const user = Auth.getUser();
    const query = user ? `?userId=${encodeURIComponent(user.id)}` : '';

    try {
      const res = await fetch(`/api/orders${query}`);
      const data = await res.json();

      if (!data.success || !data.orders || data.orders.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:40px 20px;">
            <i class="fa-solid fa-receipt fa-3x" style="color:#cbd5e1; margin-bottom:12px;"></i>
            <h4>No Orders Placed Yet</h4>
            <p style="color:var(--text-muted); font-size:0.9rem;">Once you order food, your past orders will appear here.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = data.orders.map(order => `
        <div style="border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:16px; margin-bottom:14px; background:var(--bg-main);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div>
              <strong style="color:var(--secondary);">${order.id}</strong>
              <div style="font-size:0.78rem; color:var(--text-muted);">${new Date(order.createdAt).toLocaleString()}</div>
            </div>
            <span class="status-badge ${order.status.toLowerCase().replace(/\s+/g, '-')}">${order.status}</span>
          </div>
          <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:10px;">
            ${order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed var(--border-color); padding-top:8px;">
            <span style="font-weight:800; font-size:1rem; color:var(--secondary);">$${order.total.toFixed(2)}</span>
            <button class="btn-primary" style="padding:6px 14px; font-size:0.8rem;" onclick="App.trackPastOrder('${order.id}')">
              <i class="fa-solid fa-location-dot"></i> Track Order
            </button>
          </div>
        </div>
      `).join('');
    } catch (err) {
      container.innerHTML = '<p style="color:var(--danger); text-align:center;">Failed to load order history.</p>';
    }
  },

  closeOrdersModal() {
    const modal = document.getElementById('my-orders-modal');
    if (modal) modal.classList.remove('open');
  },

  async trackPastOrder(orderId) {
    this.closeOrdersModal();
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (data.success && data.order) {
        this.openOrderTracker(data.order);
      }
    } catch (e) {
      this.showToast('Could not fetch order tracker', 'error');
    }
  },

  // ----------------------------------------------------
  // Drawer & Modal Toggles
  // ----------------------------------------------------
  toggleCartDrawer(forceState) {
    const overlay = document.getElementById('cart-drawer-overlay');
    if (!overlay) return;

    if (forceState !== undefined) {
      overlay.classList.toggle('open', forceState);
    } else {
      overlay.classList.toggle('open');
    }
  },

  resetFilters() {
    this.activeCategory = 'all';
    this.activeDietary = 'all';
    this.searchQuery = '';
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';

    document.querySelectorAll('.diet-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-diet') === 'all');
    });

    this.renderCategories();
    this.renderMenu();
  },

  // ----------------------------------------------------
  // Toast Notifications
  // ----------------------------------------------------
  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${icon}" style="font-size:1.1rem; color:${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#ff5722'};"></i>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  },

  // ----------------------------------------------------
  // Event Listeners Setup
  // ----------------------------------------------------
  setupEventListeners() {
    // Cart open/close triggers
    const cartBtn = document.getElementById('cart-toggle-btn');
    if (cartBtn) cartBtn.addEventListener('click', () => this.toggleCartDrawer(true));

    const closeCart = document.getElementById('cart-close-btn');
    if (closeCart) closeCart.addEventListener('click', () => this.toggleCartDrawer(false));

    const overlay = document.getElementById('cart-drawer-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.toggleCartDrawer(false);
      });
    }

    // Live search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        this.renderMenu();
      });
    }

    // Dietary filter buttons
    document.querySelectorAll('.diet-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.diet-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeDietary = btn.getAttribute('data-diet');
        this.renderMenu();
      });
    });

    // Sort select
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortBy = e.target.value;
        this.renderMenu();
      });
    }

    // Coupon apply button
    const applyCouponBtn = document.getElementById('btn-apply-coupon');
    if (applyCouponBtn) {
      applyCouponBtn.addEventListener('click', () => this.applyCoupon());
    }

    // Checkout modal trigger
    const checkoutBtn = document.getElementById('btn-proceed-checkout');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => this.openCheckout());
    }

    const closeCheckoutBtn = document.getElementById('close-checkout-modal');
    if (closeCheckoutBtn) {
      closeCheckoutBtn.addEventListener('click', () => this.closeCheckout());
    }

    // Checkout form submit
    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
      checkoutForm.addEventListener('submit', (e) => this.handleCheckoutSubmit(e));
    }

    // Payment options UI radio selector
    document.querySelectorAll('.payment-option-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.payment-option-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      });
    });

    // Mobile nav hamburger toggle
    const mobileToggle = document.getElementById('mobile-nav-toggle');
    const navLinks = document.getElementById('nav-links');
    if (mobileToggle && navLinks) {
      mobileToggle.addEventListener('click', () => {
        navLinks.classList.toggle('show');
      });
    }
  }
};

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
