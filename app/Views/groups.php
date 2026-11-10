<?php
$groups = $groups ?? [];
$totalMembers = array_sum(array_map(static fn ($g) => (int) $g['memberCount'], $groups));
$totalProducts = array_sum(array_map(static fn ($g) => (int) $g['productCount'], $groups));
$roleLabels = [
    'OWNER' => 'Właściciel',
    'ADMIN' => 'Administrator',
    'CONTRIBUTOR' => 'Współtwórca',
    'EDITOR' => 'Edytor',
    'VIEWER' => 'Obserwator',
];
?>
<div class="page-header">
  <div class="page-header-main">
    <h1 class="page-title">Grupy</h1>
    <p class="page-desc">Wspólne kategorie, do których możesz zapraszać innych.</p>
  </div>
  <div class="page-actions">
    <button class="btn" type="button" id="newGroupBtn"><?= icon('plus') ?> Nowa grupa</button>
  </div>
</div>

<?php if (!empty($groups)): ?>
  <div class="stats-inline">
    <span class="stat-inline"><strong><?= e(count($groups)) ?></strong> <?= e(plural_pl(count($groups), 'grupa', 'grupy', 'grup')) ?></span>
    <span class="stat-inline"><strong><?= e($totalMembers) ?></strong> <?= e(plural_pl($totalMembers, 'osoba', 'osoby', 'osób')) ?></span>
    <span class="stat-inline"><strong><?= e($totalProducts) ?></strong> <?= e(plural_pl($totalProducts, 'produkt', 'produkty', 'produktów')) ?></span>
  </div>
<?php endif; ?>

<?php if (empty($groups)): ?>
  <div class="empty-state">
    <div class="empty-icon"><?= icon('users') ?></div>
    <h3>Nie masz jeszcze żadnych grup</h3>
    <p>Utwórz pierwszą grupę i zaproś do niej inne osoby.</p>
    <div class="empty-action">
      <button class="btn btn-sm" type="button" id="newGroupBtn2"><?= icon('plus') ?> Utwórz grupę</button>
    </div>
  </div>
<?php else: ?>
  <div class="entity-list">
    <?php foreach ($groups as $g): ?>
      <div class="entity-row">
        <div class="entity-icon" style="background:<?= e($g['color']) ?>22;color:<?= e($g['color']) ?>"><?= icon(lucide_name($g['icon'])) ?></div>
        <div class="entity-body">
          <div class="entity-name">
            <a href="<?= e(url('/products?groupId=' . urlencode($g['id']))) ?>"><?= e($g['name']) ?></a>
            <?php if ($g['isOwner']): ?><span class="badge badge-primary">Właściciel</span><?php endif; ?>
          </div>
          <div class="entity-meta">
            <span><?= e($g['memberCount']) ?> <?= e(plural_pl((int) $g['memberCount'], 'osoba', 'osoby', 'osób')) ?></span>
            <span class="sep">·</span>
            <span><?= e($g['productCount']) ?> <?= e(plural_pl((int) $g['productCount'], 'produkt', 'produkty', 'produktów')) ?></span>
            <span class="sep">·</span>
            <span>Twoja rola: <?= e($roleLabels[$g['memberRole']] ?? $g['memberRole']) ?></span>
          </div>
        </div>
        <div class="entity-actions">
          <a class="icon-btn" href="<?= e(url('/products?groupId=' . urlencode($g['id']))) ?>" title="Zobacz produkty" aria-label="Zobacz produkty grupy <?= e($g['name']) ?>"><?= icon('arrow-right') ?></a>
          <button class="icon-btn" type="button" data-edit-group="<?= e($g['id']) ?>" data-name="<?= e($g['name']) ?>" data-color="<?= e($g['color']) ?>" data-icon="<?= e($g['icon']) ?>" title="Edytuj grupę" aria-label="Edytuj grupę <?= e($g['name']) ?>"><?= icon('edit-2') ?></button>
          <button class="icon-btn" type="button" data-manage-group="<?= e($g['id']) ?>" title="Zarządzaj członkami" aria-label="Zarządzaj członkami grupy <?= e($g['name']) ?>"><?= icon('user-check') ?></button>
          <?php if ($g['isOwner']): ?>
            <button class="icon-btn is-destructive" type="button" data-delete-group="<?= e($g['id']) ?>" data-name="<?= e($g['name']) ?>" title="Usuń grupę" aria-label="Usuń grupę <?= e($g['name']) ?>"><?= icon('trash-2') ?></button>
          <?php endif; ?>
        </div>
      </div>
    <?php endforeach; ?>
  </div>
