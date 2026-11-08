<?php

declare(strict_types=1);

namespace App\Core;

final class Validator
{
    private array $data;
    /** @var array<string, list<string>> */
    private array $errors = [];

    public function __construct(array $data)
    {
        $this->data = $data;
    }

    public function data(): array
    {
        return $this->data;
    }

    public function has(string $key): bool
    {
        return array_key_exists($key, $this->data);
    }

    public function requiredString(string $key, int $max, string $label, int $min = 1): string
    {
        $value = $this->data[$key] ?? null;
        if ($value === null || !is_scalar($value)) {
            $this->error($key, $label . ' is required.');
            return '';
        }
        $value = trim((string) $value);
        if ($value === '') {
            $this->error($key, $label . ' is required.');
            return '';
        }
        $length = mb_strlen($value);
        if ($length < $min) {
            $this->error($key, $label . ' must be at least ' . $min . ' characters.');
        }
        if ($length > $max) {
            $this->error($key, $label . ' may not be longer than ' . $max . ' characters.');
        }
        return $value;
    }

    public function optionalString(string $key, int $max, string $label): ?string
    {
        if (!array_key_exists($key, $this->data)) {
            return null;
        }
        $value = $this->data[$key];
        if ($value === null) {
            return null;
        }
        if (!is_scalar($value)) {
            $this->error($key, $label . ' must be text.');
            return null;
        }
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }
        if (mb_strlen($value) > $max) {
            $this->error($key, $label . ' may not be longer than ' . $max . ' characters.');
        }
        return $value;
    }

    public function requiredNumber(string $key, string $label, float $min = 0, float $max = 1000000000): float
    {
        $value = $this->optionalNumber($key, $label, $min, $max);
        if ($value === null) {
            $this->error($key, $label . ' is required.');
            return 0.0;
        }
        return $value;
    }

    public function optionalNumber(string $key, string $label, float $min = 0, float $max = 1000000000): ?float
    {
        if (!array_key_exists($key, $this->data)) {
            return null;
        }
        $value = $this->data[$key];
        if ($value === null || $value === '') {
            return null;
        }
        if (is_bool($value) || !is_numeric($value)) {
            $this->error($key, 'Enter a valid number for ' . strtolower($label) . '.');
            return null;
        }
        $number = (float) $value;
        if (!is_finite($number)) {
            $this->error($key, 'Enter a valid number for ' . strtolower($label) . '.');
            return null;
        }
        if ($number < $min) {
            $this->error($key, $label . ' cannot be lower than ' . $min . '.');
        }
        if ($number > $max) {
            $this->error($key, $label . ' is too large.');
        }
        return round($number + 1.0E-9, 2);
    }

    public function optionalInt(string $key, string $label, int $min, int $max, ?int $default = null): ?int
    {
        if (!array_key_exists($key, $this->data) || $this->data[$key] === null || $this->data[$key] === '') {
            return $default;
        }
        $value = $this->data[$key];
        if (is_bool($value) || !is_numeric($value)) {
            $this->error($key, 'Enter a valid number for ' . strtolower($label) . '.');
            return $default;
        }
        $number = (int) $value;
        if ((string) $number !== (string) $value && !is_int($value) && !ctype_digit((string) $value)) {
            $this->error($key, 'Enter a whole number for ' . strtolower($label) . '.');
            return $default;
        }
        if ($number < $min || $number > $max) {
            $this->error($key, $label . ' must be between ' . $min . ' and ' . $max . '.');
            return $default;
        }
        return $number;
    }

    public function enum(string $key, array $allowed, string $label, ?string $default = null): ?string
    {
        if (!array_key_exists($key, $this->data) || $this->data[$key] === null || $this->data[$key] === '') {
            return $default;
        }
        $value = (string) $this->data[$key];
        if (!in_array($value, $allowed, true)) {
            $this->error($key, 'Choose a valid ' . strtolower($label) . '.');
            return $default;
        }
        return $value;
    }

    /**
     * @return list<string>
     */
    public function stringList(string $key, int $maxItems, int $maxLength, string $label): array
    {
        if (!array_key_exists($key, $this->data) || $this->data[$key] === null) {
            return [];
        }
        $value = $this->data[$key];
        if (!is_array($value)) {
            $this->error($key, $label . ' must be a list.');
            return [];
        }
        $result = [];
        $seen = [];
        foreach ($value as $item) {
            if (!is_scalar($item)) {
                continue;
            }
            $item = trim((string) $item);
            if ($item === '') {
                continue;
            }
            $item = mb_substr($item, 0, $maxLength);
            $normalized = mb_strtolower($item);
            if (isset($seen[$normalized])) {
                continue;
            }
            $seen[$normalized] = true;
            $result[] = $item;
            if (count($result) >= $maxItems) {
                break;
            }
        }
        return $result;
    }

    public function boolean(string $key, bool $default = false): bool
    {
        if (!array_key_exists($key, $this->data) || $this->data[$key] === null) {
            return $default;
        }
        return filter_var($this->data[$key], FILTER_VALIDATE_BOOL);
    }

    public function email(string $key, string $label, bool $required = true): ?string
    {
        $value = $this->data[$key] ?? null;
        if ($value === null || trim((string) $value) === '') {
            if ($required) {
                $this->error($key, $label . ' is required.');
            }
            return null;
        }
        $value = trim((string) $value);
        if (!filter_var($value, FILTER_VALIDATE_EMAIL) || mb_strlen($value) > 190) {
            $this->error($key, 'Enter a valid email address.');
            return null;
        }
        return mb_strtolower($value);
    }

    public function error(string $key, string $message): void
    {
        $this->errors[$key][] = $message;
    }

    public function addError(string $key, string $message): void
    {
        $this->error($key, $message);
    }

    public function fails(): bool
    {
        return $this->errors !== [];
    }

    public function errors(): array
    {
        return $this->errors;
    }

    public function throwIfFails(): void
    {
        if ($this->errors === []) {
            return;
        }
        throw new HttpException(
            400,
            'Please check the highlighted fields.',
            'VALIDATION_ERROR',
            ['formErrors' => [], 'fieldErrors' => $this->errors]
        );
    }
}
