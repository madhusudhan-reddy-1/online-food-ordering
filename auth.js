// public/js/auth.js
// Authentication management & user session helpers

const Auth = {
  // Get stored user from localStorage
  getUser() {
    try {
      const data = localStorage.getItem('foodie_user');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  // Get stored auth token
  getToken() {
    return localStorage.getItem('foodie_token') || null;
  },

  // Save session
  saveSession(user, token) {
    localStorage.setItem('foodie_user', JSON.stringify(user));
    if (token) localStorage.setItem('foodie_token', token);
    this.updateNavUI();
  },

  // Clear session / Logout
  logout() {
    localStorage.removeItem('foodie_user');
    localStorage.removeItem('foodie_token');
    window.location.href = '/';
  },

  // Check if logged in user is admin
  isAdmin() {
    const user = this.getUser();
    return user && user.role === 'admin';
  },

  // Login via API
  async login(email, password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');

      this.saveSession(data.user, data.token);
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // Register via API
  async register(name, email, password, phone, address) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phone, address })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');

      // Auto login after register
      return await this.login(email, password);
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // Update navigation UI based on auth state
  updateNavUI() {
    const userContainer = document.getElementById('user-nav-action');
    if (!userContainer) return;

    const user = this.getUser();
    if (user) {
      const adminLink = user.role === 'admin'
        ? `<a href="/admin.html" class="user-btn" style="background:#ff5722; color:white; border-color:#ff5722;"><i class="fa-solid fa-gauge"></i> Admin</a>`
        : '';

      userContainer.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          ${adminLink}
          <div style="position:relative; display:inline-block;">
            <button class="user-btn" id="user-menu-trigger">
              <i class="fa-solid fa-user-circle"></i>
              <span>${user.name.split(' ')[0]}</span>
              <i class="fa-solid fa-chevron-down" style="font-size:0.75rem;"></i>
            </button>
            <div id="user-dropdown" style="display:none; position:absolute; right:0; top:110%; background:white; min-width:180px; box-shadow:var(--shadow-lg); border-radius:var(--radius-sm); border:1px solid var(--border-color); z-index:150; padding:6px 0;">
              <div style="padding:8px 16px; border-bottom:1px solid var(--border-color); font-size:0.8rem; color:var(--text-muted);">
                Signed in as<br><strong style="color:var(--secondary);">${user.email}</strong>
              </div>
              <a href="javascript:void(0)" onclick="App.openOrdersModal()" style="display:flex; align-items:center; gap:8px; padding:10px 16px; font-size:0.85rem; font-weight:600; color:var(--secondary);">
                <i class="fa-solid fa-receipt"></i> My Orders
              </a>
              ${user.role === 'admin' ? `
                <a href="/admin.html" style="display:flex; align-items:center; gap:8px; padding:10px 16px; font-size:0.85rem; font-weight:600; color:var(--primary);">
                  <i class="fa-solid fa-gear"></i> Admin Dashboard
                </a>
              ` : ''}
              <div style="border-top:1px solid var(--border-color); margin-top:4px;"></div>
              <a href="javascript:void(0)" onclick="Auth.logout()" style="display:flex; align-items:center; gap:8px; padding:10px 16px; font-size:0.85rem; font-weight:600; color:var(--danger);">
                <i class="fa-solid fa-right-from-bracket"></i> Sign Out
              </a>
            </div>
          </div>
        </div>
      `;

      const trigger = document.getElementById('user-menu-trigger');
      const dropdown = document.getElementById('user-dropdown');
      if (trigger && dropdown) {
        trigger.onclick = (e) => {
          e.stopPropagation();
          dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        };
        document.addEventListener('click', () => {
          dropdown.style.display = 'none';
        });
      }
    } else {
      userContainer.innerHTML = `
        <a href="/login.html" class="user-btn">
          <i class="fa-solid fa-user"></i>
          <span>Sign In</span>
        </a>
      `;
    }
  }
};

// Initialize navbar on page load
document.addEventListener('DOMContentLoaded', () => {
  Auth.updateNavUI();
});