<?php endif; ?>

<div class="modal" id="groupModal" role="dialog" aria-modal="true" aria-labelledby="groupModalTitle">
  <div class="modal-dialog">
    <div class="modal-header">
      <div class="modal-header-row">
        <div>
          <h2 class="modal-title" id="groupModalTitle">Nowa grupa</h2>
          <p class="modal-desc" id="groupModalDesc">Nazwij grupę, wybierz kolor i ikonę.</p>
        </div>
        <button class="modal-close" type="button" id="groupClose" aria-label="Zamknij"><?= icon('x') ?></button>
      </div>
    </div>
    <div class="modal-form-body">
      <div class="field">
        <label class="label" for="groupName">Nazwa grupy</label>
        <input class="input" id="groupName" type="text" maxlength="80" placeholder="np. Rodzina, Przyjaciele, Święta">
      </div>
      <div class="field mt-3">
        <label class="label">Kolor</label>
        <div class="swatches" id="groupSwatches"></div>
      </div>
      <div class="field mt-3">
        <label class="label">Ikona</label>
        <div class="icon-picker" id="groupIcons"></div>
      </div>
      <input type="hidden" id="groupId">
      <input type="hidden" id="groupColor" value="#D9A3B0">
      <input type="hidden" id="groupIcon" value="Users">
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline btn-sm" type="button" id="groupCancel">Anuluj</button>
      <button class="btn btn-sm" type="button" id="groupSave">Utwórz grupę</button>
    </div>
  </div>
</div>

<div class="modal" id="manageMembersModal" role="dialog" aria-modal="true" aria-labelledby="mmTitle">
  <div class="modal-dialog wide">
    <div class="modal-header">
      <div class="modal-header-row">
        <div>
          <div class="form-section-title" id="mmEyebrow" style="margin-bottom:4px">Członkowie grupy</div>
          <h2 class="modal-title" id="mmTitle">Członkowie</h2>
          <p class="modal-desc" id="mmDesc">Zarządzaj osobami, które mają dostęp do tej grupy.</p>
        </div>
        <button class="modal-close" type="button" id="mmClose" aria-label="Zamknij"><?= icon('x') ?></button>
      </div>
    </div>
    <div class="modal-scroll">
      <div class="modal-form-body" id="mmBody"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline btn-sm" type="button" id="mmCancel">Zamknij</button>
    </div>
  </div>
</div>

