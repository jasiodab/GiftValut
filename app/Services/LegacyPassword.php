<?php

declare(strict_types=1);

namespace App\Services;

use FFI;

/**
 * Verifies the scrypt hashes written by the old Node.js server:
 *   scrypt$<32 hex salt>$<128 hex key>, N=16384, r=8, p=1, 64-byte key.
 *
 * PHP's password_* API cannot read scrypt, so we call libsodium's raw scrypt
 * function. The extension is available on the target Alpine/Mikrus host. If
 * FFI is unavailable the login fails safely and the owner can use
 * bin/reset-password.php.
 */
final class LegacyPassword
{
    private static bool $ffiUnavailableLogged = false;
    private static mixed $ffi = null;
    private static bool $ffiLoaded = false;

    public static function verify(string $password, string $stored): bool
    {
        $parts = explode('$', $stored);
        if (count($parts) !== 3 || $parts[0] !== 'scrypt') {
            return false;
        }

        $saltHex = $parts[1];
        $keyHex = $parts[2];
        if (!preg_match('/^[a-f0-9]{32}$/i', $saltHex) || !preg_match('/^[a-f0-9]{128}$/i', $keyHex)) {
            return false;
        }

        $salt = hex2bin($saltHex);
        $expected = hex2bin($keyHex);
        if ($salt === false || $expected === false) {
            return false;
        }

        $derived = self::derive($password, $salt, 16384, 8, 1, 64);
        if ($derived === null) {
            return false;
        }

        return hash_equals($expected, $derived);
    }

    private static function derive(string $password, string $salt, int $n, int $r, int $p, int $length): ?string
    {
        $ffi = self::ffi();
        if ($ffi === null) {
            return null;
        }

        try {
            $passwordLength = max(1, strlen($password));
            $passwordBuffer = $ffi->new('uint8_t[' . $passwordLength . ']');
            if ($passwordBuffer === null) {
                return null;
            }
            if ($password !== '') {
                FFI::memcpy($passwordBuffer, $password, strlen($password));
            }

            $saltBuffer = $ffi->new('uint8_t[' . max(1, strlen($salt)) . ']');
            if ($saltBuffer === null) {
                return null;
            }
            FFI::memcpy($saltBuffer, $salt, strlen($salt));

            $output = $ffi->new('uint8_t[' . $length . ']');
            if ($output === null) {
                return null;
            }

            $result = $ffi->crypto_pwhash_scryptsalsa208sha256_ll(
                $passwordBuffer,
                strlen($password),
                $saltBuffer,
                strlen($salt),
                $n,
                $r,
                $p,
                $output,
                $length
            );

            if ($result !== 0) {
                return null;
            }

            $binary = FFI::string($output, $length);
            return $binary === '' ? null : $binary;
        } catch (\Throwable $error) {
            if (!self::$ffiUnavailableLogged) {
                self::$ffiUnavailableLogged = true;
                error_log('Gift Vault: legacy scrypt verification failed via FFI: ' . $error->getMessage());
            }
            return null;
        }
    }

    private static function ffi(): mixed
    {
        if (self::$ffiLoaded) {
            return self::$ffi;
        }
        self::$ffiLoaded = true;

        if (!class_exists(FFI::class)) {
            self::logUnavailable('the FFI extension is not enabled');
            return null;
        }

        $libraries = [
            'libsodium.so.23',
            'libsodium.so.26',
            'libsodium.so',
            'libsodium.dll',
            'sodium.dll',
            'libsodium.dylib',
        ];

        $declaration = 'int crypto_pwhash_scryptsalsa208sha256_ll('
            . 'const unsigned char *passwd, size_t passwdlen, '
            . 'const unsigned char *salt, size_t saltlen, '
            . 'uint64_t N, uint32_t r, uint32_t p, '
            . 'unsigned char *buf, size_t buflen);';

        foreach ($libraries as $library) {
            try {
                $ffi = FFI::cdef($declaration, $library);
                if ($ffi !== null) {
                    self::$ffi = $ffi;
                    return $ffi;
                }
            } catch (\Throwable $error) {
                continue;
            }
        }

        self::logUnavailable('libsodium could not be loaded through FFI');
        return null;
    }

    private static function logUnavailable(string $reason): void
    {
        if (self::$ffiUnavailableLogged) {
            return;
        }
        self::$ffiUnavailableLogged = true;
        error_log(
            'Gift Vault: legacy scrypt password verification is unavailable because ' . $reason
            . '. Use bin/reset-password.php to set a new bcrypt password, or enable FFI + libsodium.'
        );
    }
}
