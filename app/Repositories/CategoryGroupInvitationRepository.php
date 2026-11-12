<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\App;
use App\Core\Str;

final class CategoryGroupInvitationRepository
{
    public function create(string $groupId, string $tokenHash, string $role, string $invitedById, int $expiresAt): array
    {
        $id = Str::id();
        App::db()->run(
            'INSERT INTO "CategoryGroupInvitation" (id, groupId, tokenHash, role, invitedById, expiresAt, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [$id, $groupId, $tokenHash, $role, $invitedById, $expiresAt, Str::nowMs()]
        );
        return App::db()->fetch('SELECT * FROM "CategoryGroupInvitation" WHERE id = ?', [$id]) ?? [];
    }

    public function findByTokenHash(string $tokenHash): ?array
    {
        return App::db()->fetch('SELECT * FROM "CategoryGroupInvitation" WHERE tokenHash = ? LIMIT 1', [$tokenHash]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listForGroup(string $groupId, int $limit = 50): array
    {
        return App::db()->fetchAll(
            'SELECT * FROM "CategoryGroupInvitation" WHERE groupId = ? ORDER BY createdAt DESC LIMIT ?',
            [$groupId, $limit]
        );
    }

    public function revoke(string $id, ?string $groupId = null): bool
    {
        if ($groupId !== null) {
            return App::db()->execute(
                'UPDATE "CategoryGroupInvitation" SET revokedAt = ? WHERE id = ? AND groupId = ? AND revokedAt IS NULL AND usedAt IS NULL',
                [Str::nowMs(), $id, $groupId]
            ) > 0;
        }
        return App::db()->execute(
            'UPDATE "CategoryGroupInvitation" SET revokedAt = ? WHERE id = ? AND revokedAt IS NULL AND usedAt IS NULL',
            [Str::nowMs(), $id]
        ) > 0;
    }

    public function consume(string $id, string $userId): bool
    {
        return App::db()->execute(
            'UPDATE "CategoryGroupInvitation" SET usedAt = ?, usedById = ? WHERE id = ? AND usedAt IS NULL AND revokedAt IS NULL',
            [Str::nowMs(), $userId, $id]
        ) > 0;
    }

    public function delete(string $id): bool
    {
        return App::db()->execute('DELETE FROM "CategoryGroupInvitation" WHERE id = ?', [$id]) > 0;
    }
}
