<?php

declare(strict_types=1);

namespace App\Core;

use App\Services\LegacyPassword;
use PDOException;

final class Auth
{
    private const COOKIE = 'gv_session';
    private const LAST_SEEN_INTERVAL_MS = 300000;
    private const CLEANUP_INTERVAL_SECONDS = 14400;

    private static bool $resolved = false;
    private static ?array $user = null;
    private static ?string $token = null;
    private static bool $cleanupAttempted = false;

    public static function rawToken(Request $request): ?string
    {
        $header = $request->header('x-session-token');
        $cookie = $request->cookie(self::COOKIE);
        $token = $cookie !== null && $cookie !== '' ? $cookie : $header;
        if ($token === null || !preg_match('/^[a-f0-9]{32,128}$/i', $token)) {
            return null;
        }
        return $token;
    }

    public static function user(): ?array
    {
        if (!self::$resolved) {
            $request = App::request();
            if ($request === null) {
                return null;
            }
            self::resolve($request);
        }
        return self::$user;
    }

    public static function resolve(Request $request): void
    {
        if (self::$resolved) {
            return;
        }
        self::$resolved = true;

        $token = self::rawToken($request);
        if ($token === null) {
            return;
        }
        self::$token = $token;

        $tokenHash = Str::hashToken($token);
        try {
            $row = App::db()->fetch(
                'SELECT s.id AS session_id, s.expiresAt, s.revokedAt, s.lastSeenAt,
                        u.id, u.username, u.email, u.role, u.status, u.mustChangePassword, u.lastLoginAt
                 FROM "Session" s
                 INNER JOIN "User" u ON u.id = s.userId
                 WHERE s.tokenHash = ?
                 LIMIT 1',
                [$tokenHash]
            );
        } catch (PDOException $error) {
            self::$user = null;
            self::$token = null;
            return;
        }

        if ($row === null) {
            return;
        }

        $now = Str::nowMs();
        if ($row['revokedAt'] !== null || (int) $row['expiresAt'] <= $now || $row['status'] !== 'ACTIVE') {
            self::$token = null;
            return;
        }

        $lastSeen = (int) ($row['lastSeenAt'] ?? 0);
        if ($now - $lastSeen >= self::LAST_SEEN_INTERVAL_MS) {
            App::db()->execute(
                'UPDATE "Session" SET lastSeenAt = ? WHERE id = ? AND revokedAt IS NULL',
                [$now, $row['session_id']]
            );
        }

        self::$user = [
            'id' => (string) $row['id'],
            'username' => (string) $row['username'],
            'email' => (string) $row['email'],
            'role' => (string) $row['role'],
            'status' => (string) $row['status'],
            'mustChangePassword' => (bool) $row['mustChangePassword'],
            'lastLoginAt' => $row['lastLoginAt'] !== null ? (int) $row['lastLoginAt'] : null,
        ];

        self::cleanupExpiredSessions();
    }

    public static function check(): bool
    {
        return self::user() !== null;
    }

    public static function requireUser(): array
    {
        $user = self::user();
        if ($user === null) {
            throw new HttpException(401, 'Authentication required.', 'UNAUTHORIZED');
        }
        return $user;
    }

    public static function requireOwner(): array
    {
        $user = self::requireUser();
        if ($user['role'] !== 'OWNER') {
            throw new HttpException(403, 'Owner access required.', 'FORBIDDEN');
        }
        return $user;
    }

    public static function isOwner(): bool
    {
        $user = self::user();
        return $user !== null && $user['role'] === 'OWNER';
    }

