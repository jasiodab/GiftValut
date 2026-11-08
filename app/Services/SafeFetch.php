<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\HttpException;

final class SafeFetch
{
    private const DEFAULT_HEADERS = [
        'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 GiftVault/2.0',
        'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/*;q=0.8,*/*;q=0.7',
        'accept-language: pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
    ];

    /**
     * Fetch a URL with DNS pinning, manual redirects and strict size limits.
     *
     * @param array{maxBytes?: int, timeoutMs?: int, maxRedirects?: int, headers?: list<string>} $options
     * @return array{url: string, status: int, contentType: string, headers: array<string,string>, body: string}
     */
    public static function fetch(string $input, array $options = []): array
    {
        $maxBytes = $options['maxBytes'] ?? 5 * 1024 * 1024;
        $timeoutMs = $options['timeoutMs'] ?? 12000;
        $maxRedirects = $options['maxRedirects'] ?? 5;
        $extraHeaders = $options['headers'] ?? [];

        $currentUrl = $input;

        for ($redirects = 0; $redirects <= $maxRedirects; $redirects++) {
            $parts = parse_url($currentUrl);
            if ($parts === false || !isset($parts['scheme'], $parts['host'])) {
                throw new HttpException(400, 'Enter a valid product URL.', 'INVALID_URL');
            }
            $scheme = strtolower((string) $parts['scheme']);
            if ($scheme !== 'http' && $scheme !== 'https') {
                throw new HttpException(400, 'Only HTTP and HTTPS links are supported.', 'INVALID_PROTOCOL');
            }
            if (isset($parts['user']) || isset($parts['pass'])) {
                throw new HttpException(400, 'URLs containing credentials are not supported.', 'INVALID_URL');
            }

            $host = strtolower((string) $parts['host']);
            $port = isset($parts['port']) ? (int) $parts['port'] : ($scheme === 'https' ? 443 : 80);
            $addresses = UrlSafety::resolvePublicAddresses($host);

            $resolve = [];
            foreach ($addresses as $address) {
                $ip = $address['address'];
                if ($address['family'] === 6 || str_contains($ip, ':')) {
                    $ip = '[' . $ip . ']';
                }
                $resolve[] = $host . ':' . $port . ':' . $ip;
            }

            $headers = [];
            $body = '';
            $tooLarge = false;
            $headerMap = [];

            $handle = curl_init();
            if ($handle === false) {
                throw new HttpException(500, 'The HTTP client could not be initialised.', 'FETCH_FAILED');
            }

            curl_setopt_array($handle, [
                CURLOPT_URL => $currentUrl,
                CURLOPT_RETURNTRANSFER => false,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_MAXREDIRS => 0,
                CURLOPT_CONNECTTIMEOUT_MS => min(5000, $timeoutMs),
                CURLOPT_TIMEOUT_MS => $timeoutMs,
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
                CURLOPT_ENCODING => '',
                CURLOPT_HTTPHEADER => array_merge(self::DEFAULT_HEADERS, $extraHeaders),
                CURLOPT_RESOLVE => $resolve,
                CURLOPT_HEADERFUNCTION => static function ($curl, string $line) use (&$headerMap): int {
                    $trimmed = trim($line);
                    if ($trimmed === '') {
                        return strlen($line);
                    }
                    if (str_starts_with(strtolower($trimmed), 'http/')) {
                        $headerMap = [];
                        return strlen($line);
                    }
                    $position = strpos($trimmed, ':');
                    if ($position !== false) {
                        $name = strtolower(trim(substr($trimmed, 0, $position)));
                        $value = trim(substr($trimmed, $position + 1));
                        $headerMap[$name] = $value;
                    }
                    return strlen($line);
                },
                CURLOPT_WRITEFUNCTION => static function ($curl, string $chunk) use (&$body, &$tooLarge, $maxBytes): int {
                    $length = strlen($chunk);
                    if (strlen($body) + $length > $maxBytes) {
                        $tooLarge = true;
                        return 0;
                    }
                    $body .= $chunk;
                    return $length;
                },
            ]);

            $ok = curl_exec($handle);
            $errorNumber = curl_errno($handle);
            $errorMessage = curl_error($handle);
            $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
            $contentType = (string) (curl_getinfo($handle, CURLINFO_CONTENT_TYPE) ?: ($headerMap['content-type'] ?? ''));
            curl_close($handle);

            if ($tooLarge) {
                throw new HttpException(413, 'The response exceeded the safe size limit.', 'RESPONSE_TOO_LARGE');
            }

            $declaredLength = isset($headerMap['content-length']) ? (int) $headerMap['content-length'] : 0;
            if ($declaredLength > $maxBytes) {
                throw new HttpException(413, 'The page is too large to process safely.', 'RESPONSE_TOO_LARGE');
            }

            if ($ok === false) {
                if ($errorNumber === 28) {
                    throw new HttpException(504, 'The store took too long to respond.', 'FETCH_TIMEOUT');
                }
                throw new HttpException(502, 'The store could not be reached.', 'FETCH_FAILED');
            }

            if (in_array($status, [301, 302, 303, 307, 308], true)) {
                $location = $headerMap['location'] ?? '';
                if ($location === '') {
                    throw new HttpException(502, 'The store returned an invalid redirect.', 'BAD_REDIRECT');
                }
                if ($redirects === $maxRedirects) {
                    throw new HttpException(502, 'The store redirected too many times.', 'TOO_MANY_REDIRECTS');
                }
                $next = self::resolveUrl($location, $currentUrl);
                $nextScheme = strtolower((string) parse_url($next, PHP_URL_SCHEME));
                if ($nextScheme !== 'http' && $nextScheme !== 'https') {
                    throw new HttpException(400, 'The redirect pointed to an unsupported protocol.', 'INVALID_REDIRECT');
                }
                $currentUrl = $next;
                continue;
            }

            return [
                'url' => $currentUrl,
                'status' => $status,
                'contentType' => $contentType,
                'headers' => $headerMap,
                'body' => $body,
            ];
        }

        throw new HttpException(502, 'The store redirected too many times.', 'TOO_MANY_REDIRECTS');
    }

