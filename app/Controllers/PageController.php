<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\App;
use App\Core\Auth;
use App\Core\HttpException;
use App\Core\Response;
use App\Core\Str;
use App\Core\View;
use App\Middleware\AuthMiddleware;
use App\Repositories\CategoryGroupRepository;
use App\Repositories\CategoryRepository;
use App\Repositories\DashboardRepository;
use App\Repositories\InvitationRepository;
use App\Repositories\ProductRepository;
use App\Repositories\SettingsRepository;
use App\Repositories\TagRepository;
use App\Repositories\UploadRepository;
use App\Repositories\UserRepository;
use App\Services\BackupService;
use App\Services\Images;
use App\Services\Serializer;

final class PageController extends Controller
{
    private ProductRepository $products;
    private CategoryRepository $categories;
    private CategoryGroupRepository $groups;
    private TagRepository $tags;
    private SettingsRepository $settings;

    public function __construct(\App\Core\Request $request)
    {
        parent::__construct($request);
        $this->products = new ProductRepository();
        $this->categories = new CategoryRepository();
        $this->groups = new CategoryGroupRepository();
        $this->tags = new TagRepository();
        $this->settings = new SettingsRepository();
    }

    public function dashboard(): Response
    {
        if ($redirect = AuthMiddleware::requirePageUser($this->request)) {
            return $redirect;
        }
        $user = Auth::user();
        $data = (new DashboardRepository())->data(
            (string) $user['id'],
            $this->products,
            $this->tags,
            $this->settings
        );

        return View::render('dashboard', [
            'title' => 'Panel · Gift Vault',
            'activeNav' => 'dashboard',
            'dashboard' => $data,
        ]);
    }

    public function products(): Response
    {
        if ($redirect = AuthMiddleware::requirePageUser($this->request)) {
            return $redirect;
        }
        $user = Auth::user();
        $userId = (string) $user['id'];

        $search = trim((string) $this->request->query('search', ''));
        if (mb_strlen($search) > 200) {
            $search = mb_substr($search, 0, 200);
        }
        $status = (string) $this->request->query('status', 'ALL');
        if (!in_array($status, ['ALL', 'TO_CONSIDER', 'FAVORITE', 'TO_BUY', 'PURCHASED'], true)) {
            $status = 'ALL';
        }
        $categoryId = (string) $this->request->query('categoryId', '');
        $groupId = (string) $this->request->query('groupId', '');
        $favorite = (string) $this->request->query('favorite', '') === 'true';
        $sort = (string) $this->request->query('sort', 'recent');
        if (!in_array($sort, ['recent', 'updated', 'price-asc', 'price-desc', 'name'], true)) {
            $sort = 'recent';
        }
        $page = max(1, (int) $this->request->query('page', 1));
        $pageSize = 24;

        $result = $this->products->paginateForUser($userId, [
            'search' => $search,
            'status' => $status,
            'categoryId' => $categoryId,
            'groupId' => $groupId,
            'favorite' => $favorite,
            'sort' => $sort,
        ], $page, $pageSize, $this->tags);

        $total = $result['total'];
        $totalPages = max(1, (int) ceil($total / $pageSize));
        if ($page > $totalPages) {
            $page = $totalPages;
        }

        $settingsRow = $this->settings->ensureForUser($userId);

        return View::render('products/index', [
            'title' => 'Produkty · Gift Vault',
            'activeNav' => 'products',
            'products' => array_map([Serializer::class, 'product'], $result['products']),
            'pagination' => [
                'page' => $page,
                'pageSize' => $pageSize,
                'total' => $total,
                'totalPages' => $totalPages,
            ],
            'categories' => array_map([Serializer::class, 'category'], $this->categories->listForUser($userId)),
            'tags' => $this->tags->listForUser($userId),
            'settings' => Serializer::settings($settingsRow),
            'filters' => [
                'search' => $search,
                'status' => $status,
                'categoryId' => $categoryId,
                'groupId' => $groupId,
                'favorite' => $favorite,
                'sort' => $sort,
            ],
        ]);
    }

