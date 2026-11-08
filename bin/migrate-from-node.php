<?php
require dirname(__DIR__) . '/app/bootstrap.php';

$legacyPath = $argv[1] ?? dirname(__DIR__) . '/data/gift-vault.db';
$newPath = App\Core\App::config('paths.database');
if (!is_file($legacyPath)) {
    fwrite(STDERR, "Legacy DB not found: $legacyPath\n");
    exit(1);
}

$legacy = new PDO('sqlite:' . $legacyPath);
$legacy->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$new = App\Core\App::db()->pdo();

// Run migrations first
passthru(PHP_BINARY . ' ' . dirname(__DIR__) . '/bin/migrate.php', $rc);

$tables = ['User','Category','Store','Tag','Settings','Product','ProductTag','Upload','Session','Invitation'];
foreach ($tables as $t) {
    try {
        $rows = $legacy->query('SELECT * FROM "' . $t . '"')->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        fwrite(STDERR, "Skip $t: " . $e->getMessage() . "\n");
        continue;
    }
    if (!$rows) continue;
    $cols = array_keys($rows[0]);
    $placeholders = implode(',', array_fill(0, count($cols), '?'));
    $colList = implode(',', array_map(fn($c) => '"' . $c . '"', $cols));
    $stmt = $new->prepare('INSERT OR IGNORE INTO "' . $t . '" (' . $colList . ') VALUES (' . $placeholders . ')');
    foreach ($rows as $row) {
        $stmt->execute(array_values($row));
    }
    echo "Migrated " . count($rows) . " rows into $t\n";
}
echo "Done.\n";