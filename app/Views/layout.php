<?php
/** @var string $content */
/** @var string $title */
/** @var string $activeNav */
/** @var mixed $flash */
$user = $user ?? null;
$metaProductCount = 0;
$databaseStatus = 'connected';
?>
<!DOCTYPE html>
<html lang="en" class="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= e($title) ?></title>
  <link rel="stylesheet" href="<?= e(asset('css/app.css') . '?v=c59e4af') ?>">
  <link rel="preload" href="<?= e(asset('fonts/inter-latin-wght-normal.woff2')) ?>" as="font" type="font/woff2" crossorigin>
  <script>
    (function () {
      try {
        var theme = localStorage.getItem('gv_theme');
        if (theme === 'dark') document.documentElement.classList.add('dark');
        if (theme === 'light') document.documentElement.classList.remove('dark');
      } catch (e) {}
    })();
  </script>
</head>
<body>
<?= view_partial('partials/icons') ?>
<div class="app">
  <div class="sidebar-backdrop" id="sidebarBackdrop"></div>
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-inner">
      <div class="sidebar-brand">
        <a class="brand-link" href="<?= e(url('/')) ?>">
          <div class="brand-mark"><?= icon('vault') ?><span></span></div>
          <div>
            <div class="brand-name">Gift Vault</div>
            <div class="brand-tag">Personal collection</div>
          </div>
        </a>
        <button class="sidebar-close" type="button" id="sidebarClose" aria-label="Close navigation"><?= icon('x') ?></button>
      </div>
      <div class="sidebar-quick">
        <button class="quick-add" type="button" id="quickAddBtn" aria-label="Quick add product">
          <div class="quick-add-label"><?= icon('plus') ?> <span>Quick add product</span></div>
          <?= icon('arrow-up-right') ?>
        </button>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-label">Workspace</div>
        <a class="nav-item <?= is_nav_active($activeNav, 'dashboard') ? 'active' : '' ?>" href="<?= e(url('/')) ?>">
          <?= icon('layout-dashboard') ?><span>Dashboard</span>
        </a>
        <a class="nav-item <?= is_nav_active($activeNav, 'products') ? 'active' : '' ?>" href="<?= e(url('/products')) ?>">
          <?= icon('shopping-bag') ?><span>All Products</span>
        </a>
        <a class="nav-item <?= is_nav_active($activeNav, 'categories') ? 'active' : '' ?>" href="<?= e(url('/categories')) ?>">
          <?= icon('tags') ?><span>Categories</span>
        </a>
        <div class="collection-card">
          <div class="collection-card-top"><?= icon('folder-heart') ?> <span>Your collection</span></div>
          <div class="collection-card-value">
            <div><strong id="collectionCount">0</strong> <small>products saved</small></div>
            <?= icon('gift') ?>
          </div>
          <p>A quiet place for every gift idea, price drop and thoughtful find.</p>
        </div>
      </nav>
      <div class="sidebar-footer">
        <a class="nav-item <?= is_nav_active($activeNav, 'settings') ? 'active' : '' ?>" href="<?= e(url('/settings')) ?>">
          <?= icon('settings') ?><span>Settings</span>
        </a>
        <button class="theme-toggle" type="button" id="themeToggle" aria-label="Toggle theme">
          <?= icon('moon') ?><span id="themeLabel">Dark mode</span>
        </button>
        <div class="db-status">
          <div class="db-status-left">
            <span class="dot dot-success"></span>
            <div>
              <div class="db-status-title">Local database</div>
              <div class="db-status-sub">Connected · stored on this device</div>
            </div>
          </div>
          <div class="db-status-version">v2.0</div>
        </div>
        <?php if ($user): ?>
        <div class="sidebar-user">
          <div class="avatar"><?= e(initials((string) ($user['username'] ?? ''))) ?></div>
          <div class="sidebar-user-info">
            <div class="sidebar-user-name"><?= e($user['username'] ?? '') ?></div>
            <div class="sidebar-user-role"><?= e(strtolower((string) ($user['role'] ?? 'user'))) ?></div>
          </div>
          <form class="logout-form" method="post" action="<?= e(url('/logout')) ?>">
            <?= csrf_field() ?>
            <button class="logout-btn" type="submit" aria-label="Sign out"><?= icon('log-out') ?></button>
          </form>
        </div>
        <?php endif; ?>
      </div>
    </div>
  </aside>

  <div class="main">
    <div class="mobile-header">
      <div class="mobile-header-left">
        <button class="mobile-menu-btn" type="button" id="mobileMenuBtn" aria-label="Open navigation"><?= icon('menu') ?></button>
        <div class="mobile-brand">
          <div class="mobile-brand-mark"><?= icon('vault') ?></div>
          <span class="mobile-brand-name">Gift Vault</span>
        </div>
      </div>
    </div>
    <main class="content">
      <div class="page">
        <?= $content ?>
      </div>
    </main>
  </div>
