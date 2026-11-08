<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\CategoryRepository;
use App\Repositories\DashboardRepository;
use App\Repositories\ProductRepository;
use App\Repositories\SettingsRepository;
use App\Repositories\TagRepository;

final class DashboardController extends Controller
{
    public function index(): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];

        $data = (new DashboardRepository())->data(
            $userId,
            new ProductRepository(),
            new TagRepository(),
            new SettingsRepository()
        );

        return Response::json($data);
    }
}
