<?php

declare(strict_types=1);

use App\Core\App;
use App\Core\Auth;
use App\Core\Csrf;
use App\Core\Str;
use App\Core\View;

if (!function_exists('e')) {
    function e(mixed $value): string
    {
        if ($value === null) {
            return '';
        }
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}

if (!function_exists('url')) {
    function url(string $path = ''): string
    {
        if (preg_match('#^https?://#i', $path)) {
            return $path;
        }
        $base = rtrim((string) App::config('app.url', ''), '/');
        if ($path === '') {
            return $base === '' ? '/' : $base . '/';
        }
        return $base . '/' . ltrim($path, '/');
    }
}

if (!function_exists('asset')) {
    function asset(string $path): string
    {
        $relative = 'assets/' . ltrim($path, '/');
        $file = App::root() . '/public/' . $relative;
        $version = is_file($file) ? (string) filemtime($file) : (string) App::config('app.version', '1');
        return url($relative) . '?v=' . rawurlencode($version);
    }
}

if (!function_exists('csrf_token')) {
    function csrf_token(): string
    {
        $request = App::request();
        return $request === null ? '' : Csrf::token($request);
    }
}

if (!function_exists('csrf_field')) {
    function csrf_field(): string
    {
        $token = csrf_token();
        return $token === '' ? '' : '<input type="hidden" name="_csrf" value="' . e($token) . '">';
    }
}

if (!function_exists('view_partial')) {
    function view_partial(string $template, array $data = []): string
    {
        return View::partial($template, $data);
    }
}

if (!function_exists('icon')) {
    function icon(string $name, string $class = 'icon'): string
    {
        $safe = preg_replace('/[^a-z0-9-]/', '', strtolower($name)) ?? '';
        if ($safe === '') {
            return '';
        }
        return '<svg class="' . e($class) . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="#i-' . e($safe) . '"></use></svg>';
    }
}

if (!function_exists('lucide_name')) {
    function lucide_name(?string $name): string
    {
        $name = trim((string) $name);
        if ($name === '') {
            return 'tag';
        }
        $kebab = preg_replace('/(?<!^)[A-Z]/', '-$0', $name) ?? $name;
        $kebab = preg_replace('/-([0-9]+)$/', '-$1', $kebab) ?? $kebab;
        return strtolower($kebab);
    }
}

if (!function_exists('to_timestamp')) {
    function to_timestamp(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_numeric($value)) {
            $number = (float) $value;
            if ($number > 100000000000) {
                return (int) floor($number / 1000);
            }
            return (int) $number;
        }
        if (is_string($value)) {
            $timestamp = strtotime($value);
            return $timestamp === false ? null : $timestamp;
        }
        return null;
    }
}

if (!function_exists('currency_symbol')) {
    function currency_symbol(string $currency): string
    {
        $map = [
            'PLN' => 'zł',
            'EUR' => '€',
            'USD' => '$',
            'GBP' => '£',
            'JPY' => '¥',
            'CHF' => 'CHF',
            'SEK' => 'kr',
            'NOK' => 'kr',
            'DKK' => 'kr',
            'CZK' => 'Kč',
            'HUF' => 'Ft',
            'UAH' => '₴',
            'CAD' => 'CA$',
            'AUD' => 'A$',
        ];
        return $map[strtoupper($currency)] ?? strtoupper($currency);
    }
}

if (!function_exists('format_money')) {
    function format_money(mixed $value, string $currency = 'PLN'): string
    {
        if ($value === null || $value === '' || !is_numeric($value)) {
            return '—';
        }
        $number = (float) $value;
        $decimals = abs($number - round($number)) < 0.00001 ? 0 : 2;
        return number_format($number, $decimals, ',', ' ') . ' ' . currency_symbol($currency);
    }
}

if (!function_exists('format_compact_money')) {
    function format_compact_money(mixed $value, string $currency = 'PLN'): string
    {
        if ($value === null || $value === '' || !is_numeric($value)) {
            return '—';
        }
        $number = (float) $value;
        if (abs($number) >= 10000) {
            if (abs($number) >= 1000000) {
                return number_format($number / 1000000, 1, ',', ' ') . ' mln ' . currency_symbol($currency);
            }
            return number_format($number / 1000, 1, ',', ' ') . ' tys. ' . currency_symbol($currency);
        }
        return format_money($number, $currency);
    }
}

if (!function_exists('format_date')) {
    function format_date(mixed $value): string
    {
        $timestamp = to_timestamp($value);
        if ($timestamp === null) {
            return '—';
        }
        return date('j M Y', $timestamp);
    }
}

