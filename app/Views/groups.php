<?php
$groups = $groups ?? [];
$settings = $settings ?? ['currency' => 'PLN'];
?>
<div class="page-header">
  <div>
    <div class="eyebrow">Współdzielenie</div>
    <h1 class="page-title">Grupy</h1>
    <p class="page-desc">Kategorie współdzielone, do których możesz zapraszać inne osoby.</p>
  </div>
  <div class="page-actions">
    <button class="btn btn-sm" type="button" id="newGroupBtn"><?= icon('plus') ?> Nowa grupa</button>
  </div>
</div>

<div class="summary-grid">
  <div class="card summary-fact">
    <p>Grupy</p>
    <p><?= e(count($groups)) ?></p>
    <p>Do których należysz</p>
  </div>
  <div class="card summary-fact">
    <p>Wspólne produkty</p>
    <p><?= e(array_sum(array_map(fn($g) => $g['productCount'], $groups))) ?></p>
    <p>Wszystkie grupy</p>
  </div>
</div>

<?php if (empty($groups)): ?>
  <div class="empty-state">
    <div class="empty-icon"><?= icon('users') ?></div>
    <h3>Nie masz jeszcze żadnych grup</h3>
    <p>Utwórz swoją pierwszą grupę i zaproś do niej inne osoby.</p>
    <div class="empty-action">
      <button class="btn btn-sm" type="button" id="newGroupBtn2"><?= icon('plus') ?> Utwórz grupę</button>
    </div>
  </div>
<?php else: ?>
  <div class="group-grid">
    <?php foreach ($groups as $g): ?>
      <div class="card group-card" data-id="<?= e($g['id']) ?>">
        <div class="group-top">
          <div class="group-icon" style="background:<?= e($g['color']) ?>22;color:<?= e($g['color']) ?>"><?= icon(lucide_name($g['icon'])) ?></div>
          <div>
            <div class="group-name-row">
              <span class="group-name"><?= e($g['name']) ?></span>
              <?php if ($g['isOwner']): ?><span class="badge badge-muted">Właściciel</span><?php endif; ?>
            </div>
            <div class="group-meta">
              <span><?= e($g['memberCount']) ?> osoba<?= $g['memberCount'] === 1 ? '' : 's' ?></span>
              <span class="sep">·</span>
              <span><?= e($g['productCount']) ?> produkt<?= $g['productCount'] === 1 ? '' : 'y' ?></span>
            </div>
            <div class="group-role small muted">
              Twoja rola: <?= e($g['memberRole'] === 'OWNER' ? 'Właściciel' : ($g['memberRole'] === 'ADMIN' ? 'Administrator' : ($g['memberRole'] === 'CONTRIBUTOR' ? 'Współtwórca' : ($g['memberRole'] === 'EDITOR' ? 'Edytor' : 'Obserwator')))) ?>
            </div>
          </div>
        </div>
        <div class="group-foot">
          <a class="group-view" href="<?= e(url('/products?groupId=' . urlencode($g['id']))) ?>">Zobacz produkty <?= icon('arrow-right') ?></a>
          <div class="group-actions">
            <button class="icon-btn" type="button" data-edit-group="<?= e($g['id']) ?>" data-name="<?= e($g['name']) ?>" data-color="<?= e($g['color']) ?>" data-icon="<?= e($g['icon']) ?>" title="Edytuj grupę"><?= icon('edit-2') ?></button>
            <button class="icon-btn" type="button" data-manage-group="<?= e($g['id']) ?>" title="Zarządzaj członkami"><?= icon('user-check') ?></button>
            <button class="icon-btn icon-btn-destructive" type="button" data-delete-group="<?= e($g['id']) ?>" data-name="<?= e($g['name']) ?>" title="Usuń grupę"><?= icon('trash-2') ?></button>
          </div>
        </div>
      </div>
    <?php endforeach; ?>
  </div>
<?php endif; ?>

<!-- Group modal (create / edit) -->
<div class="modal" id="groupModal">
  <div class="modal-dialog">
    <div class="modal-header">
      <h2 id="groupModalTitle">Nowa grupa</h2>
      <p id="groupModalDesc">Nazwij grupę, wybierz kolor i ikonę.</p>
    </div>
    <div class="modal-body">
      <div class="field">
        <label class="label" for="groupName">Nazwa grupy</label>
        <input class="input" id="groupName" type="text" placeholder="np. Rodzina, Przyjaciele, Święta">
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

