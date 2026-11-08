<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\HttpException;
use App\Core\Maintenance;
use App\Core\Request;
use App\Core\Response;

final class MaintenanceMiddleware
{
    public static function guard(Request $request): ?Response
    {
        if (!Maintenance::isActive()) {
            return null;
        }
        if (str_starts_with($request->path, '/api/health')) {
            return null;
        }
        throw new HttpException(
            503,
            'Gift Vault is being restored from a backup. Please refresh in a moment.',
            'MAINTENANCE'
        );
    }
}
