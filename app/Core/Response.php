<?php

declare(strict_types=1);

namespace App\Core;

final class Response
{
    public int $status;
    public array $headers;
    public string $body;
    public ?string $filePath;
    public ?string $downloadName;

    public function __construct(
        int $status = 200,
        array $headers = [],
        string $body = '',
        ?string $filePath = null,
        ?string $downloadName = null
    ) {
        $this->status = $status;
        $this->headers = $headers;
        $this->body = $body;
        $this->filePath = $filePath;
        $this->downloadName = $downloadName;
    }

    public static function json(mixed $data, int $status = 200, array $headers = []): self
    {
        $headers['Content-Type'] = 'application/json; charset=utf-8';
        $headers['Cache-Control'] = $headers['Cache-Control'] ?? 'no-store';
        return new self($status, $headers, Str::jsonEncode($data));
    }

    public static function error(int $status, string $code, string $message, mixed $details = null, array $headers = []): self
    {
        $error = ['code' => $code, 'message' => $message];
        if ($details !== null) {
            $error['details'] = $details;
        }
        return self::json(['error' => $error], $status, $headers);
    }

    public static function html(string $html, int $status = 200, array $headers = []): self
    {
        $headers['Content-Type'] = 'text/html; charset=utf-8';
        $headers['Cache-Control'] = $headers['Cache-Control'] ?? 'no-cache';
        return new self($status, $headers, $html);
    }

    public static function text(string $text, int $status = 200, array $headers = []): self
    {
        $headers['Content-Type'] = $headers['Content-Type'] ?? 'text/plain; charset=utf-8';
        return new self($status, $headers, $text);
    }

    public static function redirect(string $location, int $status = 303): self
    {
        return new self($status, ['Location' => $location, 'Cache-Control' => 'no-store']);
    }

    public static function file(string $path, ?string $downloadName = null, array $headers = []): self
    {
        return new self(200, $headers, '', $path, $downloadName);
    }

    public function withHeader(string $name, string $value): self
    {
        $this->headers[$name] = $value;
        return $this;
    }

    public function send(): void
    {
        if (!headers_sent()) {
            http_response_code($this->status);
            header('X-Content-Type-Options: nosniff');
            header('Referrer-Policy: strict-origin-when-cross-origin');
            header('X-Frame-Options: DENY');
            foreach ($this->headers as $name => $value) {
                header($name . ': ' . $value, true);
            }
            if ($this->downloadName !== null) {
                $safe = str_replace(['"', "\r", "\n"], '', basename($this->downloadName));
                header('Content-Disposition: attachment; filename="' . $safe . '"');
            }
        }

        if ($this->filePath !== null) {
            $this->streamFile($this->filePath);
            return;
        }

        // If headers were already sent (e.g. output before redirect), fall back to
        // a client-side redirect so the user still ends up at the right page.
        if ($this->status >= 300 && $this->status < 400 && isset($this->headers['Location']) && headers_sent()) {
            $loc = $this->headers['Location'];
            echo '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=' . htmlspecialchars((string) $loc, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '"></head><body></body></html>';
            return;
        }

        echo $this->body;
    }

    private function streamFile(string $path): void
    {
        if (!is_file($path) || !is_readable($path)) {
            if (!headers_sent()) {
                http_response_code(404);
            }
            echo 'File not found.';
            return;
        }

        $size = filesize($path);
        $mime = function_exists('mime_content_type') ? (mime_content_type($path) ?: 'application/octet-stream') : 'application/octet-stream';

        if (!headers_sent()) {
            header('Content-Type: ' . $mime);
            if ($size !== false) {
                header('Content-Length: ' . $size);
            }
        }

        while (ob_get_level() > 0) {
            @ob_end_clean();
        }

        $handle = fopen($path, 'rb');
        if ($handle === false) {
            return;
        }
        while (!feof($handle)) {
            $chunk = fread($handle, 8192);
            if ($chunk === false) {
                break;
            }
            echo $chunk;
            flush();
        }
        fclose($handle);
    }
}
