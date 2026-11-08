<?php

declare(strict_types=1);

namespace App\Core;

final class Request
{
    public string $method;
    public string $path;
    public array $query;
    public array $body;
    public array $files;
    public array $cookies;
    public array $server;
    public string $ip;
    private ?string $rawBody = null;

    public function __construct(
        string $method,
        string $path,
        array $query = [],
        array $body = [],
        array $files = [],
        array $cookies = [],
        array $server = []
    ) {
        $this->method = strtoupper($method);
        $this->path = self::normalizePath($path);
        $this->query = $query;
        $this->body = $body;
        $this->files = $files;
        $this->cookies = $cookies;
        $this->server = $server;
        $this->ip = self::detectIp($server);
    }

    public static function capture(): self
    {
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        $path = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
        if ($path === '') {
            $path = '/';
        }

        $body = $_POST;
        $raw = null;
        $contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? ''));

        if (str_contains($contentType, 'application/json')) {
            $raw = (string) file_get_contents('php://input');
            $decoded = json_decode($raw, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new HttpException(400, 'The request body is not valid JSON.', 'INVALID_JSON');
            }
            if (is_array($decoded)) {
                $body = $decoded;
            }
        }

        $request = new self(
            $method,
            $path,
            $_GET,
            $body,
            $_FILES,
            $_COOKIE,
            $_SERVER
        );
        $request->rawBody = $raw;

        $override = $request->header('x-http-method-override');
        if ($override !== null && $request->method === 'POST') {
            $candidate = strtoupper(trim($override));
            if (in_array($candidate, ['PUT', 'PATCH', 'DELETE'], true)) {
                $request->method = $candidate;
            }
        }

        return $request;
    }

    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $default;
    }

    public function has(string $key): bool
    {
        return array_key_exists($key, $this->body);
    }

    public function query(string $key, mixed $default = null): mixed
    {
        return $this->query[$key] ?? $default;
    }

    public function file(string $key): ?array
    {
        $file = $this->files[$key] ?? null;
        return is_array($file) ? $file : null;
    }

    public function header(string $name): ?string
    {
        $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        $value = $this->server[$key] ?? null;
        if ($value === null && strtolower($name) === 'content-type') {
            $value = $this->server['CONTENT_TYPE'] ?? null;
        }
        return $value === null ? null : (string) $value;
    }

    public function cookie(string $name, ?string $default = null): ?string
    {
        $value = $this->cookies[$name] ?? null;
        return $value === null ? $default : (string) $value;
    }

    public function rawBody(): ?string
    {
        return $this->rawBody;
    }

    public function isApi(): bool
    {
        return str_starts_with($this->path, '/api/') || $this->path === '/api';
    }

    public function isSecure(): bool
    {
        if (($this->server['HTTPS'] ?? '') !== '' && strtolower((string) $this->server['HTTPS']) !== 'off') {
            return true;
        }
        if (($this->server['SERVER_PORT'] ?? '') === '443') {
            return true;
        }
        $proto = strtolower((string) ($this->server['HTTP_X_FORWARDED_PROTO'] ?? ''));
        return $proto === 'https';
    }

    public function wantsJson(): bool
    {
        $accept = strtolower($this->header('accept') ?? '');
        return $this->isApi()
            || str_contains($accept, 'application/json')
            || strtolower($this->header('x-requested-with') ?? '') === 'xmlhttprequest';
    }

    public static function normalizePath(string $path): string
    {
        $decoded = rawurldecode($path);
        $decoded = preg_replace('#/+#', '/', $decoded) ?? $decoded;
        if ($decoded === '') {
            return '/';
        }
        if ($decoded[0] !== '/') {
            $decoded = '/' . $decoded;
        }
        if ($decoded !== '/' && str_ends_with($decoded, '/')) {
            $decoded = rtrim($decoded, '/');
        }
        return $decoded === '' ? '/' : $decoded;
    }

    private static function detectIp(array $server): string
    {
        $remote = (string) ($server['REMOTE_ADDR'] ?? 'unknown');
        $isLocalProxy = in_array($remote, ['127.0.0.1', '::1', '::ffff:127.0.0.1'], true);
        if ($isLocalProxy) {
            $forwarded = (string) ($server['HTTP_X_FORWARDED_FOR'] ?? '');
            if (trim($forwarded) !== '') {
                $first = trim(explode(',', $forwarded)[0]);
                if (filter_var($first, FILTER_VALIDATE_IP)) {
                    return $first;
                }
            }
        }
        return $remote !== '' ? $remote : 'unknown';
    }
}
