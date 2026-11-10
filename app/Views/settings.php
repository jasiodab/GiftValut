<?php
$s = $settings;
$db = $database;
$app = $appInfo ?? [];
$users = $users ?? [];
$invitations = $invitations ?? [];
$backups = $backups ?? [];
$roleLabels = [
    'OWNER' => 'Właściciel',
    'ADMIN' => 'Administrator',
    'CONTRIBUTOR' => 'Współtwórca',
    'EDITOR' => 'Edytor',
    'VIEWER' => 'Obserwator',
];
$statusLabels = [
    'ACTIVE' => 'Aktywne',
    'BLOCKED' => 'Zablokowane',
];
$now = time();
?>
<div class="page-header">
  <div class="page-header-main">
    <h1 class="page-title">Ustawienia</h1>
    <p class="page-desc">Dostosuj wygląd, konto i kopie zapasowe. Wszystko działa lokalnie na tym urządzeniu.</p>
  </div>
</div>

<div class="settings-grid">
  <div class="settings-col">
    <section class="panel settings-section">
      <div class="panel-head">
        <div class="panel-head-main">
          <h2 class="panel-title">Preferencje</h2>
          <p class="panel-desc">Waluta i domyślny widok produktów.</p>
        </div>
      </div>
      <div class="settings-body">
        <form id="settingsForm">
          <?= csrf_field() ?>
          <div class="form-grid">
            <div class="field">
              <label class="label" for="currency">Waluta</label>
              <select class="select" id="currency" name="currency">
                <?php foreach (['PLN','EUR','USD','GBP','CHF','CZK','SEK','NOK','DKK','HUF','UAH'] as $cur): ?>
                  <option value="<?= e($cur) ?>" <?= $s['currency'] === $cur ? 'selected' : '' ?>><?= e($cur) ?></option>
                <?php endforeach; ?>
              </select>
            </div>
            <div class="field">
              <label class="label" for="defaultProductView">Domyślny widok</label>
              <select class="select" id="defaultProductView" name="defaultProductView">
                <option value="grid" <?= $s['defaultProductView'] === 'grid' ? 'selected' : '' ?>>Siatka</option>
                <option value="list" <?= $s['defaultProductView'] === 'list' ? 'selected' : '' ?>>Lista</option>
              </select>
            </div>
          </div>
          <div class="settings-actions">
            <button class="btn btn-sm" type="button" id="saveSettingsBtn"><?= icon('save') ?> Zapisz preferencje</button>
          </div>
        </form>
      </div>
    </section>

    <section class="panel settings-section">
      <div class="panel-head">
        <div class="panel-head-main">
          <h2 class="panel-title">Konto</h2>
          <p class="panel-desc">Zmień hasło do swojego konta.</p>
        </div>
      </div>
      <div class="settings-body">
        <form method="post" action="<?= e(url('/settings/password')) ?>" id="passwordForm">
          <?= csrf_field() ?>
          <div class="field">
            <label class="label" for="currentPassword">Obecne hasło</label>
            <input class="input" id="currentPassword" name="currentPassword" type="password" autocomplete="current-password">
          </div>
          <div class="field">
            <label class="label" for="newPassword">Nowe hasło</label>
            <input class="input" id="newPassword" name="newPassword" type="password" minlength="12" autocomplete="new-password">
            <span class="hint">Co najmniej 12 znaków.</span>
          </div>
          <div class="settings-actions">
            <button class="btn btn-sm" type="submit"><?= icon('save') ?> Zmień hasło</button>
          </div>
        </form>
      </div>
    </section>

    <?php if ($isOwner): ?>
    <section class="panel settings-section">
      <div class="panel-head">
        <div class="panel-head-main">
          <h2 class="panel-title">Konta</h2>
          <p class="panel-desc">Zaproś i zarządzaj osobami korzystającymi z tej kolekcji.</p>
        </div>
      </div>
      <div class="settings-body">
        <div class="field">
          <label class="label" for="inviteLink">Zaproś osobę</label>
          <div class="input-row">
            <input class="input" id="inviteLink" type="text" readonly placeholder="Utwórz link z zaproszeniem">
            <button class="btn btn-sm" type="button" id="createInviteBtn"><?= icon('send') ?> Utwórz</button>
          </div>
          <span class="hint">Link wygasa po 48 godzinach i można go użyć tylko raz. Przekaż go prywatnie.</span>
        </div>

        <?php if (!empty($invitations)): ?>
          <div class="invite-list mt-4" id="inviteList">
            <?php foreach ($invitations as $inv): ?>
              <?php
              $used = !empty($inv['usedAt']);
              $revoked = !empty($inv['revokedAt']);
              $expired = !$used && !$revoked && !empty($inv['expiresAt']) && strtotime($inv['expiresAt']) < $now;
              ?>
              <div class="invite-item">
                <span>
                  <code>#<?= e(substr((string) $inv['id'], 0, 8)) ?></code>
                  <span class="sep">·</span>
                  <?= $used ? 'wykorzystane' : ($revoked ? 'odwołane' : ($expired ? 'wygasłe' : 'wygasa ' . e(format_datetime($inv['expiresAt'])))) ?>
                </span>
                <?php if ($used): ?>
                  <span class="badge badge-success">Wykorzystane</span>
                <?php elseif ($revoked): ?>
                  <span class="badge badge-danger">Odwołane</span>
                <?php elseif ($expired): ?>
                  <span class="badge badge-muted">Wygasłe</span>
                <?php else: ?>
                  <span class="badge badge-muted">Oczekuje</span>
                <?php endif; ?>
              </div>
            <?php endforeach; ?>
          </div>
        <?php else: ?>
          <div class="invite-list mt-4" id="inviteList"></div>
        <?php endif; ?>

        <div class="mt-4">
          <?php foreach ($users as $u): ?>
            <div class="account-row">
              <span class="avatar"><?= e(initials($u['username'])) ?></span>
              <div class="account-body">
                <div class="account-name">
                  <?= e($u['username']) ?>
                  <span class="badge <?= $u['role'] === 'OWNER' ? 'badge-primary' : 'badge-muted' ?>"><?= e($roleLabels[$u['role']] ?? $u['role']) ?></span>
                  <span class="badge <?= $u['status'] === 'ACTIVE' ? 'badge-success' : 'badge-danger' ?>"><?= e($statusLabels[$u['status']] ?? $u['status']) ?></span>
                </div>
                <div class="account-meta"><?= e($u['email']) ?> · dołączył <?= e(format_date($u['createdAt'])) ?></div>
              </div>
              <div class="account-actions">
                <?php if ($u['status'] === 'ACTIVE'): ?>
                  <button class="btn btn-outline btn-xs" type="button" data-block-user="<?= e($u['id']) ?>">Zablokuj</button>
                <?php else: ?>
                  <button class="btn btn-outline btn-xs" type="button" data-unblock-user="<?= e($u['id']) ?>">Odblokuj</button>
                <?php endif; ?>
                <?php if ($u['id'] !== ($user['id'] ?? '')): ?>
                  <button class="btn btn-danger-ghost btn-xs" type="button" data-delete-user="<?= e($u['id']) ?>">Usuń</button>
                <?php endif; ?>
              </div>
            </div>
          <?php endforeach; ?>
        </div>
      </div>
    </section>
    <?php endif; ?>
  </div>

  <div class="settings-col">
    <?php if ($isOwner): ?>
    <section class="panel settings-section">
      <div class="panel-head">
        <div class="panel-head-main">
          <h2 class="panel-title">Kopie zapasowe</h2>
          <p class="panel-desc">Twórz, pobieraj i przywracaj kopie danych.</p>
        </div>
      </div>
      <div class="settings-body">
        <div class="storage-row">
          <div class="storage-icon"><?= icon('database') ?></div>
          <div class="storage-body">
            <div class="storage-top">
              <p>Ostatnia kopia</p>
              <span><?= $s['lastBackupAt'] ? e(format_datetime($s['lastBackupAt'])) : 'Nigdy' ?></span>
            </div>
          </div>
          <button class="btn btn-sm" type="button" id="createBackupBtn"><?= icon('download') ?> Utwórz kopię</button>
        </div>

        <div class="form-section">
          <div class="form-section-title">Zapisane kopie</div>
          <div class="backup-list" id="backupList">
            <?php if (empty($backups)): ?>
              <div class="backup-empty">Nie ma jeszcze żadnych kopii zapasowych.</div>
            <?php else: ?>
              <?php foreach ($backups as $b): ?>
                <div class="backup-item">
                  <?= icon('file-archive') ?>
                  <div class="backup-item-body">
                    <div class="backup-item-name"><?= e($b['filename']) ?></div>
                    <div class="backup-item-meta"><?= e(format_bytes($b['size'])) ?> · <?= e(format_datetime($b['createdAt'])) ?></div>
                  </div>
                  <a class="btn btn-outline btn-xs" href="<?= e(url('/api/settings/backups/' . urlencode($b['filename']))) ?>">Pobierz</a>
                </div>
              <?php endforeach; ?>
            <?php endif; ?>
          </div>
        </div>

        <div class="form-section">
          <label class="label" for="restoreFile">Przywróć z kopii</label>
          <div class="input-row">
            <input class="input" id="restoreFile" type="file" accept=".zip">
            <button class="btn btn-outline btn-sm" type="button" id="restoreBtn"><?= icon('upload') ?> Przywróć</button>
          </div>
          <span class="hint">Przywrócenie zastąpi obecną bazę danych. Przed operacją powstanie kopia bezpieczeństwa.</span>
        </div>
      </div>
    </section>
    <?php endif; ?>

    <section class="panel settings-section">
      <div class="panel-head">
        <div class="panel-head-main">
          <h2 class="panel-title">Pamięć lokalna</h2>
          <p class="panel-desc">Gdzie przechowywane są Twoje dane.</p>
        </div>
      </div>
      <div class="settings-body">
        <div class="storage-row">
          <div class="storage-icon"><?= icon('database') ?></div>
          <div class="storage-body">
            <div class="storage-top">
              <p>Baza danych</p>
              <span><?= e(format_bytes($db['size'])) ?></span>
            </div>
            <div class="storage-path"><?= e($db['path'] ?: '—') ?></div>
          </div>
        </div>
        <div class="storage-row">
          <div class="storage-icon"><?= icon('image') ?></div>
          <div class="storage-body">
            <div class="storage-top">
              <p>Zdjęcia</p>
              <span><?= e(format_bytes($db['uploadsSize'])) ?></span>
            </div>
            <div class="storage-path"><?= e($db['uploadsPath'] ?: '—') ?></div>
          </div>
        </div>
        <div class="count-facts">
          <div class="count-fact"><strong><?= e($db['counts']['products']) ?></strong><span>produkty</span></div>
          <div class="count-fact"><strong><?= e($db['counts']['categories']) ?></strong><span>kategorie</span></div>
          <div class="count-fact"><strong><?= e($db['counts']['stores']) ?></strong><span>sklepy</span></div>
          <div class="count-fact"><strong><?= e($db['counts']['tags']) ?></strong><span>tagi</span></div>
        </div>
      </div>
    </section>

    <section class="panel settings-section">
      <div class="panel-head">
        <div class="panel-head-main">
          <h2 class="panel-title">O aplikacji</h2>
          <p class="panel-desc">Wersja i środowisko uruchomieniowe.</p>
        </div>
      </div>
      <div class="settings-body">
        <div class="about-rows">
          <div class="about-row"><span>Nazwa</span><span><?= e($app['name'] ?? 'Gift Vault') ?></span></div>
          <div class="about-row"><span>Wersja</span><span><?= e($app['version'] ?? '2.0.0') ?></span></div>
          <div class="about-row"><span>Środowisko</span><span><?= e($app['runtime'] ?? '') ?></span></div>
          <div class="about-row"><span>Przechowywanie</span><span>SQLite, dane prywatne</span></div>
        </div>
        <div class="privacy-note">
          <strong><?= icon('shield-check') ?> Prywatność przede wszystkim</strong>
          <p>Kolekcja działa na tym urządzeniu. Dane są zapisywane lokalnie w bazie SQLite.</p>
        </div>
      </div>
    </section>
  </div>
</div>
