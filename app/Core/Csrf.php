<?php

declare(strict_types=1);

namespace App\Core;

final class Csrf
{
    private const COOKIE = 'gv_csrf';

    public static function token(Request $request): string
    {
        return self::compute($request, self::context($request, true));
    }

    public static function field(Request $request): string
    {
        return '<input type="hidden" name="_csrf" value="' . e(self::token($request)) . '">';
    }

    public static function enforce(Request $request): void
    {
        if (!in_array($request->method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return;
        }

        $provided = $request->header('x-csrf-token');
        if ($provided === null && isset($request->body['_csrf'])) {
            $provided = (string) $request->body['_csrf'];
        }
        if ($provided === null && isset($request->query['_csrf'])) {
            $provided = (string) $request->query['_csrf'];
        }

        if ($provided === null || $provided === '') {
            throw new HttpException(403, 'Brak tokena bezpieczeństwa. Odśwież stronę i spróbuj ponownie.', 'CSRF_MISSING');
        }

        $expected = self::token($request);
        if (!hash_equals($expected, $provided)) {
            throw new HttpException(403, 'Token bezpieczeństwa wygasł. Odśwież stronę i spróbuj ponownie.', 'CSRF_INVALID');
        }
    }

    private static function context(Request $request, bool $createGuest = false): string
    {
        $sessionToken = Auth::rawToken($request);
        if ($sessionToken !== null) {
            return 'u:' . $sessionToken;
        }

        $guest = $request->cookie(self::COOKIE);
        if ($guest === null || !preg_match('/^[a-f0-9]{64}$/i', $guest)) {
            $guest = Str::token(32);
            if ($createGuest && !headers_sent()) {
                setcookie(self::COOKIE, $guest, [
                    'expires' => time() + 86400,
                    'path' => '/',
                    'secure' => $request->isSecure(),
                    'httponly' => true,
                    'samesite' => 'Lax',
                ]);
            }
            $_COOKIE[self::COOKIE] = $guest;
        }
        return 'g:' . $guest;
    }

    private static function compute(Request $request, string $context): string
    {
        $secret = (string) App::config('security.secret');
        return Str::base64Url(hash_hmac('sha256', $context, $secret, true));
    }
}
