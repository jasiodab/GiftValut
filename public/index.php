<?php

declare(strict_types=1);

/**
 * Gift Vault front controller.
 *
 * This file is the only PHP entry point that should be reachable from the web
 * root. Everything else lives outside public/.
 */

// The PHP built-in server asks the router script to serve existing static files.
if (PHP_SAPI === 'cli-server') {
    $requestPath = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
    $candidate = __DIR__ . (is_string($requestPath) ? $requestPath : '');
    if (is_string($requestPath) && $requestPath !== '/' && is_file($candidate)) {
        return false;
    }
}

require dirname(__DIR__) . '/app/bootstrap.php';

use App\Controllers\AuthController;
use App\Controllers\CategoryController;
use App\Controllers\DashboardController;
use App\Controllers\ExtractController;
use App\Controllers\PageController;
use App\Controllers\ProductController;
use App\Controllers\SettingsController;
use App\Controllers\TagController;
use App\Controllers\UploadController;
use App\Core\App;
use App\Core\Auth;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Router;
use App\Core\View;
use App\Middleware\AuthMiddleware;
use App\Middleware\CsrfMiddleware;
use App\Middleware\MaintenanceMiddleware;
use App\Middleware\RateLimitMiddleware;

try {
    App::ensureSchema();
} catch (Throwable $error) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Gift Vault could not open its database.' . PHP_EOL;
    echo $error->getMessage() . PHP_EOL;
    exit;
}

try {
    $request = Request::capture();
} catch (HttpException $error) {
    http_response_code($error->status);
    header('Content-Type: application/json; charset=utf-8');
    echo \App\Core\Str::jsonEncode([
        'error' => ['code' => $error->errorCode, 'message' => $error->getMessage()],
    ]);
    exit;
}

App::setRequest($request);

// Register routes.
$router = new Router($request);

// Pages.
$router->get('/', [PageController::class, 'dashboard']);
$router->get('/products', [PageController::class, 'products']);
$router->get('/products/{id}', [PageController::class, 'productShow']);
$router->get('/categories', [PageController::class, 'categories']);
$router->get('/settings', [PageController::class, 'settings']);
$router->post('/settings/password', [AuthController::class, 'changePasswordForm']);
$router->get('/login', [AuthController::class, 'showLogin']);
$router->post('/login', [AuthController::class, 'loginForm']);
$router->post('/logout', [AuthController::class, 'logoutForm']);
$router->get('/setup', [AuthController::class, 'showSetup']);
$router->post('/setup', [AuthController::class, 'setupForm']);
$router->get('/invite/{token}', [AuthController::class, 'showInvite']);
$router->post('/invite/{token}', [AuthController::class, 'inviteForm']);
$router->get('/uploads/{filename}', [PageController::class, 'upload']);

// Public API.
$router->get('/api/health', [PageController::class, 'health']);
$router->get('/api/auth/setup-status', [AuthController::class, 'setupStatus']);
$router->post('/api/auth/bootstrap', [AuthController::class, 'bootstrap']);
$router->post('/api/auth/login', [AuthController::class, 'login']);
$router->post('/api/auth/logout', [AuthController::class, 'logout']);
$router->get('/api/auth/me', [AuthController::class, 'me']);
$router->post('/api/auth/invite/accept', [AuthController::class, 'acceptInvitation']);

// Authenticated API.
$router->post('/api/auth/change-password', [AuthController::class, 'changePassword']);
$router->get('/api/auth/invitations', [AuthController::class, 'listInvitations']);
$router->post('/api/auth/invitations', [AuthController::class, 'createInvitation']);
$router->post('/api/auth/invitations/{id}/revoke', [AuthController::class, 'revokeInvitation']);
$router->get('/api/auth/users', [AuthController::class, 'listUsers']);
$router->post('/api/auth/users/{id}/block', [AuthController::class, 'blockUser']);
$router->post('/api/auth/users/{id}/unblock', [AuthController::class, 'unblockUser']);
$router->delete('/api/auth/users/{id}', [AuthController::class, 'deleteUser']);

$router->get('/api/meta', [PageController::class, 'meta']);
$router->get('/api/dashboard', [DashboardController::class, 'index']);

