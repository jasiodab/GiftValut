<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\App;
use App\Core\Str;

final class Images
{
    private const ALLOWED_MIME = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/avif',
    ];

    /**
     * @return array{extension: string, mimeType: string}|null
     */
    public static function detect(string $bytes): ?array
    {
        if (strlen($bytes) < 12) {
            return null;
        }

        if (ord($bytes[0]) === 0xff && ord($bytes[1]) === 0xd8 && ord($bytes[2]) === 0xff) {
            return ['extension' => 'jpg', 'mimeType' => 'image/jpeg'];
        }
        if (substr($bytes, 0, 8) === "\x89PNG\r\n\x1a\n") {
            return ['extension' => 'png', 'mimeType' => 'image/png'];
        }
        if (substr($bytes, 0, 6) === 'GIF87a' || substr($bytes, 0, 6) === 'GIF89a') {
            return ['extension' => 'gif', 'mimeType' => 'image/gif'];
        }
        if (substr($bytes, 0, 4) === 'RIFF' && substr($bytes, 8, 4) === 'WEBP') {
            return ['extension' => 'webp', 'mimeType' => 'image/webp'];
        }
        if (str_contains(substr($bytes, 4, 8), 'ftypavi')) {
            return ['extension' => 'avif', 'mimeType' => 'image/avif'];
        }

        return null;
    }

    /**
     * @return array{path: string, mimeType: string}
     */
    public static function saveBuffer(string $bytes, string $userId, ?string $declaredMimeType = null): array
    {
        $maxBytes = (int) App::config('uploads.max_bytes', 2 * 1024 * 1024);
        if ($bytes === '') {
            throw new \RuntimeException('Plik zdjęcia jest pusty.');
        }
        if (strlen($bytes) > $maxBytes) {
            throw new \RuntimeException('Zdjęcie przekracza limit 2 MB.');
        }

        $detected = self::detect($bytes);
        if ($detected === null) {
            throw new \RuntimeException('Plik nie jest obsługiwanym obrazem (JPEG, PNG, WebP, GIF lub AVIF).');
        }

        if ($declaredMimeType !== null && $declaredMimeType !== ''
            && !str_starts_with($declaredMimeType, 'image/')
            && $declaredMimeType !== 'application/octet-stream') {
            throw new \RuntimeException('Plik nie wygląda na obraz.');
        }

        $directory = (string) App::config('paths.uploads');
        if (!is_dir($directory)) {
            @mkdir($directory, 0750, true);
        }

        $filename = self::uuid() . '.' . $detected['extension'];
        $absolute = $directory . '/' . $filename;

        $handle = @fopen($absolute, 'xb');
        if ($handle === false) {
            throw new \RuntimeException('Nie można zapisać zdjęcia.');
        }
        try {
            fwrite($handle, $bytes);
        } finally {
            fclose($handle);
        }
        @chmod($absolute, 0640);

        try {
            App::db()->run(
                'INSERT INTO "Upload" (id, filename, userId, createdAt) VALUES (?, ?, ?, ?)',
                [Str::id(), $filename, $userId, date('Y-m-d H:i:s')]
            );
        } catch (\Throwable $error) {
            @unlink($absolute);
            throw $error;
        }

        return ['path' => '/uploads/' . $filename, 'mimeType' => $detected['mimeType']];
    }

    /**
     * @return array{path: string, sourceUrl: string}|null
     */
    public static function download(string $imageUrl, string $pageUrl, string $userId): ?array
    {
        if ($imageUrl === '') {
            return null;
        }

        $absolute = SafeFetch::resolveUrl($imageUrl, $pageUrl);
        $scheme = strtolower((string) parse_url($absolute, PHP_URL_SCHEME));
        if ($scheme !== 'http' && $scheme !== 'https') {
            return null;
        }

        try {
            $response = SafeFetch::fetch($absolute, [
                'maxBytes' => (int) App::config('uploads.remote_max_bytes', 2 * 1024 * 1024),
                'timeoutMs' => 15000,
                'headers' => ['accept: image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.5'],
            ]);
        } catch (\Throwable $error) {
            return null;
        }

        if ($response['status'] < 200 || $response['status'] >= 300) {
            return null;
        }

        $contentType = strtolower(trim(explode(';', $response['contentType'])[0]));
        if ($contentType !== '' && !in_array($contentType, self::ALLOWED_MIME, true)
            && $contentType !== 'application/octet-stream') {
            return null;
        }

        try {
            $saved = self::saveBuffer($response['body'], $userId, $contentType);
        } catch (\Throwable $error) {
            return null;
        }

        return ['path' => $saved['path'], 'sourceUrl' => $absolute];
    }

    public static function deleteLocal(string $relativePath): void
    {
        if ($relativePath === '') {
            return;
        }
        $filename = basename($relativePath);
        if ($filename === '' || $filename === '.' || $filename === '..') {
            return;
        }
        $absolute = (string) App::config('paths.uploads') . '/' . $filename;
        if (is_file($absolute)) {
            @unlink($absolute);
        }
    }

    public static function absolutePath(string $filename): string
    {
        return (string) App::config('paths.uploads') . '/' . basename($filename);
    }

    /**
     * @param list<string>|null $filenames
     */
    public static function uploadsSize(?array $filenames = null): int
    {
        $directory = (string) App::config('paths.uploads');
        if (!is_dir($directory)) {
            return 0;
        }
        $wanted = $filenames === null ? null : array_flip($filenames);
        $total = 0;
        $entries = @scandir($directory);
        if ($entries === false) {
            return 0;
        }
        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            $path = $directory . '/' . $entry;
            if (!is_file($path)) {
                continue;
            }
            if ($wanted !== null && !isset($wanted[$entry])) {
                continue;
            }
            $size = @filesize($path);
            if ($size !== false) {
                $total += $size;
            }
        }
        return $total;
    }

    public static function uuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
