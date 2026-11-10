<div class="auth-card">
  <h2>Utwórz swoją kolekcję</h2>
  <p class="auth-sub">Skonfiguruj konto właściciela tej instalacji Gift Vault.</p>
  <form class="auth-form" method="post" action="<?= e(url('setup')) ?>">
    <?= csrf_field() ?>
    <div class="field">
      <label class="label" for="setupKey">Klucz konfiguracyjny</label>
      <input class="input" id="setupKey" name="setupKey" type="text" autocomplete="off" required>
      <span class="hint">Znajdziesz go w zmiennej OWNER_SETUP_KEY w pliku .env</span>
    </div>
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
    <button class="btn btn-block" type="submit">Utwórz kolekcję</button>
  </form>
</div>
