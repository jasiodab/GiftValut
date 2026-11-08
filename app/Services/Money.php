<?php

declare(strict_types=1);

namespace App\Services;

final class Money
{
    public static function round(float $value): float
    {
        return round($value + 1.0E-9, 2);
    }

    public static function parsePriceValue(mixed $value): ?float
    {
        if (is_int($value) || is_float($value)) {
            $number = (float) $value;
            if (is_finite($number) && $number >= 0 && $number < 1000000000) {
                return self::round($number);
            }
            return null;
        }
        if (!is_string($value)) {
            return null;
        }

        $text = str_replace(["\u{00A0}", "\u{200B}", "\u{200C}", "\u{200D}"], [' ', '', '', ''], $value);
        $text = strtolower(trim($text));
        if ($text === '') {
            return null;
        }

        $text = (string) preg_replace(
            '/(zł|pln|eur|usd|gbp|chf|sek|nok|dkk|czk|huf|uah|jpy|cad|aud|\$|€|£|¥)/iu',
            '',
            $text
        );
        $text = (string) preg_replace("/[^0-9.,'-]/u", '', $text);
        $text = trim($text);
        $text = str_replace("'", '', $text);
        if ($text === '') {
            return null;
        }

        $comma = strrpos($text, ',');
        $dot = strrpos($text, '.');

        if ($comma !== false && $dot !== false) {
            $decimalSeparator = $comma > $dot ? ',' : '.';
            $thousandsSeparator = $decimalSeparator === ',' ? '.' : ',';
            $text = str_replace($thousandsSeparator, '', $text);
            if ($decimalSeparator === ',') {
                $position = strrpos($text, ',');
                if ($position !== false) {
                    $text = substr($text, 0, $position) . '.' . substr($text, $position + 1);
                }
            }
        } elseif ($comma !== false) {
            $decimals = strlen($text) - $comma - 1;
            if ($decimals > 0 && $decimals <= 2) {
                $position = strrpos($text, ',');
                if ($position !== false) {
                    $text = substr($text, 0, $position) . '.' . substr($text, $position + 1);
                }
            } else {
                $text = str_replace(',', '', $text);
            }
        } elseif ($dot !== false) {
            $decimals = strlen($text) - $dot - 1;
            if ($decimals !== 1 && $decimals !== 2) {
                $groups = explode('.', $text);
                if (count($groups) > 2 || strlen($groups[0] ?? '') > 3) {
                    $text = implode('', $groups);
                }
            }
        }

        if (!is_numeric($text)) {
            return null;
        }
        $numeric = (float) $text;
        if (!is_finite($numeric) || $numeric < 0 || $numeric >= 1000000000) {
            return null;
        }
        return self::round($numeric);
    }

    public static function normalizeCurrency(mixed $value, string $fallback = 'PLN'): string
    {
        if (!is_string($value)) {
            return $fallback;
        }
        $cleaned = strtoupper(trim($value));
        if (preg_match('/^[A-Z]{3}$/', $cleaned)) {
            return $cleaned;
        }
        if ($cleaned === 'ZŁ' || $cleaned === 'ZL') {
            return 'PLN';
        }
        if ($cleaned === '€') {
            return 'EUR';
        }
        if ($cleaned === '$') {
            return 'USD';
        }
        if ($cleaned === '£') {
            return 'GBP';
        }
        return $fallback;
    }
}