    public static function resolveUrl(string $location, string $base): string
    {
        if (preg_match('#^https?://#i', $location)) {
            return $location;
        }
        $baseParts = parse_url($base);
        if ($baseParts === false) {
            return $location;
        }
        if (str_starts_with($location, '//')) {
            return ($baseParts['scheme'] ?? 'https') . ':' . $location;
        }
        $scheme = $baseParts['scheme'] ?? 'https';
        $host = $baseParts['host'] ?? '';
        $port = isset($baseParts['port']) ? ':' . $baseParts['port'] : '';
        if (str_starts_with($location, '/')) {
            return $scheme . '://' . $host . $port . $location;
        }
        $path = $baseParts['path'] ?? '/';
        $directory = substr($path, 0, (int) strrpos($path, '/') + 1);
        return $scheme . '://' . $host . $port . $directory . $location;
    }

    public static function decodeHtml(string $body, string $contentType): string
    {
        $charset = null;
        if (preg_match('/charset=["\']?([^;"\'\s]+)/i', $contentType, $matches)) {
            $charset = strtolower($matches[1]);
        }
        if ($charset === null) {
            $head = substr($body, 0, 4096);
            if (preg_match('/<meta[^>]+charset=["\']?([^"\'\s\/>]+)/i', $head, $matches)) {
                $charset = strtolower($matches[1]);
            }
        }
        if ($charset === null || $charset === 'utf-8' || $charset === 'utf8') {
            return $body;
        }

        $converted = @mb_convert_encoding($body, 'UTF-8', $charset);
        if (!is_string($converted)) {
            $converted = @iconv($charset, 'UTF-8//IGNORE', $body);
        }
        return is_string($converted) ? $converted : $body;
    }
}
