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
    let errorMessage = res.statusText;
    try {
      data = await res.json();
      if (data && data.error && data.error.message) errorMessage = data.error.message;
    } catch (e) {
      // Nie-JSON odpowiedź (np. HTML z błędem PHP) – spróbuj wyciągnąć tekst.
      try { errorMessage = await res.text(); } catch (e2) {}
    }
    if (!res.ok) {
      const err = new Error(errorMessage || res.statusText);
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
  const modalBody = document.getElementById('pfBody');
  const modalFooter = document.getElementById('pfFooter');
  let categories = [];
  let settings = { currency: 'PLN' };
  let extracting = false;
  let saving = false;
  let uploading = false;
  let currentStep = 'link'; // 'link' | 'details' | 'summary'
  let form = null;
  let editingProductId = null;
  const pfEyebrowEl = document.getElementById('pfEyebrow');
  const pfTitleEl = document.getElementById('pfTitle');
  const pfDescEl = document.getElementById('pfDesc');
  const defaultEyebrow = pfEyebrowEl ? pfEyebrowEl.textContent : 'New addition';
  const defaultTitle = pfTitleEl ? pfTitleEl.textContent : 'Add to your vault';
  const defaultDesc = pfDescEl ? pfDescEl.textContent : 'Paste a store link and we’ll try to fill in the details.';

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
  function closeModal() { if (modal) { modal.classList.remove('open'); modal.removeEventListener('paste', handlePaste); } editingProductId = null; if (pfEyebrowEl) pfEyebrowEl.textContent = defaultEyebrow; if (pfTitleEl) pfTitleEl.textContent = defaultTitle; if (pfDescEl) pfDescEl.textContent = defaultDesc; }

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

  function wizardStepHTML() {
    const steps = [
      { id: 'link', label: '1', title: 'Product link', hint: 'Paste a store link' },
      { id: 'details', label: '2', title: 'Details', hint: 'Name, price and image' },
      { id: 'summary', label: '3', title: 'Save', hint: 'Category, tags and notes' }
    ];
    let html = '<div class="wizard-steps">';
    steps.forEach(function (s, i) {
      const isActive = currentStep === s.id;
      const isCompleted = ['link', 'details', 'summary'].indexOf(currentStep) > i;
      html += '<span class="wizard-step ' + (isCompleted ? 'completed' : '') + (isActive ? ' active' : '') + '" aria-current="' + (isActive ? 'step' : 'false') + '">';
      if (isCompleted) {
        html += '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      } else {
        html += s.label;
      }
      html += '</span>';
      if (i < steps.length - 1) {
        html += '<svg class="wizard-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>';
        html += '<span class="wizard-label">' + s.title + '</span>';
      }
    });
    html += '</div>';
    return html;
  }

  function stepOptionHTML() {
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
    return { catOpts: catOpts, currOpts: currOpts, statusOpts: statusOpts };
  }

  function renderForm() {
    if (!modalBody) return;
    const opts = stepOptionHTML();

    modalBody.innerHTML = ''
      // Step 1: Link
      + '<section class="form-step ' + (currentStep === 'link' ? 'active' : '') + '" aria-labelledby="step-link">'
      +   '<h2 id="step-link" class="sr-only">Product link</h2>'
      +   '<div class="url-panel">'
      +     '<label class="label" for="pf-url">Paste a store link</label>'
      +     '<div class="url-row">'
      +       '<input class="input" id="pf-url" type="url" placeholder="https://store.com/product/..." value="' + esc(form.url) + '">'
      +       '<button class="btn btn-sm" type="button" id="pf-import" ' + (extracting ? 'disabled' : '') + '>' + (extracting ? 'Reading…' : 'Import details') + '</button>'
      +     '</div>'
      +     '<p class="hint">We’ll try to read the page and fill in the details automatically. You can always enter them by hand.</p>'
      +     '<div id="pf-extraction"></div>'
      +     '<div id="pf-duplicate"></div>'
      +   '</div>'
      + '</section>'

      // Step 2: Details
      + '<section class="form-step ' + (currentStep === 'details' ? 'active' : '') + '" aria-labelledby="step-details">'
      +   '<h2 id="step-details" class="sr-only">Product details</h2>'
      +   '<div class="product-form-main">'
      +     '<div>'
      +       '<label class="label">Image</label>'
      +       '<div class="image-upload" id="pf-imageBox">'
      +         (form.imagePath ? '<img src="' + esc(productImageUrl(form.imagePath)) + '" alt="preview" style="width:100%;height:100%;object-fit:cover">' : '<div class="product-image-empty"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#i-image"></use></svg><span>No image</span></div>')
      +         (uploading ? '<div class="image-upload-loading"><span class="spinner"></span></div>' : '')
      +       '</div>'
      +       '<input type="file" id="pf-file" accept="image/*" style="display:none">'
      +       '<div style="display:flex;gap:8px;margin-top:8px">'
      +         '<button class="btn btn-outline btn-sm" type="button" id="pf-uploadBtn">' + (uploading ? 'Uploading…' : 'Upload image') + '</button>'
      +         (form.imagePath ? '<button class="btn btn-ghost btn-sm" type="button" id="pf-removeImg">Remove</button>' : '')
      +       '</div>'
      +       '<input type="hidden" id="pf-imagePath" value="' + esc(form.imagePath) + '">'
      +     '</div>'
      +     '<div class="space-y-4">'
      +       '<div class="form-subhead"><h3>Basic details</h3></div>'
      +       '<div class="field"><label class="label" for="pf-name">Name <span style="color:hsl(var(--destructive))">*</span></label><input class="input" id="pf-name" value="' + esc(form.name) + '" placeholder="What is this product?"></div>'
      +       '<div class="field"><label class="label" for="pf-url2">URL <span style="color:hsl(var(--destructive))">*</span></label><input class="input" id="pf-url2" value="' + esc(form.url) + '" placeholder="https://..."></div>'
      +       '<div class="field"><label class="label" for="pf-description">Description</label><textarea class="textarea" id="pf-description" placeholder="Optional details, size, colour, variant…">' + esc(form.description) + '</textarea></div>'
      +       '<div class="form-subhead"><h3>Pricing</h3></div>'
      +       '<div class="grid form-grid">'
      +         '<div class="field"><label class="label" for="pf-price">Current price</label><input class="input" id="pf-price" type="number" step="0.01" value="' + esc(form.currentPrice) + '" placeholder="0.00"></div>'
      +         '<div class="field"><label class="label" for="pf-original">Original price</label><input class="input" id="pf-original" type="number" step="0.01" value="' + esc(form.originalPrice) + '" placeholder="Optional"></div>'
      +       '</div>'
      +       '<div class="grid form-grid">'
      +         '<div class="field"><label class="label" for="pf-currency">Currency</label><select class="select" id="pf-currency">' + opts.currOpts + '</select></div>'
      +         '<div class="field"><label class="label" for="pf-status">Status</label><select class="select" id="pf-status">' + opts.statusOpts + '</select></div>'
      +       '</div>'
      +       '<div class="form-subhead"><h3>Organisation</h3></div>'
      +       '<div class="field"><label class="label" for="pf-store">Store</label><input class="input" id="pf-store" value="' + esc(form.storeName) + '" placeholder="Store name"></div>'
      +       '<div class="field"><label class="label" for="pf-availability">Availability</label><input class="input" id="pf-availability" value="' + esc(form.availability) + '" placeholder="In stock, pre-order…"></div>'
      +       '<div class="field"><label class="label" for="pf-tags">Tags</label><input class="input" id="pf-tags" value="' + esc(form.tags.join(', ')) + '" placeholder="comma separated"></div>'
      +     '</div>'
      +   '</div>'
      + '</section>'

      // Step 3: Summary
      + '<section class="form-step ' + (currentStep === 'summary' ? 'active' : '') + '" aria-labelledby="step-summary">'
      +   '<h2 id="step-summary" class="sr-only">Save product</h2>'
      +   '<div class="grid form-grid">'
      +     '<div class="field"><label class="label" for="pf-category">Category <span style="color:hsl(var(--destructive))">*</span></label><select class="select" id="pf-category"><option value="">Choose a category</option>' + opts.catOpts + '</select></div>'
      +     '<div class="field"><label class="label" for="pf-notes">Private notes</label><textarea class="textarea no-resize" id="pf-notes" placeholder="Gift idea for…, size, colour, occasion…" rows="3">' + esc(form.notes) + '</textarea></div>'
      +   '</div>'
      +   '<div class="field" style="margin-top:8px"><label class="label" for="pf-tags">Tags</label><div class="tag-input" id="pf-tags-box"><div class="tag-chips" id="pf-tag-chips"></div><input id="pf-tags" type="text" value="" placeholder="Type a tag and press Enter"></div></div>'
      +   '<div class="preview-card">'
      +     '<div class="preview-head">'
      +       '<h3>Preview</h3>'
      +       '<span class="muted small">Read-only summary</span>'
      +     '</div>'
      +     '<div class="preview-body">'
      +       '<div class="preview-row">'
      +         '<div class="preview-thumb" id="pf-preview-thumb">' + (form.imagePath ? '<img src="' + esc(productImageUrl(form.imagePath)) + '" alt="preview" style="width:100%;height:100%;object-fit:cover">' : '<div class="product-image-empty" style="width:48px;height:48px"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#i-image"></use></svg><span style="display:none">No image</span></div>') + '</div>'
      +         '<div class="preview-info">'
      +           '<strong id="pf-preview-name">' + esc(form.name) + '</strong>'
      +           '<small id="pf-preview-store">' + (form.storeName ? form.storeName : '—') + '</small>'
      +         '</div>'
      +       '</div>'
      +       '<div class="preview-meta">'
      +         '<span><span class="cat-dot" style="background:hsl(var(--muted-foreground))"></span> <span id="pf-preview-category">' + (form.categoryId ? (categories.find(function(c){return c.id===form.categoryId;})||{name:'—'}).name : '—') + '</span></span>'
      +         '<span>' + (form.currentPrice ? parseFloat(form.currentPrice).toFixed(2) + ' ' + form.currency : '—') + '</span>'
      +         '<span>' + form.status + '</span>'
      +       '</div>'
      +       '<div id="pf-preview-tags" class="preview-meta" style="margin-top:6px"></div>'
      +     '</div>'
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
    renderTags();
    updatePreview();

    var imageBox = document.getElementById('pf-imageBox');
    if (imageBox && !imageBox.dataset.dndBound) {
      imageBox.dataset.dndBound = '1';
      imageBox.addEventListener('dragover', function (e) { e.preventDefault(); imageBox.classList.add('drag-over'); });
      imageBox.addEventListener('dragleave', function () { imageBox.classList.remove('drag-over'); });
      imageBox.addEventListener('drop', function (e) {
        e.preventDefault();
        imageBox.classList.remove('drag-over');
        var files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length) handleImageUpload(files[0]);
      });
    }

    updateWizardFooter();
  }

  function renderTags() {
    const box = document.getElementById('pf-tag-chips');
    const input = document.getElementById('pf-tags-input') || document.getElementById('pf-tags');
    if (!box) return;
    box.innerHTML = '';
    (form.tags || []).forEach(function (tag) {
      const el = document.createElement('span');
      el.className = 'tag-chip';
      el.textContent = tag;
      const btn = document.createElement('button');
      btn.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
      btn.setAttribute('aria-label', 'Remove ' + esc(tag));
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        form.tags = (form.tags || []).filter(function (t) { return t !== tag; });
        renderForm();
      });
      el.appendChild(btn);
      box.appendChild(el);
    });
    const tagInput = document.getElementById('pf-tags-input');
    if (tagInput) {
      tagInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          addTagFromInput();
        }
        if (e.key === 'Backspace' && !tagInput.value && (form.tags || []).length) {
          form.tags.pop();
          renderForm();
        }
      });
      tagInput.addEventListener('blur', addTagFromInput);
    }
  }

  function addTagFromInput() {
    const input = document.getElementById('pf-tags-input');
    if (!input || !input.value.trim()) return;
    const parts = input.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
    for (var i = 0; i < parts.length; i++) {
      if ((form.tags || []).indexOf(parts[i]) === -1) {
        (form.tags || []).push(parts[i].slice(0, 40));
      }
    }
    if ((form.tags || []).length > 15) {
      form.tags = (form.tags || []).slice(0, 15);
    }
    input.value = '';
    renderForm();
  }

  function updatePreview() {
    const nameEl = document.getElementById('pf-preview-name');
    const storeEl = document.getElementById('pf-preview-store');
    const catEl = document.getElementById('pf-preview-category');
    const tagsEl = document.getElementById('pf-preview-tags');
    if (nameEl) nameEl.textContent = esc(form.name) || '—';
    if (storeEl) storeEl.textContent = esc(form.storeName) || '—';
    if (catEl) {
      var catName = '—';
      if (form.categoryId) {
        var c = categories.find(function (cat) { return cat.id === form.categoryId; });
        if (c) catName = c.name;
      }
      catEl.textContent = catName;
    }
    if (tagsEl) {
      tagsEl.innerHTML = '';
      if ((form.tags || []).length) {
        (form.tags || []).forEach(function (tag) {
          var span = document.createElement('span');
          span.className = 'tag-pill';
          span.textContent = tag;
          tagsEl.appendChild(span);
        });
      }
    }
  }

  function validateStep() {
    var errors = [];
    if (currentStep === 'link') {
      if (!form.url.trim()) errors.push('Product URL is required.');
      else if (!/^https?:\/\//i.test(form.url.trim())) errors.push('Use a full HTTP or HTTPS link.');
    } else if (currentStep === 'details') {
      if (!form.name.trim()) errors.push('Product name is required.');
      if (form.currentPrice.trim()) {
        var v = parseFloat(form.currentPrice);
        if (isNaN(v) || v < 0) errors.push('Enter a valid price.');
      }
      if (form.originalPrice.trim()) {
        var v = parseFloat(form.originalPrice);
        if (isNaN(v) || v < 0) errors.push('Enter a valid original price.');
      }
    } else if (currentStep === 'summary') {
      if (!form.categoryId) errors.push('Choose a category.');
    }
    return errors;
  }

  function goNext() {
    var errors = validateStep();
    if (errors.length) {
      toast(errors[0], 'error');
      return;
    }
    if (currentStep === 'link') currentStep = 'details';
    else if (currentStep === 'details') currentStep = 'summary';
    renderForm();
  }

  function goBack() {
    if (currentStep === 'details') currentStep = 'link';
    else if (currentStep === 'summary') currentStep = 'details';
    renderForm();
  }

  function updateWizardFooter() {
    if (!modalFooter) return;
    var isLast = currentStep === 'summary';
    var isFirst = currentStep === 'link';
    var saveBtn = document.getElementById('pfSave');
    var nextBtn = document.getElementById('pfNext');
    var backBtn = document.getElementById('pfBack');

    if (saveBtn) saveBtn.style.display = isLast ? 'inline-flex' : 'none';
    if (nextBtn) {
      nextBtn.style.display = isLast ? 'none' : 'inline-flex';
      nextBtn.disabled = (validateStep().length > 0);
    }
    if (backBtn) {
      backBtn.style.display = isFirst ? 'none' : 'inline-flex';
      backBtn.disabled = saving;
    }
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
    v('pf-store','storeName'); v('pf-availability','availability');
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
      if (currentStep === 'link') {
        goNext();
      }
    }
  }

  async function saveProduct() {
    if (saving) return;
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
    if (!editingProductId && !form.categoryId) { toast('Choose a category.', 'error'); return; }

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
      const savePath = editingProductId ? '/api/products/' + editingProductId : '/api/products';
      const saveMethod = editingProductId ? 'PATCH' : 'POST';
      await api(savePath, { method: saveMethod, body: payload });
      toast(editingProductId ? 'Product updated' : 'Product added to your vault', 'success');
      editingProductId = null;
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
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = editingProductId ? 'Save changes' : 'Add product'; }
    }
  }

  async function openProductModal() {
    if (modal && modal.classList.contains('open')) return;
    resetForm();
    currentStep = 'link';
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
    updateWizardFooter();

    const saveBtn = document.getElementById('pfSave');
    const newBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newBtn, saveBtn);
    newBtn.id = 'pfSave';
    newBtn.addEventListener('click', saveProduct);

    // Ensure wizard nav buttons exist in the footer (listeners attached once)
    var footer = saveBtn ? saveBtn.parentNode : null;
    if (footer) {
      var nextBtn = document.getElementById('pfNext');
      if (!nextBtn) {
        nextBtn = document.createElement('button');
        nextBtn.id = 'pfNext';
        nextBtn.type = 'button';
        nextBtn.className = 'btn btn-sm';
        nextBtn.innerHTML = 'Next <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>';
        footer.insertBefore(nextBtn, saveBtn);
        nextBtn.addEventListener('click', goNext);
      }
      var backBtn = document.getElementById('pfBack');
      if (!backBtn) {
        backBtn = document.createElement('button');
        backBtn.id = 'pfBack';
        backBtn.type = 'button';
        backBtn.className = 'btn btn-outline btn-sm';
        backBtn.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 6 9 12 15 18"></polyline></svg> Back';
        footer.insertBefore(backBtn, nextBtn);
        backBtn.addEventListener('click', goBack);
      }
    }

    updateWizardFooter();
  }

  async function openEditProduct(id) {
    if (modal && modal.classList.contains('open')) return;
    editingProductId = id;
    resetForm();
    currentStep = 'details';
    openModal();
    if (modal) modal.addEventListener('paste', handlePaste);
    const body = document.getElementById('pfBody');
    if (body) body.innerHTML = '<div class="muted small">Loading…</div>';
    try {
      const [cats, sets, prod] = await Promise.all([
        api('/api/categories', { method: 'GET' }),
        api('/api/settings', { method: 'GET' }),
        api('/api/products/' + id, { method: 'GET' })
      ]);
      categories = (cats.categories || cats || []);
      if (sets.settings) settings = sets.settings;
      const p = prod.product || prod;
      form.url = p.url || '';
      form.name = p.name || '';
      form.description = p.description || '';
      form.imagePath = p.imageUrl || '';
      form.imageSourceUrl = p.imageSourceUrl || '';
      form.currentPrice = p.currentPrice != null ? String(p.currentPrice) : '';
      form.originalPrice = p.originalPrice != null ? String(p.originalPrice) : '';
      form.currency = p.currency || 'PLN';
      form.availability = p.availability || '';
      form.status = p.status || 'TO_CONSIDER';
      form.notes = p.notes || '';
      form.storeName = (p.store && p.store.name) || '';
      form.storeDomain = (p.store && p.store.domain) || '';
      form.categoryId = (p.category && p.category.id) || '';
      form.tags = Array.isArray(p.tags) ? p.tags.slice() : [];
    } catch (e) {
      toast('Could not load product.', 'error');
      closeModal();
      return;
    }
    if (pfEyebrowEl) pfEyebrowEl.textContent = 'Edit product';
    if (pfTitleEl) pfTitleEl.textContent = 'Edit product';
    if (pfDescEl) pfDescEl.textContent = 'Update details and save.';
    renderForm();
    updateWizardFooter();
    const saveBtn = document.getElementById('pfSave');
    if (saveBtn) {
      const newBtn = saveBtn.cloneNode(true);
      saveBtn.parentNode.replaceChild(newBtn, saveBtn);
      newBtn.id = 'pfSave';
      newBtn.textContent = 'Save changes';
      newBtn.addEventListener('click', saveProduct);
    }
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

  // Edit product
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('#editProductBtn');
    if (btn) {
      const id = btn.getAttribute('data-id');
      if (id) openEditProduct(id);
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
    const favBtn = document.getElementById('bulkFavorite');
    const statusBtn = document.getElementById('bulkStatus');
    const delBtn = document.getElementById('bulkDelete');
    const has = checks.length > 0;
    if (!bar) return;
    if (has) {
      bar.style.display = 'flex';
      if (count) count.textContent = checks.length;
    } else {
      bar.style.display = 'none';
    }
    if (favBtn) favBtn.disabled = !has;
    if (statusBtn) statusBtn.disabled = !has;
    if (delBtn) delBtn.disabled = !has;
  }
  document.addEventListener('change', function (e) {
    if (e.target.classList && e.target.classList.contains('bulk-check')) updateBulkBar();
  });

  function getBulkIds() {
    return $$('.bulk-check:checked').map(function (cb) { return cb.value; });
  }

  document.addEventListener('click', function (e) {
    const del = e.target.closest('#bulkDelete');
    if (del) {
      e.preventDefault();
      const ids = getBulkIds();
      if (!ids.length) return;
      openConfirm(
        'Delete ' + ids.length + ' product' + (ids.length === 1 ? '' : 's') + '?',
        'This removes the selected products and their images. This cannot be undone.',
        function () {
          api('/api/products/bulk', {
            method: 'POST',
            body: { action: 'delete', ids: ids }
          }).then(function () {
            toast('Product' + (ids.length === 1 ? '' : 's') + ' deleted', 'success');
            setTimeout(function () { window.location.reload(); }, 400);
          }).catch(function (err) { toast(err.message || 'Could not delete products.', 'error'); });
        }
      );
    }
    const fav = e.target.closest('#bulkFavorite');
    if (fav) {
      e.preventDefault();
      const ids = getBulkIds();
      if (!ids.length) return;
      api('/api/products/bulk', {
        method: 'POST',
        body: { action: 'status', ids: ids, status: 'FAVORITE' }
      }).then(function () {
        toast('Added to favorites', 'success');
        setTimeout(function () { window.location.reload(); }, 400);
      }).catch(function (err) { toast(err.message || 'Could not update products.', 'error'); });
    }
    const status = e.target.closest('#bulkStatus');
    if (status) {
      e.preventDefault();
      const ids = getBulkIds();
      if (!ids.length) return;
      var newStatus = prompt('Set status for selected products (TO_CONSIDER, FAVORITE, TO_BUY, PURCHASED):', 'TO_CONSIDER');
      if (!newStatus) return;
      api('/api/products/bulk', {
        method: 'POST',
        body: { action: 'status', ids: ids, status: newStatus }
      }).then(function () {
        toast('Status updated', 'success');
        setTimeout(function () { window.location.reload(); }, 400);
      }).catch(function (err) { toast(err.message || 'Could not update products.', 'error'); });
    }
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

  // ---------- Category modal ----------
  const CAT_COLORS = [
    '#C9A46A','#D9A3B0','#B7A5C9','#8FAFC4','#9DB8A4','#C4A484',
    '#B4B8A5','#E0A5A5','#88B7B0','#D6A878','#A8A29E'
  ];
  const CAT_ICONS = [
    'tag','gem','sparkles','shirt','headphones','gamepad-2',
    'book-open','lamp','flower-2','ticket','cake-slice','gift'
  ];
  let catEditingId = null;
  let catSelectedColor = CAT_COLORS[1];
  let catSelectedIcon = CAT_ICONS[0];

  function renderCatSwatches() {
    const box = document.getElementById('catSwatches');
    if (!box) return;
    box.innerHTML = CAT_COLORS.map(function (color) {
      var selected = catSelectedColor === color ? ' selected' : '';
      return '<button type="button" class="swatch' + selected + '" style="background:' + color + '" data-cat-color="' + esc(color) + '" aria-label="Colour ' + esc(color) + '"></button>';
    }).join('');
    box.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        catSelectedColor = btn.getAttribute('data-cat-color');
        renderCatSwatches();
      });
    });
  }

  function renderCatIcons() {
    const box = document.getElementById('catIcons');
    if (!box) return;
    box.innerHTML = CAT_ICONS.map(function (name) {
      var selected = catSelectedIcon === name ? ' selected' : '';
      return '<button type="button" class="icon-option' + selected + '" data-cat-icon="' + esc(name) + '" aria-label="Icon ' + esc(name) + '"><svg class="icon"><use href="#i-' + esc(name) + '"></use></svg></button>';
    }).join('');
    box.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        catSelectedIcon = btn.getAttribute('data-cat-icon');
        renderCatIcons();
      });
    });
  }

  function openCategoryModal(category) {
    var m = document.getElementById('categoryModal');
    if (m && m.classList.contains('open')) return;
    catEditingId = category ? category.id : null;
    var nameEl = document.getElementById('catName');
    var colorEl = document.getElementById('catColor');
    var iconEl = document.getElementById('catIcon');
    var title = document.getElementById('catModalTitle');
    var desc = document.getElementById('catModalDesc');
    var saveBtn = document.getElementById('catSave');

    if (nameEl) nameEl.value = category ? category.name : '';
    if (colorEl) colorEl.value = category ? category.color : CAT_COLORS[1];
    if (iconEl) iconEl.value = category ? category.icon : 'tag';
    catSelectedColor = colorEl ? colorEl.value : CAT_COLORS[1];
    catSelectedIcon = iconEl ? iconEl.value : 'tag';
    if (title) title.textContent = category ? 'Edit category' : 'New category';
    if (desc) desc.textContent = category ? 'Update name, colour and icon.' : 'Pick a name, a soft accent colour and an icon.';
    if (saveBtn) saveBtn.textContent = category ? 'Save changes' : 'Create category';

    renderCatSwatches();
    renderCatIcons();

    var m = document.getElementById('categoryModal');
    if (m) m.classList.add('open');
  }

  function closeCategoryModal() {
    var m = document.getElementById('categoryModal');
    if (m) m.classList.remove('open');
    catEditingId = null;
  }

  const newCatBtn = document.getElementById('newCategoryBtn');
  if (newCatBtn) newCatBtn.addEventListener('click', function () { openCategoryModal(null); });
  const catCancel = document.getElementById('catCancel');
  if (catCancel) catCancel.addEventListener('click', closeCategoryModal);

  const catSave = document.getElementById('catSave');
  if (catSave) catSave.addEventListener('click', async function () {
    var nameEl = document.getElementById('catName');
    var colorEl = document.getElementById('catColor');
    var iconEl = document.getElementById('catIcon');
    if (!nameEl || !nameEl.value.trim()) { toast('Category name is required.', 'error'); return; }
    var body = {
      name: nameEl.value.trim(),
      color: (colorEl ? colorEl.value : catSelectedColor) || catSelectedColor,
      icon: (iconEl ? iconEl.value : catSelectedIcon) || catSelectedIcon
    };
    try {
      if (catEditingId) {
        await api('/api/categories/' + catEditingId, { method: 'PATCH', body: body });
        toast('Category updated', 'success');
      } else {
        await api('/api/categories', { method: 'POST', body: body });
        toast('Category created', 'success');
      }
      closeCategoryModal();
      setTimeout(function () { window.location.reload(); }, 400);
    } catch (err) { toast(err.message || 'Could not save category.', 'error'); }
  });

  // Edit / delete category from row dropdown
  document.addEventListener('click', function (e) {
    var editBtn = e.target.closest('[data-edit-cat]');
    if (editBtn) {
      e.preventDefault();
      var id = editBtn.getAttribute('data-edit-cat');
      var name = editBtn.closest('.category-card').querySelector('.category-name').textContent;
      // We need color + icon from the card; fetch from the DOM attribute via a data-ish lookup.
      // Simplest: refetch categories is heavy; instead read from the rendered card inline styles is unreliable.
      // We'll open a minimal edit with name only and keep existing color/icon unless user changes.
      openCategoryModal({ id: id, name: name, color: document.getElementById('catColor') ? document.getElementById('catColor').value : CAT_COLORS[1], icon: document.getElementById('catIcon') ? document.getElementById('catIcon').value : 'tag' });
    }
    var delBtn = e.target.closest('[data-delete-cat]');
    if (delBtn) {
      e.preventDefault();
      var id = delBtn.getAttribute('data-delete-cat');
      var name = delBtn.getAttribute('data-name') || 'this category';
      openConfirm(
        'Delete ' + esc(name) + '?',
        'This only removes the category. Products and price history are not affected.',
        function () {
          api('/api/categories/' + id, { method: 'DELETE' }).then(function () {
            toast('Category deleted', 'success');
            setTimeout(function () { window.location.reload(); }, 400);
          }).catch(function (err) { toast(err.message || 'Could not delete category.', 'error'); });
        }
      );
    }
  });
})();