    public function productShow(string $id): Response
    {
        if ($redirect = AuthMiddleware::requirePageUser($this->request)) {
            return $redirect;
        }
        $user = Auth::user();
        $row = $this->products->findForUser($id, (string) $user['id'], $this->tags);
        if ($row === null) {
            throw new HttpException(404, 'Nie znaleziono produktu.', 'PRODUCT_NOT_FOUND');
        }
        $settingsRow = $this->settings->ensureForUser((string) $user['id']);

        return View::render('products/show', [
            'title' => $row['name'] . ' · Gift Vault',
            'activeNav' => 'products',
            'product' => Serializer::product($row),
            'categories' => array_map([Serializer::class, 'category'], $this->categories->listForUser((string) $user['id'])),
            'tags' => $this->tags->listForUser((string) $user['id']),
            'settings' => Serializer::settings($settingsRow),
        ]);
    }

    public function categories(): Response
    {
        if ($redirect = AuthMiddleware::requirePageUser($this->request)) {
            return $redirect;
        }
        $user = Auth::user();
        $settingsRow = $this->settings->ensureForUser((string) $user['id']);

        return View::render('categories', [
            'title' => 'Kategorie · Gift Vault',
            'activeNav' => 'categories',
            'categories' => array_map([Serializer::class, 'category'], $this->categories->listForUser((string) $user['id'])),
            'settings' => Serializer::settings($settingsRow),
        ]);
    }

    public function groups(): Response
    {
        if ($redirect = AuthMiddleware::requirePageUser($this->request)) {
            return $redirect;
        }
        $user = Auth::user();
        $settingsRow = $this->settings->ensureForUser((string) $user['id']);

        return View::render('groups', [
            'title' => 'Grupy · Gift Vault',
            'activeNav' => 'groups',
            'groups' => array_map([$this, 'serializeGroupForView'], $this->groups->listForUser((string) $user['id'])),
            'settings' => Serializer::settings($settingsRow),
        ]);
    }

    private function serializeGroupForView(array $row): array
    {
        return [
            'id' => (string) ($row['id'] ?? ''),
            'ownerId' => $row['ownerId'] !== null ? (string) $row['ownerId'] : null,
            'ownerUsername' => (string) ($row['ownerUsername'] ?? ''),
            'name' => (string) ($row['name'] ?? ''),
            'slug' => (string) ($row['slug'] ?? ''),
            'color' => (string) ($row['color'] ?? '#D9A3B0'),
            'icon' => (string) ($row['icon'] ?? 'Users'),
            'createdAt' => Str::isoFromMs($row['createdAt'] ?? null),
            'updatedAt' => Str::isoFromMs($row['updatedAt'] ?? null),
            'memberCount' => (int) ($row['memberCount'] ?? 0),
            'productCount' => (int) ($row['productCount'] ?? 0),
            'memberRole' => (string) ($row['memberRole'] ?? 'VIEWER'),
            'isOwner' => isset($row['isOwner']) ? (bool) $row['isOwner'] : false,
        ];
    }

