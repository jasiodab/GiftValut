<div class="error-page">
  <div class="card error-card">
    <div class="error-icon"><?= icon('circle-help') ?></div>
    <div class="error-eyebrow">404</div>
    <h1>Page not found</h1>
    <p><?= e($message ?? 'The page you are looking for does not exist.') ?></p>
    <div class="error-actions">
      <a class="btn btn-outline btn-sm" href="<?= e(url('/')) ?>">Go home</a>
    </div>
  </div>
</div>