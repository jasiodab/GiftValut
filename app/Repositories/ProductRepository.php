<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\App;
use App\Core\Str;

final class ProductRepository
{
    private const SELECT = 'SELECT p.*, s.name AS storeName, s.domain AS storeDomain,
            c.name AS categoryName, c.slug AS categorySlug, c.color AS categoryColor, c.icon AS categoryIcon
        FROM "Product" p
        LEFT JOIN "Store" s ON s.id = p.storeId
        LEFT JOIN "Category" c ON c.id = p.categoryId';

    /**
     * @param array{search?: string, status?: string, categoryId?: string, groupId?: string, favorite?: bool, sort?: string} $filters
     * @return array{products: list<array<string, mixed>>, total: int}
     */
    public function paginateForUser(string $userId, array $filters, int $page, int $pageSize, TagRepository $tags): array
    {
        [$where, $params] = $this->buildWhere($userId, $filters);
        $total = (int) App::db()->value(
            'SELECT COUNT(*) FROM "Product" p
             LEFT JOIN "Store" s ON s.id = p.storeId
             WHERE ' . $where,
            $params
        );

        $order = match ($filters['sort'] ?? 'recent') {
            'price-asc' => 'p.currentPrice ASC, p.createdAt DESC',
            'price-desc' => 'p.currentPrice DESC, p.createdAt DESC',
            'name' => 'p.name ASC',
            'updated' => 'p.updatedAt DESC',
            default => 'p.createdAt DESC',
        };

        $offset = max(0, ($page - 1) * $pageSize);
        $rows = App::db()->fetchAll(
            self::SELECT . ' WHERE ' . $where . ' ORDER BY ' . $order . ' LIMIT ? OFFSET ?',
            array_merge($params, [$pageSize, $offset])
        );

        $rows = $this->attachTags($rows, $tags);

        return ['products' => $rows, 'total' => $total];
    }

    public function findForUser(string $id, string $userId, TagRepository $tags): ?array
    {
        $row = App::db()->fetch(
            self::SELECT . ' WHERE p.id = ? AND p.userId = ? LIMIT 1',
            [$id, $userId]
        );
        if ($row === null) {
            return null;
        }
        return $this->attachTags([$row], $tags)[0];
    }

    public function findByNormalizedUrl(string $userId, string $normalizedUrl, ?string $exceptId = null): ?array
    {
        if ($exceptId !== null) {
            return App::db()->fetch(
                'SELECT id, name, createdAt FROM "Product" WHERE userId = ? AND normalizedUrl = ? AND id <> ? LIMIT 1',
                [$userId, $normalizedUrl, $exceptId]
            );
        }
        return App::db()->fetch(
            'SELECT id, name, createdAt FROM "Product" WHERE userId = ? AND normalizedUrl = ? LIMIT 1',
            [$userId, $normalizedUrl]
        );
    }

    public function findRowForUser(string $id, string $userId): ?array
    {
        return App::db()->fetch(
            'SELECT * FROM "Product" WHERE id = ? AND userId = ? LIMIT 1',
            [$id, $userId]
        );
    }

