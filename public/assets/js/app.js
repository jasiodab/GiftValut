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
  applyTheme(localStorage.getItem('gv_theme') || 'light');
  document.addEventListener('click', function (e) {
    if (e.target.closest('#themeToggle, #themeToggleAuth')) {
      const cur = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      applyTheme(cur === 'dark' ? 'light' : 'dark');
    }
  });

  // Sidebar
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  function openSidebar() { if (sidebar) sidebar.classList.add('open'); if (backdrop) backdrop.style.display = 'block'; }
  function closeSidebar() { if (sidebar) sidebar.classList.remove('open'); if (backdrop) backdrop.style.display = ''; }
  const openBtn = document.getElementById('mobileMenuBtn');
  const closeBtn = document.getElementById('sidebarClose');
  if (openBtn) openBtn.addEventListener('click', openSidebar);
  if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
  if (backdrop) backdrop.addEventListener('click', closeSidebar);

  // API
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
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function toast(message, type) {
    const stack = document.getElementById('flashStack') || document.body;
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.innerHTML = '<span>' + (message || '') + '</span>';
    stack.appendChild(el);
    setTimeout(function () { el.classList.add('leaving'); setTimeout(function () { el.remove(); }, 200); }, 3500);
  }

  const modal = document.getElementById('productModal');
  let categories = [];
  let settings = { currency: 'PLN' };
  let extracting = false;
  let saving = false;
  let uploading = false;
  let form = null;

  function openModal() { if (modal) modal.classList.add('open'); }
  function handlePaste(e) {
    if (!modal || !modal.classList.contains('open')) return;
    const items = (e.clipboardData && e.clipboardData.items) || [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image/') === 0) {
        const file = items[i].getAsFile();
        if (file) { e.preventDefault(); handleImageUpload(file); return; }
      }
    }
  }
  function closeModal() { if (modal) { modal.classList.remove('open'); modal.removeEventListener('paste', handlePaste); } }

  function resetForm() {
    form = {
      url: '', name: '', description: '', imagePath: '', imageSourceUrl: '',
      currentPrice: '', originalPrice: '', currency: settings.currency || 'PLN',
      availability: '', status: 'TO_CONSIDER', categoryId: '', storeName: '',
      storeDomain: '', notes: '', tags: []
    };
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function productImageUrl(p) {
    if (!p) return '';
    if (/^https?:\/\//i.test(p)) return p;
    return (window.location.origin || '') + '/' + String(p).replace(/^\/+/,'');
  }

  async function handleImageUpload(file) {
    if (!file || !file.type.startsWith('image/')) { toast('Choose an image file.', 'error'); return; }
    uploading = true; renderForm();
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/uploads/image', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: fd, credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) throw new Error((data && data.error && data.error.message) || 'Upload failed');
      form.imagePath = data.imagePath || data.path || form.imagePath;
      toast('Image uploaded', 'success');
    } catch (e) { toast(e.message || 'Could not upload image.', 'error'); }
    finally { uploading = false; renderForm(); }
  }

  function renderForm() {
    const body = document.getElementById('pfBody');
    if (!body) return;
    const catOpts = categories.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (form.categoryId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
    const currOpts = ['PLN','EUR','USD','GBP','CHF','CZK','SEK','NOK','DKK','HUF','UAH'].map(function (c) {
      return '<option value="' + c + '"' + (form.currency === c ? ' selected' : '') + '>' + c + '</option>';
    }).join('');
    const statusOpts = [
      {v:'TO_CONSIDER',l:'To consider'},{v:'FAVORITE',l:'Favorite'},
      {v:'TO_BUY',l:'To buy'},{v:'PURCHASED',l:'Purchased'}
    ].map(function (s){ return '<option value="'+s.v+'"'+(form.status===s.v?' selected':'')+'>'+s.l+'</option>'; }).join('');

    body.innerHTML = ''
      // Step 1: link
      + '<section class="url-panel">'
      +   '<div class="section-title">1. Product link</div>'
      +   '<label class="label" for="pf-url">Paste a store link</label>'
      +   '<div class="url-row">'
      +     '<input class="input" id="pf-url" type="url" placeholder="https://store.com/product/..." value="' + esc(form.url) + '">'
      +     '<button class="btn btn-sm" type="button" id="pf-import" ' + (extracting ? 'disabled' : '') + '>' + (extracting ? 'Reading…' : 'Import') + '</button>'
      +   '</div>'
      +   '<p class="hint">We’ll try to read the page and fill in the details automatically.</p>'
      +   '<div id="pf-extraction"></div>'
      +   '<div id="pf-duplicate"></div>'
      + '</section>'
      // Step 2: image + basic
      + '<section class="product-form-main">'
      +   '<div>'
      +     '<label class="label">Image</label>'
      +     '<div class="image-upload" id="pf-imageBox">'
      +       (form.imagePath ? '<img src="' + esc(productImageUrl(form.imagePath)) + '" alt="preview" style="width:100%;height:100%;object-fit:cover">' : '<div class="product-image-empty"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#i-image"></use></svg><span>No image</span></div>')
      +       (uploading ? '<div class="image-upload-loading"><span class="spinner"></span></div>' : '')
      +     '</div>'
      +     '<input type="file" id="pf-file" accept="image/*" style="display:none">'
      +     '<div style="display:flex;gap:8px;margin-top:8px">'
      +       '<button class="btn btn-outline btn-sm" type="button" id="pf-uploadBtn">' + (uploading ? 'Uploading…' : 'Upload image') + '</button>'
      +       (form.imagePath ? '<button class="btn btn-ghost btn-sm" type="button" id="pf-removeImg">Remove</button>' : '')
      +     '</div>'
      +     '<input type="hidden" id="pf-imagePath" value="' + esc(form.imagePath) + '">'
      +   '</div>'
      +   '<div class="space-y-4">'
      +     '<div class="form-subhead"><h3>Basic details</h3></div>'
      +     '<div class="field"><label class="label" for="pf-name">Name *</label><input class="input" id="pf-name" value="' + esc(form.name) + '" placeholder="What is this product?"></div>'
      +     '<div class="field"><label class="label" for="pf-url2">URL *</label><input class="input" id="pf-url2" value="' + esc(form.url) + '" placeholder="https://..."></div>'
      +     '<div class="field"><label class="label" for="pf-description">Description</label><textarea class="textarea" id="pf-description" placeholder="Optional details, size, colour, variant…">' + esc(form.description) + '</textarea></div>'
      +     '<div class="form-subhead"><h3>Pricing</h3></div>'
      +     '<div class="grid form-grid">'
      +       '<div class="field"><label class="label" for="pf-price">Current price</label><input class="input" id="pf-price" type="number" step="0.01" value="' + esc(form.currentPrice) + '" placeholder="0.00"></div>'
      +       '<div class="field"><label class="label" for="pf-original">Original price</label><input class="input" id="pf-original" type="number" step="0.01" value="' + esc(form.originalPrice) + '" placeholder="Optional"></div>'
      +     '</div>'
      +     '<div class="grid form-grid">'
      +       '<div class="field"><label class="label" for="pf-currency">Currency</label><select class="select" id="pf-currency">' + currOpts + '</select></div>'
      +       '<div class="field"><label class="label" for="pf-status">Status</label><select class="select" id="pf-status">' + statusOpts + '</select></div>'
      +     '</div>'
      +     '<div class="form-subhead"><h3>Organisation</h3></div>'
      +     '<div class="field"><label class="label" for="pf-category">Category *</label><select class="select" id="pf-category"><option value="">Choose a category</option>' + catOpts + '</select></div>'
      +     '<div class="grid form-grid">'
      +       '<div class="field"><label class="label" for="pf-store">Store</label><input class="input" id="pf-store" value="' + esc(form.storeName) + '" placeholder="Store name"></div>'
      +       '<div class="field"><label class="label" for="pf-availability">Availability</label><input class="input" id="pf-availability" value="' + esc(form.availability) + '" placeholder="In stock, pre-order…"></div>'
      +     '</div>'
      +     '<div class="field"><label class="label" for="pf-tags">Tags</label><input class="input" id="pf-tags" value="' + esc(form.tags.join(', ')) + '" placeholder="comma separated"></div>'
      +     '<div class="field"><label class="label" for="pf-notes">Private notes</label><textarea class="textarea" id="pf-notes" placeholder="Gift idea for…, size, colour, occasion…">' + esc(form.notes) + '</textarea></div>'
      +   '</div>'
      + '</section>';

    // wire events
    const importBtn = document.getElementById('pf-import');
    if (importBtn) importBtn.addEventListener('click', doImport);
    const urlInput = document.getElementById('pf-url');
    if (urlInput) urlInput.addEventListener('input', function () { form.url = urlInput.value; const u2=document.getElementById('pf-url2'); if (u2) u2.value = urlInput.value; });

    const uploadBtn = document.getElementById('pf-uploadBtn');
    const fileInput = document.getElementById('pf-file');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function () { if (fileInput.files && fileInput.files[0]) handleImageUpload(fileInput.files[0]); fileInput.value=''; });
    }
    const removeImg = document.getElementById('pf-removeImg');
    if (removeImg) removeImg.addEventListener('click', function () { form.imagePath=''; form.imageSourceUrl=''; renderForm(); });

    bindFormFields();
  }

  function bindFormFields() {
    function v(id, key) {
      const el = document.getElementById(id);
      if (!el) return;
      const handler = function () { form[key] = el.value; };
      el.addEventListener('input', handler);
      if (el.tagName === 'SELECT') el.addEventListener('change', handler);
    }
    v('pf-name','name'); v('pf-url2','url'); v('pf-price','currentPrice'); v('pf-original','originalPrice');
    v('pf-currency','currency'); v('pf-status','status'); v('pf-category','categoryId');
    v('pf-store','storeName'); v('pf-availability','availability'); v('pf-tags','tagsText');
    v('pf-description','description'); v('pf-notes','notes');
  }

  async function doImport() {
    if (extracting) return;
    const urlInput = document.getElementById('pf-url');
    const url = (urlInput ? urlInput.value : form.url).trim();
    if (!url) { toast('Paste a product link first.', 'error'); return; }
    if (!/^https?:\/\//i.test(url)) { toast('Use a full link starting with http:// or https://.', 'error'); return; }
    extracting = true;
    renderForm();
    try {
      const res = await api('/api/extract', { method: 'POST', body: { url: url } });
      form.url = (res.data && res.data.url) || url;
      if (res.data) {
        if (res.data.name != null) form.name = res.data.name;
        if (res.data.description != null) form.description = res.data.description;
        if (res.data.imagePath != null) form.imagePath = res.data.imagePath;
        if (res.data.imageSourceUrl != null) form.imageSourceUrl = res.data.imageSourceUrl;
        if (res.data.currentPrice != null) form.currentPrice = String(res.data.currentPrice);
        if (res.data.originalPrice != null) form.originalPrice = String(res.data.originalPrice);
        if (res.data.currency) form.currency = res.data.currency;
        if (res.data.availability != null) form.availability = res.data.availability;
        if (res.data.storeName != null) form.storeName = res.data.storeName;
        if (res.data.storeDomain != null) form.storeDomain = res.data.storeDomain;
        if (res.data.suggestedCategoryId) form.categoryId = res.data.suggestedCategoryId;
      }
      const ex = document.getElementById('pf-extraction');
      if (ex) {
        const cls = res.success ? 'extraction-panel success' : 'extraction-panel warning';
        let html = '<div class="' + cls + '"><div class="extraction-top">';
        html += res.success ? '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#i-circle-check"></use></svg>' : '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#i-circle-alert"></use></svg>';
        html += '<div class="extraction-body"><div class="extraction-title">' + (res.success ? 'Details found — review before saving' : (res.error || 'Limited details found')) + '</div>';
        if (res.strategies && res.strategies.length) html += '<div class="extraction-strategies">Detected with ' + res.strategies.join(' · ') + '</div>';
        if (res.warnings && res.warnings.length) {
          html += '<ul class="extraction-warnings">' + res.warnings.map(function (w){ return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>';
        }
        html += '</div></div></div>';
        ex.innerHTML = html;
      }
      try {
        const dup = await api('/api/products/check-url?url=' + encodeURIComponent(form.url), { method: 'GET' });
        const dd = document.getElementById('pf-duplicate');
        if (dd && dup.duplicate) {
          dd.innerHTML = '<div class="duplicate-warning"><span>!</span><div class="duplicate-warning-body"><strong>This product is already in your vault.</strong><span>' + esc(dup.duplicate.name) + '</span></div></div>';
        } else if (dd) dd.innerHTML = '';
      } catch (e) {}
      toast(res.success ? 'Product details found' : 'Automatic extraction was limited', res.success ? 'success' : 'warning');
    } catch (err) {
      toast(err.message || 'Could not read this link', 'error');
      const ex = document.getElementById('pf-extraction');
      if (ex) ex.innerHTML = '<div class="extraction-panel warning"><div class="extraction-top"><span>!</span><div class="extraction-body"><div class="extraction-title">' + esc(err.message || 'Could not read this link') + '</div></div></div></div>';
    } finally {
      extracting = false;
      renderForm();
    }
  }

  async function saveProduct() {
    if (saving) return;
    const tagsText = document.getElementById('pf-tags') ? document.getElementById('pf-tags').value : '';
    form.tags = tagsText.split(',').map(function (t){ return t.trim(); }).filter(Boolean);
    form.name = document.getElementById('pf-name').value.trim();
    form.url = document.getElementById('pf-url2').value.trim();
    form.currentPrice = document.getElementById('pf-price').value.trim();
    form.originalPrice = document.getElementById('pf-original').value.trim();
    form.currency = document.getElementById('pf-currency').value;
    form.status = document.getElementById('pf-status').value;
    form.categoryId = document.getElementById('pf-category').value;
    form.storeName = document.getElementById('pf-store').value.trim();
    form.availability = document.getElementById('pf-availability').value.trim();
    form.description = document.getElementById('pf-description').value.trim();
    form.notes = document.getElementById('pf-notes').value.trim();
    form.imagePath = document.getElementById('pf-imagePath').value;

    if (!form.name) { toast('Product name is required.', 'error'); return; }
    if (!form.url) { toast('Product URL is required.', 'error'); return; }
    if (!/^https?:\/\//i.test(form.url)) { toast('Use a full HTTP or HTTPS link.', 'error'); return; }
    if (!form.categoryId) { toast('Choose a category.', 'error'); return; }

    const payload = {
      name: form.name,
      url: form.url,
      description: form.description || null,
      imagePath: form.imagePath || null,
      imageSourceUrl: form.imageSourceUrl || null,
      currentPrice: form.currentPrice ? parseFloat(form.currentPrice) : null,
      originalPrice: form.originalPrice ? parseFloat(form.originalPrice) : null,
      currency: form.currency,
      availability: form.availability || null,
      status: form.status,
      categoryId: form.categoryId,
      notes: form.notes || null,
      storeName: form.storeName || null,
      storeDomain: form.storeDomain || null,
      tags: form.tags
    };

    saving = true;
    const saveBtn = document.getElementById('pfSave');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
    try {
      await api('/api/products', { method: 'POST', body: payload });
      toast('Product added to your vault', 'success');
      closeModal();
      setTimeout(function () { window.location.reload(); }, 400);
    } catch (err) {
      toast(err.message || 'Could not save this product.', 'error');
      if (err.details && err.details.fieldErrors) {
        const fe = err.details.fieldErrors;
        const first = Object.keys(fe)[0];
        if (first) toast(fe[first][0], 'error');
      }
    } finally {
      saving = false;
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Add product'; }
    }
  }

  async function openProductModal() {
    resetForm();
    openModal();
    if (modal) modal.addEventListener('paste', handlePaste);
    const body = document.getElementById('pfBody');
    if (body) body.innerHTML = '<div class="muted small">Loading…</div>';
    try {
      const [cats, sets] = await Promise.all([
        api('/api/categories', { method: 'GET' }),
        api('/api/settings', { method: 'GET' })
      ]);
      categories = (cats.categories || cats || []);
      if (sets.settings) settings = sets.settings;
      form.currency = settings.currency || 'PLN';
      form.categoryId = (categories.find(function (c){ return c.slug === 'other'; }) || categories[0] || {}).id || '';
    } catch (e) {
      toast('Could not load categories.', 'error');
    }
    renderForm();
    const saveBtn = document.getElementById('pfSave');
    const newBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newBtn, saveBtn);
    newBtn.id = 'pfSave';
    newBtn.addEventListener('click', saveProduct);
  }

  ['quickAddBtn','quickAddBtn2','quickAddBtn3','quickAddBtn4'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', openProductModal);
  });
  const pfClose = document.getElementById('pfClose');
  const pfCancel = document.getElementById('pfCancel');
  if (pfClose) pfClose.addEventListener('click', closeModal);
  if (pfCancel) pfCancel.addEventListener('click', closeModal);

  // Confirm dialog
  let confirmCallback = null;
  function openConfirm(title, desc, cb) {
    const t = document.getElementById('confirmTitle');
    const d = document.getElementById('confirmDesc');
    if (t) t.textContent = title;
    if (d) d.textContent = desc;
    confirmCallback = cb;
    const m = document.getElementById('confirmModal');
    if (m) m.classList.add('open');
  }
  const confirmCancel = document.getElementById('confirmCancel');
  const confirmOk = document.getElementById('confirmOk');
  if (confirmCancel) confirmCancel.addEventListener('click', function () {
    const m = document.getElementById('confirmModal'); if (m) m.classList.remove('open');
    confirmCallback = null;
  });
  if (confirmOk) confirmOk.addEventListener('click', function () {
    if (confirmCallback) confirmCallback();
    const m = document.getElementById('confirmModal'); if (m) m.classList.remove('open');
    confirmCallback = null;
  });

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

  // Favorite toggle
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-fav]');
    if (btn) {
      e.preventDefault(); e.stopPropagation();
      const id = btn.getAttribute('data-fav');
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

  // Bulk
  function updateBulkBar() {
    const checks = $$('.bulk-check:checked');
    const bar = document.getElementById('bulkBar');
    const count = document.getElementById('bulkCount');
    if (!bar) return;
    if (checks.length > 0) { bar.style.display = 'flex'; if (count) count.textContent = checks.length; }
    else { bar.style.display = 'none'; }
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

  // Backup
  const createBackupBtn = document.getElementById('createBackupBtn');
  if (createBackupBtn) {
    createBackupBtn.addEventListener('click', async function () {
      try {
        await api('/api/settings/backup', { method: 'GET' });
        toast('Backup created', 'success');
        setTimeout(function () { window.location.reload(); }, 800);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // Invite
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

  // Categories modal
  const newCatBtn = document.getElementById('newCategoryBtn');
  if (newCatBtn) newCatBtn.addEventListener('click', function () {
    const m = document.getElementById('categoryModal'); if (m) m.classList.add('open');
  });
  const catCancel = document.getElementById('catCancel');
  if (catCancel) catCancel.addEventListener('click', function () {
    const m = document.getElementById('categoryModal'); if (m) m.classList.remove('open');
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
})();
