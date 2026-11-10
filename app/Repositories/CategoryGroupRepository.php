<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\App;
use App\Core\Str;
use App\Core\HttpException;

/**
 * Repository for shared category groups.
 *
 * Roles:
 *  - OWNER     - group owner, full control incl. managing members and deleting the group
 *  - ADMIN     - can manage members and edit group details, cannot delete unless owner
 *  - EDITOR    - can edit existing products in group categories, cannot add new
 *  - CONTRIBUTOR - can add and edit products in group categories
 *  - VIEWER    - can only view products in group categories
 */
final class CategoryGroupRepository
{
    public const ROLE_OWNER = 'OWNER';
    public const ROLE_ADMIN = 'ADMIN';
    public const ROLE_EDITOR = 'EDITOR';
    public const ROLE_CONTRIBUTOR = 'CONTRIBUTOR';
    public const ROLE_VIEWER = 'VIEWER';

    /**
     * @return list<array<string, mixed>>
     */
    public function listForUser(string $userId): array
    {
        return App::db()->fetchAll(
            'SELECT g.*,
                    m.role AS memberRole,
                    m.joinedAt AS memberJoinedAt,
                    u.username AS ownerUsername
             FROM "CategoryGroup" g
             INNER JOIN "CategoryGroupMember" m ON m.groupId = g.id AND m.userId = ?
             LEFT JOIN "User" u ON u.id = g.ownerId
             ORDER BY g.name ASC',
            [$userId]
        );
    }

    public function findById(string $id): ?array
    {
        return App::db()->fetch(
            'SELECT * FROM "CategoryGroup" WHERE id = ? LIMIT 1',
            [$id]
        );
    }

    public function findForUser(string $id, string $userId): ?array
    {
        return App::db()->fetch(
            'SELECT g.*, m.role AS memberRole
             FROM "CategoryGroup" g
             INNER JOIN "CategoryGroupMember" m ON m.groupId = g.id AND m.userId = ?
             WHERE g.id = ? LIMIT 1',
            [$userId, $id]
        );
    }

    public function findBySlug(string $ownerId, string $slug): ?array
    {
        return App::db()->fetch(
            'SELECT * FROM "CategoryGroup" WHERE ownerId = ? AND slug = ? LIMIT 1',
            [$ownerId, $slug]
        );
    }

    public function slugExists(string $ownerId, string $slug, ?string $exceptId = null): bool
    {
        if ($exceptId !== null) {
            return (bool) App::db()->value(
                'SELECT 1 FROM "CategoryGroup" WHERE ownerId = ? AND slug = ? AND id <> ? LIMIT 1',
                [$ownerId, $slug, $exceptId]
            );
        }
        return (bool) App::db()->value(
            'SELECT 1 FROM "CategoryGroup" WHERE ownerId = ? AND slug = ? LIMIT 1',
            [$ownerId, $slug]
        );
    }

    public function create(string $ownerId, string $name, string $slug, string $color, string $icon): array
    {
        $id = Str::id();
        $now = Str::nowMs();
        App::db()->run(
            'INSERT INTO "CategoryGroup" (id, ownerId, name, slug, color, icon, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$id, $ownerId, $name, $slug, $color, $icon, $now, $now]
        );
        // Owner is automatically a member with OWNER role.
        $this->addMember($id, $ownerId, self::ROLE_OWNER, $ownerId, $now);

        return $this->findForUser($id, $ownerId) ?? [];
    }

    public function update(string $id, string $userId, array $data): void
    {
        $allowed = ['name', 'color', 'icon'];
        $sets = [];
        $params = [];
        foreach ($allowed as $field) {
            if (array_key_exists($field, $data)) {
                $sets[] = '"' . $field . '" = ?';
                $params[] = $data[$field];
            }
        }
        if ($sets === []) {
            return;
        }
        $sets[] = '"updatedAt" = ?';
        $params[] = Str::nowMs();
        $params[] = $id;
        $params[] = $userId;
        App::db()->execute('UPDATE "CategoryGroup" SET ' . implode(', ', $sets) . ' WHERE id = ? AND ownerId = ?', $params);
    }

