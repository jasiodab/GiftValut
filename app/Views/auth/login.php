<div class="auth-card">
  <h2>Sign in</h2>
  <p class="auth-sub">Welcome back. Enter your credentials to open your vault.</p>
  <?php if (!empty($needsSetup)): ?>
    <div class="auth-note">
      <?= icon('info') ?>
      <span>No owner account exists yet. <a href="<?= e(url('setup')) ?>">Create your vault</a> first.</span>
    </div>
  <?php endif; ?>
  <form class="auth-form" method="post" action="<?= e(url('login')) ?>">
    <?= csrf_field() ?>
    <input type="hidden" name="next" value="<?= e($next ?? '') ?>">
    <div class="field">
      <label class="label" for="username">Username or email</label>
      <input class="input" id="username" name="username" type="text" required autofocus>
    </div>
    <div class="field">
      <label class="label" for="password">Password</label>
      <input class="input" id="password" name="password" type="password" required>
    </div>
    <button class="btn btn-block" type="submit">Sign in</button>
  </form>
  <div class="auth-footer">
    Gift Vault runs on this device. Your data stays local.
  </div>
</div>