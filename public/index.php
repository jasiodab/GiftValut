<?php

declare(strict_types=1);

@ob_start();

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
use App\Controllers\CategoryGroupController;
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

$request = Request::capture();
App::setRequest($request);
$isApi = str_starts_with($request->path, '/api/');

/**
 * Render a minimal, dependency-free HTML error page.
 * Used as a last resort when the normal view/layout pipeline is unavailable.
 */
$renderFatalPage = static function (int $status, string $title, string $message): void {
    http_response_code($status);
    if (!headers_sent()) {
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
    }
    $safeTitle = htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeMessage = htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeStatus = (string) $status;
    echo '<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>' . $safeTitle . '</title>'
        . '<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f4f5;color:#252329;min-height:100vh;display:grid;place-items:center;padding:24px}'
        . '.card{max-width:520px;width:100%;background:#fff;border:1px solid #e6e0e3;border-radius:16px;padding:28px;box-shadow:0 8px 30px rgba(0,0,0,.06)}'
        . '.eyebrow{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8b5b72;margin-bottom:8px;font-weight:600}'
        . 'h1{margin:0 0 10px;font-size:24px;line-height:1.2}p{margin:0 0 18px;color:#5b555b;line-height:1.5}'
        . 'a{display:inline-block;padding:10px 14px;border-radius:10px;background:#e9afc5;color:#252329;text-decoration:none;font-weight:600}'
        . '@media(prefers-color-scheme:dark){body{background:#161417;color:#f2eef0}.card{background:#211e22;border-color:#332e33}.eyebrow{color:#e9afc5}p{color:#b7afb4}}</style>'
        . '</head><body><main class="card"><div class="eyebrow">BĹ‚Ä…d ' . $safeStatus . '</div><h1>' . $safeTitle . '</h1>'
        . '<p>' . $safeMessage . '</p><a href="/">WrĂłÄ‡ na stronÄ™ gĹ‚ĂłwnÄ…</a></main></body></html>';
};

try {
    App::ensureSchema();
} catch (Throwable $error) {
    $debug = (bool) App::config('app.debug', false);
    $publicMessage = $debug ? $error->getMessage() : 'Nie moĹĽna otworzyÄ‡ lokalnej bazy danych Gift Vault. SprĂłbuj ponownie za chwilÄ™.';
    error_log('[Gift Vault] Schema/init error: ' . $error->getMessage() . ' in ' . $error->getFile() . ':' . $error->getLine());

    if ($isApi || $request->wantsJson()) {
        Response::error(503, 'DB_UNAVAILABLE', $publicMessage)->send();
        exit;
    }

    $renderFatalPage(503, 'BĹ‚Ä…d poĹ‚Ä…czenia z bazÄ… danych', $publicMessage);
    exit;
}

// Register routes.
$router = new Router($request);

// Pages.
$router->get('/', [PageController::class, 'dashboard']);
$router->get('/products', [PageController::class, 'products']);
$router->get('/products/{id}', [PageController::class, 'productShow']);
$router->get('/categories', [PageController::class, 'categories']);
$router->get('/groups', [PageController::class, 'groups']);
$router->get('/settings', [PageController::class, 'settings']);
$router->post('/settings/password', [AuthController::class, 'changePasswordForm']);
$router->get('/login', [AuthController::class, 'showLogin']);
$router->post('/login', [AuthController::class, 'loginForm']);
$router->post('/logout', [AuthController::class, 'logoutForm']);
$router->get('/setup', [AuthController::class, 'showSetup']);
$router->post('/setup', [AuthController::class, 'setupForm']);
$router->get('/invite/{token}', [AuthController::class, 'showInvite']);
$router->post('/invite/{token}', [AuthController::class, 'inviteForm']);
$router->get('/invite-group/{token}', [CategoryGroupController::class, 'showGroupInvite']);
$router->post('/invite-group/{token}/accept', [CategoryGroupController::class, 'acceptGroupInviteForm']);
$router->post('/invite-group/{token}/decline', [CategoryGroupController::class, 'declineGroupInviteForm']);
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
$router->get('/api/products/{id}/price-history', [ProductController::class, 'priceHistory']);

$router->get('/api/categories', [CategoryController::class, 'index']);
$router->post('/api/categories', [CategoryController::class, 'create']);
$router->patch('/api/categories/{id}', [CategoryController::class, 'update']);
$router->delete('/api/categories/{id}', [CategoryController::class, 'delete']);

