<div class="auth-card">
  <h2>Zaloguj się</h2>
  <p class="auth-sub">Witaj ponownie. Podaj dane, aby otworzyć swoją kolekcję.</p>
  <?php if (!empty($needsSetup)): ?>
    <div class="auth-note">
      <?= icon('info') ?>
      <span>Nie ma jeszcze konta właściciela. <a href="<?= e(url('setup')) ?>">Utwórz swoją kolekcję</a>, aby zacząć.</span>
    </div>
  <?php endif; ?>
  <form class="auth-form" method="post" action="<?= e(url('login')) ?>">
    <?= csrf_field() ?>
    <input type="hidden" name="next" value="<?= e($next ?? '') ?>">
    <div class="field">
      <label class="label" for="username">Nazwa użytkownika lub e-mail</label>
      <input class="input" id="username" name="username" type="text" autocomplete="username" required autofocus>
    </div>
    <div class="field password-toggle">
      <label class="label" for="password">Hasło</label>
      <input class="input" id="password" name="password" type="password" autocomplete="current-password" required>
      <button class="btn-icon toggle-password" type="button" aria-label="Pokaż/ukryj hasło" title="Pokaż/ukryj hasło"><?= icon('eye') ?></button>
    </div>
    <button class="btn btn-block" type="submit">Zaloguj się</button>
  </form>
  <div class="auth-footer">
    Gift Vault działa na tym urządzeniu. Twoje dane pozostają lokalne.
  </div>
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
