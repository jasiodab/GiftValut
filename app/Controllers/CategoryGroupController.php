<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Response;
use App\Core\Str;
use App\Core\Validator;
use App\Middleware\AuthMiddleware;
use App\Repositories\CategoryGroupInvitationRepository;
use App\Repositories\CategoryGroupRepository;
use App\Repositories\UserRepository;

final class CategoryGroupController extends Controller
{
    private CategoryGroupRepository $groups;
    private CategoryGroupInvitationRepository $invitations;
    private UserRepository $users;

    public function __construct(\App\Core\Request $request)
    {
        parent::__construct($request);
        $this->groups = new CategoryGroupRepository();
        $this->invitations = new CategoryGroupInvitationRepository();
        $this->users = new UserRepository();
    }

    public function index(): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];
        $rows = $this->groups->listForUser($userId);

        return Response::json([
            'groups' => array_map([$this, 'serializeGroup'], $rows),
        ]);
    }

    public function create(): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];
        $input = $this->jsonInput();

        $validator = new Validator($input);
        $name = $validator->requiredString('name', 80, 'Nazwa grupy');
        $color = $this->validateColor($validator, $input);
        $icon = $this->validateIcon($validator, $input);
        $validator->throwIfFails();

        if ($this->groups->findBySlug($userId, Str::slugify($name)) !== null) {
            throw new HttpException(409, 'Grupa o tej nazwie już istnieje.', 'DUPLICATE_GROUP');
        }

        $baseSlug = Str::slugify($name);
        $slug = $baseSlug;
        $suffix = 1;
        while ($this->groups->slugExists($userId, $slug)) {
            $slug = $baseSlug . '-' . $suffix;
            $suffix++;
        }

        $created = $this->groups->create($userId, $name, $slug, $color, $icon);
        $created['memberCount'] = 1;
        $created['productCount'] = 0;
        $created['isOwner'] = true;
        $created['memberRole'] = CategoryGroupRepository::ROLE_OWNER;

        return Response::json(['group' => $this->serializeGroup($created)], 201);
    }

    public function show(string $id): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];
        $group = $this->groups->findForUser($id, $userId);
        if ($group === null) {
            throw new HttpException(404, 'Grupa nie znaleziona.', 'GROUP_NOT_FOUND');
        }

        $group['memberCount'] = $this->groups->memberCount($id);
        $group['productCount'] = $this->groups->productCount($id);
        $group['isOwner'] = (string) $group['ownerId'] === $userId;
        $group['memberRole'] = (string) ($group['memberRole'] ?? CategoryGroupRepository::ROLE_VIEWER);

        return Response::json(['group' => $this->serializeGroup($group)]);
    }

    public function update(string $id): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];
        $group = $this->groups->findForUser($id, $userId);
        if ($group === null) {
            throw new HttpException(404, 'Grupa nie znaleziona.', 'GROUP_NOT_FOUND');
        }
        // Only owner or admin can update group details.
        if (!$this->groups->canManageMembers($id, $userId)) {
            throw new HttpException(403, 'Brak uprawnień do edycji tej grupy.', 'FORBIDDEN');
        }

        $input = $this->jsonInput();
        $validator = new Validator($input);
        $data = [];

        if (array_key_exists('name', $input)) {
            $name = $validator->requiredString('name', 80, 'Nazwa grupy');
            $validator->throwIfFails();
            if ($name !== (string) $group['name'] && $this->groups->findBySlug((string) $group['ownerId'], Str::slugify($name)) !== null) {
                throw new HttpException(409, 'Grupa o tej nazwie już istnieje.', 'DUPLICATE_GROUP');
            }
            $data['name'] = $name;
        }
        if (array_key_exists('color', $input)) {
            $data['color'] = $this->validateColor($validator, $input);
        }
        if (array_key_exists('icon', $input)) {
            $data['icon'] = $this->validateIcon($validator, $input);
        }
        $validator->throwIfFails();

        $this->groups->update($id, $userId, $data);
        $updated = $this->groups->findForUser($id, $userId) ?? [];
        $updated['memberCount'] = $this->groups->memberCount($id);
        $updated['productCount'] = $this->groups->productCount($id);
        $updated['isOwner'] = (string) ($updated['ownerId'] ?? '') === $userId;
        $updated['memberRole'] = (string) ($updated['memberRole'] ?? CategoryGroupRepository::ROLE_VIEWER);

        return Response::json(['group' => $this->serializeGroup($updated)]);
    }

    public function delete(string $id): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];
        $group = $this->groups->findById($id);
        if ($group === null) {
            throw new HttpException(404, 'Grupa nie znaleziona.', 'GROUP_NOT_FOUND');
        }
        if ((string) $group['ownerId'] !== $userId) {
            throw new HttpException(403, 'Tylko właściciel może usunąć grupę.', 'FORBIDDEN');
        }

        $this->groups->delete($id, $userId);
        return Response::json(['deleted' => true]);
    }

    public function members(string $id): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];
        $group = $this->groups->findForUser($id, $userId);
        if ($group === null) {
            throw new HttpException(404, 'Grupa nie znaleziona.', 'GROUP_NOT_FOUND');
        }

        $rows = $this->groups->listMembers($id);
        return Response::json([
            'members' => array_map(function (array $m) use ($userId, $id) {
                return [
                    'id' => (string) $m['id'],
                    'userId' => (string) $m['userId'],
                    'username' => (string) ($m['username'] ?? ''),
                    'email' => (string) ($m['email'] ?? ''),
                    'role' => (string) $m['role'],
                    'joinedAt' => Str::isoFromMs($m['joinedAt'] ?? null),
                    'isOwner' => (string) $m['userId'] === (string) ($group['ownerId'] ?? ''),
                    'isCurrentUser' => (string) $m['userId'] === $userId,
                    'canRemove' => $this->groups->canManageMembers($id, $userId)
                        && (string) $m['role'] !== CategoryGroupRepository::ROLE_OWNER
                        && (string) $m['userId'] !== $userId,
                    'canChangeRole' => $this->groups->canManageMembers($id, $userId)
                        && (string) $m['role'] !== CategoryGroupRepository::ROLE_OWNER,
                ];
            }, $rows),
        ]);
    }

    public function addMember(string $id): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];
        $group = $this->groups->findForUser($id, $userId);
        if ($group === null) {
            throw new HttpException(404, 'Grupa nie znaleziona.', 'GROUP_NOT_FOUND');
        }
        if (!$this->groups->canManageMembers($id, $userId)) {
            throw new HttpException(403, 'Brak uprawnień do zarządzania członkami.', 'FORBIDDEN');
        }

        $input = $this->jsonInput();
        $validator = new Validator($input);
        $email = $validator->email('email', 'E-mail', true);
        $role = $validator->enum('role', [
            CategoryGroupRepository::ROLE_VIEWER,
            CategoryGroupRepository::ROLE_EDITOR,
            CategoryGroupRepository::ROLE_CONTRIBUTOR,
            CategoryGroupRepository::ROLE_ADMIN,
        ], 'Rola', CategoryGroupRepository::ROLE_CONTRIBUTOR);
        $validator->throwIfFails();

        // Check if user already exists and is already a member.
        $existingUser = $this->users->findByEmail($email);
        if ($existingUser !== null && $this->groups->findMember($id, (string) $existingUser['id']) !== null) {
            throw new HttpException(409, 'Ta osoba jest już członkiem grupy.', 'ALREADY_MEMBER');
        }

        // Check for existing pending invitation.
        $existingInvites = $this->invitations->listForGroup($id);
        foreach ($existingInvites as $inv) {
            if ((string) $inv['email'] === $email && (string) $inv['role'] === $role) {
                throw new HttpException(409, 'Zaproszenie dla tego adresu e-mail już istnieje.', 'INVITATION_EXISTS');
            }
        }

        $token = Str::token(32);
        $expiresAt = Str::nowMs() + (7 * 86400000); // 7 days
        $invitation = $this->invitations->create($id, $email, Str::hashToken($token), $role, $userId, $expiresAt);

        $link = \App\Core\App::config('app.url', '') . '/api/category-group-invitations/accept/' . rawurlencode($token);

        return Response::json([
            'invitation' => [
                'id' => (string) $invitation['id'],
                'email' => (string) $invitation['email'],
                'role' => (string) $invitation['role'],
                'link' => $link,
                'expiresAt' => Str::isoFromMs($invitation['expiresAt'] ?? null),
            ],
        ], 201);
    }

    public function updateMemberRole(string $id, string $userId): Response
    {
        $user = AuthMiddleware::user($this->request);
        $actorId = (string) $user['id'];
        $group = $this->groups->findForUser($id, $actorId);
        if ($group === null) {
            throw new HttpException(404, 'Grupa nie znaleziona.', 'GROUP_NOT_FOUND');
        }
        if (!$this->groups->canManageMembers($id, $actorId)) {
            throw new HttpException(403, 'Brak uprawnień do zarządzania członkami.', 'FORBIDDEN');
        }
        if ($userId === $actorId) {
            throw new HttpException(400, 'Nie możesz zmienić swojej własnej roli.', 'CANNOT_CHANGE_OWN_ROLE');
        }

        $input = $this->jsonInput();
        $validator = new Validator($input);
        $role = $validator->requiredString('role', 20, 'Rola');
        $validator->throwIfFails();

        $allowed = [
            CategoryGroupRepository::ROLE_VIEWER,
            CategoryGroupRepository::ROLE_EDITOR,
            CategoryGroupRepository::ROLE_CONTRIBUTOR,
            CategoryGroupRepository::ROLE_ADMIN,
        ];
        if (!in_array($role, $allowed, true)) {
            throw new HttpException(400, 'Nieprawidłowa rola.', 'INVALID_ROLE');
        }

        if (!$this->groups->updateMemberRole($id, $userId, $role)) {
            throw new HttpException(404, 'Członek nie znaleziony lub nie można zmienić roli właściciela.', 'MEMBER_NOT_FOUND');
        }

        return Response::json(['updated' => true]);
    }

    public function removeMember(string $id, string $userId): Response
    {
        $user = AuthMiddleware::user($this->request);
        $actorId = (string) $user['id'];
        $group = $this->groups->findForUser($id, $actorId);
        if ($group === null) {
            throw new HttpException(404, 'Grupa nie znaleziona.', 'GROUP_NOT_FOUND');
        }
        if (!$this->groups->canManageMembers($id, $actorId)) {
            throw new HttpException(403, 'Brak uprawnień do zarządzania członkami.', 'FORBIDDEN');
        }
        if ($userId === $actorId) {
            throw new HttpException(400, 'Właściciel nie może opuścić grupy w ten sposób. Usuń grupę lub przekaż własność.', 'CANNOT_REMOVE_OWNER');
        }

        if (!$this->groups->removeMember($id, $userId)) {
            throw new HttpException(404, 'Członek nie znaleziony.', 'MEMBER_NOT_FOUND');
        }

        return Response::json(['removed' => true]);
    }

    public function invitations(string $id): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];
        $group = $this->groups->findForUser($id, $userId);
        if ($group === null) {
            throw new HttpException(404, 'Grupa nie znaleziona.', 'GROUP_NOT_FOUND');
        }
        if (!$this->groups->canManageMembers($id, $userId)) {
            throw new HttpException(403, 'Brak uprawnień do zarządzania zaproszeniami.', 'FORBIDDEN');
        }

        $rows = $this->invitations->listForGroup($id);
        return Response::json([
            'invitations' => array_map(function (array $inv) use ($userId) {
                return [
                    'id' => (string) $inv['id'],
                    'email' => (string) $inv['email'],
                    'role' => (string) $inv['role'],
                    'expiresAt' => Str::isoFromMs($inv['expiresAt'] ?? null),
                    'usedAt' => $inv['usedAt'] !== null ? Str::isoFromMs($inv['usedAt']) : null,
                    'revokedAt' => $inv['revokedAt'] !== null ? Str::isoFromMs($inv['revokedAt']) : null,
                    'createdAt' => Str::isoFromMs($inv['createdAt'] ?? null),
                    'isUsed' => $inv['usedAt'] !== null,
                    'isRevoked' => $inv['revokedAt'] !== null,
                    'canRevoke' => (string) $inv['invitedById'] === $userId || $this->groups->canManageMembers($id, $userId),
                ];
            }, $rows),
        ]);
    }

    public function revokeInvitation(string $id, string $invitationId): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];
        $group = $this->groups->findForUser($id, $userId);
        if ($group === null) {
            throw new HttpException(404, 'Grupa nie znaleziona.', 'GROUP_NOT_FOUND');
        }
        if (!$this->groups->canManageMembers($id, $userId)) {
            throw new HttpException(403, 'Brak uprawnień do zarządzania zaproszeniami.', 'FORBIDDEN');
        }

        $invitation = null;
        foreach ($this->invitations->listForGroup($id) as $inv) {
            if ((string) $inv['id'] === $invitationId) {
                $invitation = $inv;
                break;
            }
        }
        if ($invitation === null) {
            throw new HttpException(404, 'Zaproszenie nie znalezione.', 'INVITATION_NOT_FOUND');
        }

        if (!$this->invitations->revoke($invitationId)) {
            throw new HttpException(400, 'Nie można odwołać tego zaproszenia.', 'CANNOT_REVOKE');
        }

        return Response::json(['revoked' => true]);
    }

    public function acceptInvitation(string $token): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];

        $invitation = $this->invitations->findByTokenHash(Str::hashToken($token));
        if ($invitation === null) {
            throw new HttpException(404, 'Zaproszenie nie znalezione.', 'INVITATION_NOT_FOUND');
        }
        if ((string) $invitation['usedAt'] !== '') {
            throw new HttpException(409, 'Zaproszenie zostało już wykorzystane.', 'INVITATION_USED');
        }
        if ((string) $invitation['revokedAt'] !== '') {
            throw new HttpException(409, 'Zaproszenie zostało odwołane.', 'INVITATION_REVOKED');
        }
        $expiresAt = (int) ($invitation['expiresAt'] ?? 0);
        if ($expiresAt > 0 && Str::nowMs() > $expiresAt) {
            throw new HttpException(409, 'Zaproszenie wygasło.', 'INVITATION_EXPIRED');
        }

        $groupId = (string) $invitation['groupId'];
        $role = (string) $invitation['role'];

        // Check if already a member.
        if ($this->groups->findMember($groupId, $userId) !== null) {
            $this->invitations->consume($invitation['id'], $userId);
            return Response::json(['message' => 'Jesteś już członkiem tej grupy.', 'groupId' => $groupId]);
        }

        $this->groups->addMember($groupId, $userId, $role, (string) $invitation['invitedById']);
        $this->invitations->consume($invitation['id'], $userId);

        $group = $this->groups->findForUser($groupId, $userId);
        return Response::json([
            'message' => 'Dołączono do grupy.',
            'group' => $this->serializeGroup($group ?? []),
        ]);
    }

    private function serializeGroup(array $row): array
    {
        return [
            'id' => (string) ($row['id'] ?? ''),
            'ownerId' => $row['ownerId'] !== null ? (string) $row['ownerId'] : null,
            'ownerUsername' => (string) ($row['ownerUsername'] ?? ''),
            'name' => (string) ($row['name'] ?? ''),
            'slug' => (string) ($row['slug'] ?? ''),
            'color' => (string) ($row['color'] ?? '#D9A3B0'),
            'icon' => (string) ($row['icon'] ?? 'Users'),
            'createdAt' => Str::isoFromMs($row['createdAt'] ?? null),
            'updatedAt' => Str::isoFromMs($row['updatedAt'] ?? null),
            'memberCount' => (int) ($row['memberCount'] ?? 0),
            'productCount' => (int) ($row['productCount'] ?? 0),
            'memberRole' => (string) ($row['memberRole'] ?? CategoryGroupRepository::ROLE_VIEWER),
            'isOwner' => isset($row['isOwner']) ? (bool) $row['isOwner'] : false,
        ];
    }

    private function validateColor(\App\Core\Validator $validator, array $input): string
    {
        if (!array_key_exists('color', $input) || $input['color'] === null || $input['color'] === '') {
            return '#D9A3B0';
        }
        $color = trim((string) $input['color']);
        if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) {
            $validator->addError('color', 'Wybierz poprawny kolor.');
            return '#D9A3B0';
        }
        return strtoupper($color);
    }

    private function validateIcon(\App\Core\Validator $validator, array $input): string
    {
        if (!array_key_exists('icon', $input) || $input['icon'] === null || $input['icon'] === '') {
            return 'Users';
        }
        $icon = trim((string) $input['icon']);
        if ($icon === '' || mb_strlen($icon) > 40) {
            $validator->addError('icon', 'Wybierz poprawną ikonę.');
            return 'Users';
        }
        return $icon;
    }
}
