<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\HttpException;

final class UrlSafety
{
    private const BLOCKED_SUFFIXES = [
        '.localhost',
        '.local',
        '.internal',
        '.localdomain',
        '.home.arpa',
        '.lan',
        '.intranet',
        '.test',
        '.invalid',
        '.example',
    ];

    /**
     * Normalise a product URL exactly like the old Node backend.
     *
     * @return array{url: string, normalizedUrl: string}
     */
    public static function normalizeProductUrl(string $input): array
    {
        $trimmed = trim($input);
        $parts = parse_url($trimmed);
        if ($parts === false || !isset($parts['scheme'], $parts['host']) || $parts['host'] === '') {
            throw new HttpException(400, 'Wpisz poprawny adres URL produktu.', 'INVALID_URL');
        }

        $scheme = strtolower((string) $parts['scheme']);
        if ($scheme !== 'http' && $scheme !== 'https') {
            throw new HttpException(400, 'Obsługiwane są tylko linki HTTP i HTTPS.', 'INVALID_PROTOCOL');
        }
        if (isset($parts['user']) || isset($parts['pass'])) {
            throw new HttpException(400, 'URLs containing credentials are not supported.', 'INVALID_URL');
        }

        $host = strtolower((string) $parts['host']);
        $port = $parts['port'] ?? null;
        if ($port !== null) {
            $port = (int) $port;
            if (($scheme === 'http' && $port === 80) || ($scheme === 'https' && $port === 443)) {
                $port = null;
            }
        }

        $path = $parts['path'] ?? '/';
        if ($path === '') {
            $path = '/';
        }
        if ($path[0] !== '/') {
            $path = '/' . $path;
        }

        $query = self::normalizeQuery((string) ($parts['query'] ?? ''));

        $authority = $host;
        if (str_contains($authority, ':') && !str_starts_with($authority, '[')) {
            $authority = '[' . $authority . ']';
        }
        if ($port !== null) {
            $authority .= ':' . $port;
        }

        $cleanUrl = $scheme . '://' . $authority . $path;
        if ($query !== '') {
            $cleanUrl .= '?' . $query;
        }

        $normalized = $scheme . '://' . $authority . $path;
        if ($query !== '') {
            $normalized .= '?' . $query;
        }
        if ($path !== '/' && str_ends_with($normalized, '/')) {
            $normalized = substr($normalized, 0, -1);
        }

        return ['url' => $cleanUrl, 'normalizedUrl' => $normalized];
    }

    private static function normalizeQuery(string $query): string
    {
        if ($query === '') {
            return '';
        }

        $tracking = [
            '/^utm_/i',
            '/^gclid$/i',
            '/^fbclid$/i',
            '/^msclkid$/i',
            '/^dclid$/i',
            '/^mc_cid$/i',
            '/^mc_eid$/i',
            '/^ref$/i',
            '/^affiliate/i',
        ];

        $pairs = [];
        foreach (explode('&', $query) as $chunk) {
            if ($chunk === '') {
                continue;
            }
            $equals = strpos($chunk, '=');
            if ($equals === false) {
                $rawKey = $chunk;
                $rawValue = '';
            } else {
                $rawKey = substr($chunk, 0, $equals);
                $rawValue = substr($chunk, $equals + 1);
            }
            $key = urldecode($rawKey);
            foreach ($tracking as $pattern) {
                if (preg_match($pattern, $key)) {
                    continue 2;
                }
            }
            $pairs[] = [$key, $rawValue];
        }

        usort($pairs, static fn (array $a, array $b): int => strcmp($a[0], $b[0]));

        $encoded = [];
        foreach ($pairs as [$key, $rawValue]) {
            $encoded[] = self::encodeQueryComponent($key) . '=' . self::encodeQueryComponent(urldecode($rawValue));
        }

        return implode('&', $encoded);
    }

    private static function encodeQueryComponent(string $value): string
    {
        $encoded = urlencode($value);
        return str_replace('%2A', '*', $encoded);
    }

