<?php

declare(strict_types=1);

namespace App\Core;

final class Str
{
    public static function nowMs(): int
    {
        return (int) floor(microtime(true) * 1000);
    }

    public static function id(): string
    {
        return 'c' . bin2hex(random_bytes(12));
    }

    public static function token(int $bytes = 32): string
    {
        return bin2hex(random_bytes($bytes));
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function base64Url(string $binary): string
    {
        return rtrim(strtr(base64_encode($binary), '+/', '-_'), '=');
    }

    /**
     * Convert milliseconds (or an ISO string) to an ISO-8601 UTC string.
     */
    public static function isoFromMs(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_string($value) && !is_numeric($value)) {
            $timestamp = strtotime($value);
            if ($timestamp === false) {
                return null;
            }
            return gmdate('Y-m-d\TH:i:s.000\Z', $timestamp);
        }
        $ms = (int) $value;
        $seconds = intdiv($ms, 1000);
        $millis = $ms % 1000;
        if ($millis < 0) {
            $millis += 1000;
        }
        return gmdate('Y-m-d\TH:i:s', $seconds) . sprintf('.%03dZ', $millis);
    }

    public static function slugify(string $name): string
    {
        $map = [
            'ł' => 'l', 'Ł' => 'L',
            'ą' => 'a', 'ć' => 'c', 'ę' => 'e', 'ń' => 'n',
            'ó' => 'o', 'ś' => 's', 'ź' => 'z', 'ż' => 'z',
            'Ą' => 'A', 'Ć' => 'C', 'Ę' => 'E', 'Ń' => 'N',
            'Ó' => 'O', 'Ś' => 'S', 'Ź' => 'Z', 'Ż' => 'Z',
        ];
        $text = strtr($name, $map);

        $converted = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
        if ($converted !== false) {
            $text = $converted;
        }

        $text = strtolower($text);
        $text = preg_replace('/[^a-z0-9]+/', '-', $text) ?? '';
        $text = trim($text, '-');
        $text = substr($text, 0, 50);

        return $text !== '' ? $text : 'category';
    }

    public static function hostWithoutWww(string $host): string
    {
        return strtolower((string) preg_replace('/^www\./i', '', $host));
    }

    public static function truncate(string $value, int $length): string
    {
        if (mb_strlen($value) <= $length) {
            return $value;
        }
        return mb_substr($value, 0, max(0, $length - 1)) . '…';
    }

    public static function jsonEncode(mixed $value): string
    {
        $encoded = json_encode(
            $value,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
        );
        return $encoded === false ? 'null' : $encoded;
    }
}
