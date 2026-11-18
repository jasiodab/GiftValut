<?php
$message = trim((string) ($message ?? ''));
?>
<div class="error-page">
  <div class="panel error-card">
    <div class="error-icon"><?= icon('circle-help') ?></div>
    <div class="error-eyebrow">404</div>
    <h1>Nie znaleziono strony</h1>
    <p><?= e($message !== '' ? $message : 'Strona, której szukasz, nie istnieje lub została przeniesiona.') ?></p>
    <div class="error-actions">
      <a class="btn btn-outline btn-sm" href="<?= e(url('/')) ?>">Wróć na stronę główną</a>
      <a class="btn btn-ghost btn-sm" href="<?= e(url('/products')) ?>">Przejdź do produktów</a>
    </div>
  </div>
</div>
