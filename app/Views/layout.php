<?php
/** @var string $content */
/** @var string $title */
/** @var string $activeNav */
/** @var mixed $flash */
$user = $user ?? null;
?>
<!DOCTYPE html>
<html lang="pl" class="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title><?= e($title) ?></title>
  <link rel="stylesheet" href="<?= e(asset('css/app.css')) ?>">
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
  <aside class="sidebar" id="sidebar" aria-label="Nawigacja główna">
    <div class="sidebar-inner">
      <div class="sidebar-brand">
        <a class="brand-link" href="<?= e(url('/')) ?>">
          <span class="brand-mark"><?= icon('vault') ?></span>
          <span class="brand-name">Gift Vault</span>
        </a>
        <button class="sidebar-close" type="button" id="sidebarClose" aria-label="Zamknij nawigację"><?= icon('x') ?></button>
      </div>

      <button class="btn btn-block" type="button" id="quickAddBtn">
        <?= icon('plus') ?> Dodaj produkt
      </button>

      <nav class="sidebar-nav">
        <a class="nav-item <?= is_nav_active($activeNav, 'dashboard') ? 'active' : '' ?>" href="<?= e(url('/')) ?>">
          <?= icon('layout-dashboard') ?><span>Panel</span>
        </a>
        <a class="nav-item <?= is_nav_active($activeNav, 'products') ? 'active' : '' ?>" href="<?= e(url('/products')) ?>">
          <?= icon('shopping-bag') ?><span>Produkty</span>
        </a>
        <a class="nav-item <?= is_nav_active($activeNav, 'categories') ? 'active' : '' ?>" href="<?= e(url('/categories')) ?>">
          <?= icon('tags') ?><span>Kategorie</span>
        </a>
        <a class="nav-item <?= is_nav_active($activeNav, 'groups') ? 'active' : '' ?>" href="<?= e(url('/groups')) ?>">
          <?= icon('users') ?><span>Grupy</span>
        </a>
        <a class="nav-item <?= is_nav_active($activeNav, 'cart') ? 'active' : '' ?>" href="<?= e(url('/cart')) ?>">
          <?= icon('shopping-cart') ?><span>Koszyk</span>
        </a>
      </nav>

      <div class="sidebar-footer">
        <a class="nav-item <?= is_nav_active($activeNav, 'settings') ? 'active' : '' ?>" href="<?= e(url('/settings')) ?>">
          <?= icon('settings') ?><span>Ustawienia</span>
        </a>
        <button class="theme-toggle" type="button" id="themeToggle" aria-label="Przełącz motyw">
          <?= icon('moon', 'icon icon-moon') ?>
          <?= icon('sun', 'icon icon-sun') ?>
          <span id="themeLabel">Tryb ciemny</span>
        </button>
        <?php if ($user): ?>
        <div class="user-chip">
          <span class="avatar"><?= e(initials((string) ($user['username'] ?? ''))) ?></span>
          <div class="user-chip-info">
            <div class="user-chip-name"><?= e($user['username'] ?? '') ?></div>
            <div class="user-chip-role"><?= ($user['role'] ?? '') === 'OWNER' ? 'Właściciel' : 'Użytkownik' ?></div>
          </div>
          <form class="logout-form" method="post" action="<?= e(url('/logout')) ?>">
            <?= csrf_field() ?>
            <button class="logout-btn" type="submit" aria-label="Wyloguj się" title="Wyloguj się"><?= icon('log-out') ?></button>
          </form>
        </div>
        <?php endif; ?>
      </div>
    </div>
  </aside>

  <div class="main">
    <div class="mobile-header">
      <div class="mobile-header-left">
        <button class="mobile-menu-btn" type="button" id="mobileMenuBtn" aria-label="Otwórz nawigację"><?= icon('menu') ?></button>
        <a class="mobile-brand" href="<?= e(url('/')) ?>">
          <span class="mobile-brand-mark"><?= icon('vault') ?></span>
          <span class="mobile-brand-name">Gift Vault</span>
        </a>
      </div>
      <button class="mobile-add-btn" type="button" id="quickAddBtn2" aria-label="Dodaj produkt"><?= icon('plus') ?></button>
    </div>

    <main class="content">
      <div class="page">
        <?= $content ?>
      </div>
    </main>
  </div>
