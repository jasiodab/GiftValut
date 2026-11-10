<div class="error-page">
  <div class="panel error-card">
    <div class="error-icon"><?= icon('circle-alert') ?></div>
    <div class="error-eyebrow"><?= e((string) ($status ?? 500)) ?></div>
    <h1>Coś poszło nie tak</h1>
    <p><?= e($message ?? 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.') ?></p>
    <div class="error-actions">
      <a class="btn btn-outline btn-sm" href="<?= e(url('/')) ?>">Wróć do panelu</a>
    </div>
  </div>
</div>
