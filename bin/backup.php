<?php
require dirname(__DIR__) . '/app/bootstrap.php';
$backup = new App\Services\BackupService();
$file = $backup->create();
echo "Backup created: " . $file['filename'] . "\n";