    public static function login(Request $request, array $user): string
    {
        $database = App::db();

        $oldToken = self::rawToken($request);
        if ($oldToken !== null) {
            $database->execute(
                'UPDATE "Session" SET revokedAt = ? WHERE tokenHash = ? AND revokedAt IS NULL',
                [Str::nowMs(), Str::hashToken($oldToken)]
            );
        }

        $token = Str::token(32);
        $now = Str::nowMs();
        $expiresAt = $now + ((int) App::config('security.session_days', 7) * 86400000);

        $database->run(
            'INSERT INTO "Session" (id, userId, tokenHash, expiresAt, createdAt, lastSeenAt, revokedAt)
             VALUES (?, ?, ?, ?, ?, ?, NULL)',
            [Str::id(), $user['id'], Str::hashToken($token), $expiresAt, $now, $now]
        );

        self::$token = $token;
        self::$user = $user;
        self::$resolved = true;

        // Make sure no output has been flushed before setting the session cookie.
        @ob_end_clean();
        self::setSessionCookie($token, $request);

        return $token;
    }

    public static function logout(Request $request): void
    {
        $token = self::rawToken($request);
        if ($token !== null) {
            App::db()->execute(
                'UPDATE "Session" SET revokedAt = ? WHERE tokenHash = ? AND revokedAt IS NULL',
                [Str::nowMs(), Str::hashToken($token)]
            );
        }
        self::$token = null;
        self::$user = null;
        self::$resolved = true;
        self::clearSessionCookie($request);
    }

    public static function revokeAllSessions(Request $request, string $userId): void
    {
        App::db()->execute(
            'UPDATE "Session" SET revokedAt = ? WHERE userId = ? AND revokedAt IS NULL',
            [Str::nowMs(), $userId]
        );
        self::$user = null;
        self::$token = null;
        self::$resolved = true;
        self::clearSessionCookie($request);
    }

    public static function hashPassword(string $password): string
    {
        $hash = password_hash($password, PASSWORD_BCRYPT, [
            'cost' => (int) App::config('security.bcrypt_cost', 12),
        ]);
        if (!is_string($hash) || $hash === '') {
            throw new HttpException(500, 'Nie można zahaszować hasła.', 'PASSWORD_HASH_FAILED');
        }
        return $hash;
    }

    public static function verifyPassword(string $password, string $stored): bool
    {
        if (str_starts_with($stored, 'scrypt$')) {
            return LegacyPassword::verify($password, $stored);
        }
        return password_verify($password, $stored);
    }

    public static function isLegacyHash(string $stored): bool
    {
        return str_starts_with($stored, 'scrypt$');
    }

    public static function rehashPassword(string $userId, string $password): void
    {
        App::db()->execute(
            'UPDATE "User" SET passwordHash = ?, updatedAt = ? WHERE id = ?',
            [self::hashPassword($password), Str::nowMs(), $userId]
        );
    }

    public static function cleanupExpiredSessions(): void
    {
        if (self::$cleanupAttempted) {
            return;
        }
        self::$cleanupAttempted = true;

        $marker = App::config('paths.data') . '/.session-cleanup';
        $last = is_file($marker) ? (int) file_get_contents($marker) : 0;
        if (time() - $last < self::CLEANUP_INTERVAL_SECONDS) {
            return;
        }
        @file_put_contents($marker, (string) time(), LOCK_EX);

        try {
            App::db()->execute(
                'DELETE FROM "Session" WHERE expiresAt < ?',
                [Str::nowMs() - 86400000]
            );
        } catch (\Throwable $error) {
            // Cleanup is best-effort only.
        }
    }

    private static function setSessionCookie(string $token, Request $request): void
    {
        if (headers_sent()) {
            return;
        }
        setcookie(self::COOKIE, $token, [
            'expires' => time() + ((int) App::config('security.session_days', 7) * 86400),
            'path' => '/',
            'secure' => self::cookieSecure($request),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        $_COOKIE[self::COOKIE] = $token;
    }

    public static function clearSessionCookie(Request $request): void
    {
        if (headers_sent()) {
            return;
        }
        setcookie(self::COOKIE, '', [
            'expires' => time() - 3600,
            'path' => '/',
            'secure' => self::cookieSecure($request),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        unset($_COOKIE[self::COOKIE]);
    }

    private static function cookieSecure(Request $request): bool
    {
        $mode = (string) App::config('security.cookie_secure', 'auto');
        if ($mode === 'true' || $mode === '1') {
            return true;
        }
        if ($mode === 'false' || $mode === '0') {
            return false;
        }
        return $request->isSecure();
    }
}
