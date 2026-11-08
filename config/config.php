<?php

declare(strict_types=1);

/**
 * Gift Vault configuration.
 *
 * Every value can be overridden with an environment variable so the same code
 * works on Mikrus, in local development and in tests.
 */

$root = dirname(__DIR__);

$env = static function (string $key, ?string $default = null): ?string {
    $value = $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);
    if ($value === false || $value === null || $value === '') {
        return $default;
    }
    return (string) $value;
};

$bool = static function (string $key, bool $default = false) use ($env): bool {
    $value = $env($key);
    if ($value === null) {
        return $default;
    }
    return filter_var($value, FILTER_VALIDATE_BOOL);
};

$int = static function (string $key, int $default) use ($env): int {
    $value = $env($key);
    if ($value === null || !is_numeric($value)) {
        return $default;
    }
    return (int) $value;
};

$dataDir = rtrim((string) $env('GV_DATA_DIR', $root . DIRECTORY_SEPARATOR . 'data'), '/\\');

return [
    'app' => [
        'name' => 'Gift Vault',
        'version' => '2.0.0',
        'env' => (string) $env('APP_ENV', 'production'),
        'debug' => $bool('APP_DEBUG', false),
        'frog_mode' => $bool('FROG_MODE', false),
        'timezone' => (string) $env('APP_TIMEZONE', 'Europe/Warsaw'),
        'url' => rtrim((string) $env('APP_URL', ''), '/'),
    ],
    'paths' => [
        'root' => $root,
        'app' => $root . '/app',
        'views' => $root . '/app/Views',
        'migrations' => $root . '/migrations',
        'data' => $dataDir,
        'database' => (string) $env('GV_DB_PATH', $dataDir . '/gift-vault.sqlite'),
        'uploads' => $dataDir . '/uploads',
        'backups' => $dataDir . '/backups',
        'rate_limits' => $dataDir . '/rate-limits',
        'logs' => $dataDir . '/logs',
        'secret' => $dataDir . '/secret.key',
        'maintenance' => $dataDir . '/maintenance.lock',
        'legacy_database' => (string) $env('LEGACY_DB_PATH', $dataDir . '/gift-vault.db'),
    ],
    'security' => [
        'owner_setup_key' => (string) $env('OWNER_SETUP_KEY', ''),
        'secret' => (string) $env('APP_SECRET', ''),
        'cookie_secure' => (string) $env('COOKIE_SECURE', 'auto'),
        'session_days' => max(1, $int('SESSION_DAYS', 7)),
        'bcrypt_cost' => max(10, min(14, $int('BCRYPT_COST', 12))),
        'trust_proxy_headers' => $bool('TRUST_PROXY_HEADERS', true),
    ],
    'uploads' => [
        'max_bytes' => 2 * 1024 * 1024,
        'remote_max_bytes' => 2 * 1024 * 1024,
        'allowed_mime' => [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/avif',
        ],
    ],
    'backup' => [
        'max_upload_bytes' => max(8 * 1024 * 1024, $int('BACKUP_MAX_UPLOAD_BYTES', 96 * 1024 * 1024)),
        'max_backups' => max(1, $int('MAX_BACKUPS', 12)),
        'max_entries' => 20000,
        'max_image_bytes' => 20 * 1024 * 1024,
    ],
    'limits' => [
        'login' => ['window' => 60, 'max' => 10],
        'bootstrap' => ['window' => 3600, 'max' => 3],
        'extract' => ['window' => 900, 'max' => 10],
        'api' => ['window' => 900, 'max' => 240],
    ],
];
