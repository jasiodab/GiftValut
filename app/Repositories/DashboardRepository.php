<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\App;
use App\Services\Serializer;

final class DashboardRepository
{
    public function data(string $userId, ProductRepository $products, TagRepository $tags, SettingsRepository $settings): array
    {
        $database = App::db();

        $settingsRow = $settings->findForUser($userId);
        $statusRows = $database->fetchAll(
            'SELECT status, COUNT(*) AS count FROM "Product" WHERE userId = ? GROUP BY status',
            [$userId]
        );
        $statusCounts = [];
        $totalProducts = 0;
        foreach ($statusRows as $row) {
            $statusCounts[(string) $row['status']] = (int) $row['count'];
            $totalProducts += (int) $row['count'];
        }

        $totalValue = (float) ($database->value(
            'SELECT SUM(currentPrice) FROM "Product" WHERE userId = ?',
            [$userId]
        ) ?? 0);
        $withPrice = (int) $database->value(
            'SELECT COUNT(*) FROM "Product" WHERE userId = ? AND currentPrice IS NOT NULL',
            [$userId]
        );

        $recentRows = $database->fetchAll(
            'SELECT p.*, s.name AS storeName, s.domain AS storeDomain,
                    c.name AS categoryName, c.slug AS categorySlug, c.color AS categoryColor, c.icon AS categoryIcon
             FROM "Product" p
             LEFT JOIN "Store" s ON s.id = p.storeId
             LEFT JOIN "Category" c ON c.id = p.categoryId
             WHERE p.userId = ?
             ORDER BY p.createdAt DESC LIMIT 4',
            [$userId]
        );
        $favoriteRows = $database->fetchAll(
            "SELECT p.*, s.name AS storeName, s.domain AS storeDomain,
                    c.name AS categoryName, c.slug AS categorySlug, c.color AS categoryColor, c.icon AS categoryIcon
             FROM \"Product\" p
             LEFT JOIN \"Store\" s ON s.id = p.storeId
             LEFT JOIN \"Category\" c ON c.id = p.categoryId
             WHERE p.userId = ? AND p.status = 'FAVORITE'
             ORDER BY p.createdAt DESC LIMIT 4",
            [$userId]
        );

        $recentIds = array_map(static fn (array $row): string => (string) $row['id'], $recentRows);
        $favoriteIds = array_map(static fn (array $row): string => (string) $row['id'], $favoriteRows);
        $tagNames = $tags->namesForProducts(array_values(array_unique(array_merge($recentIds, $favoriteIds))));
        foreach ($recentRows as $index => $row) {
            $recentRows[$index]['tags'] = $tagNames[(string) $row['id']] ?? [];
        }
        foreach ($favoriteRows as $index => $row) {
            $favoriteRows[$index]['tags'] = $tagNames[(string) $row['id']] ?? [];
        }

        $categoryRows = $database->fetchAll(
            'SELECT c.id, c.name, c.color, COUNT(p.id) AS count
             FROM "Category" c
             LEFT JOIN "Product" p ON p.categoryId = c.id AND p.userId = c.userId
             WHERE c.userId = ?
             GROUP BY c.id, c.name, c.color
             ORDER BY count DESC, c.name ASC
             LIMIT 5',
            [$userId]
        );

        return [
            'currency' => (string) ($settingsRow['currency'] ?? 'PLN'),
            'stats' => [
                'totalProducts' => $totalProducts,
                'favorites' => $statusCounts['FAVORITE'] ?? 0,
                'toBuy' => $statusCounts['TO_BUY'] ?? 0,
                'purchased' => $statusCounts['PURCHASED'] ?? 0,
                'totalValue' => round($totalValue + 1.0E-9, 2),
                'withPrice' => $withPrice,
            ],
            'recentlyAdded' => array_map([Serializer::class, 'product'], $recentRows),
            'favorites' => array_map([Serializer::class, 'product'], $favoriteRows),
            'categorySummary' => array_map(static fn (array $row): array => [
                'id' => (string) $row['id'],
                'name' => (string) $row['name'],
                'color' => (string) $row['color'],
                'count' => (int) $row['count'],
            ], $categoryRows),
        ];
    }
}
