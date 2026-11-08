<?php

declare(strict_types=1);

namespace App\Core;

final class RateLimiter
{
    /**
     * Add a hit to a bucket.
     *
     * @return int|null Seconds until retry when limited, otherwise null.
     */
    public static function hit(string $prefix, string $identity, int $windowSeconds, int $max): ?int
    {
        $directory = (string) App::config('paths.rate_limits');
        if (!is_dir($directory)) {
            @mkdir($directory, 0750, true);
        }

        $file = $directory . '/' . preg_replace('/[^a-z0-9_-]/i', '_', $prefix) . '-' . hash('sha256', $identity) . '.json';
        $handle = @fopen($file, 'c+');
        if ($handle === false) {
            return null;
        }

        try {
            if (!flock($handle, LOCK_EX)) {
                return null;
            }

            $contents = stream_get_contents($handle);
            $data = is_string($contents) && $contents !== '' ? json_decode($contents, true) : null;
            $now = time();

            if (!is_array($data) || !isset($data['count'], $data['reset']) || (int) $data['reset'] <= $now) {
                $data = ['count' => 1, 'reset' => $now + $windowSeconds];
                self::write($handle, $data);
                flock($handle, LOCK_UN);
                self::cleanup($directory);
                return null;
            }

            if ((int) $data['count'] >= $max) {
                $retry = max(1, (int) $data['reset'] - $now);
                flock($handle, LOCK_UN);
                return $retry;
            }

            $data['count'] = (int) $data['count'] + 1;
            self::write($handle, $data);
            flock($handle, LOCK_UN);
            return null;
        } finally {
            if (is_resource($handle)) {
                fclose($handle);
            }
        }
    }

    public static function enforce(string $prefix, string $identity, int $windowSeconds, int $max): void
    {
        $retry = self::hit($prefix, $identity, $windowSeconds, $max);
        if ($retry !== null) {
            if (!headers_sent()) {
                header('Retry-After: ' . $retry);
            }
            throw new HttpException(429, 'Too many requests. Please try again later.', 'RATE_LIMITED');
        }
    }

    private static function write($handle, array $data): void
    {
        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, json_encode($data));
        fflush($handle);
    }

    private static function cleanup(string $directory): void
    {
        if (random_int(1, 200) !== 1) {
            return;
        }
        $threshold = time() - 86400;
        foreach (glob($directory . '/*.json') ?: [] as $file) {
            $mtime = @filemtime($file);
            if ($mtime !== false && $mtime < $threshold) {
                @unlink($file);
            }
        }
    }
}
