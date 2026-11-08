<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\App;
use App\Core\HttpException;
use App\Core\Response;
use App\Core\Validator;
use App\Middleware\AuthMiddleware;
use App\Repositories\CategoryRepository;
use App\Repositories\ProductRepository;
use App\Repositories\SettingsRepository;
use App\Repositories\StoreRepository;
use App\Repositories\TagRepository;
use App\Repositories\UploadRepository;
use App\Services\BackupService;
use App\Services\Images;
use App\Services\Serializer;

final class SettingsController extends Controller
{
    private SettingsRepository $settings;

    public function __construct(\App\Core\Request $request)
    {
        parent::__construct($request);
        $this->settings = new SettingsRepository();
    }

    public function show(): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];
        $isOwner = ($user['role'] ?? '') === 'OWNER';

        $settings = $this->settings->ensureForUser($userId);
        $uploads = new UploadRepository();

        $counts = [
            'products' => (new ProductRepository())->countForUser($userId),
            'categories' => count((new CategoryRepository())->listForUser($userId)),
            'stores' => (new StoreRepository())->countForUser($userId),
            'tags' => (new TagRepository())->countForUser($userId),
        ];

        $backups = [];
        if ($isOwner) {
            $backups = array_map([Serializer::class, 'backup'], (new BackupService())->list());
        }

        $databasePath = (string) App::config('paths.database');

        return Response::json([
            'isOwner' => $isOwner,
            'settings' => Serializer::settings($settings),
            'database' => [
                'path' => $isOwner ? 'data/gift-vault.sqlite' : '',
                'size' => $isOwner ? (int) (@filesize($databasePath) ?: 0) : 0,
                'uploadsPath' => $isOwner ? 'data/uploads' : '',
                'uploadsSize' => Images::uploadsSize($isOwner ? null : $uploads->filenamesForUser($userId)),
                'counts' => $counts,
            ],
            'backups' => $backups,
            'app' => [
                'name' => 'Gift Vault',
                'version' => (string) App::config('app.version', '2.0.0'),
                'runtime' => 'PHP ' . PHP_VERSION,
                'storage' => 'SQLite with private account data',
                'backupDirectory' => $isOwner ? 'data/backups' : '',
            ],
        ]);
    }

    public function update(): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];
        $input = $this->jsonInput();
        $validator = new Validator($input);
        $data = [];

        if (array_key_exists('currency', $input)) {
            $currency = strtoupper(trim((string) $input['currency']));
            if (!preg_match('/^[A-Z]{3}$/', $currency)) {
                $validator->addError('currency', 'Choose a valid currency.');
            } else {
                $data['currency'] = $currency;
            }
        }
        if (array_key_exists('defaultProductView', $input)) {
            $view = (string) $input['defaultProductView'];
            if (!in_array($view, ['grid', 'list'], true)) {
                $validator->addError('defaultProductView', 'Choose a valid product view.');
            } else {
                $data['defaultProductView'] = $view;
            }
        }
        $validator->throwIfFails();

        $this->settings->ensureForUser($userId);
        $updated = $this->settings->update($userId, $data);

        return Response::json(['settings' => Serializer::settings($updated)]);
    }

    public function backup(): Response
    {
        $user = AuthMiddleware::owner($this->request);
        $backup = (new BackupService())->create(true, (string) $user['id']);

        return Response::file($backup['filePath'], $backup['filename'], [
            'Cache-Control' => 'no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function listBackups(): Response
    {
        AuthMiddleware::owner($this->request);
        $backups = array_map([Serializer::class, 'backup'], (new BackupService())->list());

        return Response::json(['backups' => $backups]);
    }

    public function downloadBackup(string $filename): Response
    {
        AuthMiddleware::owner($this->request);
        $path = (new BackupService())->findBackupPath($filename);
        if ($path === null) {
            throw new HttpException(404, 'Backup not found.', 'BACKUP_NOT_FOUND');
        }

        return Response::file($path, basename($path), [
            'Cache-Control' => 'no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function restore(): Response
    {
        AuthMiddleware::owner($this->request);
        $file = $this->request->file('backup');
        if ($file === null) {
            throw new HttpException(400, 'Choose a backup ZIP file.', 'INVALID_BACKUP');
        }

        $result = (new BackupService())->restore($file);

        return Response::json($result);
    }

    public function info(): Response
    {
        AuthMiddleware::owner($this->request);
        $databasePath = (string) App::config('paths.database');

        return Response::json([
            'databasePath' => $databasePath,
            'databaseSize' => (int) (@filesize($databasePath) ?: 0),
            'uploadsPath' => (string) App::config('paths.uploads'),
            'uploadsSize' => Images::uploadsSize(),
        ]);
    }
}