    public function settings(): Response
    {
        if ($redirect = AuthMiddleware::requirePageUser($this->request)) {
            return $redirect;
        }
        $user = Auth::user();
        $userId = (string) $user['id'];
        $isOwner = ($user['role'] ?? '') === 'OWNER';

        $settingsRow = $this->settings->ensureForUser($userId);
        $databasePath = (string) App::config('paths.database');
        $uploadRepository = new UploadRepository();

        $counts = [
            'products' => $this->products->countForUser($userId),
            'categories' => count($this->categories->listForUser($userId)),
            'stores' => (new \App\Repositories\StoreRepository())->countForUser($userId),
            'tags' => $this->tags->countForUser($userId),
        ];

        $backups = [];
        $users = [];
        $invitations = [];
        if ($isOwner) {
            $backups = array_map([Serializer::class, 'backup'], (new BackupService())->list());
            $userRows = (new UserRepository())->listAll();
            $users = array_map(static function (array $row): array {
                return [
                    'id' => (string) $row['id'],
                    'username' => (string) $row['username'],
                    'email' => (string) $row['email'],
                    'role' => (string) $row['role'],
                    'status' => (string) $row['status'],
                    'createdAt' => Str::isoFromMs($row['createdAt'] ?? null),
                    'lastLoginAt' => $row['lastLoginAt'] !== null ? Str::isoFromMs($row['lastLoginAt']) : null,
                ];
            }, $userRows);
            $invitations = array_map([Serializer::class, 'invitation'], (new InvitationRepository())->listRecent());
        }

        return View::render('settings', [
            'title' => 'Ustawienia · Gift Vault',
            'activeNav' => 'settings',
            'settings' => Serializer::settings($settingsRow),
            'database' => [
                'path' => $isOwner ? 'data/gift-vault.sqlite' : '',
                'size' => $isOwner ? (int) (@filesize($databasePath) ?: 0) : 0,
                'uploadsPath' => $isOwner ? 'data/uploads' : '',
                'uploadsSize' => Images::uploadsSize($isOwner ? null : $uploadRepository->filenamesForUser($userId)),
                'counts' => $counts,
            ],
            'backups' => $backups,
            'isOwner' => $isOwner,
            'users' => $users,
            'invitations' => $invitations,
            'app' => [
                'name' => 'Gift Vault',
                'version' => (string) App::config('app.version', '2.0.0'),
                'runtime' => 'PHP ' . PHP_VERSION,
                'storage' => 'SQLite with private account data',
                'backupDirectory' => $isOwner ? 'data/backups' : '',
            ],
        ]);
    }

    public function upload(string $filename): Response
    {
        if ($redirect = AuthMiddleware::requirePageUser($this->request)) {
            return $redirect;
        }
        $user = Auth::user();
        $filename = basename($filename);
        $repository = new UploadRepository();
        if ($filename === '' || !$repository->existsForUser($filename, (string) $user['id'])) {
            throw new HttpException(404, 'Nie znaleziono zdjęcia.', 'NOT_FOUND');
        }
        $path = Images::absolutePath($filename);
        if (!is_file($path)) {
            throw new HttpException(404, 'Nie znaleziono zdjęcia.', 'NOT_FOUND');
        }

        return Response::file($path, null, [
            'Cache-Control' => 'private, max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function health(): Response
    {
        try {
            App::db()->value('SELECT 1');
            $database = 'connected';
        } catch (\Throwable $error) {
            $database = 'error';
        }
        return Response::json([
            'status' => $database === 'connected' ? 'ok' : 'degraded',
            'database' => $database,
            'uptime' => (int) ($_SERVER['REQUEST_TIME_FLOAT'] ?? microtime(true)),
            'timestamp' => gmdate('Y-m-d\TH:i:s\Z'),
        ]);
    }

    public function meta(): Response
    {
        $user = AuthMiddleware::user($this->request);
        $settingsRow = $this->settings->findForUser((string) $user['id']);
        return Response::json([
            'productCount' => $this->products->countForUser((string) $user['id']),
            'status' => 'ok',
            'database' => 'connected',
            'frogMode' => (bool) App::config('app.frog_mode', false),
            'lastBackupAt' => $settingsRow['lastBackupAt'] !== null ? Str::isoFromMs($settingsRow['lastBackupAt']) : null,
        ]);
    }

    public function notFound(): Response
    {
        $user = Auth::user();
        return View::render('errors/404', [
            'title' => 'Strona nie znaleziona · Gift Vault',
            'activeNav' => '',
        ], $user === null ? 'auth-layout' : 'layout');
    }
}