if (!function_exists('format_datetime')) {
    function format_datetime(mixed $value): string
    {
        $timestamp = to_timestamp($value);
        if ($timestamp === null) {
            return '—';
        }
        return date('j M Y, H:i', $timestamp);
    }
}

if (!function_exists('time_ago')) {
    function time_ago(mixed $value): string
    {
        $timestamp = to_timestamp($value);
        if ($timestamp === null) {
            return 'Never';
        }
        $seconds = $timestamp - time();
        $absolute = abs($seconds);
        if ($absolute < 60) {
            return 'Just now';
        }
        if ($absolute < 3600) {
            $minutes = (int) round($seconds / 60);
            return $minutes === -1 ? '1 minute ago' : ($minutes < 0 ? abs($minutes) . ' minutes ago' : 'in ' . $minutes . ' minutes');
        }
        if ($absolute < 86400) {
            $hours = (int) round($seconds / 3600);
            return $hours === -1 ? '1 hour ago' : ($hours < 0 ? abs($hours) . ' hours ago' : 'in ' . $hours . ' hours');
        }
        if ($absolute < 604800) {
            $days = (int) round($seconds / 86400);
            return $days === -1 ? '1 day ago' : ($days < 0 ? abs($days) . ' days ago' : 'in ' . $days . ' days');
        }
        return format_date($timestamp);
    }
}

if (!function_exists('format_bytes')) {
    function format_bytes(mixed $bytes): string
    {
        $number = (float) $bytes;
        if ($number <= 0) {
            return '0 B';
        }
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $index = min((int) floor(log($number, 1024)), count($units) - 1);
        $scaled = $number / (1024 ** $index);
        return number_format($scaled, $index === 0 ? 0 : 1, ',', ' ') . ' ' . $units[$index];
    }
}

if (!function_exists('status_meta')) {
    function status_meta(string $status): array
    {
        $map = [
            'TO_CONSIDER' => [
                'label' => 'To consider',
                'short' => 'Considering',
                'description' => 'Ideas worth keeping an eye on',
                'class' => 'status-consider',
                'dot' => 'dot-muted',
            ],
            'FAVORITE' => [
                'label' => 'Favorite',
                'short' => 'Favorite',
                'description' => 'Your most-loved finds',
                'class' => 'status-favorite',
                'dot' => 'dot-primary',
            ],
            'TO_BUY' => [
                'label' => 'To buy',
                'short' => 'To buy',
                'description' => 'Ready for the next occasion',
                'class' => 'status-tobuy',
                'dot' => 'dot-warning',
            ],
            'PURCHASED' => [
                'label' => 'Purchased',
                'short' => 'Purchased',
                'description' => 'Gifts already secured',
                'class' => 'status-purchased',
                'dot' => 'dot-success',
            ],
        ];
        return $map[$status] ?? $map['TO_CONSIDER'];
    }
}

if (!function_exists('status_label')) {
    function status_label(string $status): string
    {
        return status_meta($status)['label'];
    }
}

if (!function_exists('initials')) {
    function initials(string $value): string
    {
        $parts = preg_split('/\s+/', trim($value)) ?: [];
        $parts = array_values(array_filter($parts, static fn ($part) => $part !== ''));
        $letters = '';
        foreach (array_slice($parts, 0, 2) as $part) {
            $letters .= mb_strtoupper(mb_substr($part, 0, 1));
        }
        return $letters !== '' ? $letters : mb_strtoupper(mb_substr($value, 0, 1));
    }
}

if (!function_exists('product_image_url')) {
    function product_image_url(?string $path): ?string
    {
        if ($path === null || $path === '') {
            return null;
        }
        if (preg_match('#^https?://#i', $path)) {
            return $path;
        }
        return url($path);
    }
}

if (!function_exists('discount_percent')) {
    function discount_percent(mixed $current, mixed $original): ?int
    {
        if (!is_numeric($current) || !is_numeric($original)) {
            return null;
        }
        $current = (float) $current;
        $original = (float) $original;
        if ($original <= 0 || $original <= $current) {
            return null;
        }
        return (int) round((($original - $current) / $original) * 100);
    }
}

if (!function_exists('is_nav_active')) {
    function is_nav_active(string $active, string $key): bool
    {
        return $active === $key;
    }
}

if (!function_exists('current_path')) {
    function current_path(): string
    {
        $request = App::request();
        return $request === null ? '/' : $request->path;
    }
}

if (!function_exists('mask_secret')) {
    function mask_secret(string $value): string
    {
        $length = strlen($value);
        if ($length <= 8) {
            return str_repeat('•', max(4, $length));
        }
        return substr($value, 0, 4) . str_repeat('•', 8) . substr($value, -4);
    }
}