<!-- Manage members modal -->
<div class="modal" id="manageMembersModal">
  <div class="modal-dialog form-modal wide">
    <div class="modal-header">
      <div class="modal-header-row">
        <div>
          <div class="modal-eyebrow" id="mmEyebrow">Członkowie grupy</div>
          <h2 id="mmTitle">Członkowie</h2>
          <p id="mmDesc">Zarządzaj osobami, które mają dostęp do tej grupy.</p>
        </div>
        <button class="modal-close" type="button" id="mmClose"><?= icon('x') ?></button>
      </div>
    </div>
    <div class="modal-scroll">
      <div class="modal-form-body" id="mmBody">
        <!-- rendered by JS -->
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline btn-sm" type="button" id="mmCancel">Zamknij</button>
    </div>
  </div>
</div>

<script>
  (function () {
    const GROUP_COLORS = [
      '#C9A46A','#D9A3B0','#B7A5C9','#8FAFC4','#9DB8A4','#C4A484',
      '#B4B8A5','#E0A5A5','#88B7B0','#D6A878','#A8A29E'
    ];
    const GROUP_ICONS = [
      'users','user-plus','user-group','home','heart','gift',
      'calendar','tag','shopping-bag','sparkles','bell','star'
    ];
    let groupEditingId = null;
    let groupSelectedColor = GROUP_COLORS[1];
    let groupSelectedIcon = GROUP_ICONS[0];
    let managingGroupId = null;

    function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    function renderGroupSwatches() {
      const box = document.getElementById('groupSwatches');
      if (!box) return;
      box.innerHTML = GROUP_COLORS.map(function (color) {
        var selected = groupSelectedColor === color ? ' selected' : '';
        return '<button type="button" class="swatch' + selected + '" style="background:' + color + '" data-group-color="' + esc(color) + '" aria-label="Kolor ' + esc(color) + '"></button>';
      }).join('');
      box.querySelectorAll('button').forEach(function (btn) {
        btn.addEventListener('click', function () {
          groupSelectedColor = btn.getAttribute('data-group-color');
          renderGroupSwatches();
        });
      });
    }

    function renderGroupIcons() {
      const box = document.getElementById('groupIcons');
      if (!box) return;
      box.innerHTML = GROUP_ICONS.map(function (name) {
        var selected = groupSelectedIcon === name ? ' selected' : '';
        return '<button type="button" class="icon-option' + selected + '" data-group-icon="' + esc(name) + '" aria-label="Ikona ' + esc(name) + '"><svg class="icon"><use href="#i-' + esc(name) + '"></use></svg></button>';
      }).join('');
      box.querySelectorAll('button').forEach(function (btn) {
        btn.addEventListener('click', function () {
          groupSelectedIcon = btn.getAttribute('data-group-icon');
          renderGroupIcons();
        });
      });
    }

    function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    function openGroupModal(group) {
      var m = document.getElementById('groupModal');
      if (m && m.classList.contains('open')) return;
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
      m.classList.add('open');
    }

    function closeGroupModal() {
      var m = document.getElementById('groupModal');
      if (m) m.classList.remove('open');
      groupEditingId = null;
    }

    document.getElementById('newGroupBtn').addEventListener('click', function () { openGroupModal(null); });
    document.getElementById('newGroupBtn2').addEventListener('click', function () { openGroupModal(null); });
    document.getElementById('groupCancel').addEventListener('click', closeGroupModal);

    document.getElementById('groupSave').addEventListener('click', async function () {
      var nameEl = document.getElementById('groupName');
      var colorEl = document.getElementById('groupColor');
      var iconEl = document.getElementById('groupIcon');
      if (!nameEl || !nameEl.value.trim()) { toast('Nazwa grupy jest wymagana.', 'error'); return; }
      var body = {
        name: nameEl.value.trim(),
        color: (colorEl ? colorEl.value : groupSelectedColor) || groupSelectedColor,
        icon: (iconEl ? iconEl.value : groupSelectedIcon) || groupSelectedIcon
      };
      try {
        if (groupEditingId) {
          await api('/api/category-groups/' + groupEditingId, { method: 'PATCH', body: body });
          toast('Grupa zaktualizowana', 'success');
        } else {
          await api('/api/category-groups', { method: 'POST', body: body });
          toast('Grupa utworzona', 'success');
        }
        closeGroupModal();
        setTimeout(function () { window.location.reload(); }, 400);
      } catch (err) { toast(err.message || 'Nie można zapisać grupy.', 'error'); }
    });

    // Edit / delete group from row
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
          'Usunąć grupę ' + esc(name) + '?',
          'To usunie grupę, wszystkie jej zaproszenia i powiązane produkty. Całkowicie i nieodwracalnie.',
          function () {
            api('/api/category-groups/' + id, { method: 'DELETE' }).then(function () {
              toast('Grupa usunięta', 'success');
              setTimeout(function () { window.location.reload(); }, 400);
            }).catch(function (err) { toast(err.message || 'Nie można usunąć grupy.', 'error'); });
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

    // ---------- Manage members modal ----------
    async function openManageMembersModal(groupId) {
      var m = document.getElementById('manageMembersModal');
      if (m && m.classList.contains('open')) return;
      document.getElementById('mmBody').innerHTML = '<div class="muted small">Ładowanie…</div>';
      m.classList.add('open');
      try {
        const [membersRes, invitesRes] = await Promise.all([
          api('/api/category-groups/' + groupId + '/members', { method: 'GET' }),
          api('/api/category-groups/' + groupId + '/invitations', { method: 'GET' })
        ]);
        renderManageMembers(membersRes.members || [], invitesRes.invitations || []);
      } catch (err) {
        document.getElementById('mmBody').innerHTML = '<div class="error">Nie można załadować członków: ' + esc(err.message) + '</div>';
      }
    }

    function renderManageMembers(members, invitations) {
      var box = document.getElementById('mmBody');
      var html = '';

      // Invite new member section
      html += '<div class="field mb-4"><label class="label" for="inviteEmail">E-mail osoby do zaproszenia</label><input class="input" id="inviteEmail" type="email" placeholder="osoba@przyklad.com"></div>';
      html += '<div class="field mb-4"><label class="label" for="inviteRole">Rola</label><select class="select" id="inviteRole">';
      html += '<option value="VIEWER">Obserwator (tylko podgląd)</option>';
      html += '<option value="EDITOR">Edytor (może edytować produkty)</option>';
      html += '<option value="CONTRIBUTOR" selected>Współtwórca (dodaje i edytuje produkty)</option>';
      html += '<option value="ADMIN">Administrator (zarządza członkami)</option>';
      html += '</select></div>';
      html += '<button class="btn btn-sm" type="button" id="inviteSendBtn">' + icon('send') + ' Wyślij zaproszenie</button>';

      // Members list
      html += '<div class="members-section"><h4 class="members-heading">Członkowie</h4>';
      if (members.length === 0) {
        html += '<div class="empty-state small"><p>Brak członków.</p></div>';
      } else {
        html += '<table class="members-table"><thead><tr><th>Osoba</th><th>Rola</th><th>Dołączył</th><th>Akcje</th></tr></thead><tbody>';
        members.forEach(function (m) {
          var roleLabel = m.role === 'OWNER' ? 'Właściciel' : (m.role === 'ADMIN' ? 'Administrator' : (m.role === 'CONTRIBUTOR' ? 'Współtwórca' : (m.role === 'EDITOR' ? 'Edytor' : 'Obserwator')));
          var canRemove = m.canRemove ? ' data-remove-member="' + esc(m.userId) + '"' : '';
          var canChange = m.canChangeRole ? ' data-change-role="' + esc(m.userId) + '"' : '';
          var isMe = m.isCurrentUser ? ' <span class="badge badge-muted">Ty</span>' : '';
          var isOwnerBadge = m.isOwner ? ' <span class="badge badge-muted">Właściciel</span>' : '';
          html += '<tr>';
          html += '<td><strong>' + esc(m.username) + '</strong>' + isMe + isOwnerBadge + '<br><small>' + esc(m.email) + '</small></td>';
          html += '<td><span class="member-role" ' + canChange + '>' + esc(roleLabel) + '</span></td>';
          html += '<td>' + (m.joinedAt ? esc(m.joinedAt) : '—') + '</td>';
          html += '<td>';
          if (m.canRemove) {
            html += '<button class="btn btn-destructive btn-sm" type="button"' + canRemove + '>' + icon('user-x') + ' Usuń</button>';
          }
          html += '</td>';
          html += '</tr>';
        });
        html += '</tbody></table>';
      }
      html += '</div>';

      // Pending invitations
      html += '<div class="invites-section"><h4 class="invites-heading">Oczekujące zaproszenia</h4>';
      if (invitations.length === 0) {
        html += '<div class="empty-state small"><p>Brak oczekujących zaproszeń.</p></div>';
      } else {
        html += '<table class="invites-table"><thead><tr><th>E-mail</th><th>Rola</th><th>Wygaśnie</th><th>Akcje</th></tr></thead><tbody>';
        invitations.forEach(function (inv) {
          var roleLabel = inv.role === 'OWNER' ? 'Właściciel' : (inv.role === 'ADMIN' ? 'Administrator' : (inv.role === 'CONTRIBUTOR' ? 'Współtwórca' : (inv.role === 'EDITOR' ? 'Edytor' : 'Obserwator')));
          var canRevoke = inv.canRevoke ? ' data-revoke-invite="' + esc(inv.id) + '"' : '';
          var statusBadge = inv.isUsed ? ' <span class="badge badge-muted">Wykorzystane</span>' : (inv.isRevoked ? ' <span class="badge badge-muted">Odwołane</span>' : '');
          html += '<tr>';
          html += '<td><strong>' + esc(inv.email) + '</strong>' + statusBadge + '</td>';
          html += '<td>' + esc(roleLabel) + '</td>';
          html += '<td>' + (inv.expiresAt ? esc(inv.expiresAt) : '—') + '</td>';
          html += '<td>';
          if (!inv.isUsed && !inv.isRevoked && inv.canRevoke) {
            html += '<button class="btn btn-destructive btn-sm" type="button"' + canRevoke + '>' + icon('x') + ' Odwołaj</button>';
          }
          html += '</td>';
          html += '</tr>';
        });
        html += '</tbody></table>';
      }
      html += '</div>';

      box.innerHTML = html;

      // Wire up invite button
      var inviteBtn = document.getElementById('inviteSendBtn');
      if (inviteBtn) {
        inviteBtn.addEventListener('click', async function () {
          var emailInput = document.getElementById('inviteEmail');
          var roleSelect = document.getElementById('inviteRole');
          if (!emailInput || !emailInput.value.trim()) { toast('Podaj adres e-mail.', 'error'); return; }
          try {
            await api('/api/category-groups/' + managingGroupId + '/invitations', {
              method: 'POST',
              body: { email: emailInput.value.trim(), role: roleSelect.value }
            });
            toast('Zaproszenie wysłane', 'success');
            emailInput.value = '';
            openManageMembersModal(managingGroupId);
          } catch (err) { toast(err.message || 'Nie można wysłać zaproszenia.', 'error'); }
        });
      }

      // Remove member
      box.querySelectorAll('[data-remove-member]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var uid = btn.getAttribute('data-remove-member');
          openConfirm('Usunąć tego członka?', 'Osoba straci dostęp do grupy. Jej produkty zostaną.', function () {
            api('/api/category-groups/' + managingGroupId + '/members/' + uid, { method: 'DELETE' }).then(function () {
              toast('Członek usunięty', 'success');
              openManageMembersModal(managingGroupId);
            }).catch(function (err) { toast(err.message || 'Nie można usunąć członka.', 'error'); });
          });
        });
      });

      // Change role
      box.querySelectorAll('[data-change-role]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var uid = btn.getAttribute('data-change-role');
          var current = btn.closest('td').querySelector('.member-role');
          var newRole = prompt('Nowa rola dla tego członka (VIEWER, EDITOR, CONTRIBUTOR, ADMIN):', current ? current.textContent : '');
          if (!newRole) return;
          api('/api/category-groups/' + managingGroupId + '/members/' + uid, {
            method: 'PATCH',
            body: { role: newRole.trim() }
          }).then(function () {
            toast('Rola zaktualizowana', 'success');
            openManageMembersModal(managingGroupId);
          }).catch(function (err) { toast(err.message || 'Nie można zmienić roli.', 'error'); });
        });
      });

      // Revoke invitation
      box.querySelectorAll('[data-revoke-invite]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var iid = btn.getAttribute('data-revoke-invite');
          openConfirm('Odwołać zaproszenie?', 'Zaproszenie przestanie być ważne.', function () {
            api('/api/category-groups/' + managingGroupId + '/invitations/' + iid, { method: 'DELETE' }).then(function () {
              toast('Zaproszenie odwołane', 'success');
              openManageMembersModal(managingGroupId);
            }).catch(function (err) { toast(err.message || 'Nie można odwołać zaproszenia.', 'error'); });
          });
        });
      });
    }

    document.getElementById('mmClose').addEventListener('click', function () {
      var m = document.getElementById('manageMembersModal');
      if (m) m.classList.remove('open');
    });
    document.getElementById('mmCancel').addEventListener('click', function () {
      var m = document.getElementById('manageMembersModal');
      if (m) m.classList.remove('open');
    });

  })();
</script>