</div>

<div class="bottom-nav">
  <div class="bottom-nav-inner">
    <a class="bottom-nav-item <?= is_nav_active($activeNav, 'dashboard') ? 'active' : '' ?>" href="<?= e(url('/')) ?>"><?= icon('home') ?><span>Home</span></a>
    <a class="bottom-nav-item <?= is_nav_active($activeNav, 'products') ? 'active' : '' ?>" href="<?= e(url('/products')) ?>"><?= icon('shopping-bag') ?><span>Products</span></a>
    <button class="bottom-nav-add" type="button" id="quickAddBtn2" aria-label="Quick add product"><span><?= icon('plus') ?></span><span>Add</span></button>
    <a class="bottom-nav-item <?= is_nav_active($activeNav, 'categories') ? 'active' : '' ?>" href="<?= e(url('/categories')) ?>"><?= icon('tags') ?><span>Categories</span></a>
    <a class="bottom-nav-item <?= is_nav_active($activeNav, 'settings') ? 'active' : '' ?>" href="<?= e(url('/settings')) ?>"><?= icon('settings') ?><span>Settings</span></a>
  </div>
</div>

<div class="flash-stack" id="flashStack">
<?php if (is_array($flash)): ?>
  <?php foreach ($flash as $item): ?>
    <?php
    $type = (string) ($item['type'] ?? 'info');
    $cls = $type === 'success' ? 'flash-success' : ($type === 'error' ? 'flash-error' : 'flash-info');
    $ic = $type === 'success' ? 'circle-check' : ($type === 'error' ? 'circle-alert' : 'info');
    ?>
    <div class="flash <?= e($cls) ?>">
      <?= icon($ic) ?>
      <span><?= e($item['message'] ?? '') ?></span>
      <button class="flash-close" type="button" onclick="this.parentElement.remove()"><?= icon('x') ?></button>
    </div>
  <?php endforeach; ?>
<?php endif; ?>
</div>

<!-- Product form modal -->
<div class="modal" id="productModal">
  <div class="modal-dialog form-modal wide">
    <div class="modal-header">
      <div class="modal-header-row">
        <div>
          <div class="modal-eyebrow" id="pfEyebrow">New addition</div>
          <h2 id="pfTitle">Add to your vault</h2>
          <p id="pfDesc">Paste a store link and we’ll try to fill in the details.</p>
        </div>
        <button class="modal-close" type="button" id="pfClose"><?= icon('x') ?></button>
      </div>
    </div>
    <div class="modal-scroll">
      <div class="modal-form-body" id="pfBody">
        <!-- rendered by JS -->
      </div>
    </div>
    <div class="modal-footer">
      <span class="modal-footer-hint" id="pfHint"><?= icon('sparkles') ?> Review extracted details before saving</span>
      <button class="btn btn-outline btn-sm" type="button" id="pfCancel">Cancel</button>
      <button class="btn btn-sm" type="button" id="pfSave">Add product</button>
    </div>
  </div>
</div>

<!-- Confirm dialog -->
<div class="modal" id="confirmModal">
  <div class="modal-dialog confirm-dialog">
    <div class="modal-header">
      <div class="confirm-head">
        <div class="confirm-icon"><?= icon('trash-2') ?></div>
        <div>
          <h2 id="confirmTitle">Confirm</h2>
          <p id="confirmDesc"></p>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline btn-sm" type="button" id="confirmCancel">Cancel</button>
      <button class="btn btn-destructive btn-sm" type="button" id="confirmOk">Confirm</button>
    </div>
  </div>
</div>

<script>
  window.GV = {
    csrfToken: '<?= e(csrf_token()) ?>',
    user: <?= json_encode($user, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>,
    settings: null
  };
</script>
<script src="<?= e(asset('js/app.js') . '?v=c59e4af') ?>" defer></script>
</body>
</html>