$router->get('/api/category-groups', [CategoryGroupController::class, 'index']);
$router->post('/api/category-groups', [CategoryGroupController::class, 'create']);
$router->get('/api/category-groups/{id}', [CategoryGroupController::class, 'show']);
$router->patch('/api/category-groups/{id}', [CategoryGroupController::class, 'update']);
$router->delete('/api/category-groups/{id}', [CategoryGroupController::class, 'delete']);
$router->get('/api/category-groups/{id}/members', [CategoryGroupController::class, 'members']);
$router->post('/api/category-groups/{id}/invitations', [CategoryGroupController::class, 'addMember']);
$router->patch('/api/category-groups/{id}/members/{userId}', [CategoryGroupController::class, 'updateMemberRole']);
$router->delete('/api/category-groups/{id}/members/{userId}', [CategoryGroupController::class, 'removeMember']);
$router->get('/api/category-groups/{id}/invitations', [CategoryGroupController::class, 'invitations']);
$router->delete('/api/category-groups/{id}/invitations/{invitationId}', [CategoryGroupController::class, 'revokeInvitation']);
$router->post('/api/category-group-invitations/accept/{token}', [CategoryGroupController::class, 'acceptInvitation']);

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

try {
    if ($maintenance = MaintenanceMiddleware::guard($request)) {
        $maintenance->send();
        exit;
    }

    // CSRF is required for all state-changing requests (POST/PUT/PATCH/DELETE).
    // Session cookies are sent automatically, so without CSRF an attacker could
    // force password changes, logouts, group invitations, etc. via a malicious site.
    // /api/auth/login is the only public endpoint that stays CSRF-free.
    $isStateChanging = in_array($request->method, ['POST', 'PUT', 'PATCH', 'DELETE'], true);
    if ($isStateChanging && $path !== '/api/auth/login') {
        CsrfMiddleware::enforce($request);
    }

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
        $next = $request->path . ($request->query !== [] ? ('?' . http_build_query($request->query)) : '');
        Response::redirect(url('login?next=' . rawurlencode($next)))->send();
        exit;
    }

    $status = $error->status;
    $view = $status === 404 ? 'errors/404' : 'errors/error';
    $title = match ($status) {
        403 => 'Brak dostępu',
        404 => 'Nie znaleziono strony',
        503 => 'Chwilowa przerwa',
        default => 'Wystąpił błąd',
    };
    $defaultMessage = match ($status) {
        403 => 'Nie masz uprawnień do wyświetlenia tej strony.',
        404 => 'Strona, której szukasz, nie istnieje.',
        503 => 'Gift Vault jest chwilowo niedostępny. Spróbuj ponownie za moment.',
        default => 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.',
    };
    $message = trim($error->getMessage()) !== '' ? $error->getMessage() : $defaultMessage;

    $layout = 'auth-layout';
    try {
        $layout = Auth::user() === null ? 'auth-layout' : 'layout';
    } catch (Throwable) {
        $layout = 'auth-layout';
    }

    try {
        $html = View::render($view, [
            'title' => $title . ' · Gift Vault',
            'activeNav' => '',
            'status' => $status,
            'message' => $message,
        ], $layout);
        $html->status = $status;
        $html->send();
    } catch (Throwable $renderError) {
        error_log('[Gift Vault] Error view render failed: ' . $renderError->getMessage());
        $renderFatalPage($status, $title, $message);
    }
} catch (Throwable $error) {
    error_log('[Gift Vault] ' . $error->getMessage() . ' in ' . $error->getFile() . ':' . $error->getLine());
    $debug = (bool) App::config('app.debug', false);
    $message = $debug ? $error->getMessage() : 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.';

    if ($isApi || $request->wantsJson()) {
        Response::error(500, 'INTERNAL_ERROR', $message)->send();
        exit;
    }

    $layout = 'auth-layout';
    try {
        $layout = Auth::user() === null ? 'auth-layout' : 'layout';
    } catch (Throwable) {
        $layout = 'auth-layout';
    }

    try {
        $html = View::render('errors/error', [
            'title' => 'Wystąpił błąd · Gift Vault',
            'activeNav' => '',
            'status' => 500,
            'message' => $message,
        ], $layout);
        $html->status = 500;
        $html->send();
    } catch (Throwable $renderError) {
        error_log('[Gift Vault] Fatal view render failed: ' . $renderError->getMessage());
        $renderFatalPage(500, 'Wystąpił błąd', $message);
    }
}