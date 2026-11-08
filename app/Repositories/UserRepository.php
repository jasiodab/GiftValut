<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\App;
use App\Core\Str;

final class UserRepository
{
    public function findByLogin(string $login): ?array
    {
        return App::db()->fetch(
            'SELECT * FROM "User" WHERE username = ? OR email = ? LIMIT 1',
            [$login, $login]
        );
    }

    public function findById(string $id): ?array
    {
        return App::db()->fetch('SELECT * FROM "User" WHERE id = ? LIMIT 1', [$id]);
    }

    public function findByEmail(string $email): ?array
    {
        return App::db()->fetch('SELECT * FROM "User" WHERE email = ? LIMIT 1', [$email]);
    }

    public function findByUsername(string $username): ?array
    {
        return App::db()->fetch('SELECT * FROM "User" WHERE username = ? LIMIT 1', [$username]);
    }

    public function ownerCount(): int
    {
        return (int) App::db()->value("SELECT COUNT(*) FROM \"User\" WHERE role = 'OWNER'");
    }

    public function create(
        string $username,
        string $email,
        string $passwordHash,
        string $role = 'USER',
        string $status = 'ACTIVE',
        bool $mustChangePassword = false
    ): array {
        $id = Str::id();
        $now = Str::nowMs();
        App::db()->run(
            'INSERT INTO "User" (id, username, email, passwordHash, role, status, mustChangePassword, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$id, $username, $email, $passwordHash, $role, $status, $mustChangePassword ? 1 : 0, $now, $now]
        );
        return $this->findById($id) ?? [];
    }

    public function touchLogin(string $id): void
    {
        App::db()->execute(
            'UPDATE "User" SET lastLoginAt = ?, updatedAt = ? WHERE id = ?',
            [Str::nowMs(), Str::nowMs(), $id]
        );
    }

    public function updatePassword(string $id, string $passwordHash): void
    {
        App::db()->execute(
            'UPDATE "User" SET passwordHash = ?, mustChangePassword = 0, updatedAt = ? WHERE id = ?',
            [$passwordHash, Str::nowMs(), $id]
        );
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listAll(int $limit = 100): array
    {
        return App::db()->fetchAll(
            'SELECT id, username, email, role, status, createdAt, lastLoginAt
             FROM "User" ORDER BY createdAt DESC LIMIT ?',
            [$limit]
        );
    }

    public function setStatus(string $id, string $status): bool
    {
        return App::db()->execute(
            'UPDATE "User" SET status = ?, updatedAt = ? WHERE id = ?',
            [$status, Str::nowMs(), $id]
        ) > 0;
    }

    public function delete(string $id): bool
    {
        return App::db()->execute('DELETE FROM "User" WHERE id = ?', [$id]) > 0;
    }

    public function claimUnownedData(string $userId): void
    {
        $database = App::db();
        $database->transaction(static function () use ($database, $userId): void {
            foreach (['Product', 'Category', 'Tag', 'PriceHistory', 'PriceOffer', 'PriceCheck', 'Settings', 'Store'] as $table) {
                $database->execute('UPDATE "' . $table . '" SET userId = ? WHERE userId IS NULL', [$userId]);
            }
        });
    }
}
