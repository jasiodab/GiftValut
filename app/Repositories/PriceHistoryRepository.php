<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\App;
use App\Core\Str;

final class PriceHistoryRepository
{
    /**
     * @return list<array{id: string, price: float, originalPrice: float|null, currency: string, availability: string|null, source: string, recordedAt: string}>
     */
    public function forProduct(string $userId, string $productId): array
    {
        $rows = App::db()->fetchAll(
            'SELECT id, price, originalPrice, currency, availability, source, recordedAt
             FROM "PriceHistory"
             WHERE userId = ? AND productId = ?
             ORDER BY recordedAt ASC',
            [$userId, $productId]
        );

        return array_map(static function (array $row): array {
            return [
                'id' => (string) $row['id'],
                'price' => (float) $row['price'],
                'originalPrice' => $row['originalPrice'] !== null ? (float) $row['originalPrice'] : null,
                'currency' => (string) ($row['currency'] ?? 'PLN'),
                'availability' => $row['availability'] !== null ? (string) $row['availability'] : null,
                'source' => (string) ($row['source'] ?? 'AUTOMATIC'),
                'recordedAt' => (string) $row['recordedAt'],
            ];
        }, $rows);
    }

    public function create(string $userId, string $productId, float $price, ?float $originalPrice, string $currency, ?string $availability, string $source = 'MANUAL'): void
    {
        App::db()->run(
            'INSERT INTO "PriceHistory" (id, userId, productId, price, originalPrice, currency, availability, source, recordedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                Str::id(),
                $userId,
                $productId,
                $price,
                $originalPrice,
                $currency,
                $availability,
                $source,
                date('Y-m-d H:i:s'),
            ]
        );
    }
}
