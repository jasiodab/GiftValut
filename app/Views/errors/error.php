<div class="error-page">
  <div class="card error-card">
    <div class="error-icon"><?= icon('circle-alert') ?></div>
    <div class="error-eyebrow"><?= e((string) ($status ?? 500)) ?></div>
    <h1>Something went wrong</h1>
    <p><?= e($message ?? 'An unexpected error occurred.') ?></p>
    <div class="error-actions">
      <a class="btn btn-outline btn-sm" href="<?= e(url('/')) ?>">Go home</a>
    </div>
  </div>
</div>