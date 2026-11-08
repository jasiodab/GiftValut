<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\App;
use App\Core\HttpException;
use App\Core\Maintenance;
use App\Core\Str;
use PDO;
use Throwable;
use ZipArchive;

final class BackupService
{
    private const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];

    /**
     * @return array{filePath: string, filename: string, createdAt: int}
     */
    public function create(bool $recordTimestamp = true, ?string $userId = null): array
    {
        $databasePath = (string) App::config('paths.database');
        if (!is_file($databasePath)) {
            throw new HttpException(500, 'The local database file was not found.', 'DATABASE_MISSING');
        }

        $backupDir = (string) App::config('paths.backups');
        if (!is_dir($backupDir)) {
            @mkdir($backupDir, 0750, true);
        }

        try {
            App::db()->pdo()->exec('PRAGMA wal_checkpoint(TRUNCATE)');
        } catch (Throwable $error) {
            // Checkpoint is best effort.
        }

        $createdAt = Str::nowMs();
        $stamp = gmdate('Y-m-d\TH-i-s', intdiv($createdAt, 1000)) . '-' . sprintf('%03d', $createdAt % 1000) . 'Z';
        $filename = 'gift-vault-backup-' . $stamp . '.zip';
        $filePath = $backupDir . '/' . $filename;

        $zip = new ZipArchive();
        if ($zip->open($filePath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new HttpException(500, 'The backup archive could not be created.', 'BACKUP_FAILED');
        }

        try {
            if (!$zip->addFile($databasePath, 'gift-vault.db')) {
                throw new HttpException(500, 'The database could not be added to the backup.', 'BACKUP_FAILED');
            }

            $uploadsDir = (string) App::config('paths.uploads');
            if (is_dir($uploadsDir)) {
                foreach (scandir($uploadsDir) ?: [] as $entry) {
                    if ($entry === '.' || $entry === '..' || $entry === '.gitkeep') {
                        continue;
                    }
                    $absolute = $uploadsDir . '/' . $entry;
                    if (is_file($absolute)) {
                        $zip->addFile($absolute, 'uploads/' . $entry);
                    }
                }
            }

            $manifest = json_encode([
                'app' => 'Gift Vault',
                'version' => (string) App::config('app.version', '2.0.0'),
                'createdAt' => Str::isoFromMs($createdAt),
                'includes' => ['SQLite database', 'locally stored product images'],
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            $zip->addFromString('manifest.json', $manifest === false ? '{}' : $manifest);

            if (!$zip->close()) {
                throw new HttpException(500, 'The backup archive could not be finalized.', 'BACKUP_FAILED');
            }
        } catch (Throwable $error) {
            $zip->close();
            @unlink($filePath);
            if ($error instanceof HttpException) {
                throw $error;
            }
            throw new HttpException(500, 'The backup archive could not be created.', 'BACKUP_FAILED');
        }

        if ($recordTimestamp && $userId !== null) {
            (new \App\Repositories\SettingsRepository())->markBackup($userId, $createdAt);
        }

        $this->prune();

        return ['filePath' => $filePath, 'filename' => $filename, 'createdAt' => $createdAt];
    }

    /**
     * @return list<array{filename: string, size: int, createdAt: int}>
     */
    public function list(): array
    {
        $backupDir = (string) App::config('paths.backups');
        if (!is_dir($backupDir)) {
            return [];
        }
        $result = [];
        foreach (scandir($backupDir) ?: [] as $entry) {
            if (!str_starts_with($entry, 'gift-vault-backup-') || !str_ends_with($entry, '.zip')) {
                continue;
            }
            $path = $backupDir . '/' . $entry;
            if (!is_file($path)) {
                continue;
            }
            $result[] = [
                'filename' => $entry,
                'size' => (int) (filesize($path) ?: 0),
                'createdAt' => (int) ((filemtime($path) ?: time()) * 1000),
            ];
        }
        usort($result, static fn (array $a, array $b): int => $b['createdAt'] <=> $a['createdAt']);
        return array_slice($result, 0, (int) App::config('backup.max_backups', 12));
    }

    public function findBackupPath(string $filename): ?string
    {
        $filename = basename($filename);
        if (!str_starts_with($filename, 'gift-vault-backup-') || !str_ends_with($filename, '.zip')) {
            return null;
        }
        $path = (string) App::config('paths.backups') . '/' . $filename;
        return is_file($path) ? $path : null;
    }

    /**
     * @param array{tmp_name?: string, size?: int, error?: int, name?: string} $file
     * @return array{restored: bool, images: int, safetyBackup: string}
     */
    public function restore(array $file): array
    {
        $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error !== UPLOAD_ERR_OK) {
            throw new HttpException(400, $error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE
                ? 'The backup file is larger than the server upload limit.'
                : 'Choose a backup ZIP file.', 'INVALID_BACKUP');
        }

        $tmpName = (string) ($file['tmp_name'] ?? '');
        $size = (int) ($file['size'] ?? 0);
        $maxBytes = (int) App::config('backup.max_upload_bytes', 96 * 1024 * 1024);
        if ($tmpName === '' || !is_file($tmpName)) {
            throw new HttpException(400, 'Choose a backup ZIP file.', 'INVALID_BACKUP');
        }
        if ($size <= 0 || $size > $maxBytes) {
            throw new HttpException(400, 'The backup file is empty or too large.', 'INVALID_BACKUP');
        }

        $restoreId = bin2hex(random_bytes(12));
        $backupDir = (string) App::config('paths.backups');
        $tempDir = $backupDir . '/.restore-' . $restoreId;
        if (!@mkdir($tempDir, 0750, true) && !is_dir($tempDir)) {
            throw new HttpException(500, 'The restore workspace could not be created.', 'RESTORE_FAILED');
        }

        try {
            $zip = new ZipArchive();
            if ($zip->open($tmpName) !== true) {
                throw new HttpException(400, 'The uploaded file is not a valid ZIP archive.', 'INVALID_BACKUP');
            }

            if ($zip->numFiles <= 0) {
                $zip->close();
                throw new HttpException(400, 'The backup archive is empty.', 'INVALID_BACKUP');
            }
            if ($zip->numFiles > (int) App::config('backup.max_entries', 20000)) {
                $zip->close();
                throw new HttpException(400, 'The backup contains too many files.', 'INVALID_BACKUP');
            }

            $databaseEntry = null;
            $imageEntries = [];
            for ($index = 0; $index < $zip->numFiles; $index++) {
                $stat = $zip->statIndex($index);
                if ($stat === false) {
                    continue;
                }
                $name = $this->safeZipName((string) $stat['name']);
                if ($name === '' || str_ends_with($name, '/')) {
                    continue;
                }
                if ($name === 'gift-vault.db') {
                    $databaseEntry = $name;
                    continue;
                }
                if ($name === 'manifest.json') {
                    continue;
                }
                if (!str_starts_with($name, 'uploads/')) {
                    $zip->close();
                    throw new HttpException(400, 'The backup contains an unexpected file outside the uploads folder.', 'INVALID_BACKUP');
                }
                $filename = basename($name);
                if ($filename === '.gitkeep') {
                    continue;
                }
                $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
                if (!in_array($extension, self::ALLOWED_IMAGE_EXTENSIONS, true)) {
                    $zip->close();
                    throw new HttpException(400, 'Unsupported file in backup: ' . $filename, 'INVALID_BACKUP');
                }
                if ((int) $stat['size'] > (int) App::config('backup.max_image_bytes', 20 * 1024 * 1024)) {
                    $zip->close();
                    throw new HttpException(400, 'Image is too large in backup: ' . $filename, 'INVALID_BACKUP');
                }
                $imageEntries[] = ['entry' => $name, 'filename' => $filename];
            }

            if ($databaseEntry === null) {
                $zip->close();
                throw new HttpException(400, 'The backup does not contain gift-vault.db.', 'INVALID_BACKUP');
            }

            $dbBytes = $zip->getFromName($databaseEntry);
            if (!is_string($dbBytes) || strlen($dbBytes) < 4096 || substr($dbBytes, 0, 16) !== "SQLite format 3\x00") {
                $zip->close();
                throw new HttpException(400, 'The backup does not contain a valid SQLite database.', 'INVALID_BACKUP');
            }

            $newDbPath = $tempDir . '/gift-vault.db';
            if (@file_put_contents($newDbPath, $dbBytes) === false) {
                $zip->close();
                throw new HttpException(500, 'The database inside the backup could not be written.', 'RESTORE_FAILED');
            }
            unset($dbBytes);

            $stagedUploads = $tempDir . '/uploads';
            if (!@mkdir($stagedUploads, 0750, true) && !is_dir($stagedUploads)) {
                $zip->close();
                throw new HttpException(500, 'The restore workspace could not be created.', 'RESTORE_FAILED');
            }

            $imageCount = 0;
            foreach ($imageEntries as $entry) {
                $bytes = $zip->getFromName($entry['entry']);
                if (!is_string($bytes)) {
                    $zip->close();
                    throw new HttpException(400, 'An image inside the backup could not be read.', 'INVALID_BACKUP');
                }
                $target = $stagedUploads . '/' . $entry['filename'];
                if (@file_put_contents($target, $bytes, LOCK_EX) === false) {
                    $zip->close();
                    throw new HttpException(500, 'An image inside the backup could not be written.', 'RESTORE_FAILED');
                }
                $imageCount++;
            }
            $zip->close();

            $this->validateDatabase($newDbPath);

            $preRestore = $this->create(false);
            Maintenance::enable('backup restore');

            $databasePath = (string) App::config('paths.database');
            $uploadsDir = (string) App::config('paths.uploads');
            $rollbackDbPath = $tempDir . '/rollback.db';
            $oldUploadsPath = $tempDir . '/uploads-old';

            if (!@copy($databasePath, $rollbackDbPath)) {
                throw new HttpException(500, 'The current database could not be preserved before restoring.', 'RESTORE_FAILED');
            }

            // Release the active PDO connection before replacing the database file.
            App::reconnectDatabase();
            gc_collect_cycles();

            try {
                if (is_dir($uploadsDir)) {
                    @rename($uploadsDir, $oldUploadsPath);
                }
                if (!is_dir($uploadsDir) && !@mkdir($uploadsDir, 0750, true)) {
                    throw new HttpException(500, 'The uploads folder could not be recreated.', 'RESTORE_FAILED');
                }
                foreach (scandir($stagedUploads) ?: [] as $entry) {
                    if ($entry === '.' || $entry === '..') {
                        continue;
                    }
                    if (!@copy($stagedUploads . '/' . $entry, $uploadsDir . '/' . $entry)) {
                        throw new HttpException(500, 'A restored image could not be copied.', 'RESTORE_FAILED');
                    }
                }

                if (!@copy($newDbPath, $databasePath)) {
                    throw new HttpException(500, 'The restored database could not be copied into place.', 'RESTORE_FAILED');
                }
                @unlink($databasePath . '-wal');
                @unlink($databasePath . '-shm');

                $database = App::db();
                if ($database->integrityCheck() !== 'ok') {
                    throw new HttpException(400, 'The restored database failed its integrity check.', 'INVALID_BACKUP');
                }
                $this->ensureSchemaMarker($database->pdo());
                if ((int) $database->value("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'User'") === 0) {
                    throw new HttpException(400, 'The restored database is missing the Gift Vault tables.', 'INVALID_BACKUP');
                }
            } catch (Throwable $error) {
                App::reconnectDatabase();
                gc_collect_cycles();
                @copy($rollbackDbPath, $databasePath);
                @unlink($databasePath . '-wal');
                @unlink($databasePath . '-shm');
                if (is_dir($oldUploadsPath)) {
                    if (is_dir($uploadsDir)) {
                        @rmdir($uploadsDir);
                    }
                    @rename($oldUploadsPath, $uploadsDir);
                }
                throw $error instanceof HttpException
                    ? $error
                    : new HttpException(400, 'The backup could not be restored. The previous database was kept.', 'RESTORE_FAILED');
            }

            @unlink($rollbackDbPath);
            if (is_dir($oldUploadsPath)) {
                $this->removeDirectory($oldUploadsPath);
            }

            return [
                'restored' => true,
                'images' => $imageCount,
                'safetyBackup' => $preRestore['filename'],
            ];
        } finally {
            Maintenance::disable();
            $this->removeDirectory($tempDir);
        }
    }

    private function validateDatabase(string $path): void
    {
        try {
            $pdo = new PDO('sqlite:' . $path, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            $pdo->exec('PRAGMA foreign_keys = OFF');
            $check = (string) $pdo->query('PRAGMA integrity_check')->fetchColumn();
            $hasUser = (int) $pdo->query("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'User'")->fetchColumn();
            $pdo = null;
            if ($check !== 'ok' || $hasUser === 0) {
                throw new HttpException(400, 'The backup does not contain a usable Gift Vault database.', 'INVALID_BACKUP');
            }
        } catch (HttpException $error) {
            throw $error;
        } catch (Throwable $error) {
            throw new HttpException(400, 'The backup does not contain a usable Gift Vault database.', 'INVALID_BACKUP');
        }
    }

    private function ensureSchemaMarker(PDO $pdo): void
    {
        $hasMigrations = (int) $pdo->query("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")->fetchColumn();
        if ($hasMigrations > 0) {
            return;
        }

        $migration = (string) App::config('paths.migrations') . '/001_init.sql';
        if (!is_file($migration)) {
            return;
        }

        $sql = (string) file_get_contents($migration);
        $pdo->exec('PRAGMA foreign_keys = OFF');
        $pdo->beginTransaction();
        try {
            foreach (App::splitSql($sql) as $statement) {
                $pdo->exec($statement);
            }
            $stmt = $pdo->prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (1, ?, ?)');
            $stmt->execute(['001_init.sql', Str::nowMs()]);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        } finally {
            $pdo->exec('PRAGMA foreign_keys = ON');
        }
    }

    private function prune(): void
    {
        try {
            $max = (int) App::config('backup.max_backups', 12);
            $backupDir = (string) App::config('paths.backups');
            $files = [];
            foreach (scandir($backupDir) ?: [] as $entry) {
                if (str_starts_with($entry, 'gift-vault-backup-') && str_ends_with($entry, '.zip')) {
                    $files[] = $entry;
                }
            }
            sort($files, SORT_STRING);
            $files = array_reverse($files);
            foreach (array_slice($files, $max) as $filename) {
                @unlink($backupDir . '/' . $filename);
            }
        } catch (Throwable $error) {
            // Pruning is best effort.
        }
    }

    private function safeZipName(string $entryName): string
    {
        $normalized = str_replace('\\', '/', $entryName);
        if (str_contains($normalized, "\0")) {
            throw new HttpException(400, 'The backup contains an invalid filename.', 'INVALID_BACKUP');
        }
        if (str_starts_with($normalized, '/') || preg_match('/^[a-zA-Z]:\//', $normalized)) {
            throw new HttpException(400, 'The backup contains an unsafe path.', 'INVALID_BACKUP');
        }
        $segments = explode('/', $normalized);
        if (in_array('..', $segments, true)) {
            throw new HttpException(400, 'The backup contains an unsafe path.', 'INVALID_BACKUP');
        }
        return implode('/', array_values(array_filter($segments, static fn ($segment) => $segment !== '' && $segment !== '.')));
    }

    private function removeDirectory(string $directory): void
    {
        if (!is_dir($directory)) {
            return;
        }
        foreach (scandir($directory) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            $path = $directory . '/' . $entry;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                @unlink($path);
            }
        }
        @rmdir($directory);
    }
}