<script>
  document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    var api = window.api;
    var toast = window.toast;
    var openConfirm = window.openConfirm;
    if (!api || !toast || !openConfirm) return;

    var GROUP_COLORS = [
      '#C9A46A', '#D9A3B0', '#B7A5C9', '#8FAFC4', '#9DB8A4', '#C4A484',
      '#B4B8A5', '#E0A5A5', '#88B7B0', '#D6A878', '#A8A29E'
    ];
    var GROUP_ICONS = [
      'users', 'user-plus', 'user-group', 'home', 'heart', 'gift',
      'calendar', 'tag', 'shopping-bag', 'sparkles', 'bell', 'star'
    ];
    var ROLE_LABELS = {
      OWNER: 'Właściciel',
      ADMIN: 'Administrator',
      CONTRIBUTOR: 'Współtwórca',
      EDITOR: 'Edytor',
      VIEWER: 'Obserwator'
    };
    var ROLE_OPTIONS = [
      { value: 'VIEWER', label: 'Obserwator' },
      { value: 'EDITOR', label: 'Edytor' },
      { value: 'CONTRIBUTOR', label: 'Współtwórca' },
      { value: 'ADMIN', label: 'Administrator' }
    ];

    var groupEditingId = null;
    var groupSelectedColor = GROUP_COLORS[1];
    var groupSelectedIcon = GROUP_ICONS[0];
    var managingGroupId = null;

    function esc(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function iconSvg(name) {
      return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#i-' + esc(name) + '"></use></svg>';
    }

    function fmtDate(iso) {
      if (!iso) return '—';
      var date = new Date(iso);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function renderGroupSwatches() {
      var box = document.getElementById('groupSwatches');
      if (!box) return;
      box.innerHTML = GROUP_COLORS.map(function (color) {
        var selected = groupSelectedColor === color ? ' selected' : '';
        return '<button type="button" class="swatch' + selected + '" style="background:' + color + '" data-group-color="' + esc(color) + '" aria-label="Kolor ' + esc(color) + '"></button>';
      }).join('');
      box.querySelectorAll('button').forEach(function (btn) {
        btn.addEventListener('click', function () {
          groupSelectedColor = btn.getAttribute('data-group-color');
          var hidden = document.getElementById('groupColor');
          if (hidden) hidden.value = groupSelectedColor;
          renderGroupSwatches();
        });
      });
    }

    function renderGroupIcons() {
      var box = document.getElementById('groupIcons');
      if (!box) return;
      box.innerHTML = GROUP_ICONS.map(function (name) {
        var selected = groupSelectedIcon === name ? ' selected' : '';
        return '<button type="button" class="icon-option' + selected + '" data-group-icon="' + esc(name) + '" aria-label="Ikona ' + esc(name) + '">' + iconSvg(name) + '</button>';
      }).join('');
      box.querySelectorAll('button').forEach(function (btn) {
        btn.addEventListener('click', function () {
          groupSelectedIcon = btn.getAttribute('data-group-icon');
          var hidden = document.getElementById('groupIcon');
          if (hidden) hidden.value = groupSelectedIcon;
          renderGroupIcons();
        });
      });
    }

    function openGroupModal(group) {
      var modal = document.getElementById('groupModal');
      if (!modal || modal.classList.contains('open')) return;
      groupEditingId = group ? group.id : null;
      document.getElementById('groupName').value = group ? group.name : '';
      document.getElementById('groupColor').value = group ? group.color : GROUP_COLORS[1];
      document.getElementById('groupIcon').value = group ? group.icon : 'users';
      groupSelectedColor = document.getElementById('groupColor').value;
      groupSelectedIcon = document.getElementById('groupIcon').value;
      document.getElementById('groupModalTitle').textContent = group ? 'Edytuj grupę' : 'Nowa grupa';
      document.getElementById('groupModalDesc').textContent = group ? 'Zaktualizuj nazwę, kolor i ikonę grupy.' : 'Nazwij grupę, wybierz kolor i ikonę.';
      document.getElementById('groupSave').textContent = group ? 'Zapisz zmiany' : 'Utwórz grupę';
      renderGroupSwatches();
      renderGroupIcons();
      modal.classList.add('open');
    }

    function closeGroupModal() {
      var modal = document.getElementById('groupModal');
      if (modal) modal.classList.remove('open');
      groupEditingId = null;
    }

    var newGroupBtn = document.getElementById('newGroupBtn');
    var newGroupBtn2 = document.getElementById('newGroupBtn2');
    if (newGroupBtn) newGroupBtn.addEventListener('click', function () { openGroupModal(null); });
    if (newGroupBtn2) newGroupBtn2.addEventListener('click', function () { openGroupModal(null); });
    var groupCancel = document.getElementById('groupCancel');
    var groupClose = document.getElementById('groupClose');
    if (groupCancel) groupCancel.addEventListener('click', closeGroupModal);
    if (groupClose) groupClose.addEventListener('click', closeGroupModal);

    var groupSave = document.getElementById('groupSave');
    if (groupSave) {
      groupSave.addEventListener('click', async function () {
        var nameEl = document.getElementById('groupName');
        if (!nameEl || !nameEl.value.trim()) {
          toast('Nazwa grupy jest wymagana.', 'error');
          return;
        }
        var body = {
          name: nameEl.value.trim(),
          color: document.getElementById('groupColor').value || groupSelectedColor,
          icon: document.getElementById('groupIcon').value || groupSelectedIcon
        };
        try {
          if (groupEditingId) {
            await api('/api/category-groups/' + groupEditingId, { method: 'PATCH', body: body });
            toast('Grupa zaktualizowana.', 'success');
          } else {
            await api('/api/category-groups', { method: 'POST', body: body });
            toast('Grupa utworzona.', 'success');
          }
          closeGroupModal();
          setTimeout(function () { window.location.reload(); }, 400);
        } catch (err) {
          toast(err.message || 'Nie można zapisać grupy.', 'error');
        }
      });
    }

    document.addEventListener('click', function (e) {
      var editBtn = e.target.closest('[data-edit-group]');
      if (editBtn) {
        e.preventDefault();
        openGroupModal({
          id: editBtn.getAttribute('data-edit-group'),
          name: editBtn.getAttribute('data-name'),
          color: editBtn.getAttribute('data-color'),
          icon: editBtn.getAttribute('data-icon')
        });
      }

      var delBtn = e.target.closest('[data-delete-group]');
      if (delBtn) {
        e.preventDefault();
        var id = delBtn.getAttribute('data-delete-group');
        var name = delBtn.getAttribute('data-name') || 'tę grupę';
        openConfirm(
          'Usunąć grupę „' + name + '”?',
          'Usunie to grupę, jej zaproszenia i powiązania z produktami. Tej operacji nie można cofnąć.',
          function () {
            api('/api/category-groups/' + id, { method: 'DELETE' }).then(function () {
              toast('Grupa usunięta.', 'success');
              setTimeout(function () { window.location.reload(); }, 400);
            }).catch(function (err) {
              toast(err.message || 'Nie można usunąć grupy.', 'error');
            });
          }
        );
      }

      var manageBtn = e.target.closest('[data-manage-group]');
      if (manageBtn) {
        e.preventDefault();
        managingGroupId = manageBtn.getAttribute('data-manage-group');
        openManageMembersModal(managingGroupId);
      }
    });

    async function openManageMembersModal(groupId) {
      var modal = document.getElementById('manageMembersModal');
      if (!modal || modal.classList.contains('open')) return;
      document.getElementById('mmBody').innerHTML = '<div class="muted small">Ładowanie…</div>';
      modal.classList.add('open');
      try {
        var results = await Promise.all([
          api('/api/category-groups/' + groupId + '/members', { method: 'GET' }),
          api('/api/category-groups/' + groupId + '/invitations', { method: 'GET' })
        ]);
        renderManageMembers(results[0].members || [], results[1].invitations || []);
      } catch (err) {
        document.getElementById('mmBody').innerHTML = '<div class="error">Nie można załadować członków: ' + esc(err.message) + '</div>';
      }
    }

    function renderManageMembers(members, invitations) {
      var box = document.getElementById('mmBody');
      var html = '';

      html += '<div class="form-section-title">Zaproś osobę</div>';
      html += '<div class="form-grid">';
      html += '<div class="field"><label class="label" for="inviteEmail">Adres e-mail</label><input class="input" id="inviteEmail" type="email" placeholder="osoba@przyklad.com"></div>';
      html += '<div class="field"><label class="label" for="inviteRole">Rola</label><select class="select" id="inviteRole">';
      ROLE_OPTIONS.forEach(function (role) {
        html += '<option value="' + role.value + '"' + (role.value === 'CONTRIBUTOR' ? ' selected' : '') + '>' + role.label + '</option>';
      });
      html += '</select></div>';
      html += '</div>';
      html += '<div class="settings-actions"><button class="btn btn-sm" type="button" id="inviteSendBtn">' + iconSvg('send') + ' Wyślij zaproszenie</button></div>';

      html += '<div class="form-section"><div class="form-section-title">Członkowie</div>';
      if (members.length === 0) {
        html += '<div class="empty-state compact"><p class="empty-desc">Brak członków.</p></div>';
      } else {
        html += '<div class="table-responsive"><table class="table"><thead><tr><th>Osoba</th><th>Rola</th><th>Dołączył</th><th class="table-actions">Akcje</th></tr></thead><tbody>';
        members.forEach(function (member) {
          var roleCell = '<span class="member-role">' + esc(ROLE_LABELS[member.role] || member.role) + '</span>';
          if (member.canChangeRole) {
            roleCell = '<select class="select" data-role-select="' + esc(member.userId) + '" aria-label="Rola użytkownika ' + esc(member.username) + '">';
            ROLE_OPTIONS.forEach(function (role) {
              roleCell += '<option value="' + role.value + '"' + (role.value === member.role ? ' selected' : '') + '>' + role.label + '</option>';
            });
            roleCell += '</select>';
          }
          var badges = '';
          if (member.isCurrentUser) badges += ' <span class="badge badge-muted">Ty</span>';
          if (member.isOwner) badges += ' <span class="badge badge-primary">Właściciel</span>';
          html += '<tr>';
          html += '<td><strong>' + esc(member.username) + '</strong>' + badges + '<br><small>' + esc(member.email) + '</small></td>';
          html += '<td>' + roleCell + '</td>';
          html += '<td>' + esc(fmtDate(member.joinedAt)) + '</td>';
          html += '<td class="table-actions">';
          if (member.canRemove) {
            html += '<button class="btn btn-danger-ghost btn-xs" type="button" data-remove-member="' + esc(member.userId) + '">' + iconSvg('user-x') + ' Usuń</button>';
          }
          html += '</td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '</div>';

      html += '<div class="form-section"><div class="form-section-title">Oczekujące zaproszenia</div>';
      if (invitations.length === 0) {
        html += '<div class="empty-state compact"><p class="empty-desc">Brak oczekujących zaproszeń.</p></div>';
      } else {
        html += '<div class="table-responsive"><table class="table"><thead><tr><th>E-mail</th><th>Rola</th><th>Wygasa</th><th class="table-actions">Akcje</th></tr></thead><tbody>';
        invitations.forEach(function (invitation) {
          var badge = '';
          if (invitation.isUsed) badge = ' <span class="badge badge-success">Wykorzystane</span>';
          else if (invitation.isRevoked) badge = ' <span class="badge badge-danger">Odwołane</span>';
          else badge = ' <span class="badge badge-muted">Oczekuje</span>';
          html += '<tr>';
          html += '<td><strong>' + esc(invitation.email) + '</strong>' + badge + '</td>';
          html += '<td>' + esc(ROLE_LABELS[invitation.role] || invitation.role) + '</td>';
          html += '<td>' + esc(fmtDate(invitation.expiresAt)) + '</td>';
          html += '<td class="table-actions">';
          if (!invitation.isUsed && !invitation.isRevoked && invitation.canRevoke) {
            html += '<button class="btn btn-danger-ghost btn-xs" type="button" data-revoke-invite="' + esc(invitation.id) + '">' + iconSvg('x') + ' Odwołaj</button>';
          }
          html += '</td>';
          html += '</tr>';
        });
        html += '</tbody></table></div>';
      }
      html += '</div>';

      box.innerHTML = html;

      var inviteBtn = document.getElementById('inviteSendBtn');
      if (inviteBtn) {
        inviteBtn.addEventListener('click', async function () {
          var emailInput = document.getElementById('inviteEmail');
          var roleSelect = document.getElementById('inviteRole');
          if (!emailInput || !emailInput.value.trim()) {
            toast('Podaj adres e-mail.', 'error');
            return;
          }
          try {
            await api('/api/category-groups/' + managingGroupId + '/invitations', {
              method: 'POST',
              body: { email: emailInput.value.trim(), role: roleSelect.value }
            });
            toast('Zaproszenie wysłane.', 'success');
            emailInput.value = '';
            openManageMembersModal(managingGroupId);
          } catch (err) {
            toast(err.message || 'Nie można wysłać zaproszenia.', 'error');
          }
        });
      }

      box.querySelectorAll('[data-remove-member]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var userId = btn.getAttribute('data-remove-member');
          openConfirm('Usunąć tego członka?', 'Osoba straci dostęp do grupy.', function () {
            api('/api/category-groups/' + managingGroupId + '/members/' + userId, { method: 'DELETE' }).then(function () {
              toast('Członek usunięty.', 'success');
              openManageMembersModal(managingGroupId);
            }).catch(function (err) {
              toast(err.message || 'Nie można usunąć członka.', 'error');
            });
          });
        });
      });

      box.querySelectorAll('[data-role-select]').forEach(function (select) {
        select.addEventListener('change', function () {
          var userId = select.getAttribute('data-role-select');
          api('/api/category-groups/' + managingGroupId + '/members/' + userId, {
            method: 'PATCH',
            body: { role: select.value }
          }).then(function () {
            toast('Rola zaktualizowana.', 'success');
            openManageMembersModal(managingGroupId);
          }).catch(function (err) {
            toast(err.message || 'Nie można zmienić roli.', 'error');
          });
        });
      });

      box.querySelectorAll('[data-revoke-invite]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var invitationId = btn.getAttribute('data-revoke-invite');
          openConfirm('Odwołać zaproszenie?', 'Zaproszenie przestanie być ważne.', function () {
            api('/api/category-groups/' + managingGroupId + '/invitations/' + invitationId, { method: 'DELETE' }).then(function () {
              toast('Zaproszenie odwołane.', 'success');
              openManageMembersModal(managingGroupId);
            }).catch(function (err) {
              toast(err.message || 'Nie można odwołać zaproszenia.', 'error');
            });
          });
        });
      });
    }

    var mmClose = document.getElementById('mmClose');
    var mmCancel = document.getElementById('mmCancel');
    function closeMembersModal() {
      var modal = document.getElementById('manageMembersModal');
      if (modal) modal.classList.remove('open');
    }
    if (mmClose) mmClose.addEventListener('click', closeMembersModal);
    if (mmCancel) mmCancel.addEventListener('click', closeMembersModal);
  });
</script>
