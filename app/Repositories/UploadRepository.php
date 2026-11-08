<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\App;
use App\Core\Str;

final class UploadRepository
{
    public function existsForUser(string $filename, string $userId): bool
    {
        return (bool) App::db()->value(
            'SELECT 1 FROM "Upload" WHERE filename = ? AND userId = ? LIMIT 1',
            [$filename, $userId]
        );
    }

    public function insert(string $filename, string $userId): void
    {
        App::db()->run(
            'INSERT INTO "Upload" (id, filename, userId, createdAt) VALUES (?, ?, ?, ?)',
            [Str::id(), $filename, $userId, date('Y-m-d H:i:s')]
        );
    }

    /**
     * @return list<string>
     */
    public function filenamesForUser(string $userId): array
    {
        $rows = App::db()->fetchAll('SELECT filename FROM "Upload" WHERE userId = ?', [$userId]);
        return array_map(static fn (array $row): string => (string) $row['filename'], $rows);
    }

    public function deleteForUser(string $filename, string $userId): void
    {
        App::db()->execute('DELETE FROM "Upload" WHERE filename = ? AND userId = ?', [$filename, $userId]);
    }
}
