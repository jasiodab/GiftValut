<?php
$status = (int) ($status ?? 500);
$message = trim((string) ($message ?? ''));
$titles = [
  400 => 'Nieprawidłowe żądanie',
  403 => 'Brak dostępu',
  429 => 'Zbyt wiele prób',
  500 => 'Coś poszło nie tak',
  503 => 'Chwilowa przerwa',
];
$defaults = [
  400 => 'Żądanie nie mogło zostać przetworzone. Sprawdź dane i spróbuj ponownie.',
  403 => 'Nie masz uprawnień do wyświetlenia tej strony lub wykonania tej akcji.',
  429 => 'Wykonano zbyt wiele prób w krótkim czasie. Odczekaj chwilę i spróbuj ponownie.',
  500 => 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.',
  503 => 'Gift Vault jest chwilowo niedostępny. Spróbuj ponownie za moment.',
];
$titleText = $titles[$status] ?? 'Wystąpił błąd';
$messageText = $message !== '' ? $message : ($defaults[$status] ?? 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.');
$iconName = in_array($status, [403, 429], true) ? 'shield-alert' : 'circle-alert';
?>
<div class="error-page">
  <div class="panel error-card">
    <div class="error-icon"><?= icon($iconName) ?></div>
    <div class="error-eyebrow"><?= e((string) $status) ?></div>
    <h1><?= e($titleText) ?></h1>
    <p><?= e($messageText) ?></p>
    <div class="error-actions">
      <a class="btn btn-outline btn-sm" href="<?= e(url('/')) ?>">Wróć na stronę główną</a>
      <button class="btn btn-ghost btn-sm" type="button" onclick="window.location.reload()">Odśwież</button>
    </div>
  </div>
</div>
