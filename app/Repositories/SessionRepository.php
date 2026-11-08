<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\App;
use App\Core\Str;

final class SessionRepository
{
    public function create(string $userId, string $tokenHash, int $expiresAt): string
    {
        $id = Str::id();
        $now = Str::nowMs();
        App::db()->run(
            'INSERT INTO "Session" (id, userId, tokenHash, expiresAt, createdAt, lastSeenAt, revokedAt)
             VALUES (?, ?, ?, ?, ?, ?, NULL)',
            [$id, $userId, $tokenHash, $expiresAt, $now, $now]
        );
        return $id;
    }

    public function revokeByTokenHash(string $tokenHash): void
    {
        App::db()->execute(
            'UPDATE "Session" SET revokedAt = ? WHERE tokenHash = ? AND revokedAt IS NULL',
            [Str::nowMs(), $tokenHash]
        );
    }

    public function revokeAllForUser(string $userId): void
    {
        App::db()->execute(
            'UPDATE "Session" SET revokedAt = ? WHERE userId = ? AND revokedAt IS NULL',
            [Str::nowMs(), $userId]
        );
    }

    public function cleanupExpired(): void
    {
        App::db()->execute('DELETE FROM "Session" WHERE expiresAt < ?', [Str::nowMs() - 86400000]);
    }
}
