<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\App;
use App\Core\Auth;
use App\Core\HttpException;
use App\Core\RateLimiter;
use App\Core\Request;

final class RateLimitMiddleware
{
    public static function login(Request $request): void
    {
        // Different devices behind the same NAT/IP (shared Wi-Fi) must not
        // share one login bucket. Add the user agent so each device/desktop
        // has its own limit instead of one shared bucket per IP address.
        $identity = 'ip:' . $request->ip . '|ua:' . ($request->header('user-agent') ?? 'unknown');
        self::hit('login', $identity, (array) App::config('limits.login'));
    }

    public static function bootstrap(Request $request): void
    {
        self::hit('bootstrap', 'ip:' . $request->ip, (array) App::config('limits.bootstrap'));
    }

    public static function extract(Request $request): void
    {
        $user = Auth::user();
        $identity = $user !== null ? 'user:' . $user['id'] : 'ip:' . $request->ip;
        self::hit('extract', $identity, (array) App::config('limits.extract'));
    }

    public static function api(Request $request): void
    {
        $user = Auth::user();
        $identity = $user !== null ? 'user:' . $user['id'] : 'ip:' . $request->ip;
        self::hit('api', $identity, (array) App::config('limits.api'));
    }

    /**
     * @param array{window: int, max: int} $config
     */
    private static function hit(string $prefix, string $identity, array $config): void
    {
        $retry = RateLimiter::hit(
            $prefix,
            $identity,
            max(1, (int) ($config['window'] ?? 60)),
            max(1, (int) ($config['max'] ?? 10))
        );
        if ($retry !== null) {
            if (!headers_sent()) {
                header('Retry-After: ' . max(1, $retry));
            }
            throw new HttpException(
                429,
                'Too many requests. Please try again later.',
                'RATE_LIMITED'
            );
        }
    }
}
