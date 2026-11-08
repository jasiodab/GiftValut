<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\App;
use App\Core\Str;

final class CategoryRepository
{
    /**
     * @return list<array<string, mixed>>
     */
    public function listForUser(string $userId): array
    {
        return App::db()->fetchAll(
            'SELECT c.*,
                    COALESCE(p.productCount, 0) AS productCount,
                    COALESCE(p.totalValue, 0) AS totalValue
             FROM "Category" c
             LEFT JOIN (
                 SELECT categoryId, COUNT(*) AS productCount, SUM(COALESCE(currentPrice, 0)) AS totalValue
                 FROM "Product" WHERE userId = ? GROUP BY categoryId
             ) p ON p.categoryId = c.id
             WHERE c.userId = ?
             ORDER BY c.sortOrder ASC, c.name ASC',
            [$userId, $userId]
        );
    }

    public function findForUser(string $id, string $userId): ?array
    {
        return App::db()->fetch(
            'SELECT * FROM "Category" WHERE id = ? AND userId = ? LIMIT 1',
            [$id, $userId]
        );
    }

    public function findByName(string $userId, string $name, ?string $exceptId = null): ?array
    {
        if ($exceptId !== null) {
            return App::db()->fetch(
                'SELECT * FROM "Category" WHERE userId = ? AND name = ? AND id <> ? LIMIT 1',
                [$userId, $name, $exceptId]
            );
        }
        return App::db()->fetch(
            'SELECT * FROM "Category" WHERE userId = ? AND name = ? LIMIT 1',
            [$userId, $name]
        );
    }

    public function slugExists(string $userId, string $slug): bool
    {
        return (bool) App::db()->value(
            'SELECT 1 FROM "Category" WHERE userId = ? AND slug = ? LIMIT 1',
            [$userId, $slug]
        );
    }

    public function maxSortOrder(string $userId): int
    {
        return (int) (App::db()->value('SELECT MAX(sortOrder) FROM "Category" WHERE userId = ?', [$userId]) ?? 0);
    }

    public function create(string $userId, string $name, string $slug, string $color, string $icon, int $sortOrder, bool $isDefault = false): array
    {
        $id = Str::id();
        $now = Str::nowMs();
        App::db()->run(
            'INSERT INTO "Category" (id, userId, name, slug, color, icon, sortOrder, isDefault, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$id, $userId, $name, $slug, $color, $icon, $sortOrder, $isDefault ? 1 : 0, $now, $now]
        );
        return $this->findForUser($id, $userId) ?? [];
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
        App::db()->execute('UPDATE "Category" SET ' . implode(', ', $sets) . ' WHERE id = ? AND userId = ?', $params);
    }

    public function delete(string $id, string $userId): void
    {
        App::db()->execute('DELETE FROM "Category" WHERE id = ? AND userId = ?', [$id, $userId]);
    }

    public function productCount(string $id, string $userId): int
    {
        return (int) App::db()->value(
            'SELECT COUNT(*) FROM "Product" WHERE categoryId = ? AND userId = ?',
            [$id, $userId]
        );
    }

    public function findOther(string $userId): ?array
    {
        return App::db()->fetch(
            "SELECT * FROM \"Category\" WHERE userId = ? AND slug = 'other' LIMIT 1",
            [$userId]
        );
    }

    public function firstForUser(string $userId): ?array
    {
        return App::db()->fetch(
            'SELECT * FROM "Category" WHERE userId = ? ORDER BY sortOrder ASC LIMIT 1',
            [$userId]
        );
    }
}
