<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\App;
use App\Core\Str;

final class SettingsRepository
{
    public function findForUser(string $userId): ?array
    {
        return App::db()->fetch('SELECT * FROM "Settings" WHERE userId = ? LIMIT 1', [$userId]);
    }

    public function ensureForUser(string $userId): array
    {
        $settings = $this->findForUser($userId);
        if ($settings !== null) {
            return $settings;
        }
        $now = Str::nowMs();
        App::db()->run(
            'INSERT INTO "Settings" (userId, currency, autoTrackingEnabled, priceUpdateIntervalMinutes,
                defaultProductView, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [$userId, 'PLN', 0, 360, 'grid', $now, $now]
        );
        return $this->findForUser($userId) ?? [];
    }

    public function update(string $userId, array $data): array
    {
        $allowed = ['currency', 'defaultProductView'];
        $sets = [];
        $params = [];
        foreach ($allowed as $field) {
            if (array_key_exists($field, $data)) {
                $sets[] = '"' . $field . '" = ?';
                $params[] = $data[$field];
            }
        }
        if ($sets !== []) {
            $sets[] = '"updatedAt" = ?';
            $params[] = Str::nowMs();
            $params[] = $userId;
            App::db()->execute('UPDATE "Settings" SET ' . implode(', ', $sets) . ' WHERE userId = ?', $params);
        }
        return $this->findForUser($userId) ?? [];
    }

    public function markBackup(string $userId, int $timestampMs): void
    {
        $this->ensureForUser($userId);
        App::db()->execute(
            'UPDATE "Settings" SET lastBackupAt = ?, updatedAt = ? WHERE userId = ?',
            [$timestampMs, Str::nowMs(), $userId]
        );
    }
}