    public function delete(string $id, string $ownerId): bool
    {
        return App::db()->execute(
            'DELETE FROM "CategoryGroup" WHERE id = ? AND ownerId = ?',
            [$id, $ownerId]
        ) > 0;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listMembers(string $groupId): array
    {
        return App::db()->fetchAll(
            'SELECT m.*, u.username, u.email
             FROM "CategoryGroupMember" m
             INNER JOIN "User" u ON u.id = m.userId
             WHERE m.groupId = ?
             ORDER BY m.role ASC, u.username ASC',
            [$groupId]
        );
    }

    public function findMember(string $groupId, string $userId): ?array
    {
        return App::db()->fetch(
            'SELECT * FROM "CategoryGroupMember" WHERE groupId = ? AND userId = ? LIMIT 1',
            [$groupId, $userId]
        );
    }

    public function addMember(string $groupId, string $userId, string $role, ?string $invitedById = null, ?int $joinedAt = null): void
    {
        $id = Str::id();
        $now = $joinedAt ?? Str::nowMs();
        App::db()->run(
            'INSERT INTO "CategoryGroupMember" (id, groupId, userId, role, joinedAt, invitedById)
             VALUES (?, ?, ?, ?, ?, ?)',
            [$id, $groupId, $userId, $role, $now, $invitedById]
        );
    }

    public function updateMemberRole(string $groupId, string $userId, string $role): bool
    {
        // Owner cannot be downgraded.
        $member = $this->findMember($groupId, $userId);
        if ($member === null) {
            return false;
        }
        if ((string) $member['role'] === self::ROLE_OWNER) {
            return false;
        }
        return App::db()->execute(
            'UPDATE "CategoryGroupMember" SET role = ? WHERE groupId = ? AND userId = ?',
            [$role, $groupId, $userId]
        ) > 0;
    }

    public function removeMember(string $groupId, string $userId): bool
    {
        // Owner cannot be removed.
        $member = $this->findMember($groupId, $userId);
        if ($member === null || (string) $member['role'] === self::ROLE_OWNER) {
            return false;
        }
        return App::db()->execute(
            'DELETE FROM "CategoryGroupMember" WHERE groupId = ? AND userId = ?',
            [$groupId, $userId]
        ) > 0;
    }

    public function memberCount(string $groupId): int
    {
        return (int) App::db()->value(
            'SELECT COUNT(*) FROM "CategoryGroupMember" WHERE groupId = ?',
            [$groupId]
        );
    }

    public function productCount(string $groupId): int
    {
        return (int) App::db()->value(
            'SELECT COUNT(*) FROM "Product" WHERE groupId = ?',
            [$groupId]
        );
    }

    /**
     * Check if a user has at least the given role in a group.
     * Role hierarchy: VIEWER < EDITOR < CONTRIBUTOR < ADMIN < OWNER
     */
    public function userHasRole(string $groupId, string $userId, string $requiredRole): bool
    {
        $member = $this->findMember($groupId, $userId);
        if ($member === null) {
            return false;
        }
        $userRole = (string) $member['role'];
        if ($userRole === self::ROLE_OWNER) {
            return true;
        }
        return $this->roleRank($userRole) >= $this->roleRank($requiredRole);
    }

    private function roleRank(string $role): int
    {
        return match ($role) {
            self::ROLE_VIEWER => 1,
            self::ROLE_EDITOR => 2,
            self::ROLE_CONTRIBUTOR => 3,
            self::ROLE_ADMIN => 4,
            self::ROLE_OWNER => 5,
            default => 0,
        };
    }

    /**
     * Verify a user can manage members of a group (ADMIN or OWNER).
     */
    public function canManageMembers(string $groupId, string $userId): bool
    {
        return $this->userHasRole($groupId, $userId, self::ROLE_ADMIN);
    }

    /**
     * Verify a user can add/edit products in the group (CONTRIBUTOR or higher).
     */
    public function canManageProducts(string $groupId, string $userId): bool
    {
        return $this->userHasRole($groupId, $userId, self::ROLE_CONTRIBUTOR);
    }

    /**
     * Verify a user can edit existing products (EDITOR or higher).
     */
    public function canEditProducts(string $groupId, string $userId): bool
    {
        return $this->userHasRole($groupId, $userId, self::ROLE_EDITOR);
    }

    /**
     * Verify a user can at least view the group (VIEWER or higher).
     */
    public function canView(string $groupId, string $userId): bool
    {
        return $this->userHasRole($groupId, $userId, self::ROLE_VIEWER);
    }
}
