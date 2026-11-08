<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Csrf;
use App\Core\Request;

final class CsrfMiddleware
{
    public static function enforce(Request $request): void
    {
        Csrf::enforce($request);
    }
}
