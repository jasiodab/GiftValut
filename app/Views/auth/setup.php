<div class="auth-card">
  <h2>Create your vault</h2>
  <p class="auth-sub">Set up the owner account for this Gift Vault instance.</p>
  <form class="auth-form" method="post" action="<?= e(url('setup')) ?>">
    <?= csrf_field() ?>
    <div class="field">
      <label class="label" for="setupKey">Setup key</label>
      <input class="input" id="setupKey" name="setupKey" type="text" required>
      <span class="hint">From OWNER_SETUP_KEY in .env</span>
    </div>
    <div class="field">
      <label class="label" for="username">Username</label>
      <input class="input" id="username" name="username" type="text" minlength="3" maxlength="40" required>
    </div>
    <div class="field">
      <label class="label" for="email">Email</label>
      <input class="input" id="email" name="email" type="email" required>
    </div>
    <div class="field">
      <label class="label" for="password">Password</label>
      <input class="input" id="password" name="password" type="password" minlength="12" required>
      <span class="hint">At least 12 characters.</span>
    </div>
    <button class="btn btn-block" type="submit">Create vault</button>
  </form>
</div>