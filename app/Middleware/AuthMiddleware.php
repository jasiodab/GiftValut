<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Auth;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;

final class AuthMiddleware
{
    public static function user(Request $request): array
    {
        $user = Auth::user();
        if ($user === null) {
            throw new HttpException(401, 'Authentication required.', 'UNAUTHORIZED');
        }
        return $user;
    }

    public static function owner(Request $request): array
    {
        $user = self::user($request);
        if (($user['role'] ?? '') !== 'OWNER') {
            throw new HttpException(403, 'Owner access required.', 'FORBIDDEN');
        }
        return $user;
    }

    /**
     * Redirect guests to the login page for server-rendered pages.
     */
    public static function requirePageUser(Request $request): ?Response
    {
        if (Auth::user() === null) {
            $next = rawurlencode($request->path . (($request->query) !== [] ? '?' . http_build_query($request->query) : ''));
            return Response::redirect(url('login?next=' . $next));
        }
        return null;
    }
}
