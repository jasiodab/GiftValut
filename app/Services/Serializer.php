<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Str;

final class Serializer
{
    /**
     * Convert a joined product row into the same JSON shape the old API used.
     */
    public static function product(array $row): array
    {
        $currentPrice = $row['currentPrice'] !== null ? (float) $row['currentPrice'] : null;
        $originalPrice = $row['originalPrice'] !== null ? (float) $row['originalPrice'] : null;

        $store = null;
        if (($row['storeId'] ?? null) !== null && ($row['storeName'] ?? null) !== null) {
            $store = [
                'id' => (string) $row['storeId'],
                'name' => (string) $row['storeName'],
                'domain' => (string) ($row['storeDomain'] ?? ''),
            ];
        }

        $category = null;
        if (($row['categoryId'] ?? null) !== null && ($row['categoryName'] ?? null) !== null) {
            $category = [
                'id' => (string) $row['categoryId'],
                'name' => (string) $row['categoryName'],
                'slug' => (string) ($row['categorySlug'] ?? ''),
                'color' => (string) ($row['categoryColor'] ?? '#D9A3B0'),
                'icon' => (string) ($row['categoryIcon'] ?? 'Tag'),
            ];
        }

        $tags = $row['tags'] ?? [];
        if (!is_array($tags)) {
            $tags = [];
        }

        return [
            'id' => (string) $row['id'],
            'name' => (string) $row['name'],
            'groupId' => $row['groupId'] !== null ? (string) $row['groupId'] : null,
            'url' => (string) $row['url'],
            'normalizedUrl' => (string) $row['normalizedUrl'],
            'description' => $row['description'] !== null ? (string) $row['description'] : null,
            'imageUrl' => $row['imagePath'] !== null ? (string) $row['imagePath'] : null,
            'imageSourceUrl' => $row['imageSourceUrl'] !== null ? (string) $row['imageSourceUrl'] : null,
            'currentPrice' => $currentPrice,
            'originalPrice' => $originalPrice,
            'currency' => (string) ($row['currency'] ?? 'PLN'),
            'availability' => $row['availability'] !== null ? (string) $row['availability'] : null,
            'status' => (string) $row['status'],
            'notes' => $row['notes'] !== null ? (string) $row['notes'] : null,
            'store' => $store,
            'category' => $category,
            'tags' => array_values(array_map('strval', $tags)),
            'createdAt' => Str::isoFromMs($row['createdAt'] ?? null),
            'updatedAt' => Str::isoFromMs($row['updatedAt'] ?? null),
            'discountPercent' => $currentPrice !== null && $originalPrice !== null && $originalPrice > $currentPrice
                ? (int) round((($originalPrice - $currentPrice) / $originalPrice) * 100)
                : null,
        ];
    }

    public static function category(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'userId' => $row['userId'] !== null ? (string) $row['userId'] : null,
            'name' => (string) $row['name'],
            'slug' => (string) $row['slug'],
            'color' => (string) $row['color'],
            'icon' => (string) $row['icon'],
            'sortOrder' => (int) $row['sortOrder'],
            'isDefault' => (bool) $row['isDefault'],
            'createdAt' => Str::isoFromMs($row['createdAt'] ?? null),
            'updatedAt' => Str::isoFromMs($row['updatedAt'] ?? null),
            'productCount' => (int) ($row['productCount'] ?? 0),
            'totalValue' => (float) ($row['totalValue'] ?? 0),
        ];
    }

    public static function settings(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'userId' => $row['userId'] !== null ? (string) $row['userId'] : null,
            'currency' => (string) $row['currency'],
            'autoTrackingEnabled' => (bool) $row['autoTrackingEnabled'],
            'priceUpdateIntervalMinutes' => (int) $row['priceUpdateIntervalMinutes'],
            'defaultProductView' => (string) $row['defaultProductView'],
            'lastBackupAt' => $row['lastBackupAt'] !== null ? Str::isoFromMs($row['lastBackupAt']) : null,
            'createdAt' => Str::isoFromMs($row['createdAt'] ?? null),
            'updatedAt' => Str::isoFromMs($row['updatedAt'] ?? null),
        ];
    }

    public static function user(array $row, bool $includeStatus = false): array
    {
        $user = [
            'id' => (string) $row['id'],
            'username' => (string) $row['username'],
            'email' => (string) $row['email'],
            'role' => (string) $row['role'],
        ];
        if ($includeStatus) {
            $user['status'] = (string) $row['status'];
        }
        return $user;
    }

    public static function invitation(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'expiresAt' => Str::isoFromMs($row['expiresAt'] ?? null),
            'usedAt' => $row['usedAt'] !== null ? Str::isoFromMs($row['usedAt']) : null,
            'revokedAt' => $row['revokedAt'] !== null ? Str::isoFromMs($row['revokedAt']) : null,
            'createdAt' => Str::isoFromMs($row['createdAt'] ?? null),
        ];
    }

    public static function backup(array $row): array
    {
        return [
            'filename' => (string) $row['filename'],
            'size' => (int) $row['size'],
            'createdAt' => Str::isoFromMs($row['createdAt'] ?? null),
        ];
    }
}
