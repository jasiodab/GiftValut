<div class="error-page">
  <div class="panel error-card">
    <div class="error-icon"><?= icon('circle-help') ?></div>
    <div class="error-eyebrow">404</div>
    <h1>Nie znaleziono strony</h1>
    <p><?= e($message ?? 'Strona, której szukasz, nie istnieje.') ?></p>
    <div class="error-actions">
      <a class="btn btn-outline btn-sm" href="<?= e(url('/')) ?>">Wróć do panelu</a>
    </div>
  </div>
</div>
