<div class="auth-card">
  <h2>Accept invitation</h2>
  <?php if (empty($valid)): ?>
    <div class="auth-error">
      <?= icon('circle-alert') ?>
      <span>This invitation is invalid or has expired.</span>
    </div>
  <?php else: ?>
    <p class="auth-sub">Create your account to join this vault.</p>
    <form class="auth-form" method="post" action="<?= e(url('invite/' . rawurlencode($token))) ?>">
      <?= csrf_field() ?>
      <input type="hidden" name="token" value="<?= e($token) ?>">
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
      </div>
      <button class="btn btn-block" type="submit">Create account</button>
    </form>
  <?php endif; ?>
</div>