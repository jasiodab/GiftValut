<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\App;
use App\Core\Str;

final class CartRepository
{
    /**
     * @return list<array{id: string, productId: string, quantity: int, createdAt: string, name: string|null, url: string|null, imageUrl: string|null, currentPrice: float|null, originalPrice: float|null, currency: string, storeName: string|null, categoryName: string|null}>
     */
    public function listForUser(string $userId): array
    {
        $rows = App::db()->fetchAll(
            'SELECT c.id, c.productId, c.quantity, c.createdAt,
                    p.name, p.url, p.imagePath AS imageUrl, p.currentPrice, p.originalPrice, p.currency,
                    s.name AS storeName,
                    cat.name AS categoryName
             FROM "Cart" c
             LEFT JOIN "Product" p ON p.id = c.productId AND p.userId = c.userId
             LEFT JOIN "Store" s ON s.id = p.storeId
             LEFT JOIN "Category" cat ON cat.id = p.categoryId
             WHERE c.userId = ?
             ORDER BY c.createdAt DESC',
            [$userId]
        );

        return array_map(static function (array $row): array {
            return [
                'id' => (string) $row['id'],
                'productId' => (string) $row['productId'],
                'quantity' => (int) $row['quantity'],
                'createdAt' => (string) $row['createdAt'],
                'name' => $row['name'] !== null ? (string) $row['name'] : null,
                'url' => $row['url'] !== null ? (string) $row['url'] : null,
                'imageUrl' => $row['imageUrl'] !== null ? (string) $row['imageUrl'] : null,
                'currentPrice' => $row['currentPrice'] !== null ? (float) $row['currentPrice'] : null,
                'originalPrice' => $row['originalPrice'] !== null ? (float) $row['originalPrice'] : null,
                'currency' => (string) ($row['currency'] ?? 'PLN'),
                'storeName' => $row['storeName'] !== null ? (string) $row['storeName'] : null,
                'categoryName' => $row['categoryName'] !== null ? (string) $row['categoryName'] : null,
            ];
        }, $rows);
    }

    public function countForUser(string $userId): int
    {
        return (int) App::db()->value(
            'SELECT COUNT(*) FROM "Cart" WHERE userId = ?',
            [$userId]
        );
    }

    public function add(string $userId, string $productId, int $quantity = 1): string
    {
        $existing = App::db()->value(
            'SELECT id FROM "Cart" WHERE userId = ? AND productId = ?',
            [$userId, $productId]
        );

        if ($existing !== null) {
            App::db()->run(
                'UPDATE "Cart" SET quantity = quantity + ? WHERE id = ?',
                [$quantity, (string) $existing]
            );
            return (string) $existing;
        }

        $id = Str::id();
        $now = date('Y-m-d H:i:s');
        App::db()->run(
            'INSERT INTO "Cart" (id, userId, productId, quantity, createdAt) VALUES (?, ?, ?, ?, ?)',
            [$id, $userId, $productId, $quantity, $now]
        );
        return $id;
    }

    public function remove(string $userId, string $cartId): bool
    {
        $result = App::db()->execute(
            'DELETE FROM "Cart" WHERE id = ? AND userId = ?',
            [$cartId, $userId]
        );
        return $result > 0;
    }

    public function clear(string $userId): int
    {
        return (int) App::db()->execute(
            'DELETE FROM "Cart" WHERE userId = ?',
            [$userId]
        );
    }
}
