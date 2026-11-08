<?php

declare(strict_types=1);

namespace App\Core;

final class Maintenance
{
    public static function isActive(): bool
    {
        return is_file((string) App::config('paths.maintenance'));
    }

    public static function enable(string $reason = ''): void
    {
        @file_put_contents(
            (string) App::config('paths.maintenance'),
            json_encode(['startedAt' => Str::nowMs(), 'reason' => $reason]),
            LOCK_EX
        );
    }

    public static function disable(): void
    {
        @unlink((string) App::config('paths.maintenance'));
    }
}