    public static function isPrivateIp(string $address): bool
    {
        $address = trim($address);
        if (filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            $parts = array_map('intval', explode('.', $address));
            [$a, $b, $c] = $parts;
            return $a === 0
                || $a === 10
                || $a === 127
                || ($a === 100 && $b >= 64 && $b <= 127)
                || ($a === 169 && $b === 254)
                || ($a === 172 && $b >= 16 && $b <= 31)
                || ($a === 192 && $b === 0 && $c === 0)
                || ($a === 192 && $b === 0 && $c === 2)
                || ($a === 192 && $b === 168)
                || ($a === 198 && ($b === 18 || $b === 19))
                || ($a === 198 && $b === 51 && $c === 100)
                || ($a === 203 && $b === 0 && $c === 113)
                || $a >= 224;
        }

        if (filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            $binary = @inet_pton($address);
            if ($binary === false || strlen($binary) !== 16) {
                return true;
            }

            if ($binary === str_repeat("\0", 16) || $binary === str_repeat("\0", 15) . "\1") {
                return true;
            }

            // IPv4-mapped IPv6 (::ffff:a.b.c.d).
            if (substr($binary, 0, 10) === str_repeat("\0", 10) && substr($binary, 10, 2) === "\xff\xff") {
                $ipv4 = inet_ntop(substr($binary, 12, 4));
                return $ipv4 === false ? true : self::isPrivateIp($ipv4);
            }

            $first = ord($binary[0]);
            $second = ord($binary[1]);

            if ($first === 0) {
                return true;
            }
            if (($first & 0xfe) === 0xfc) {
                return true; // fc00::/7 unique local
            }
            if ($first === 0xfe && ($second & 0xc0) === 0x80) {
                return true; // fe80::/10 link local
            }
            if ($first === 0xfe && ($second & 0xc0) === 0xc0) {
                return true; // fec0::/10 deprecated site local
            }
            if ($first === 0xff) {
                return true; // multicast
            }
            if ($first === 0x20 && $second === 0x01 && ord($binary[2]) === 0x0d && ord($binary[3]) === 0xb8) {
                return true; // 2001:db8::/32 documentation
            }

            return false;
        }

        return true;
    }

    /**
     * @return list<array{address: string, family: int}>
     */
    public static function resolvePublicAddresses(string $hostname): array
    {
        $hostname = strtolower(trim($hostname, '[]'));
        if ($hostname === '') {
            throw new HttpException(400, 'Brakuje domeny sklepu.', 'BLOCKED_HOST');
        }

        foreach (self::BLOCKED_SUFFIXES as $suffix) {
            if ($hostname === substr($suffix, 1) || str_ends_with($hostname, $suffix)) {
                throw new HttpException(400, 'Nie można pobrać nazw hostów lokalnych i wewnętrznych.', 'BLOCKED_HOST');
            }
        }

        if (filter_var($hostname, FILTER_VALIDATE_IP)) {
            if (self::isPrivateIp($hostname)) {
                throw new HttpException(400, 'Adresy sieci prywatnych i wewnętrznych są zablokowane.', 'BLOCKED_HOST');
            }
            return [['address' => $hostname, 'family' => str_contains($hostname, ':') ? 6 : 4]];
        }

        $addresses = [];

        $records = @dns_get_record($hostname, DNS_A | DNS_AAAA);
        if (is_array($records)) {
            foreach ($records as $record) {
                if (isset($record['ip'])) {
                    $addresses[] = ['address' => (string) $record['ip'], 'family' => 4];
                } elseif (isset($record['ipv6'])) {
                    $addresses[] = ['address' => (string) $record['ipv6'], 'family' => 6];
                }
            }
        }

        if ($addresses === []) {
            $ipv4 = @gethostbynamel($hostname);
            if (is_array($ipv4)) {
                foreach ($ipv4 as $address) {
                    $addresses[] = ['address' => $address, 'family' => 4];
                }
            }
        }

        if ($addresses === []) {
            throw new HttpException(400, 'Nie można rozwiązać domeny sklepu.', 'DNS_FAILED');
        }

        foreach ($addresses as $entry) {
            if (self::isPrivateIp($entry['address'])) {
                throw new HttpException(400, 'Ta domena rozwiązuje się do prywatnego adresu sieciowego.', 'BLOCKED_HOST');
            }
        }

        return $addresses;
    }

    /**
     * @return list<array{address: string, family: int}>
     */
    public static function assertSafeUrl(string $url): array
    {
        $parts = parse_url($url);
        if ($parts === false || !isset($parts['scheme'], $parts['host'])) {
            throw new HttpException(400, 'Wpisz poprawny adres URL produktu.', 'INVALID_URL');
        }
        $scheme = strtolower((string) $parts['scheme']);
        if ($scheme !== 'http' && $scheme !== 'https') {
            throw new HttpException(400, 'Obsługiwane są tylko linki HTTP i HTTPS.', 'INVALID_PROTOCOL');
        }
        return self::resolvePublicAddresses((string) $parts['host']);
    }
}
