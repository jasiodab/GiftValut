<?php

declare(strict_types=1);

/**
 * Apply pending SQL migrations from migrations/.
 *
 * Usage: php bin/migrate.php [--status]
 */

require dirname(__DIR__) . '/app/bootstrap.php';

use App\Core\App;
use App\Core\Str;

$statusOnly = in_array('--status', $argv ?? [], true);

$database = App::db();
$pdo = $database->pdo();

$pdo->exec('PRAGMA foreign_keys = ON');

$files = glob((string) App::config('paths.migrations') . '/*.sql') ?: [];
sort($files, SORT_STRING);

$hasTable = (bool) $database->value(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'"
);

$applied = [];
if ($hasTable) {
    foreach ($database->fetchAll('SELECT version, name FROM schema_migrations ORDER BY version') as $row) {
        $applied[(int) $row['version']] = (string) $row['name'];
    }
}

echo 'Database: ' . App::config('paths.database') . PHP_EOL;

$pending = 0;
foreach ($files as $file) {
    $name = basename($file);
    if (!preg_match('/^(\d+)_/', $name, $matches)) {
        continue;
    }
    $version = (int) $matches[1];

    if (isset($applied[$version])) {
        echo '[ok]      ' . $name . PHP_EOL;
        continue;
    }

    $pending++;
    if ($statusOnly) {
        echo '[pending] ' . $name . PHP_EOL;
        continue;
    }

    $sql = (string) file_get_contents($file);
    echo '[apply]   ' . $name . ' ... ';
    $pdo->exec('PRAGMA foreign_keys = OFF');
    $pdo->beginTransaction();
    try {
        foreach (App::splitSql($sql) as $statement) {
            $pdo->exec($statement);
        }
        if (!$database->value("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")) {
            $pdo->exec('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)');
        }
        $statement = $pdo->prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)');
        $statement->execute([$version, $name, Str::nowMs()]);
        $pdo->commit();
        echo 'done' . PHP_EOL;
    } catch (\Throwable $error) {
        $pdo->rollBack();
        echo 'FAILED' . PHP_EOL;
        fwrite(STDERR, $error->getMessage() . PHP_EOL);
        exit(1);
    } finally {
        $pdo->exec('PRAGMA foreign_keys = ON');
    }
}

if ($statusOnly) {
    echo $pending === 0 ? 'All migrations are applied.' . PHP_EOL : $pending . ' pending migration(s).' . PHP_EOL;
} elseif ($pending === 0) {
    echo 'Database is up to date.' . PHP_EOL;
}

$check = $database->integrityCheck();
echo 'Integrity: ' . $check . PHP_EOL;