$router->get('/api/products/check-url', [ProductController::class, 'checkUrl']);
$router->get('/api/products', [ProductController::class, 'index']);
$router->post('/api/products', [ProductController::class, 'create']);
$router->post('/api/products/bulk', [ProductController::class, 'bulk']);
$router->get('/api/products/{id}', [ProductController::class, 'show']);
$router->patch('/api/products/{id}', [ProductController::class, 'update']);
$router->delete('/api/products/{id}', [ProductController::class, 'delete']);

$router->get('/api/categories', [CategoryController::class, 'index']);
$router->post('/api/categories', [CategoryController::class, 'create']);
$router->patch('/api/categories/{id}', [CategoryController::class, 'update']);
$router->delete('/api/categories/{id}', [CategoryController::class, 'delete']);

$router->get('/api/tags', [TagController::class, 'index']);
$router->post('/api/extract', [ExtractController::class, 'create']);

$router->get('/api/settings', [SettingsController::class, 'show']);
$router->patch('/api/settings', [SettingsController::class, 'update']);
$router->get('/api/settings/backup', [SettingsController::class, 'backup']);
$router->get('/api/settings/backups', [SettingsController::class, 'listBackups']);
$router->get('/api/settings/backups/{filename}', [SettingsController::class, 'downloadBackup']);
$router->post('/api/settings/restore', [SettingsController::class, 'restore']);
$router->get('/api/settings/info', [SettingsController::class, 'info']);

$router->post('/api/uploads/image', [UploadController::class, 'image']);

$path = $request->path;
$isApi = str_starts_with($path, '/api');

try {
    if ($maintenance = MaintenanceMiddleware::guard($request)) {
        $maintenance->send();
        exit;
    }

    CsrfMiddleware::enforce($request);

    $skipGeneralLimit = $isApi && (
        $path === '/api/health'
        || $path === '/api/auth/login'
        || $path === '/api/auth/bootstrap'
        || $path === '/api/extract'
    );
    if ($isApi && !$skipGeneralLimit) {
        RateLimitMiddleware::api($request);
    }

    if ($isApi
        && $path !== '/api/health'
        && !str_starts_with($path, '/api/auth')
    ) {
        AuthMiddleware::user($request);
    }

    $response = $router->dispatch();
    $response->send();
} catch (HttpException $error) {
    $wantsJson = $isApi || $request->wantsJson();
    if ($wantsJson) {
        Response::error(
            $error->status,
            $error->errorCode,
            $error->getMessage(),
            $error->details
        )->send();
        exit;
    }

    if ($error->status === 401) {
        Response::redirect(url('login?next=' . rawurlencode($request->path)))->send();
        exit;
    }

    $view = $error->status === 404 ? 'errors/404' : 'errors/error';
    $layout = Auth::user() === null ? 'auth-layout' : 'layout';
    try {
        $html = View::render($view, [
            'title' => ($error->status === 404 ? 'Page not found' : 'Something went wrong') . ' · Gift Vault',
            'activeNav' => '',
            'status' => $error->status,
            'message' => $error->getMessage(),
        ], $layout);
        $html->status = $error->status;
        $html->send();
    } catch (Throwable $renderError) {
        Response::text('Gift Vault error: ' . $error->getMessage(), $error->status)->send();
    }
} catch (Throwable $error) {
    error_log('[Gift Vault] ' . $error->getMessage() . ' in ' . $error->getFile() . ':' . $error->getLine());
    $debug = (bool) App::config('app.debug', false);
    $message = $debug ? $error->getMessage() : 'An unexpected error occurred. Please try again.';

    if ($isApi || $request->wantsJson()) {
        Response::error(500, 'INTERNAL_ERROR', $message)->send();
        exit;
    }

    try {
        $html = View::render('errors/error', [
            'title' => 'Something went wrong · Gift Vault',
            'activeNav' => '',
            'status' => 500,
            'message' => $message,
        ], Auth::user() === null ? 'auth-layout' : 'layout');
        $html->status = 500;
        $html->send();
    } catch (Throwable $renderError) {
        Response::text('Gift Vault error: ' . $message, 500)->send();
    }
}
