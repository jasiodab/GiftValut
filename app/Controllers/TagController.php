<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\TagRepository;

final class TagController extends Controller
{
    public function index(): Response
    {
        $user = AuthMiddleware::user($this->request);
        return Response::json([
            'tags' => (new TagRepository())->listForUser((string) $user['id']),
        ]);
    }
}
