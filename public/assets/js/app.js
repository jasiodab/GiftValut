(function () {
  'use strict';

  const GV = window.GV || {};
  const csrfToken = GV.csrfToken || '';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  // Theme
  function applyTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('gv_theme', theme);
    const label = document.getElementById('themeLabel');
    if (label) label.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
  }
  const stored = localStorage.getItem('gv_theme') || 'light';
  applyTheme(stored);

  document.addEventListener('click', function (e) {
    const t = e.target.closest('#themeToggle, #themeToggleAuth');
    if (t) {
      const cur = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      applyTheme(cur === 'dark' ? 'light' : 'dark');
    }
  });

  // Sidebar mobile
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const openBtn = document.getElementById('mobileMenuBtn');
  const closeBtn = document.getElementById('sidebarClose');
  function openSidebar() { sidebar && sidebar.classList.add('open'); backdrop && (backdrop.style.display = 'block'); }
  function closeSidebar() { sidebar && sidebar.classList.remove('open'); backdrop && (backdrop.style.display = ''); }
  if (openBtn) openBtn.addEventListener('click', openSidebar);
  if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
  if (backdrop) backdrop.addEventListener('click', closeSidebar);

  // Quick add triggers
  function openQuickAdd() {
    const modal = document.getElementById('productModal');
    if (modal) modal.classList.add('open');
    resetProductForm();
  }
  ['quickAddBtn','quickAddBtn2','quickAddBtn3','quickAddBtn4'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', openQuickAdd);
  });
  const pfClose = document.getElementById('pfClose');
  const pfCancel = document.getElementById('pfCancel');
  function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (modal) modal.classList.remove('open');
  }
  if (pfClose) pfClose.addEventListener('click', closeProductModal);
  if (pfCancel) pfCancel.addEventListener('click', closeProductModal);

  function resetProductForm() {
    const body = document.getElementById('pfBody');
    if (!body) return;
    body.innerHTML = '<p class="muted small">Product form loads here. Use the API to create products.</p>';
    const hint = document.getElementById('pfHint');
    if (hint) hint.style.display = 'none';
  }

  // Confirm dialog helper
  let confirmCallback = null;
  function openConfirm(title, desc, cb) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmDesc').textContent = desc;
    confirmCallback = cb;
    document.getElementById('confirmModal').classList.add('open');
  }
  const confirmCancel = document.getElementById('confirmCancel');
  const confirmOk = document.getElementById('confirmOk');
  if (confirmCancel) confirmCancel.addEventListener('click', function () {
    document.getElementById('confirmModal').classList.remove('open');
    confirmCallback = null;
  });
  if (confirmOk) confirmOk.addEventListener('click', function () {
    if (confirmCallback) confirmCallback();
    document.getElementById('confirmModal').classList.remove('open');
    confirmCallback = null;
  });

  // API helper
  async function api(path, options) {
    options = options || {};
    const headers = Object.assign({ 'X-CSRF-Token': csrfToken }, options.headers || {});
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    const res = await fetch(path, Object.assign({}, options, { headers, credentials: 'same-origin' }));
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      const err = new Error((data && data.error && data.error.message) || res.statusText);
      err.code = data && data.error ? data.error.code : null;
      err.details = data && data.error ? data.error.details : null;
      throw err;
    }
    return data;
  }

  // Toasts
  function toast(message, type) {
    const stack = document.getElementById('flashStack') || document.body;
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.innerHTML = '<span>' + (message || '') + '</span>';
    stack.appendChild(el);
    setTimeout(function () { el.classList.add('leaving'); setTimeout(function () { el.remove(); }, 200); }, 3000);
  }

  // Delete product
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('#deleteProductBtn');
    if (btn) {
      const id = btn.getAttribute('data-id');
      openConfirm('Delete this product?', 'This action cannot be undone.', async function () {
        try {
          await api('/api/products/' + id, { method: 'DELETE' });
          toast('Product deleted', 'success');
          window.location.href = '/products';
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });

  // Favorite toggle on cards
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-fav]');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-fav');
      // best-effort: fetch product then patch status
      api('/api/products/' + id).then(function (res) {
        const p = res.product || res;
        const newStatus = p.status === 'FAVORITE' ? 'TO_CONSIDER' : 'FAVORITE';
        return api('/api/products/' + id, { method: 'PATCH', body: { status: newStatus } });
      }).then(function () {
        btn.classList.toggle('is-favorite');
        toast('Updated', 'success');
      }).catch(function (err) { toast(err.message, 'error'); });
    }
  });

  // Bulk selection
  function updateBulkBar() {
    const checks = $$('.bulk-check:checked');
    const bar = document.getElementById('bulkBar');
    const count = document.getElementById('bulkCount');
    if (!bar) return;
    if (checks.length > 0) {
      bar.style.display = 'flex';
      if (count) count.textContent = checks.length;
    } else {
      bar.style.display = 'none';
    }
  }
  document.addEventListener('change', function (e) {
    if (e.target.classList && e.target.classList.contains('bulk-check')) updateBulkBar();
  });

  // Settings save
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', async function () {
      const currency = document.getElementById('currency').value;
      const defaultProductView = document.getElementById('defaultProductView').value;
      try {
        await api('/api/settings', { method: 'PATCH', body: { currency: currency, defaultProductView: defaultProductView } });
        toast('Settings saved', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // Create backup
  const createBackupBtn = document.getElementById('createBackupBtn');
  if (createBackupBtn) {
    createBackupBtn.addEventListener('click', async function () {
      try {
        const res = await api('/api/settings/backup', { method: 'GET' });
        // trigger download via returned filename? fallback reload
        toast('Backup created', 'success');
        setTimeout(function () { window.location.reload(); }, 800);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // Create invitation
  const createInviteBtn = document.getElementById('createInviteBtn');
  if (createInviteBtn) {
    createInviteBtn.addEventListener('click', async function () {
      try {
        const res = await api('/api/auth/invitations', { method: 'POST', body: {} });
        const link = res.invitation && res.invitation.link;
        const input = document.getElementById('inviteLink');
        if (input && link) input.value = window.location.origin + link;
        toast('Invitation created', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // User actions
  document.addEventListener('click', function (e) {
    const block = e.target.closest('[data-block-user]');
    const unblock = e.target.closest('[data-unblock-user]');
    const del = e.target.closest('[data-delete-user]');
    if (block) {
      const id = block.getAttribute('data-block-user');
      api('/api/auth/users/' + id + '/block', { method: 'POST', body: {} }).then(function () { toast('Blocked', 'success'); setTimeout(function(){location.reload();},600); }).catch(function(err){toast(err.message,'error');});
    }
    if (unblock) {
      const id = unblock.getAttribute('data-unblock-user');
      api('/api/auth/users/' + id + '/unblock', { method: 'POST', body: {} }).then(function () { toast('Unblocked', 'success'); setTimeout(function(){location.reload();},600); }).catch(function(err){toast(err.message,'error');});
    }
    if (del) {
      const id = del.getAttribute('data-delete-user');
      openConfirm('Delete user?', 'This cannot be undone.', function () {
        api('/api/auth/users/' + id, { method: 'DELETE' }).then(function () { toast('Deleted', 'success'); setTimeout(function(){location.reload();},600); }).catch(function(err){toast(err.message,'error');});
      });
    }
  });

  // Categories modal basic
  const newCatBtn = document.getElementById('newCategoryBtn');
  if (newCatBtn) newCatBtn.addEventListener('click', function () {
    document.getElementById('categoryModal').classList.add('open');
  });
  const catCancel = document.getElementById('catCancel');
  if (catCancel) catCancel.addEventListener('click', function () {
    document.getElementById('categoryModal').classList.remove('open');
  });

  // Notes save
  const saveNotesBtn = document.getElementById('saveNotesBtn');
  if (saveNotesBtn) {
    saveNotesBtn.addEventListener('click', async function () {
      const id = saveNotesBtn.getAttribute('data-id');
      const notes = document.getElementById('notesField').value;
      try {
        await api('/api/products/' + id, { method: 'PATCH', body: { notes: notes } });
        toast('Notes saved', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });
  }
  const notesField = document.getElementById('notesField');
  if (notesField) {
    notesField.addEventListener('input', function () {
      const c = document.getElementById('notesCount');
      if (c) c.textContent = notesField.value.length + ' characters';
    });
  }

  // Password form handled server-side; ensure CSRF header not needed for form POST (cookie+form token)
})();
