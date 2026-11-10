<div class="auth-card">
  <h2>Przyjmij zaproszenie</h2>
  <?php if (empty($valid)): ?>
    <div class="auth-error">
      <?= icon('circle-alert') ?>
      <span>To zaproszenie jest nieprawidłowe lub wygasło.</span>
    </div>
  <?php else: ?>
    <p class="auth-sub">Utwórz konto, aby dołączyć do tej kolekcji.</p>
    <form class="auth-form" method="post" action="<?= e(url('invite/' . rawurlencode($token))) ?>">
      <?= csrf_field() ?>
      <input type="hidden" name="token" value="<?= e($token) ?>">
      <div class="field">
        <label class="label" for="username">Nazwa użytkownika</label>
        <input class="input" id="username" name="username" type="text" minlength="3" maxlength="40" autocomplete="username" required>
      </div>
      <div class="field">
        <label class="label" for="email">E-mail</label>
        <input class="input" id="email" name="email" type="email" autocomplete="email" required>
      </div>
      <div class="field">
        <label class="label" for="password">Hasło</label>
        <input class="input" id="password" name="password" type="password" minlength="12" autocomplete="new-password" required>
        <span class="hint">Co najmniej 12 znaków.</span>
      </div>
      <button class="btn btn-block" type="submit">Utwórz konto</button>
    </form>
  <?php endif; ?>
</div>
