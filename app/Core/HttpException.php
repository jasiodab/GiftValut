<?php

declare(strict_types=1);

namespace App\Core;

use RuntimeException;

class HttpException extends RuntimeException
{
    public int $status;
    public string $errorCode;
    public mixed $details;

    public function __construct(int $status, string $message, string $errorCode = 'APP_ERROR', mixed $details = null)
    {
        parent::__construct($message);
        $this->status = $status;
        $this->errorCode = $errorCode;
        $this->details = $details;
    }
}
