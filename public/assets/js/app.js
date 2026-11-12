(function () {
  'use strict';

  var GV = window.GV || {};
  var csrfToken = GV.csrfToken || '';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function iconSvg(name, cls) {
    return '<svg class="' + (cls || 'icon') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#i-' + esc(name) + '"></use></svg>';
  }

  function syncModalLock() {
    var open = document.querySelector('.modal.open');
    document.body.style.overflow = open ? 'hidden' : '';
  }

  // ---------- Theme ----------
  function applyTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('gv_theme', theme); } catch (e) {}
    var label = document.getElementById('themeLabel');
    if (label) label.textContent = theme === 'dark' ? 'Tryb jasny' : 'Tryb ciemny';
    var btn = document.getElementById('themeToggle');
    if (btn) btn.setAttribute('aria-label', theme === 'dark' ? 'Włącz tryb jasny' : 'Włącz tryb ciemny');
  }

  var storedTheme = 'light';
  try { storedTheme = localStorage.getItem('gv_theme') || 'light'; } catch (e) {}
  applyTheme(storedTheme);

  document.addEventListener('click', function (e) {
    if (e.target.closest('#themeToggle, #themeToggleAuth')) {
      var current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    }
  });

  // ---------- Sidebar ----------
  var sidebar = document.getElementById('sidebar');
  var backdrop = document.getElementById('sidebarBackdrop');

  function openSidebar() {
    if (sidebar) sidebar.classList.add('open');
    if (backdrop) backdrop.style.display = 'block';
  }
  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.style.display = '';
  }

  var openBtn = document.getElementById('mobileMenuBtn');
  var closeBtn = document.getElementById('sidebarClose');
  if (openBtn) openBtn.addEventListener('click', openSidebar);
  if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
  if (backdrop) backdrop.addEventListener('click', closeSidebar);

  // ---------- API ----------
  async function api(path, options) {
    options = options || {};
    var headers = Object.assign({ 'X-CSRF-Token': csrfToken }, options.headers || {});
    var body = options.body;
    if (body && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    var res = await fetch(path, Object.assign({}, options, { body: body, headers: headers, credentials: 'same-origin' }));
    var data = null;
    var errorMessage = res.statusText;
    try {
      data = await res.json();
      if (data && data.error && data.error.message) errorMessage = data.error.message;
    } catch (e) {
      try { errorMessage = await res.text(); } catch (e2) {}
    }
    if (!res.ok) {
      var err = new Error(errorMessage || res.statusText);
      err.code = data && data.error ? data.error.code : null;
      err.details = data && data.error ? data.error.details : null;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // ---------- Toast ----------
  function toast(message, type) {
    type = type || 'info';
    var stack = document.getElementById('flashStack');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'flashStack';
      stack.className = 'flash-stack';
      document.body.appendChild(stack);
    }
    var iconName = type === 'success' ? 'circle-check' : (type === 'error' || type === 'warning' ? 'circle-alert' : 'info');
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = iconSvg(iconName) + '<span></span>';
    el.querySelector('span').textContent = message || '';
    stack.appendChild(el);
    setTimeout(function () {
      el.classList.add('leaving');
      setTimeout(function () { el.remove(); }, 200);
    }, 3600);
  }

  // ---------- Confirm dialog ----------
  var confirmCallback = null;

  function openConfirm(title, desc, cb) {
    var t = document.getElementById('confirmTitle');
    var d = document.getElementById('confirmDesc');
    if (t) t.textContent = title;
    if (d) d.textContent = desc || '';
    confirmCallback = cb;
    var modal = document.getElementById('confirmModal');
    if (modal) modal.classList.add('open');
    syncModalLock();
  }

  function closeConfirm() {
    var modal = document.getElementById('confirmModal');
    if (modal) modal.classList.remove('open');
    confirmCallback = null;
    syncModalLock();
  }

  var confirmCancel = document.getElementById('confirmCancel');
  var confirmOk = document.getElementById('confirmOk');
  if (confirmCancel) confirmCancel.addEventListener('click', closeConfirm);
  if (confirmOk) confirmOk.addEventListener('click', function () {
    var cb = confirmCallback;
    closeConfirm();
    if (cb) cb();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var confirm = document.getElementById('confirmModal');
    if (confirm && confirm.classList.contains('open')) { closeConfirm(); return; }
    var category = document.getElementById('categoryModal');
    if (category && category.classList.contains('open')) { closeCategoryModal(); return; }
    var product = document.getElementById('productModal');
    if (product && product.classList.contains('open')) { closeModal(); }
  });

  // ---------- Product modal / wizard ----------
  var modal = document.getElementById('productModal');
  var modalBody = document.getElementById('pfBody');
  var pfEyebrowEl = document.getElementById('pfEyebrow');
  var pfTitleEl = document.getElementById('pfTitle');
  var pfDescEl = document.getElementById('pfDesc');
  var pfHintEl = document.getElementById('pfHint');

  var defaultEyebrow = pfEyebrowEl ? pfEyebrowEl.textContent : 'Nowy produkt';
  var defaultTitle = pfTitleEl ? pfTitleEl.textContent : 'Dodaj do swojej kolekcji';
  var defaultDesc = pfDescEl ? pfDescEl.textContent : 'Wklej link do sklepu — spróbujemy uzupełnić szczegóły.';

  var categories = [];
  var groups = [];
  var settings = { currency: 'PLN' };
  var extracting = false;
  var saving = false;
  var uploading = false;
  var currentStep = 'link';
  var form = null;
  var editingProductId = null;

  function resetForm() {
    form = {
      url: '', name: '', description: '', imagePath: '', imageSourceUrl: '',
      currentPrice: '', originalPrice: '', currency: settings.currency || 'PLN',
      availability: '', status: 'TO_CONSIDER', categoryId: '', groupId: '', storeName: '',
      storeDomain: '', notes: '', tags: []
    };
  }

  function productImageUrl(path) {
    if (!path) return '';
    if (/^(https?:)?\/\//i.test(path) || path.charAt(0) === '/') return path;
    return (window.location.origin || '') + '/' + String(path).replace(/^\/+/, '');
  }

  function openModal() {
    if (!modal) return;
    modal.classList.add('open');
    modal.addEventListener('paste', handlePaste);
    syncModalLock();
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    modal.removeEventListener('paste', handlePaste);
    editingProductId = null;
    if (pfEyebrowEl) pfEyebrowEl.textContent = defaultEyebrow;
    if (pfTitleEl) pfTitleEl.textContent = defaultTitle;
    if (pfDescEl) pfDescEl.textContent = defaultDesc;
    syncModalLock();
  }

  function handlePaste(e) {
    if (!modal || !modal.classList.contains('open')) return;
    var items = (e.clipboardData && e.clipboardData.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image/') === 0) {
        var file = items[i].getAsFile();
        if (file) { e.preventDefault(); handleImageUpload(file); return; }
      }
    }
  }

  function isFirstStep() {
    return currentStep === 'link' || (!!editingProductId && currentStep === 'details');
  }

  function wizardStepHTML() {
    var steps = [
      { id: 'link', label: '1', title: 'Link' },
      { id: 'details', label: '2', title: 'Szczegóły' },
      { id: 'summary', label: '3', title: 'Zapis' }
    ];
    var order = ['link', 'details', 'summary'];
    var currentIndex = order.indexOf(currentStep);
    var html = '<div class="wizard-steps" style="padding-left:0;padding-right:0">';
    steps.forEach(function (step, i) {
      var isActive = currentStep === step.id;
      var isCompleted = currentIndex > i;
      html += '<span class="wizard-step ' + (isCompleted ? 'completed' : '') + (isActive ? ' active' : '') + '" aria-current="' + (isActive ? 'step' : 'false') + '">';
      html += isCompleted ? iconSvg('check') : step.label;
      html += '</span>';
      if (i < steps.length - 1) {
        html += iconSvg('chevron-right', 'wizard-arrow');
        html += '<span class="wizard-label">' + step.title + '</span>';
      }
    });
    html += '</div>';
    return html;
  }

  function stepOptionHTML() {
    var catOpts = categories.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (form.categoryId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
    var groupOpts = groups.map(function (g) {
      return '<option value="' + esc(g.id) + '"' + (form.groupId === g.id ? ' selected' : '') + '>' + esc(g.name) + '</option>';
    }).join('');
    var currOpts = ['PLN', 'EUR', 'USD', 'GBP', 'CHF', 'CZK', 'SEK', 'NOK', 'DKK', 'HUF', 'UAH'].map(function (c) {
      return '<option value="' + c + '"' + (form.currency === c ? ' selected' : '') + '>' + c + '</option>';
    }).join('');
    var statusOpts = [
      { v: 'TO_CONSIDER', l: 'Do rozważenia' },
      { v: 'FAVORITE', l: 'Ulubione' },
      { v: 'TO_BUY', l: 'Do kupienia' },
      { v: 'PURCHASED', l: 'Kupione' }
    ].map(function (s) {
      return '<option value="' + s.v + '"' + (form.status === s.v ? ' selected' : '') + '>' + s.l + '</option>';
    }).join('');
    return { catOpts: catOpts, groupOpts: groupOpts, currOpts: currOpts, statusOpts: statusOpts };
  }

  function imagePreviewHTML() {
    if (form.imagePath) {
      return '<img src="' + esc(productImageUrl(form.imagePath)) + '" alt="Podgląd zdjęcia" style="width:100%;height:100%;object-fit:cover">';
    }
    return '<div class="product-image-empty">' + iconSvg('image') + '<span>Brak zdjęcia</span></div>';
  }

  function renderForm() {
    if (!modalBody || !form) return;
    var opts = stepOptionHTML();

    modalBody.innerHTML = wizardStepHTML()

      // Krok 1 — link
      + '<section class="form-step ' + (currentStep === 'link' ? 'active' : '') + '" aria-labelledby="step-link">'
      +   '<h2 id="step-link" class="sr-only">Link do produktu</h2>'
      +   '<div class="url-panel">'
      +     '<label class="label" for="pf-url">Wklej link do sklepu</label>'
      +     '<div class="url-row">'
      +       '<input class="input" id="pf-url" type="url" placeholder="https://sklep.pl/produkt/..." value="' + esc(form.url) + '">'
      +       '<button class="btn btn-sm" type="button" id="pf-import" ' + (extracting ? 'disabled' : '') + '>' + (extracting ? 'Wczytuję…' : 'Pobierz dane') + '</button>'
      +     '</div>'
      +     '<p class="hint">Spróbujemy odczytać stronę i uzupełnić dane automatycznie. Zawsze możesz wpisać je ręcznie.</p>'
      +     '<div id="pf-extraction"></div>'
      +     '<div id="pf-duplicate"></div>'
      +   '</div>'
      + '</section>'

      // Krok 2 — szczegóły
      + '<section class="form-step ' + (currentStep === 'details' ? 'active' : '') + '" aria-labelledby="step-details">'
      +   '<h2 id="step-details" class="sr-only">Szczegóły produktu</h2>'
      +   '<div class="product-form-main">'
      +     '<div>'
      +       '<label class="label">Zdjęcie</label>'
      +       '<div class="image-upload" id="pf-imageBox">'
      +         imagePreviewHTML()
      +         (uploading ? '<div class="image-upload-loading"><span class="spinner"></span></div>' : '')
      +       '</div>'
      +       '<input type="file" id="pf-file" accept="image/*" style="display:none">'
      +       '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">'
      +         '<button class="btn btn-outline btn-sm" type="button" id="pf-uploadBtn">' + (uploading ? 'Wysyłam…' : 'Dodaj zdjęcie') + '</button>'
      +         (form.imagePath ? '<button class="btn btn-ghost btn-sm" type="button" id="pf-removeImg">Usuń</button>' : '')
      +       '</div>'
      +       '<input type="hidden" id="pf-imagePath" value="' + esc(form.imagePath) + '">'
      +     '</div>'
      +     '<div class="space-y-4">'
      +       '<div class="form-subhead"><h3>Podstawowe dane</h3></div>'
      +       '<div class="field"><label class="label" for="pf-name">Nazwa <span class="required-mark">*</span></label><input class="input" id="pf-name" value="' + esc(form.name) + '" placeholder="Co to za produkt?"></div>'
      +       '<div class="field"><label class="label" for="pf-url2">Adres URL <span class="required-mark">*</span></label><input class="input" id="pf-url2" value="' + esc(form.url) + '" placeholder="https://..."></div>'
      +       '<div class="field"><label class="label" for="pf-description">Opis</label><textarea class="textarea" id="pf-description" placeholder="Rozmiar, kolor, wariant…">' + esc(form.description) + '</textarea></div>'
      +       '<div class="form-subhead"><h3>Cena</h3></div>'
      +       '<div class="form-grid">'
      +         '<div class="field"><label class="label" for="pf-price">Aktualna cena</label><input class="input" id="pf-price" type="number" step="0.01" min="0" value="' + esc(form.currentPrice) + '" placeholder="0,00"></div>'
      +         '<div class="field"><label class="label" for="pf-original">Cena pierwotna</label><input class="input" id="pf-original" type="number" step="0.01" min="0" value="' + esc(form.originalPrice) + '" placeholder="Opcjonalnie"></div>'
      +       '</div>'
      +       '<div class="form-grid">'
      +         '<div class="field"><label class="label" for="pf-currency">Waluta</label><select class="select" id="pf-currency">' + opts.currOpts + '</select></div>'
      +         '<div class="field"><label class="label" for="pf-status">Status</label><select class="select" id="pf-status">' + opts.statusOpts + '</select></div>'
      +       '</div>'
      +       '<div class="form-subhead"><h3>Organizacja</h3></div>'
      +       '<div class="field"><label class="label" for="pf-store">Sklep</label><input class="input" id="pf-store" value="' + esc(form.storeName) + '" placeholder="Nazwa sklepu"></div>'
      +       '<div class="field"><label class="label" for="pf-availability">Dostępność</label><input class="input" id="pf-availability" value="' + esc(form.availability) + '" placeholder="W magazynie, przedsprzedaż…"></div>'
      +       '<div class="field"><label class="label" for="pf-group">Wspólna grupa</label><select class="select" id="pf-group"><option value="">Brak (tylko Ty)</option>' + opts.groupOpts + '</select></div>'
      +     '</div>'
      +   '</div>'
      + '</section>'

      // Krok 3 — zapis
      + '<section class="form-step ' + (currentStep === 'summary' ? 'active' : '') + '" aria-labelledby="step-summary">'
      +   '<h2 id="step-summary" class="sr-only">Zapisz produkt</h2>'
      +   '<div class="form-grid">'
      +     '<div class="field"><label class="label" for="pf-category">Kategoria <span class="required-mark">*</span></label><select class="select" id="pf-category"><option value="">Wybierz kategorię</option>' + opts.catOpts + '</select></div>'
      +     '<div class="field"><label class="label" for="pf-notes">Prywatne notatki</label><textarea class="textarea no-resize" id="pf-notes" placeholder="Prezent dla…, rozmiar, kolor, okazja…" rows="3">' + esc(form.notes) + '</textarea></div>'
      +   '</div>'
      +   '<div class="field" style="margin-top:14px">'
      +     '<label class="label" for="pf-tags-input">Tagi</label>'
      +     '<div class="tag-input" id="pf-tags-box"><div class="tag-chips" id="pf-tag-chips"></div><input id="pf-tags-input" type="text" placeholder="Wpisz tag i naciśnij Enter"></div>'
      +   '</div>'
      +   '<div class="preview-card">'
      +     '<div class="preview-head"><h3>Podgląd</h3><span class="muted small">Tak zapiszesz produkt</span></div>'
      +     '<div class="preview-body">'
      +       '<div class="preview-row">'
      +         '<div class="preview-thumb" id="pf-preview-thumb">' + imagePreviewHTML() + '</div>'
      +         '<div class="preview-info"><strong id="pf-preview-name">' + esc(form.name) + '</strong><small id="pf-preview-store">' + esc(form.storeName || '—') + '</small></div>'
      +       '</div>'
      +       '<div class="preview-meta">'
      +         '<span><span class="cat-dot" style="background:' + esc(categoryColor(form.categoryId)) + '"></span> <span id="pf-preview-category">' + esc(categoryName(form.categoryId)) + '</span></span>'
      +         '<span id="pf-preview-price">' + esc(pricePreview()) + '</span>'
      +         '<span id="pf-preview-status">' + esc(statusLabel(form.status)) + '</span>'
      +       '</div>'
      +       '<div id="pf-preview-tags" class="preview-meta" style="margin-top:6px"></div>'
      +     '</div>'
      +   '</div>'
      + '</section>';

    wireFormEvents();
    renderTags();
    updatePreview();
    updateWizardFooter();
  }

  function categoryName(id) {
    if (!id) return '—';
    for (var i = 0; i < categories.length; i++) {
      if (categories[i].id === id) return categories[i].name;
    }
    return '—';
  }

  function categoryColor(id) {
    for (var i = 0; i < categories.length; i++) {
      if (categories[i].id === id) return categories[i].color || '#D9A3B0';
    }
    return '#D9A3B0';
  }

  function statusLabel(status) {
    var labels = { TO_CONSIDER: 'Do rozważenia', FAVORITE: 'Ulubione', TO_BUY: 'Do kupienia', PURCHASED: 'Kupione' };
    return labels[status] || status || '—';
  }

  function pricePreview() {
    if (!form.currentPrice) return '—';
    var value = parseFloat(form.currentPrice);
    if (isNaN(value)) return '—';
    return value.toFixed(2) + ' ' + form.currency;
  }

  function wireFormEvents() {
    var importBtn = document.getElementById('pf-import');
    if (importBtn) importBtn.addEventListener('click', doImport);

    var urlInput = document.getElementById('pf-url');
    if (urlInput) {
      urlInput.addEventListener('input', function () {
        form.url = urlInput.value;
        var url2 = document.getElementById('pf-url2');
        if (url2) url2.value = urlInput.value;
        updateWizardFooter();
      });
    }

    var uploadBtn = document.getElementById('pf-uploadBtn');
    var fileInput = document.getElementById('pf-file');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files[0]) handleImageUpload(fileInput.files[0]);
        fileInput.value = '';
      });
    }

    var removeImg = document.getElementById('pf-removeImg');
    if (removeImg) removeImg.addEventListener('click', function () {
      form.imagePath = '';
      form.imageSourceUrl = '';
      renderForm();
    });

    var imageBox = document.getElementById('pf-imageBox');
    if (imageBox && !imageBox.dataset.dndBound) {
      imageBox.dataset.dndBound = '1';
      imageBox.addEventListener('dragenter', function (e) { e.preventDefault(); imageBox.classList.add('drag-over'); });
      imageBox.addEventListener('dragover', function (e) { e.preventDefault(); imageBox.classList.add('drag-over'); });
      imageBox.addEventListener('dragleave', function () { imageBox.classList.remove('drag-over'); });
      imageBox.addEventListener('drop', function (e) {
        e.preventDefault();
        imageBox.classList.remove('drag-over');
        var dt = e.dataTransfer;
        var file = null;
        if (dt && dt.files && dt.files.length) {
          file = dt.files[0];
        } else if (dt && dt.items && dt.items.length) {
          var item = dt.items[0];
          if (item.kind === 'file' && item.getAsFile) {
            file = item.getAsFile();
          }
        }
        if (file) handleImageUpload(file);
      });
    }

    // Zapobiegaj otwieraniu przeciąganego pliku przez przeglądarkę zamiast jego upuszczenia w aplikacji.
    document.addEventListener('dragover', function (e) { e.preventDefault(); }, false);
    document.addEventListener('drop', function (e) { e.preventDefault(); }, false);

    bindFormFields();
  }

  function bindFormFields() {
    function bind(id, key) {
      var el = document.getElementById(id);
      if (!el) return;
      var handler = function () { form[key] = el.value; updateWizardFooter(); };
      el.addEventListener('input', handler);
      if (el.tagName === 'SELECT') el.addEventListener('change', handler);
    }
    bind('pf-name', 'name');
    bind('pf-url2', 'url');
    bind('pf-price', 'currentPrice');
    bind('pf-original', 'originalPrice');
    bind('pf-currency', 'currency');
    bind('pf-status', 'status');
    bind('pf-category', 'categoryId');
    bind('pf-group', 'groupId');
    bind('pf-store', 'storeName');
    bind('pf-availability', 'availability');
    bind('pf-description', 'description');
    bind('pf-notes', 'notes');
  }

  function renderTags() {
    var box = document.getElementById('pf-tag-chips');
    if (!box) return;
    box.innerHTML = '';
    (form.tags || []).forEach(function (tag) {
      var chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.textContent = tag;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = iconSvg('x');
      btn.setAttribute('aria-label', 'Usuń tag ' + tag);
      btn.addEventListener('click', function () {
        form.tags = (form.tags || []).filter(function (t) { return t !== tag; });
        renderTags();
        updatePreview();
      });
      chip.appendChild(btn);
      box.appendChild(chip);
    });

    var input = document.getElementById('pf-tags-input');
    if (!input) return;
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTagFromInput();
      } else if (e.key === 'Backspace' && !input.value && (form.tags || []).length) {
        form.tags.pop();
        renderTags();
        updatePreview();
      }
    });
    input.addEventListener('blur', addTagFromInput);
  }

  function addTagFromInput() {
    var input = document.getElementById('pf-tags-input');
    if (!input || !input.value.trim()) return;
    var parts = input.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
    parts.forEach(function (part) {
      var value = part.slice(0, 40);
      if ((form.tags || []).indexOf(value) === -1) (form.tags || []).push(value);
    });
    form.tags = (form.tags || []).slice(0, 15);
    input.value = '';
    renderTags();
    updatePreview();
  }

  function updatePreview() {
    var nameEl = document.getElementById('pf-preview-name');
    var storeEl = document.getElementById('pf-preview-store');
    var catEl = document.getElementById('pf-preview-category');
    var priceEl = document.getElementById('pf-preview-price');
    var statusEl = document.getElementById('pf-preview-status');
    var tagsEl = document.getElementById('pf-preview-tags');
    if (nameEl) nameEl.textContent = form.name || '—';
    if (storeEl) storeEl.textContent = form.storeName || '—';
    if (catEl) catEl.textContent = categoryName(form.categoryId);
    if (priceEl) priceEl.textContent = pricePreview();
    if (statusEl) statusEl.textContent = statusLabel(form.status);
    if (tagsEl) {
      tagsEl.innerHTML = '';
      (form.tags || []).forEach(function (tag) {
        var span = document.createElement('span');
        span.className = 'tag-pill';
        span.textContent = tag;
        tagsEl.appendChild(span);
      });
    }
  }

  function validateStep() {
    var errors = [];
    if (currentStep === 'link') {
      if (!form.url.trim()) errors.push('Podaj link do produktu.');
      else if (!/^https?:\/\//i.test(form.url.trim())) errors.push('Użyj pełnego linku zaczynającego się od http:// lub https://.');
    } else if (currentStep === 'details') {
      if (!form.name.trim()) errors.push('Podaj nazwę produktu.');
      if (form.currentPrice.trim()) {
        var price = parseFloat(form.currentPrice);
        if (isNaN(price) || price < 0) errors.push('Podaj poprawną cenę.');
      }
      if (form.originalPrice.trim()) {
        var original = parseFloat(form.originalPrice);
        if (isNaN(original) || original < 0) errors.push('Podaj poprawną cenę pierwotną.');
      }
    } else if (currentStep === 'summary') {
      if (!form.categoryId) errors.push('Wybierz kategorię.');
    }
    return errors;
  }

  function goNext() {
    var errors = validateStep();
    if (errors.length) { toast(errors[0], 'error'); return; }
    if (currentStep === 'link') currentStep = 'details';
    else if (currentStep === 'details') currentStep = 'summary';
    renderForm();
    var firstInput = modalBody ? modalBody.querySelector('.form-step.active .input, .form-step.active .select, .form-step.active textarea') : null;
    if (firstInput) firstInput.focus();
  }

  function goBack() {
    if (currentStep === 'details' && !editingProductId) currentStep = 'link';
    else if (currentStep === 'summary') currentStep = 'details';
    renderForm();
  }

  function updateWizardFooter() {
    var saveBtn = document.getElementById('pfSave');
    var nextBtn = document.getElementById('pfNext');
    var backBtn = document.getElementById('pfBack');
    var isLast = currentStep === 'summary';

    if (saveBtn) {
      saveBtn.style.display = isLast ? 'inline-flex' : 'none';
      saveBtn.textContent = editingProductId ? 'Zapisz zmiany' : 'Dodaj produkt';
      saveBtn.disabled = saving;
    }
    if (nextBtn) {
      nextBtn.style.display = isLast ? 'none' : 'inline-flex';
      nextBtn.disabled = saving || validateStep().length > 0;
    }
    if (backBtn) {
      backBtn.style.display = isFirstStep() ? 'none' : 'inline-flex';
      backBtn.disabled = saving;
    }
    if (pfHintEl) {
      var hints = {
        link: 'Wklej link, aby pobrać dane',
        details: 'Uzupełnij najważniejsze informacje',
        summary: 'Sprawdź dane przed zapisaniem'
      };
      pfHintEl.innerHTML = iconSvg('sparkles') + ' ' + (hints[currentStep] || hints.summary);
    }
  }

  async function handleImageUpload(file) {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) {
      toast('Wybierz plik graficzny.', 'error');
      return;
    }
    uploading = true;
    renderForm();
    try {
      var fd = new FormData();
      fd.append('image', file);
      var res = await fetch('/api/uploads/image', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrfToken },
        body: fd,
        credentials: 'same-origin'
      });
      var data = await res.json().catch(function () { return null; });
      if (!res.ok) throw new Error((data && data.error && data.error.message) || 'Nie udało się wysłać zdjęcia.');
      form.imagePath = (data && (data.imagePath || data.path)) || form.imagePath;
      toast('Zdjęcie zostało dodane.', 'success');
    } catch (err) {
      toast(err.message || 'Nie udało się wysłać zdjęcia.', 'error');
    } finally {
      uploading = false;
      renderForm();
    }
  }

  async function doImport() {
    if (extracting) return;
    var urlInput = document.getElementById('pf-url');
    var url = (urlInput ? urlInput.value : form.url).trim();
    if (!url) { toast('Najpierw wklej link do produktu.', 'error'); return; }
    if (!/^https?:\/\//i.test(url)) { toast('Użyj pełnego linku zaczynającego się od http:// lub https://.', 'error'); return; }

    form.url = url;
    extracting = true;
    renderForm();
    try {
      var res = await api('/api/extract', { method: 'POST', body: { url: url } });
      var data = res.data || {};
      form.url = data.url || url;
      if (data.name != null) form.name = data.name;
      if (data.description != null) form.description = data.description;
      if (data.imagePath != null) form.imagePath = data.imagePath;
      if (data.imageSourceUrl != null) form.imageSourceUrl = data.imageSourceUrl;
      if (data.currentPrice != null) form.currentPrice = String(data.currentPrice);
      if (data.originalPrice != null) form.originalPrice = String(data.originalPrice);
      if (data.currency) form.currency = data.currency;
      if (data.availability != null) form.availability = data.availability;
      if (data.storeName != null) form.storeName = data.storeName;
      if (data.storeDomain != null) form.storeDomain = data.storeDomain;
      if (data.suggestedCategoryId) form.categoryId = data.suggestedCategoryId;

      extracting = false;
      renderForm();
      showExtractionResult(res);
      await checkDuplicate(form.url);
      toast(res.success ? 'Znaleziono dane produktu.' : 'Udało się odczytać tylko część danych.', res.success ? 'success' : 'warning');
      if (currentStep === 'link') {
        if (validateStep().length === 0) { currentStep = 'details'; renderForm(); }
      }
    } catch (err) {
      extracting = false;
      renderForm();
      showExtractionResult({ success: false, error: err.message || 'Nie udało się odczytać linku.' });
      toast(err.message || 'Nie udało się odczytać linku.', 'error');
    }
  }

  function showExtractionResult(res) {
    var box = document.getElementById('pf-extraction');
    if (!box) return;
    var cls = res.success ? 'extraction-panel success' : 'extraction-panel warning';
    var title = res.success ? 'Znaleziono dane — sprawdź je przed zapisaniem' : (res.error || 'Odczytano ograniczone dane');
    var html = '<div class="' + cls + '"><div class="extraction-top">';
    html += iconSvg(res.success ? 'circle-check' : 'circle-alert');
    html += '<div class="extraction-body"><div class="extraction-title">' + esc(title) + '</div>';
    if (res.strategies && res.strategies.length) {
      html += '<div class="extraction-strategies">Wykryto: ' + esc(res.strategies.join(' · ')) + '</div>';
    }
    if (res.warnings && res.warnings.length) {
      html += '<ul class="extraction-warnings">' + res.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>';
    }
    html += '</div></div></div>';
    box.innerHTML = html;
  }

  async function checkDuplicate(url) {
    var box = document.getElementById('pf-duplicate');
    if (!box) return;
    try {
      var res = await api('/api/products/check-url?url=' + encodeURIComponent(url), { method: 'GET' });
      if (res.duplicate) {
        box.innerHTML = '<div class="duplicate-warning"><span>!</span><div class="duplicate-warning-body"><strong>Ten produkt jest już w Twojej kolekcji.</strong><span>' + esc(res.duplicate.name) + '</span></div></div>';
      } else {
        box.innerHTML = '';
      }
    } catch (e) {
      box.innerHTML = '';
    }
  }

  async function saveProduct() {
    if (saving) return;
    form.name = (document.getElementById('pf-name') || {}).value || '';
    form.url = (document.getElementById('pf-url2') || {}).value || '';
    form.currentPrice = (document.getElementById('pf-price') || {}).value || '';
    form.originalPrice = (document.getElementById('pf-original') || {}).value || '';
    form.currency = (document.getElementById('pf-currency') || {}).value || 'PLN';
    form.status = (document.getElementById('pf-status') || {}).value || 'TO_CONSIDER';
    form.categoryId = (document.getElementById('pf-category') || {}).value || '';
    form.groupId = (document.getElementById('pf-group') || {}).value || '';
    form.storeName = (document.getElementById('pf-store') || {}).value || '';
    form.availability = (document.getElementById('pf-availability') || {}).value || '';
    form.description = (document.getElementById('pf-description') || {}).value || '';
    form.notes = (document.getElementById('pf-notes') || {}).value || '';
    form.imagePath = (document.getElementById('pf-imagePath') || {}).value || '';

    form.name = form.name.trim();
    form.url = form.url.trim();
    form.currentPrice = String(form.currentPrice).trim();
    form.originalPrice = String(form.originalPrice).trim();
    form.storeName = form.storeName.trim();
    form.availability = form.availability.trim();
    form.description = form.description.trim();
    form.notes = form.notes.trim();

    if (!form.name) { toast('Podaj nazwę produktu.', 'error'); return; }
    if (!form.url) { toast('Podaj link do produktu.', 'error'); return; }
    if (!/^https?:\/\//i.test(form.url)) { toast('Użyj pełnego linku zaczynającego się od http:// lub https://.', 'error'); return; }
    if (!form.categoryId) { toast('Wybierz kategorię.', 'error'); return; }

    var payload = {
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
      groupId: form.groupId || null,
      notes: form.notes || null,
      storeName: form.storeName || null,
      storeDomain: form.storeDomain || null,
      tags: form.tags || []
    };

    saving = true;
    updateWizardFooter();
    try {
      var path = editingProductId ? '/api/products/' + editingProductId : '/api/products';
      var method = editingProductId ? 'PATCH' : 'POST';
      await api(path, { method: method, body: payload });
      toast(editingProductId ? 'Produkt został zaktualizowany.' : 'Produkt dodany do kolekcji.', 'success');
      editingProductId = null;
      closeModal();
      setTimeout(function () { window.location.reload(); }, 400);
    } catch (err) {
      toast(err.message || 'Nie udało się zapisać produktu.', 'error');
      if (err.details && err.details.fieldErrors) {
        var keys = Object.keys(err.details.fieldErrors);
        if (keys.length && err.details.fieldErrors[keys[0]][0]) toast(err.details.fieldErrors[keys[0]][0], 'error');
      }
    } finally {
      saving = false;
      updateWizardFooter();
    }
  }

  async function loadFormData() {
    var results = await Promise.all([
      api('/api/categories', { method: 'GET' }),
      api('/api/settings', { method: 'GET' }),
      api('/api/category-groups', { method: 'GET' })
    ]);
    categories = (results[0] && (results[0].categories || results[0])) || [];
    if (!Array.isArray(categories)) categories = [];
    groups = (results[2] && (results[2].groups || results[2])) || [];
    if (!Array.isArray(groups)) groups = [];
    if (results[1] && results[1].settings) settings = results[1].settings;
  }

  async function openProductModal() {
    if (modal && modal.classList.contains('open')) return;
    resetForm();
    currentStep = 'link';
    editingProductId = null;
    if (pfEyebrowEl) pfEyebrowEl.textContent = defaultEyebrow;
    if (pfTitleEl) pfTitleEl.textContent = defaultTitle;
    if (pfDescEl) pfDescEl.textContent = defaultDesc;
    openModal();
    if (modalBody) modalBody.innerHTML = '<div class="muted small">Ładowanie…</div>';
    try {
      await loadFormData();
      form.currency = settings.currency || 'PLN';
      var other = categories.filter(function (c) { return c.slug === 'other'; })[0];
      form.categoryId = (other || categories[0] || {}).id || '';
    } catch (err) {
      toast('Nie udało się załadować kategorii.', 'error');
    }
    renderForm();
    var urlInput = document.getElementById('pf-url');
    if (urlInput) urlInput.focus();
  }

  async function openEditProduct(id) {
    if (modal && modal.classList.contains('open')) return;
    editingProductId = id;
    resetForm();
    currentStep = 'details';
    openModal();
    if (modalBody) modalBody.innerHTML = '<div class="muted small">Ładowanie…</div>';
    try {
      var results = await Promise.all([
        loadFormData(),
        api('/api/products/' + id, { method: 'GET' })
      ]);
      var product = results[1].product || results[1];
      form.url = product.url || '';
      form.name = product.name || '';
      form.description = product.description || '';
      form.imagePath = product.imageUrl || '';
      form.imageSourceUrl = product.imageSourceUrl || '';
      form.currentPrice = product.currentPrice != null ? String(product.currentPrice) : '';
      form.originalPrice = product.originalPrice != null ? String(product.originalPrice) : '';
      form.currency = product.currency || settings.currency || 'PLN';
      form.availability = product.availability || '';
      form.status = product.status || 'TO_CONSIDER';
      form.notes = product.notes || '';
      form.storeName = (product.store && product.store.name) || '';
      form.storeDomain = (product.store && product.store.domain) || '';
      form.categoryId = (product.category && product.category.id) || '';
      form.groupId = product.groupId || '';
      form.tags = Array.isArray(product.tags) ? product.tags.slice() : [];
    } catch (err) {
      toast('Nie udało się załadować produktu.', 'error');
      closeModal();
      return;
    }
    if (pfEyebrowEl) pfEyebrowEl.textContent = 'Edycja produktu';
    if (pfTitleEl) pfTitleEl.textContent = 'Edytuj produkt';
    if (pfDescEl) pfDescEl.textContent = 'Zaktualizuj dane i zapisz zmiany.';
    renderForm();
  }

  ['quickAddBtn', 'quickAddBtn2', 'quickAddBtn3', 'quickAddBtn4'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', openProductModal);
  });

  var pfClose = document.getElementById('pfClose');
  var pfCancel = document.getElementById('pfCancel');
  var pfNext = document.getElementById('pfNext');
  var pfBack = document.getElementById('pfBack');
  var pfSave = document.getElementById('pfSave');
  if (pfClose) pfClose.addEventListener('click', closeModal);
  if (pfCancel) pfCancel.addEventListener('click', closeModal);
  if (pfNext) pfNext.addEventListener('click', goNext);
  if (pfBack) pfBack.addEventListener('click', goBack);
  if (pfSave) pfSave.addEventListener('click', saveProduct);

  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
  }

  // ---------- Product actions ----------
  document.addEventListener('click', function (e) {
    var deleteBtn = e.target.closest('#deleteProductBtn');
    if (deleteBtn) {
      var id = deleteBtn.getAttribute('data-id');
      openConfirm('Usunąć ten produkt?', 'Tej operacji nie można cofnąć. Zdjęcie produktu również zostanie usunięte.', function () {
        api('/api/products/' + id, { method: 'DELETE' }).then(function () {
          toast('Produkt usunięty.', 'success');
          setTimeout(function () { window.location.href = '/products'; }, 300);
        }).catch(function (err) { toast(err.message || 'Nie udało się usunąć produktu.', 'error'); });
      });
    }
  });

  document.addEventListener('click', function (e) {
    var editBtn = e.target.closest('#editProductBtn');
    if (editBtn) {
      var id = editBtn.getAttribute('data-id');
      if (id) openEditProduct(id);
    }
    var changeImageBtn = e.target.closest('#changeImageBtn');
    if (changeImageBtn) {
      var imageId = changeImageBtn.getAttribute('data-id');
      if (imageId) openEditProduct(imageId);
    }
    var removeImageBtn = e.target.closest('#removeImageBtn');
    if (removeImageBtn) {
      var removeId = removeImageBtn.getAttribute('data-id');
      openConfirm('Usunąć zdjęcie?', 'Zdjęcie zostanie odłączone od produktu. Możesz dodać nowe w każdej chwili.', function () {
        api('/api/products/' + removeId, { method: 'PATCH', body: { imagePath: null } }).then(function () {
          toast('Zdjęcie usunięte.', 'success');
          setTimeout(function () { window.location.reload(); }, 300);
        }).catch(function (err) { toast(err.message || 'Nie udało się usunąć zdjęcia.', 'error'); });
      });
    }
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-fav]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var id = btn.getAttribute('data-fav');
    var currentStatus = btn.getAttribute('data-status') || 'TO_CONSIDER';
    var nextStatus = currentStatus === 'FAVORITE' ? 'TO_CONSIDER' : 'FAVORITE';
    btn.disabled = true;
    api('/api/products/' + id, { method: 'PATCH', body: { status: nextStatus } }).then(function () {
      btn.setAttribute('data-status', nextStatus);
      var isFav = nextStatus === 'FAVORITE';
      btn.classList.toggle('is-favorite', isFav);
      btn.setAttribute('aria-label', isFav ? 'Usuń z ulubionych' : 'Dodaj do ulubionych');
      toast(isFav ? 'Dodano do ulubionych.' : 'Usunięto z ulubionych.', 'success');
    }).catch(function (err) {
      toast(err.message || 'Nie udało się zaktualizować produktu.', 'error');
    }).finally(function () {
      btn.disabled = false;
    });
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-mark-bought]');
    if (!btn) return;
    var id = btn.getAttribute('data-mark-bought');
    btn.disabled = true;
    api('/api/products/' + id, { method: 'PATCH', body: { status: 'PURCHASED' } }).then(function () {
      toast('Oznaczono jako kupione.', 'success');
      setTimeout(function () { window.location.reload(); }, 350);
    }).catch(function (err) {
      btn.disabled = false;
      toast(err.message || 'Nie udało się zaktualizować produktu.', 'error');
    });
  });

  // ---------- Product filters & view ----------
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el && el.matches && el.matches('[data-auto-submit]')) {
      if (el.form) el.form.submit();
    }
  });

  document.addEventListener('click', function (e) {
    var toggle = e.target.closest('[data-view-toggle]');
    if (!toggle) return;
    var view = toggle.getAttribute('data-view-toggle');
    if (toggle.classList.contains('active')) return;
    $$('[data-view-toggle]').forEach(function (b) { b.disabled = true; });
    api('/api/settings', { method: 'PATCH', body: { defaultProductView: view } }).then(function () {
      window.location.reload();
    }).catch(function (err) {
      $$('[data-view-toggle]').forEach(function (b) { b.disabled = false; });
      toast(err.message || 'Nie udało się zmienić widoku.', 'error');
    });
  });

  // ---------- Bulk actions ----------
  function getBulkIds() {
    return $$('.bulk-check:checked').map(function (cb) { return cb.value; });
  }

  function updateBulkBar() {
    var checks = $$('.bulk-check:checked');
    var bar = document.getElementById('bulkBar');
    var count = document.getElementById('bulkCount');
    var statusSelect = document.getElementById('bulkStatus');
    var deleteBtn = document.getElementById('bulkDelete');
    var has = checks.length > 0;
    if (bar) bar.style.display = has ? 'flex' : 'none';
    if (count) count.textContent = String(checks.length);
    if (statusSelect) statusSelect.disabled = !has;
    if (deleteBtn) deleteBtn.disabled = !has;
  }

  document.addEventListener('change', function (e) {
    if (e.target && e.target.classList && e.target.classList.contains('bulk-check')) updateBulkBar();
  });

  document.addEventListener('change', function (e) {
    var select = e.target.closest ? e.target.closest('#bulkStatus') : null;
    if (!select) return;
    var ids = getBulkIds();
    var status = select.value;
    if (!ids.length || !status) return;
    select.disabled = true;
    api('/api/products/bulk', { method: 'POST', body: { action: 'status', ids: ids, status: status } }).then(function () {
      toast('Status produktów został zmieniony.', 'success');
      setTimeout(function () { window.location.reload(); }, 350);
    }).catch(function (err) {
      select.disabled = false;
      select.value = '';
      toast(err.message || 'Nie udało się zaktualizować produktów.', 'error');
    });
  });

  document.addEventListener('click', function (e) {
    var del = e.target.closest('#bulkDelete');
    if (!del) return;
    e.preventDefault();
    var ids = getBulkIds();
    if (!ids.length) return;
    openConfirm(
      'Usunąć ' + ids.length + ' ' + (ids.length === 1 ? 'produkt' : 'produkty') + '?',
      'Wybrane produkty i ich zdjęcia zostaną usunięte. Tej operacji nie można cofnąć.',
      function () {
        api('/api/products/bulk', { method: 'POST', body: { action: 'delete', ids: ids } }).then(function () {
          toast('Produkty zostały usunięte.', 'success');
          setTimeout(function () { window.location.reload(); }, 350);
        }).catch(function (err) { toast(err.message || 'Nie udało się usunąć produktów.', 'error'); });
      }
    );
  });

  // ---------- Settings ----------
  var saveSettingsBtn = document.getElementById('saveSettingsBtn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', function () {
      var currency = document.getElementById('currency');
      var view = document.getElementById('defaultProductView');
      saveSettingsBtn.disabled = true;
      api('/api/settings', {
        method: 'PATCH',
        body: {
          currency: currency ? currency.value : 'PLN',
          defaultProductView: view ? view.value : 'grid'
        }
      }).then(function () {
        toast('Preferencje zostały zapisane.', 'success');
      }).catch(function (err) {
        toast(err.message || 'Nie udało się zapisać preferencji.', 'error');
      }).finally(function () {
        saveSettingsBtn.disabled = false;
      });
    });
  }

  // ---------- Backups ----------
  var createBackupBtn = document.getElementById('createBackupBtn');
  if (createBackupBtn) {
    createBackupBtn.addEventListener('click', async function () {
      createBackupBtn.disabled = true;
      try {
        var res = await fetch('/api/settings/backup', {
          method: 'GET',
          headers: { 'X-CSRF-Token': csrfToken },
          credentials: 'same-origin'
        });
        if (!res.ok) {
          var message = 'Nie udało się utworzyć kopii zapasowej.';
          try {
            var data = await res.json();
            if (data && data.error && data.error.message) message = data.error.message;
          } catch (e) {}
          throw new Error(message);
        }
        var blob = await res.blob();
        var disposition = res.headers.get('Content-Disposition') || '';
        var match = /filename="?([^";]+)"?/i.exec(disposition);
        var filename = match ? match[1] : 'gift-vault-backup.zip';
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        toast('Kopia zapasowa została utworzona i pobrana.', 'success');
        setTimeout(function () { window.location.reload(); }, 1000);
      } catch (err) {
        toast(err.message || 'Nie udało się utworzyć kopii zapasowej.', 'error');
      } finally {
        createBackupBtn.disabled = false;
      }
    });
  }

  var restoreBtn = document.getElementById('restoreBtn');
  if (restoreBtn) {
    restoreBtn.addEventListener('click', function () {
      var fileInput = document.getElementById('restoreFile');
      var file = fileInput && fileInput.files ? fileInput.files[0] : null;
      if (!file) { toast('Wybierz plik kopii zapasowej (.zip).', 'error'); return; }
      openConfirm(
        'Przywrócić kopię zapasową?',
        'Obecna baza danych zostanie zastąpiona danymi z kopii. Przed operacją powstanie kopia bezpieczeństwa.',
        function () {
          var fd = new FormData();
          fd.append('backup', file);
          restoreBtn.disabled = true;
          api('/api/settings/restore', { method: 'POST', body: fd }).then(function () {
            toast('Kopia zapasowa została przywrócona.', 'success');
            setTimeout(function () { window.location.reload(); }, 900);
          }).catch(function (err) {
            restoreBtn.disabled = false;
            toast(err.message || 'Nie udało się przywrócić kopii.', 'error');
          });
        }
      );
    });
  }

  // ---------- Invitations & accounts ----------
  var createInviteBtn = document.getElementById('createInviteBtn');
  if (createInviteBtn) {
    createInviteBtn.addEventListener('click', function () {
      createInviteBtn.disabled = true;
      api('/api/auth/invitations', { method: 'POST', body: {} }).then(function (res) {
        var link = res.invitation && res.invitation.link;
        var input = document.getElementById('inviteLink');
        if (input && link) {
          input.value = window.location.origin + link;
          input.focus();
          input.select();
          try { document.execCommand('copy'); } catch (e) {}
        }
        toast('Zaproszenie utworzone. Link skopiowano do schowka.', 'success');
      }).catch(function (err) {
        toast(err.message || 'Nie udało się utworzyć zaproszenia.', 'error');
      }).finally(function () {
        createInviteBtn.disabled = false;
      });
    });
  }

  document.addEventListener('click', function (e) {
    var block = e.target.closest('[data-block-user]');
    var unblock = e.target.closest('[data-unblock-user]');
    var del = e.target.closest('[data-delete-user]');

    if (block) {
      var blockId = block.getAttribute('data-block-user');
      api('/api/auth/users/' + blockId + '/block', { method: 'POST', body: {} }).then(function () {
        toast('Konto zostało zablokowane.', 'success');
        setTimeout(function () { window.location.reload(); }, 350);
      }).catch(function (err) { toast(err.message || 'Nie udało się zablokować konta.', 'error'); });
    }

    if (unblock) {
      var unblockId = unblock.getAttribute('data-unblock-user');
      api('/api/auth/users/' + unblockId + '/unblock', { method: 'POST', body: {} }).then(function () {
        toast('Konto zostało odblokowane.', 'success');
        setTimeout(function () { window.location.reload(); }, 350);
      }).catch(function (err) { toast(err.message || 'Nie udało się odblokować konta.', 'error'); });
    }

    if (del) {
      var userId = del.getAttribute('data-delete-user');
      openConfirm('Usunąć to konto?', 'Konto i jego prywatne dane zostaną usunięte. Tej operacji nie można cofnąć.', function () {
        api('/api/auth/users/' + userId, { method: 'DELETE' }).then(function () {
          toast('Konto zostało usunięte.', 'success');
          setTimeout(function () { window.location.reload(); }, 350);
        }).catch(function (err) { toast(err.message || 'Nie udało się usunąć konta.', 'error'); });
      });
    }
  });

  // ---------- Notes ----------
  var saveNotesBtn = document.getElementById('saveNotesBtn');
  if (saveNotesBtn) {
    saveNotesBtn.addEventListener('click', function () {
      var id = saveNotesBtn.getAttribute('data-id');
      var notesField = document.getElementById('notesField');
      if (!notesField) return;
      saveNotesBtn.disabled = true;
      api('/api/products/' + id, { method: 'PATCH', body: { notes: notesField.value } }).then(function () {
        toast('Notatki zostały zapisane.', 'success');
      }).catch(function (err) {
        toast(err.message || 'Nie udało się zapisać notatek.', 'error');
      }).finally(function () {
        saveNotesBtn.disabled = false;
      });
    });
  }

  var notesField = document.getElementById('notesField');
  if (notesField) {
    notesField.addEventListener('input', function () {
      var count = document.getElementById('notesCount');
      if (count) count.textContent = notesField.value.length + ' znaków';
    });
  }

  // ---------- Category modal ----------
  var CAT_COLORS = [
    '#C9A46A', '#D9A3B0', '#B7A5C9', '#8FAFC4', '#9DB8A4', '#C4A484',
    '#B4B8A5', '#E0A5A5', '#88B7B0', '#D6A878', '#A8A29E'
  ];
  var CAT_ICONS = [
    'tag', 'gem', 'sparkles', 'shirt', 'headphones', 'gamepad-2',
    'book-open', 'lamp', 'flower-2', 'ticket', 'cake-slice', 'gift'
  ];
  var catEditingId = null;
  var catSelectedColor = CAT_COLORS[1];
  var catSelectedIcon = 'tag';

  function normalizeIcon(name) {
    return String(name || 'tag').toLowerCase();
  }

  function renderCatSwatches() {
    var box = document.getElementById('catSwatches');
    if (!box) return;
    box.innerHTML = CAT_COLORS.map(function (color) {
      var selected = catSelectedColor === color ? ' selected' : '';
      return '<button type="button" class="swatch' + selected + '" style="background:' + color + '" data-cat-color="' + esc(color) + '" aria-label="Kolor ' + esc(color) + '"></button>';
    }).join('');
    $$('button', box).forEach(function (btn) {
      btn.addEventListener('click', function () {
        catSelectedColor = btn.getAttribute('data-cat-color');
        var hidden = document.getElementById('catColor');
        if (hidden) hidden.value = catSelectedColor;
        renderCatSwatches();
      });
    });
  }

  function renderCatIcons() {
    var box = document.getElementById('catIcons');
    if (!box) return;
    box.innerHTML = CAT_ICONS.map(function (name) {
      var selected = catSelectedIcon === name ? ' selected' : '';
      return '<button type="button" class="icon-option' + selected + '" data-cat-icon="' + esc(name) + '" aria-label="Ikona ' + esc(name) + '">' + iconSvg(name) + '</button>';
    }).join('');
    $$('button', box).forEach(function (btn) {
      btn.addEventListener('click', function () {
        catSelectedIcon = btn.getAttribute('data-cat-icon');
        var hidden = document.getElementById('catIcon');
        if (hidden) hidden.value = catSelectedIcon;
        renderCatIcons();
      });
    });
  }

  function openCategoryModal(category) {
    var modalEl = document.getElementById('categoryModal');
    if (!modalEl || modalEl.classList.contains('open')) return;
    catEditingId = category ? category.id : null;
    var nameEl = document.getElementById('catName');
    var colorEl = document.getElementById('catColor');
    var iconEl = document.getElementById('catIcon');
    var idEl = document.getElementById('catId');
    var title = document.getElementById('catModalTitle');
    var desc = document.getElementById('catModalDesc');
    var saveBtn = document.getElementById('catSave');

    catSelectedColor = category && category.color ? category.color : CAT_COLORS[1];
    catSelectedIcon = normalizeIcon(category ? category.icon : 'tag');

    if (nameEl) nameEl.value = category ? category.name : '';
    if (colorEl) colorEl.value = catSelectedColor;
    if (iconEl) iconEl.value = catSelectedIcon;
    if (idEl) idEl.value = category ? category.id : '';
    if (title) title.textContent = category ? 'Edytuj kategorię' : 'Nowa kategoria';
    if (desc) desc.textContent = category ? 'Zaktualizuj nazwę, kolor i ikonę.' : 'Wybierz nazwę, delikatny kolor i ikonę.';
    if (saveBtn) saveBtn.textContent = category ? 'Zapisz zmiany' : 'Utwórz kategorię';

    renderCatSwatches();
    renderCatIcons();
    modalEl.classList.add('open');
    syncModalLock();
    if (nameEl) setTimeout(function () { nameEl.focus(); }, 30);
  }

  function closeCategoryModal() {
    var modalEl = document.getElementById('categoryModal');
    if (modalEl) modalEl.classList.remove('open');
    catEditingId = null;
    syncModalLock();
  }

  var newCatBtn = document.getElementById('newCategoryBtn');
  var newCatBtn2 = document.getElementById('newCategoryBtn2');
  var catCancel = document.getElementById('catCancel');
  var catClose = document.getElementById('catClose');
  if (newCatBtn) newCatBtn.addEventListener('click', function () { openCategoryModal(null); });
  if (newCatBtn2) newCatBtn2.addEventListener('click', function () { openCategoryModal(null); });
  if (catCancel) catCancel.addEventListener('click', closeCategoryModal);
  if (catClose) catClose.addEventListener('click', closeCategoryModal);

  var categoryModalEl = document.getElementById('categoryModal');
  if (categoryModalEl) {
    categoryModalEl.addEventListener('click', function (e) {
      if (e.target === categoryModalEl) closeCategoryModal();
    });
  }

  var catSave = document.getElementById('catSave');
  if (catSave) {
    catSave.addEventListener('click', function () {
      var nameEl = document.getElementById('catName');
      var colorEl = document.getElementById('catColor');
      var iconEl = document.getElementById('catIcon');
      if (!nameEl || !nameEl.value.trim()) { toast('Nazwa kategorii jest wymagana.', 'error'); return; }
      var body = {
        name: nameEl.value.trim(),
        color: (colorEl ? colorEl.value : catSelectedColor) || catSelectedColor,
        icon: (iconEl ? iconEl.value : catSelectedIcon) || catSelectedIcon
      };
      catSave.disabled = true;
      var request = catEditingId
        ? api('/api/categories/' + catEditingId, { method: 'PATCH', body: body })
        : api('/api/categories', { method: 'POST', body: body });
      request.then(function () {
        toast(catEditingId ? 'Kategoria zaktualizowana.' : 'Kategoria utworzona.', 'success');
        closeCategoryModal();
        setTimeout(function () { window.location.reload(); }, 350);
      }).catch(function (err) {
        catSave.disabled = false;
        toast(err.message || 'Nie udało się zapisać kategorii.', 'error');
      });
    });
  }

  document.addEventListener('click', function (e) {
    var editBtn = e.target.closest('[data-edit-cat]');
    if (editBtn) {
      e.preventDefault();
      openCategoryModal({
        id: editBtn.getAttribute('data-edit-cat'),
        name: editBtn.getAttribute('data-name'),
        color: editBtn.getAttribute('data-color'),
        icon: editBtn.getAttribute('data-icon')
      });
    }

    var delBtn = e.target.closest('[data-delete-cat]');
    if (delBtn) {
      e.preventDefault();
      var id = delBtn.getAttribute('data-delete-cat');
      var name = delBtn.getAttribute('data-name') || 'tę kategorię';
      openConfirm(
        'Usunąć kategorię „' + name + '”?',
        'Usunięta zostanie tylko kategoria. Produkty i ich historia cen pozostaną bez zmian.',
        function () {
          api('/api/categories/' + id, { method: 'DELETE' }).then(function () {
            toast('Kategoria usunięta.', 'success');
            setTimeout(function () { window.location.reload(); }, 350);
          }).catch(function (err) { toast(err.message || 'Nie udało się usunąć kategorii.', 'error'); });
        }
      );
    }
  });

  function renderPriceChart() {
    var canvas = document.getElementById('priceChart');
    var empty = document.getElementById('priceChartEmpty');
    if (!canvas) return;
    var productId = canvas.getAttribute('data-product-id');
    if (!productId) return;

    var ctx = canvas.getContext('2d');
    var wrap = canvas.parentElement;
    var dpr = window.devicePixelRatio || 1;
    var rect = wrap.getBoundingClientRect();
    var w = Math.max(rect.width, 300);
    var h = Math.max(rect.height, 200);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    api('/api/products/' + productId + '/price-history').then(function (res) {
      var history = (res && res.history) || [];
      if (history.length === 0) {
        canvas.style.display = 'none';
        if (empty) empty.style.display = '';
        return;
      }
      canvas.style.display = '';
      if (empty) empty.style.display = 'none';

      var currentPrice = canvas.getAttribute('data-current-price');
      var originalPrice = canvas.getAttribute('data-original-price');
      var currency = canvas.getAttribute('data-currency') || 'PLN';

      var prices = history.map(function (p) { return p.price; });
      var allPrices = prices.slice();
      if (currentPrice !== null && currentPrice !== '') allPrices.push(parseFloat(currentPrice));
      if (originalPrice !== null && originalPrice !== '') allPrices.push(parseFloat(originalPrice));
      var pricesForMinMax = allPrices.length > 0 ? allPrices : prices;
      var min = Math.min.apply(null, pricesForMinMax);
      var max = Math.max.apply(null, pricesForMinMax);
      var range = max - min || 1;
      var pad = range * 0.2;
      min -= pad;
      max += pad;

      var padding = { top: 24, right: 120, bottom: 30, left: 40 };
      var plotW = w - padding.left - padding.right;
      var plotH = h - padding.top - padding.bottom;

      ctx.clearRect(0, 0, w, h);

      // Oś Y i etykiety
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') || '#89838b';
      var labels = [min, (min + max) / 2, max];
      labels.forEach(function (val, i) {
        var y = padding.top + plotH - ((val - min) / (max - min)) * plotH;
        ctx.fillText(val.toFixed(2), 4, y + 4);
        if (i < labels.length - 1) {
          ctx.beginPath();
          ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-color') || '#eee9ed';
          ctx.lineWidth = 1;
          ctx.moveTo(padding.left, y);
          ctx.lineTo(w - padding.right, y);
          ctx.stroke();
        }
      });

      // Etykiety dat na osi X
      var lastIndex = history.length - 1;
      var step = Math.max(1, Math.floor(history.length / 4));
      ctx.textAlign = 'center';
      history.forEach(function (p, i) {
        if (i % step !== 0 && i !== lastIndex) return;
        var x = lastIndex === 0 ? padding.left : padding.left + (i / lastIndex) * plotW;
        var d = new Date(p.recordedAt);
        var label = d.getDate() + '.' + (d.getMonth() + 1);
        ctx.fillText(label, x, h - 8);
      });

      // Linia ceny
      ctx.beginPath();
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary') || '#e9afc5';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      history.forEach(function (p, i) {
        var x = lastIndex === 0 ? padding.left : padding.left + (i / lastIndex) * plotW;
        var y = padding.top + plotH - ((p.price - min) / (max - min)) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Punkty
      history.forEach(function (p, i) {
        var x = lastIndex === 0 ? padding.left : padding.left + (i / lastIndex) * plotW;
        var y = padding.top + plotH - ((p.price - min) / (max - min)) * plotH;
        ctx.beginPath();
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface-bg') || '#fff';
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary') || '#e9afc5';
        ctx.lineWidth = 2;
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      // Jedna linia łączącą cenę pierwotną z obecną
      var cp = currentPrice !== null && currentPrice !== '' ? parseFloat(currentPrice) : null;
      var op = originalPrice !== null && originalPrice !== '' ? parseFloat(originalPrice) : null;

      function drawPriceLine(y1, y2, label1, label2, color) {
        if (y1 === null && y2 === null) return;
        if (y1 === null) y1 = y2;
        if (y2 === null) y2 = y1;
        var py1 = padding.top + plotH - ((y1 - min) / (max - min)) * plotH;
        var py2 = padding.top + plotH - ((y2 - min) / (max - min)) * plotH;
        if (py1 < padding.top) py1 = padding.top;
        if (py1 > padding.top + plotH) py1 = padding.top + plotH;
        if (py2 < padding.top) py2 = padding.top;
        if (py2 > padding.top + plotH) py2 = padding.top + plotH;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.moveTo(padding.left + 20, py1);
        ctx.lineTo(w - padding.right - 20, py2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.fillText(label1 + ' ' + y1.toFixed(2) + ' ' + currency, padding.left + 22, py1 - 8);
        ctx.fillText(label2 + ' ' + y2.toFixed(2) + ' ' + currency, w - padding.right - 100 - ctx.measureText(label2 + ' ' + y2.toFixed(2) + ' ' + currency).width, py2 + 16);
      }

      if (cp !== null && op !== null) {
        drawPriceLine(op, cp, 'Pierwotna:', 'Obecna:', '#e9afc5');
      } else if (cp !== null) {
        drawPriceLine(cp, cp, 'Obecna:', 'Obecna:', '#e9afc5');
      } else if (op !== null) {
        drawPriceLine(op, op, 'Cena:', 'Cena:', '#e9afc5');
      }
    }).catch(function (err) {
      console.error('Price chart error:', err);
      canvas.style.display = 'none';
      if (empty) {
        empty.style.display = '';
        empty.textContent = 'Błąd wczytywania historii: ' + (err.message || String(err));
      }
    });
  }

  document.addEventListener('click', function (e) {
  });

  // Inicjalizacja przy wczytywaniu strony
  (function initPageFeatures() {
    renderPriceChart();
  })();

  // Expose helpers for inline page scripts (np. groups.php).
  window.api = api;
  window.toast = toast;
  window.openConfirm = openConfirm;
})();
