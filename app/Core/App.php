<?php

declare(strict_types=1);

namespace App\Core;

use RuntimeException;

final class App
{
    private static ?string $root = null;
    private static ?array $config = null;
    private static ?Database $db = null;
    private static bool $schemaReady = false;
    private static ?Request $request = null;

    public static function boot(string $root): void
    {
        if (self::$root !== null) {
            return;
        }

        self::$root = rtrim($root, '/\\');
        self::loadEnv(self::$root . '/.env');

        /** @var array $config */
        $config = require self::$root . '/config/config.php';
        self::$config = $config;

        date_default_timezone_set((string) $config['app']['timezone']);
        error_reporting(E_ALL);
        ini_set('display_errors', $config['app']['debug'] ? '1' : '0');
        ini_set('log_errors', '1');

        foreach ([
            $config['paths']['data'],
            $config['paths']['uploads'],
            $config['paths']['backups'],
            $config['paths']['rate_limits'],
            $config['paths']['logs'],
        ] as $directory) {
            if (!is_dir($directory)) {
                @mkdir($directory, 0750, true);
            }
        }

        ini_set('error_log', $config['paths']['logs'] . '/php-error.log');

        if (trim((string) $config['security']['secret']) === '') {
            self::$config['security']['secret'] = self::loadOrCreateSecret($config['paths']['secret']);
        }
    }

    public static function root(): string
    {
        if (self::$root === null) {
            throw new RuntimeException('Application has not been booted.');
        }
        return self::$root;
    }

    public static function config(string $key, mixed $default = null): mixed
    {
        if (self::$config === null) {
            throw new RuntimeException('Application has not been booted.');
        }
        $value = self::$config;
        foreach (explode('.', $key) as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                return $default;
            }
            $value = $value[$segment];
        }
        return $value;
    }

    public static function db(): Database
    {
        if (self::$db === null) {
            self::$db = new Database((string) self::config('paths.database'));
        }
        return self::$db;
    }

    public static function reconnectDatabase(): void
    {
        self::$db = null;
        self::$schemaReady = false;
    }

    public static function setRequest(Request $request): void
    {
        self::$request = $request;
    }

    public static function request(): ?Request
    {
        return self::$request;
    }

    /**
     * Create the schema on a completely fresh installation.
     *
     * If the configured database already contains application tables but no
     * schema_migrations marker we refuse to touch it: that is a legacy database
     * that must be imported with bin/migrate-from-node.php.
     */
    public static function ensureSchema(): void
    {
        if (self::$schemaReady) {
            return;
        }

        $db = self::db();
        $pdo = $db->pdo();

        $hasMigrations = (bool) $db->value(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'"
        );

        if ($hasMigrations) {
            self::$schemaReady = true;
            return;
        }

        $applicationTables = (int) $db->value(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'schema_migrations'"
        );

        if ($applicationTables > 0) {
            throw new RuntimeException(
                'This database contains legacy Gift Vault tables but no schema_migrations table. '
                . 'Run bin/migrate-from-node.php to import it instead of starting the web app.'
            );
        }

        $migration = self::config('paths.migrations') . '/001_init.sql';
        if (!is_file($migration)) {
            throw new RuntimeException('Initial migration 001_init.sql is missing.');
        }

        $sql = (string) file_get_contents($migration);
        $pdo->exec('PRAGMA foreign_keys = OFF');
        $pdo->beginTransaction();
        try {
            foreach (self::splitSql($sql) as $statement) {
                $pdo->exec($statement);
            }
            $stmt = $pdo->prepare(
                'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
            );
            $stmt->execute([1, '001_init.sql', Str::nowMs()]);
            $pdo->commit();
        } catch (\Throwable $error) {
            $pdo->rollBack();
            throw $error;
        } finally {
            $pdo->exec('PRAGMA foreign_keys = ON');
        }

        self::$schemaReady = true;
    }

    /**
     * @return list<string>
     */
    public static function splitSql(string $sql): array
    {
        $statements = [];
        $buffer = '';
        $inString = false;
        $stringChar = '';
        $length = strlen($sql);

        for ($i = 0; $i < $length; $i++) {
            $char = $sql[$i];
            if ($inString) {
                $buffer .= $char;
                if ($char === $stringChar) {
                    if ($i + 1 < $length && $sql[$i + 1] === $stringChar) {
                        $buffer .= $sql[++$i];
                    } else {
                        $inString = false;
                    }
                }
                continue;
            }
            if ($char === "'" || $char === '"') {
                $inString = true;
                $stringChar = $char;
                $buffer .= $char;
                continue;
            }
            if ($char === '-' && $i + 1 < $length && $sql[$i + 1] === '-') {
                while ($i < $length && $sql[$i] !== "\n") {
                    $i++;
                }
                $buffer .= "\n";
                continue;
            }
            if ($char === ';') {
                $trimmed = trim($buffer);
                if ($trimmed !== '') {
                    $statements[] = $trimmed;
                }
                $buffer = '';
                continue;
            }
            $buffer .= $char;
        }

        $trimmed = trim($buffer);
        if ($trimmed !== '') {
            $statements[] = $trimmed;
        }

        return $statements;
    }

    private static function loadEnv(string $file): void
    {
        if (!is_file($file)) {
            return;
        }
        $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            return;
        }
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }
            if (str_starts_with($line, 'export ')) {
                $line = trim(substr($line, 7));
            }
            $position = strpos($line, '=');
            if ($position === false) {
                continue;
            }
            $key = trim(substr($line, 0, $position));
            $value = trim(substr($line, $position + 1));
            if ($key === '') {
                continue;
            }
            if (strlen($value) >= 2) {
                $first = $value[0];
                $last = $value[strlen($value) - 1];
                if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                    $value = substr($value, 1, -1);
                    if ($first === '"') {
                        $value = str_replace(['\\n', '\\r', '\\"'], ["\n", "\r", '"'], $value);
                    }
                }
            }
            if (!array_key_exists($key, $_ENV) && getenv($key) === false) {
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
                putenv($key . '=' . $value);
            }
        }
    }

    private static function loadOrCreateSecret(string $file): string
    {
        if (is_file($file)) {
            $existing = trim((string) file_get_contents($file));
            if ($existing !== '') {
                return $existing;
            }
        }

        if (!is_dir(dirname($file))) {
            @mkdir(dirname($file), 0750, true);
        }

        try {
            $secret = bin2hex(random_bytes(32));
        } catch (\Throwable $error) {
            throw new RuntimeException('Unable to generate an application secret.', 0, $error);
        }

        $written = @file_put_contents($file, $secret, LOCK_EX);
        if ($written === false) {
            throw new RuntimeException('Unable to store the application secret at ' . $file);
        }
        @chmod($file, 0600);

        return $secret;
    }
}
