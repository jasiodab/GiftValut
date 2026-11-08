<?php
$s = $settings;
$db = $database;
$app = $appInfo ?? [];
$users = $users ?? [];
$invitations = $invitations ?? [];
$backups = $backups ?? [];
?>
<div class="page-header">
  <div>
    <div class="eyebrow">Vault</div>
    <h1 class="page-title">Settings</h1>
    <p class="page-desc">Everything lives on this device. Adjust how your vault looks and behaves.</p>
  </div>
</div>

<div class="settings-grid">
  <div class="settings-col">
    <div class="card">
      <div class="settings-head">
        <div class="settings-head-icon"><?= icon('settings-2') ?></div>
        <div>
          <h2>Preferences</h2>
          <p>Currency, default view and tracking.</p>
        </div>
      </div>
      <div class="settings-body">
        <form id="settingsForm">
          <?= csrf_field() ?>
          <div class="form-grid">
            <div class="field">
              <label class="label" for="currency">Currency</label>
              <select class="select" id="currency" name="currency">
                <?php foreach (['PLN','EUR','USD','GBP','CHF','CZK','SEK','NOK','DKK','HUF','UAH'] as $cur): ?>
                  <option value="<?= e($cur) ?>" <?= $s['currency'] === $cur ? 'selected' : '' ?>><?= e($cur) ?></option>
                <?php endforeach; ?>
              </select>
            </div>
            <div class="field">
              <label class="label" for="defaultProductView">Default view</label>
              <select class="select" id="defaultProductView" name="defaultProductView">
                <option value="grid" <?= $s['defaultProductView'] === 'grid' ? 'selected' : '' ?>>Grid</option>
                <option value="list" <?= $s['defaultProductView'] === 'list' ? 'selected' : '' ?>>List</option>
              </select>
            </div>
          </div>
          <div class="pref-actions mt-4">
            <button class="btn btn-sm" type="button" id="saveSettingsBtn"><?= icon('save') ?> Save preferences</button>
          </div>
        </form>
      </div>
    </div>

    <div class="card">
      <div class="settings-head">
        <div class="settings-head-icon"><?= icon('lock') ?></div>
        <div>
          <h2>Account</h2>
          <p>Change your password.</p>
        </div>
      </div>
      <div class="settings-body">
        <form method="post" action="<?= e(url('/settings/password')) ?>" id="passwordForm">
          <?= csrf_field() ?>
          <div class="field">
            <label class="label" for="currentPassword">Current password</label>
            <input class="input" id="currentPassword" name="currentPassword" type="password">
          </div>
          <div class="field mt-3">
            <label class="label" for="newPassword">New password</label>
            <input class="input" id="newPassword" name="newPassword" type="password" minlength="12">
          </div>
          <div class="pref-actions mt-4">
            <button class="btn btn-sm" type="submit"><?= icon('save') ?> Update password</button>
          </div>
        </form>
      </div>
    </div>

    <?php if ($isOwner): ?>
    <div class="card">
      <div class="settings-head">
        <div class="settings-head-icon"><?= icon('users') ?></div>
        <div>
          <h2>Accounts</h2>
          <p>Invite and manage user accounts.</p>
        </div>
      </div>
      <div class="settings-body">
        <div class="field">
          <label class="label">Invite an account</label>
          <div class="invite-link-row">
            <input class="input" id="inviteLink" type="text" readonly placeholder="Create an invitation link">
            <button class="btn btn-sm" type="button" id="createInviteBtn"><?= icon('send') ?> Create</button>
          </div>
          <span class="hint">The link expires in 48 hours and can be used once. Share it privately.</span>
        </div>
        <div class="invite-list" id="inviteList">
          <?php foreach ($invitations as $inv): ?>
            <div class="invite-item">
              <span><?= e($inv['id']) ?></span>
              <span>expires <?= e(format_datetime($inv['expiresAt'])) ?></span>
            </div>
          <?php endforeach; ?>
        </div>

        <div class="mt-4">
          <?php foreach ($users as $u): ?>
            <div class="account-card">
              <div class="avatar"><?= e(initials($u['username'])) ?></div>
              <div class="account-body">
                <div class="account-name">
                  <?= e($u['username']) ?>
                  <span class="badge <?= $u['role'] === 'OWNER' ? 'badge-primary' : 'badge-muted' ?>"><?= e($u['role']) ?></span>
                  <span class="badge <?= $u['status'] === 'ACTIVE' ? 'badge-success' : 'badge-danger' ?>"><?= e($u['status']) ?></span>
                </div>
                <div class="account-meta"><?= e($u['email']) ?> · joined <?= e(format_date($u['createdAt'])) ?></div>
                <div class="account-actions">
                  <?php if ($u['status'] === 'ACTIVE'): ?>
                    <button class="btn btn-outline btn-xs" type="button" data-block-user="<?= e($u['id']) ?>">Block</button>
                  <?php else: ?>
                    <button class="btn btn-outline btn-xs" type="button" data-unblock-user="<?= e($u['id']) ?>">Unblock</button>
                  <?php endif; ?>
                  <?php if ($u['id'] !== ($user['id'] ?? '')): ?>
                    <button class="btn btn-destructive btn-xs" type="button" data-delete-user="<?= e($u['id']) ?>">Delete</button>
                  <?php endif; ?>
                </div>
              </div>
            </div>
          <?php endforeach; ?>
        </div>
      </div>
    </div>
    <?php endif; ?>
  </div>

  <div class="settings-col">
    <?php if ($isOwner): ?>
    <div class="card">
      <div class="settings-head">
        <div class="settings-head-icon"><?= icon('archive') ?></div>
        <div>
          <h2>Backups</h2>
          <p>Create, download and restore backups.</p>
        </div>
      </div>
      <div class="settings-body">
        <div class="backup-cta">
          <div class="backup-cta-left">
            <div class="backup-cta-icon"><?= icon('database') ?></div>
            <div>
              <strong>Create a fresh backup</strong>
              <small>Last backup: <?= $s['lastBackupAt'] ? e(format_datetime($s['lastBackupAt'])) : 'Never' ?></small>
            </div>
          </div>
          <div class="pref-actions">
            <button class="btn btn-sm" type="button" id="createBackupBtn"><?= icon('download') ?> Create backup</button>
          </div>
        </div>
        <div class="backup-list-head mt-3">
          <p>Stored backups</p>
          <span>Up to 12 kept</span>
        </div>
        <div class="backup-list" id="backupList">
          <?php if (empty($backups)): ?>
            <div class="backup-empty">No backups yet.</div>
          <?php else: ?>
            <?php foreach ($backups as $b): ?>
              <div class="backup-item">
                <?= icon('file-archive') ?>
                <div class="backup-item-body">
                  <div class="backup-item-name"><?= e($b['filename']) ?></div>
                  <div class="backup-item-meta"><?= e(format_bytes($b['size'])) ?> · <?= e(format_datetime($b['createdAt'])) ?></div>
                </div>
                <a class="btn btn-outline btn-xs" href="<?= e(url('/api/settings/backups/' . urlencode($b['filename']))) ?>">Download</a>
              </div>
            <?php endforeach; ?>
          <?php endif; ?>
        </div>
        <div class="mt-4">
          <label class="label" for="restoreFile">Restore from a backup</label>
          <div class="invite-link-row">
            <input class="input" id="restoreFile" type="file" accept=".zip">
            <button class="btn btn-outline btn-sm" type="button" id="restoreBtn"><?= icon('upload') ?> Restore</button>
          </div>
          <span class="hint">Restoring replaces the current database. A safety backup is created first.</span>
        </div>
      </div>
    </div>
    <?php endif; ?>

    <div class="card">
      <div class="settings-head">
        <div class="settings-head-icon"><?= icon('hard-drive') ?></div>
        <div>
          <h2>Local storage</h2>
          <p>Where your data lives.</p>
        </div>
      </div>
      <div class="settings-body">
        <div class="storage-row">
          <div class="storage-icon"><?= icon('database') ?></div>
          <div class="storage-body">
            <div class="storage-top">
              <p>Database</p>
              <p><?= e(format_bytes($db['size'])) ?></p>
            </div>
            <div class="storage-path"><?= e($db['path']) ?></div>
          </div>
        </div>
        <div class="storage-row mt-3">
          <div class="storage-icon"><?= icon('image') ?></div>
          <div class="storage-body">
            <div class="storage-top">
              <p>Uploads</p>
              <p><?= e(format_bytes($db['uploadsSize'])) ?></p>
            </div>
            <div class="storage-path"><?= e($db['uploadsPath']) ?></div>
          </div>
        </div>
        <div class="count-grid">
          <div class="count-fact"><p>Products</p><p><?= e($db['counts']['products']) ?></p></div>
          <div class="count-fact"><p>Categories</p><p><?= e($db['counts']['categories']) ?></p></div>
          <div class="count-fact"><p>Stores</p><p><?= e($db['counts']['stores']) ?></p></div>
          <div class="count-fact"><p>Tags</p><p><?= e($db['counts']['tags']) ?></p></div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="settings-head">
        <div class="settings-head-icon"><?= icon('info') ?></div>
        <div>
          <h2>About Gift Vault</h2>
          <p>Version and runtime details.</p>
        </div>
      </div>
      <div class="settings-body">
        <div class="about-rows">
          <div class="about-row"><span>Name</span><span><?= e($app['name'] ?? 'Gift Vault') ?></span></div>
          <div class="about-row"><span>Version</span><span><?= e($app['version'] ?? '2.0.0') ?></span></div>
          <div class="about-row"><span>Runtime</span><span><?= e($app['runtime'] ?? '') ?></span></div>
          <div class="about-row"><span>Storage</span><span><?= e($app['storage'] ?? '') ?></span></div>
        </div>
        <div class="privacy-note">
          <strong><?= icon('shield-check') ?> Private by design</strong>
          <p>Your vault runs on this device. Data is stored locally in SQLite.</p>
        </div>
      </div>
    </div>

    <div class="card reminder-card">
      <div class="reminder-top"><?= icon('sparkles') ?> <p>Reminder</p></div>
      <h3>Keep your collection tidy.</h3>
      <p>Regular backups keep your gift ideas safe.</p>
    </div>
  </div>
</div>