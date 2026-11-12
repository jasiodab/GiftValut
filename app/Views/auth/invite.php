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
      <div class="field password-toggle">
        <label class="label" for="password">Hasło</label>
        <input class="input" id="password" name="password" type="password" minlength="12" autocomplete="new-password" required>
        <span class="hint">Co najmniej 12 znaków.</span>
        <button class="btn-icon toggle-password" type="button" aria-label="Pokaż/ukryj hasło" title="Pokaż/ukryj hasło"><?= icon('eye') ?></button>
      </div>
      <button class="btn btn-block" type="submit">Utwórz konto</button>
    </form>
  <?php endif; ?>
</div>

<script>
  document.addEventListener('DOMContentLoaded', function () {
    'use strict';
    document.querySelectorAll('.toggle-password').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var field = btn.closest('.password-toggle');
        if (!field) return;
        var input = field.querySelector('input');
        if (!input) return;
        var showing = input.getAttribute('type') === 'text';
        input.setAttribute('type', showing ? 'password' : 'text');
        btn.innerHTML = showing ? '<?= icon('eye') ?>' : '<?= icon('eye-off') ?>';
        btn.setAttribute('aria-pressed', showing ? 'false' : 'true');
        btn.setAttribute('title', showing ? 'Pokaż hasło' : 'Ukryj hasło');
      });
    });
  });
</script>
