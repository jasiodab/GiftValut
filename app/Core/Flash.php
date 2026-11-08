<?php

declare(strict_types=1);

namespace App\Core;

final class Flash
{
    private const COOKIE = 'gv_flash';

    public static function success(string $message): void
    {
        self::set('success', $message);
    }

    public static function error(string $message): void
    {
        self::set('error', $message);
    }

    public static function info(string $message): void
    {
        self::set('info', $message);
    }

    private static function set(string $type, string $message): void
    {
        $payload = Str::jsonEncode(['type' => $type, 'message' => $message]);
        self::writeCookie($payload);
    }

    public static function pull(): ?array
    {
        $raw = $_COOKIE[self::COOKIE] ?? null;
        if (!is_string($raw) || $raw === '') {
            return null;
        }
        self::writeCookie('', time() - 3600);
        $decoded = json_decode($raw, true);
        if (!is_array($decoded) || !isset($decoded['type'], $decoded['message'])) {
            return null;
        }
        return ['type' => (string) $decoded['type'], 'message' => (string) $decoded['message']];
    }

    private static function writeCookie(string $value, ?int $expires = null): void
    {
        if (headers_sent()) {
            return;
        }
        $secure = self::isSecure();
        setcookie(self::COOKIE, $value, [
            'expires' => $expires ?? 0,
            'path' => '/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        if ($value === '') {
            unset($_COOKIE[self::COOKIE]);
        } else {
            $_COOKIE[self::COOKIE] = $value;
        }
    }

    private static function isSecure(): bool
    {
        $mode = (string) App::config('security.cookie_secure', 'auto');
        if ($mode === 'true' || $mode === '1') {
            return true;
        }
        if ($mode === 'false' || $mode === '0') {
            return false;
        }
        $https = $_SERVER['HTTPS'] ?? '';
        if ($https !== '' && strtolower((string) $https) !== 'off') {
            return true;
        }
        return ($_SERVER['SERVER_PORT'] ?? '') === '443'
            || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
    }
}
