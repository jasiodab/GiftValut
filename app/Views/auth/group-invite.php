<?php
$roleLabels = [
    'OWNER' => 'Właściciel',
    'ADMIN' => 'Administrator',
    'CONTRIBUTOR' => 'Współtwórca',
    'EDITOR' => 'Edytor',
    'VIEWER' => 'Obserwator',
];
?>
<div class="auth-card">
  <h2><?= $valid ? 'Dołącz do grupy' : 'Zaproszenie do grupy' ?></h2>

  <?php if (!$valid): ?>
    <div class="auth-error">
      <?= icon('circle-alert') ?>
      <span>To zaproszenie jest nieprawidłowe lub wygasło.</span>
    </div>
  <?php elseif ($alreadyMember): ?>
    <div class="auth-error">
      <?= icon('alert-circle') ?>
      <span>Jesteś już członkiem grupy „<?= e($group['name']) ?>”.</span>
    </div>
    <div class="auth-actions mt-3">
      <a class="btn btn-block" href="<?= e(url('/groups')) ?>"><?= icon('arrow-right') ?> Przejdź do grup</a>
    </div>
  <?php else: ?>
    <p class="auth-sub">Zaproszenie do grupy <strong><?= e($group['name']) ?></strong>.</p>
    <p class="auth-sub">
      Rola: <?= e($roleLabels[$invitation['role']] ?? $invitation['role']) ?> ·
      ważne do <?= e(format_date($invitation['expiresAt'] ?? null)) ?>
    </p>

    <form class="auth-form" method="post" action="<?= e(url('invite-group/' . rawurlencode($token) . '/accept')) ?>">
      <?= csrf_field() ?>
      <input type="hidden" name="token" value="<?= e($token) ?>">
      <button class="btn btn-block" type="submit"><?= icon('user-plus') ?> Dołącz do grupy</button>
    </form>

    <form class="auth-form mt-3" method="post" action="<?= e(url('invite-group/' . rawurlencode($token) . '/decline')) ?>">
      <?= csrf_field() ?>
      <input type="hidden" name="token" value="<?= e($token) ?>">
      <button class="btn btn-outline btn-block" type="submit"><?= icon('x') ?> Odrzuć zaproszenie</button>
    </form>
  <?php endif; ?>
</div>
