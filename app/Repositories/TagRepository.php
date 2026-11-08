<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\App;
use App\Core\Str;

final class TagRepository
{
    /**
     * @return list<array{id: string, name: string, count: int}>
     */
    public function listForUser(string $userId): array
    {
        $rows = App::db()->fetchAll(
            'SELECT t.id, t.name, COUNT(pt.productId) AS count
             FROM "Tag" t
             LEFT JOIN "ProductTag" pt ON pt.tagId = t.id
             WHERE t.userId = ?
             GROUP BY t.id, t.name
             ORDER BY t.name ASC',
            [$userId]
        );
        return array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'name' => (string) $row['name'],
            'count' => (int) $row['count'],
        ], $rows);
    }

    public function findByName(string $userId, string $name): ?array
    {
        return App::db()->fetch(
            'SELECT * FROM "Tag" WHERE userId = ? AND name = ? LIMIT 1',
            [$userId, $name]
        );
    }

    public function create(string $userId, string $name): array
    {
        $id = Str::id();
        App::db()->run(
            'INSERT INTO "Tag" (id, userId, name, createdAt) VALUES (?, ?, ?, ?)',
            [$id, $userId, $name, Str::nowMs()]
        );
        return ['id' => $id, 'userId' => $userId, 'name' => $name];
    }

    public function attach(string $productId, string $tagId): void
    {
        App::db()->run(
            'INSERT OR IGNORE INTO "ProductTag" (productId, tagId) VALUES (?, ?)',
            [$productId, $tagId]
        );
    }

    public function detachAll(string $productId): void
    {
        App::db()->execute('DELETE FROM "ProductTag" WHERE productId = ?', [$productId]);
    }

    /**
     * @param list<string> $productIds
     * @return list<string>
     */
    public function tagIdsForProducts(array $productIds): array
    {
        if ($productIds === []) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($productIds), '?'));
        $rows = App::db()->fetchAll(
            'SELECT DISTINCT tagId FROM "ProductTag" WHERE productId IN (' . $placeholders . ')',
            $productIds
        );
        return array_map(static fn (array $row): string => (string) $row['tagId'], $rows);
    }

    public function deleteOrphans(string $userId): void
    {
        App::db()->execute(
            'DELETE FROM "Tag"
             WHERE userId = ? AND NOT EXISTS (
                 SELECT 1 FROM "ProductTag" pt WHERE pt.tagId = "Tag".id
             )',
            [$userId]
        );
    }

    /**
     * @param list<string> $productIds
     * @return array<string, list<string>>
     */
    public function namesForProducts(array $productIds): array
    {
        if ($productIds === []) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($productIds), '?'));
        $rows = App::db()->fetchAll(
            'SELECT pt.productId, t.name
             FROM "ProductTag" pt
             INNER JOIN "Tag" t ON t.id = pt.tagId
             WHERE pt.productId IN (' . $placeholders . ')
             ORDER BY t.name ASC',
            $productIds
        );
        $result = [];
        foreach ($rows as $row) {
            $result[(string) $row['productId']][] = (string) $row['name'];
        }
        return $result;
    }

    public function countForUser(string $userId): int
    {
        return (int) App::db()->value('SELECT COUNT(*) FROM "Tag" WHERE userId = ?', [$userId]);
    }
}