    public function create(array $data): string
    {
        $id = Str::id();
        $now = Str::nowMs();
        App::db()->run(
            'INSERT INTO "Product" (id, userId, name, url, normalizedUrl, description, imagePath, imageSourceUrl,
                currentPrice, originalPrice, currency, availability, status, notes, autoTrack, storeId, categoryId, groupId,
                lastCheckStatus, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $id,
                $data['userId'],
                $data['name'],
                $data['url'],
                $data['normalizedUrl'],
                $data['description'] ?? null,
                $data['imagePath'] ?? null,
                $data['imageSourceUrl'] ?? null,
                $data['currentPrice'] ?? null,
                $data['originalPrice'] ?? null,
                $data['currency'] ?? 'PLN',
                $data['availability'] ?? null,
                $data['status'] ?? 'TO_CONSIDER',
                $data['notes'] ?? null,
                0,
                $data['storeId'] ?? null,
                $data['categoryId'],
                $data['groupId'] ?? null,
                'NEVER',
                $now,
                $now,
            ]
        );
        return $id;
    }

    public function update(string $id, string $userId, array $data): void
    {
        $allowed = [
            'name', 'url', 'normalizedUrl', 'description', 'imagePath', 'imageSourceUrl',
            'currentPrice', 'originalPrice', 'currency', 'availability', 'status', 'notes',
            'storeId', 'categoryId', 'groupId',
        ];
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
        App::db()->execute('UPDATE "Product" SET ' . implode(', ', $sets) . ' WHERE id = ? AND userId = ?', $params);
    }

    public function delete(string $id, string $userId): void
    {
        App::db()->execute('DELETE FROM "Product" WHERE id = ? AND userId = ?', [$id, $userId]);
    }

    public function countByImagePath(string $imagePath, ?string $userId = null): int
    {
        if ($userId !== null) {
            return (int) App::db()->value(
                'SELECT COUNT(*) FROM "Product" WHERE imagePath = ? AND userId = ?',
                [$imagePath, $userId]
            );
        }
        return (int) App::db()->value('SELECT COUNT(*) FROM "Product" WHERE imagePath = ?', [$imagePath]);
    }

    /**
     * @param list<string> $ids
     */
    public function updateStatusBulk(string $userId, array $ids, string $status): int
    {
        if ($ids === []) {
            return 0;
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        return App::db()->execute(
            'UPDATE "Product" SET status = ?, updatedAt = ? WHERE userId = ? AND id IN (' . $placeholders . ')',
            array_merge([$status, Str::nowMs(), $userId], $ids)
        );
    }

    /**
     * @param list<string> $ids
     * @return list<array{id: string, imagePath: ?string}>
     */
    public function findManyForUser(string $userId, array $ids): array
    {
        if ($ids === []) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        return App::db()->fetchAll(
            'SELECT id, imagePath FROM "Product" WHERE userId = ? AND id IN (' . $placeholders . ')',
            array_merge([$userId], $ids)
        );
    }

    public function countForUser(string $userId): int
    {
        return (int) App::db()->value('SELECT COUNT(*) FROM "Product" WHERE userId = ?', [$userId]);
    }

    /**
     * @param list<array<string, mixed>> $rows
     * @return list<array<string, mixed>>
     */
    private function attachTags(array $rows, TagRepository $tags): array
    {
        if ($rows === []) {
            return [];
        }
        $ids = array_map(static fn (array $row): string => (string) $row['id'], $rows);
        $names = $tags->namesForProducts($ids);
        foreach ($rows as $index => $row) {
            $rows[$index]['tags'] = $names[(string) $row['id']] ?? [];
        }
        return $rows;
    }

    /**
     * @param array{search?: string, status?: string, categoryId?: string, favorite?: bool} $filters
     * @return array{0: string, 1: list<mixed>}
     */
    private function buildWhere(string $userId, array $filters): array
    {
        $where = 'p.userId = ?';
        $params = [$userId];

        $status = $filters['status'] ?? 'ALL';
        if (($filters['favorite'] ?? false) === true) {
            $where .= " AND p.status = 'FAVORITE'";
        } elseif ($status !== '' && $status !== 'ALL') {
            $where .= ' AND p.status = ?';
            $params[] = $status;
        }

        if (($filters['categoryId'] ?? '') !== '') {
            $where .= ' AND p.categoryId = ?';
            $params[] = $filters['categoryId'];
        }

        if (($filters['groupId'] ?? '') !== '') {
            $where .= ' AND p.groupId = ?';
            $params[] = $filters['groupId'];
        }

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $like = '%' . $search . '%';
            $where .= ' AND (p.name LIKE ? OR p.description LIKE ? OR p.notes LIKE ? OR s.name LIKE ?
                OR EXISTS (SELECT 1 FROM "ProductTag" pt INNER JOIN "Tag" t ON t.id = pt.tagId
                           WHERE pt.productId = p.id AND t.name LIKE ?))';
            array_push($params, $like, $like, $like, $like, $like);
        }

        return [$where, $params];
    }
}
