<?php
/** @var string $content */
/** @var string $title */
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= e($title) ?></title>
  <link rel="stylesheet" href="<?= e(asset('css/app.css')) ?>">
  <script>
    (function () {
      try {
        var theme = localStorage.getItem('gv_theme');
        if (theme === 'dark') document.documentElement.classList.add('dark');
      } catch (e) {}
    })();
  </script>
</head>
<body>
<?= view_partial('partials/icons') ?>
<div class="auth-page">
  <div class="auth-theme">
    <button type="button" id="themeToggleAuth" aria-label="Toggle theme"><?= icon('moon') ?></button>
  </div>
  <div class="auth-shell">
    <div class="auth-brand">
      <div class="auth-brand-mark"><?= icon('vault') ?></div>
      <h1>Gift Vault</h1>
      <p>Personal collection</p>
    </div>
    <?= $content ?>
  </div>
</div>
<div class="flash-stack" id="flashStack">
<?php
$flash = $flash ?? null;
if (is_array($flash)):
  foreach ($flash as $item):
    $type = (string) ($item['type'] ?? 'info');
    $cls = $type === 'success' ? 'auth-success' : ($type === 'error' ? 'auth-error' : 'auth-note');
    $ic = $type === 'success' ? 'circle-check' : ($type === 'error' ? 'circle-alert' : 'info');
?>
    <div class="<?= e($cls) ?>">
      <?= icon($ic) ?>
      <span><?= e($item['message'] ?? '') ?></span>
    </div>
<?php endforeach; endif; ?>
</div>
<script>
  window.GV = { csrfToken: '<?= e(csrf_token()) ?>', user: null, settings: null };
</script>
<script src="<?= e(asset('js/app.js')) ?>" defer></script>
</body>
</html>