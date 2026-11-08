<?php

declare(strict_types=1);

namespace App\Core;

use PDO;
use PDOStatement;
use RuntimeException;

final class Database
{
    private PDO $pdo;
    private int $transactionDepth = 0;

    public function __construct(string $path)
    {
        $directory = dirname($path);
        if (!is_dir($directory)) {
            @mkdir($directory, 0750, true);
        }

        $isNew = !is_file($path);

        $this->pdo = new PDO('sqlite:' . $path, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);

        $this->pdo->exec('PRAGMA foreign_keys = ON');
        $this->pdo->exec('PRAGMA busy_timeout = 5000');
        $this->pdo->exec('PRAGMA journal_mode = WAL');
        $this->pdo->exec('PRAGMA synchronous = NORMAL');
        $this->pdo->exec('PRAGMA temp_store = MEMORY');
        $this->pdo->exec('PRAGMA cache_size = -8000');

        if ($isNew) {
            @chmod($path, 0600);
        }
    }

    public function pdo(): PDO
    {
        return $this->pdo;
    }

    public function run(string $sql, array $params = []): PDOStatement
    {
        $statement = $this->pdo->prepare($sql);
        foreach (array_values($params) as $index => $value) {
            $type = match (true) {
                is_int($value) => PDO::PARAM_INT,
                is_bool($value) => PDO::PARAM_INT,
                $value === null => PDO::PARAM_NULL,
                default => PDO::PARAM_STR,
            };
            $statement->bindValue($index + 1, is_bool($value) ? (int) $value : $value, $type);
        }
        $statement->execute();
        return $statement;
    }

    public function fetch(string $sql, array $params = []): ?array
    {
        $row = $this->run($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    public function fetchAll(string $sql, array $params = []): array
    {
        return $this->run($sql, $params)->fetchAll();
    }

    public function value(string $sql, array $params = []): mixed
    {
        $value = $this->run($sql, $params)->fetchColumn();
        return $value === false ? null : $value;
    }

    public function execute(string $sql, array $params = []): int
    {
        return $this->run($sql, $params)->rowCount();
    }

    public function lastInsertId(): string
    {
        return (string) $this->pdo->lastInsertId();
    }

    public function transaction(callable $callback): mixed
    {
        if ($this->transactionDepth === 0) {
            $this->pdo->beginTransaction();
        } else {
            $this->pdo->exec('SAVEPOINT gv_tx_' . $this->transactionDepth);
        }

        $this->transactionDepth++;

        try {
            $result = $callback($this);
            $this->transactionDepth--;
            if ($this->transactionDepth === 0) {
                $this->pdo->commit();
            } else {
                $this->pdo->exec('RELEASE SAVEPOINT gv_tx_' . $this->transactionDepth);
            }
            return $result;
        } catch (\Throwable $error) {
            $this->transactionDepth--;
            if ($this->transactionDepth === 0) {
                if ($this->pdo->inTransaction()) {
                    $this->pdo->rollBack();
                }
            } else {
                $this->pdo->exec('ROLLBACK TO SAVEPOINT gv_tx_' . $this->transactionDepth);
                $this->pdo->exec('RELEASE SAVEPOINT gv_tx_' . $this->transactionDepth);
            }
            throw $error;
        }
    }

    public function integrityCheck(): string
    {
        try {
            return (string) ($this->value('PRAGMA integrity_check') ?? 'unknown');
        } catch (\Throwable $error) {
            return 'error: ' . $error->getMessage();
        }
    }

    public function foreignKeyViolations(): array
    {
        return $this->fetchAll('PRAGMA foreign_key_check');
    }

    public function vacuumInto(string $target): void
    {
        $target = str_replace("'", "''", $target);
        $this->pdo->exec("VACUUM INTO '{$target}'");
    }
}