</div>

<nav class="bottom-nav" aria-label="Nawigacja mobilna">
  <div class="bottom-nav-inner">
    <a class="bottom-nav-item <?= is_nav_active($activeNav, 'dashboard') ? 'active' : '' ?>" href="<?= e(url('/')) ?>"><?= icon('layout-dashboard') ?><span>Panel</span></a>
    <a class="bottom-nav-item <?= is_nav_active($activeNav, 'products') ? 'active' : '' ?>" href="<?= e(url('/products')) ?>"><?= icon('shopping-bag') ?><span>Produkty</span></a>
    <a class="bottom-nav-item <?= is_nav_active($activeNav, 'categories') ? 'active' : '' ?>" href="<?= e(url('/categories')) ?>"><?= icon('tags') ?><span>Kategorie</span></a>
    <a class="bottom-nav-item <?= is_nav_active($activeNav, 'groups') ? 'active' : '' ?>" href="<?= e(url('/groups')) ?>"><?= icon('users') ?><span>Grupy</span></a>
    <a class="bottom-nav-item <?= is_nav_active($activeNav, 'cart') ? 'active' : '' ?>" href="<?= e(url('/cart')) ?>"><?= icon('shopping-cart') ?><span>Koszyk</span></a>
    <a class="bottom-nav-item <?= is_nav_active($activeNav, 'settings') ? 'active' : '' ?>" href="<?= e(url('/settings')) ?>"><?= icon('settings') ?><span>Ustawienia</span></a>
  </div>
</nav>

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
      <button class="flash-close" type="button" onclick="this.parentElement.remove()" aria-label="Zamknij"><?= icon('x') ?></button>
    </div>
  <?php endforeach; ?>
<?php endif; ?>
</div>

<!-- Modal dodawania / edycji produktu -->
<div class="modal" id="productModal" role="dialog" aria-modal="true" aria-labelledby="pfTitle">
  <div class="modal-dialog wide">
    <div class="modal-header">
      <div class="modal-header-row">
        <div>
          <div class="form-section-title" id="pfEyebrow" style="margin-bottom:4px">Nowy produkt</div>
          <h2 class="modal-title" id="pfTitle">Dodaj do swojej kolekcji</h2>
          <p class="modal-desc" id="pfDesc">Wklej link do sklepu — spróbujemy uzupełnić szczegóły.</p>
        </div>
        <button class="modal-close" type="button" id="pfClose" aria-label="Zamknij"><?= icon('x') ?></button>
      </div>
    </div>
    <div class="modal-scroll">
      <div class="modal-form-body" id="pfBody">
        <!-- renderowane przez JS -->
      </div>
    </div>
    <div class="modal-footer">
      <span class="modal-footer-hint" id="pfHint"><?= icon('sparkles') ?> Sprawdź dane przed zapisaniem</span>
      <button class="btn btn-outline btn-sm" type="button" id="pfBack" style="display:none">Wstecz</button>
      <button class="btn btn-ghost btn-sm" type="button" id="pfCancel">Anuluj</button>
      <button class="btn btn-sm" type="button" id="pfNext">Dalej</button>
      <button class="btn btn-sm" type="button" id="pfSave" style="display:none">Dodaj produkt</button>
    </div>
  </div>
</div>

<!-- Potwierdzenie -->
<div class="modal" id="confirmModal" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
  <div class="modal-dialog confirm-dialog">
    <div class="modal-header">
      <div class="confirm-head">
        <div class="confirm-icon"><?= icon('trash-2') ?></div>
        <div>
          <h2 class="modal-title" id="confirmTitle">Potwierdź</h2>
          <p class="modal-desc" id="confirmDesc"></p>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline btn-sm" type="button" id="confirmCancel">Anuluj</button>
      <button class="btn btn-danger btn-sm" type="button" id="confirmOk">Usuń</button>
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
<script src="<?= e(asset('js/app.js')) ?>" defer></script>
</body>
</html>
