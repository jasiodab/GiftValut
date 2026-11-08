<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\App;
use App\Core\Str;

final class StoreRepository
{
    public function findForUser(string $id, string $userId): ?array
    {
        return App::db()->fetch(
            'SELECT * FROM "Store" WHERE id = ? AND userId = ? LIMIT 1',
            [$id, $userId]
        );
    }

    public function findByDomain(string $userId, string $domain): ?array
    {
        return App::db()->fetch(
            'SELECT * FROM "Store" WHERE userId = ? AND domain = ? LIMIT 1',
            [$userId, $domain]
        );
    }

    public function upsert(string $userId, string $domain, string $name): array
    {
        $existing = $this->findByDomain($userId, $domain);
        if ($existing !== null) {
            App::db()->execute('UPDATE "Store" SET name = ? WHERE id = ?', [$name, $existing['id']]);
            $existing['name'] = $name;
            return $existing;
        }

        $id = Str::id();
        App::db()->run(
            'INSERT INTO "Store" (id, userId, name, domain, createdAt) VALUES (?, ?, ?, ?, ?)',
            [$id, $userId, $name, $domain, Str::nowMs()]
        );
        return $this->findForUser($id, $userId) ?? [];
    }

    public function countForUser(string $userId): int
    {
        return (int) App::db()->value('SELECT COUNT(*) FROM "Store" WHERE userId = ?', [$userId]);
    }
}
