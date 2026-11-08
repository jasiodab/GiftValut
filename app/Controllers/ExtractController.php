<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Validator;
use App\Core\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\RateLimitMiddleware;
use App\Repositories\CategoryRepository;
use App\Repositories\SettingsRepository;
use App\Services\Extraction;
use App\Services\Serializer;

final class ExtractController extends Controller
{
    public function create(): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];
        RateLimitMiddleware::extract($this->request);

        $validator = new Validator($this->jsonInput());
        $url = $validator->requiredString('url', 4000, 'Product link');
        $validator->throwIfFails();

        $settings = (new SettingsRepository())->ensureForUser($userId);
        $categories = array_map(
            static fn (array $row): array => [
                'id' => (string) $row['id'],
                'name' => (string) $row['name'],
                'slug' => (string) $row['slug'],
                'color' => (string) $row['color'],
                'icon' => (string) $row['icon'],
            ],
            (new CategoryRepository())->listForUser($userId)
        );

        $result = Extraction::extract(
            $url,
            (string) ($settings['currency'] ?? 'PLN'),
            $categories,
            true,
            $userId
        );

        return Response::json($result);
    }
}
