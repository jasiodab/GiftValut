<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\App;
use App\Core\Str;

final class InvitationRepository
{
    public function create(string $tokenHash, string $createdById, int $expiresAt): array
    {
        $id = Str::id();
        App::db()->run(
            'INSERT INTO "Invitation" (id, tokenHash, createdById, expiresAt, createdAt)
             VALUES (?, ?, ?, ?, ?)',
            [$id, $tokenHash, $createdById, $expiresAt, Str::nowMs()]
        );
        return App::db()->fetch('SELECT * FROM "Invitation" WHERE id = ?', [$id]) ?? [];
    }

    public function findByTokenHash(string $tokenHash): ?array
    {
        return App::db()->fetch('SELECT * FROM "Invitation" WHERE tokenHash = ? LIMIT 1', [$tokenHash]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listRecent(int $limit = 50): array
    {
        return App::db()->fetchAll(
            'SELECT * FROM "Invitation" ORDER BY createdAt DESC LIMIT ?',
            [$limit]
        );
    }

    public function revoke(string $id): bool
    {
        return App::db()->execute(
            'UPDATE "Invitation" SET revokedAt = ? WHERE id = ? AND revokedAt IS NULL AND usedAt IS NULL',
            [Str::nowMs(), $id]
        ) > 0;
    }

    public function consume(string $id, string $userId): bool
    {
        return App::db()->execute(
            'UPDATE "Invitation" SET usedAt = ?, usedById = ? WHERE id = ? AND usedAt IS NULL AND revokedAt IS NULL',
            [Str::nowMs(), $userId, $id]
        ) > 0;
    }
}
