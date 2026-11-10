<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Response;
use App\Core\Str;
use App\Core\Validator;
use App\Middleware\AuthMiddleware;
use App\Repositories\CategoryRepository;
use App\Services\Serializer;

final class CategoryController extends Controller
{
    private CategoryRepository $categories;

    public function __construct(\App\Core\Request $request)
    {
        parent::__construct($request);
        $this->categories = new CategoryRepository();
    }

    public function index(): Response
    {
        $user = AuthMiddleware::user($this->request);
        $rows = $this->categories->listForUser((string) $user['id']);

        return Response::json([
            'categories' => array_map([Serializer::class, 'category'], $rows),
        ]);
    }

    public function create(): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];
        $input = $this->jsonInput();

        $validator = new Validator($input);
        $name = $validator->requiredString('name', 40, 'Category name');
        $color = $this->validateColor($validator, $input);
        $icon = $this->validateIcon($validator, $input);
        $validator->throwIfFails();

        if ($this->categories->findByName($userId, $name) !== null) {
            throw new HttpException(409, 'A category with that name already exists.', 'DUPLICATE_CATEGORY');
        }

        $baseSlug = Str::slugify($name);
        $slug = $baseSlug;
        $suffix = 1;
        while ($this->categories->slugExists($userId, $slug)) {
            $slug = $baseSlug . '-' . $suffix;
            $suffix++;
        }

        $sortOrder = $this->categories->maxSortOrder($userId) + 10;
        $created = $this->categories->create($userId, $name, $slug, $color, $icon, $sortOrder, false);
        $created['productCount'] = 0;
        $created['totalValue'] = 0.0;

        return Response::json(['category' => Serializer::category($created)], 201);
    }

    public function update(string $id): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];
        $existing = $this->categories->findForUser($id, $userId);
        if ($existing === null) {
            throw new HttpException(404, 'Nie znaleziono kategorii.', 'CATEGORY_NOT_FOUND');
        }

        $input = $this->jsonInput();
        $validator = new Validator($input);
        $data = [];

        if (array_key_exists('name', $input)) {
            $name = $validator->requiredString('name', 40, 'Category name');
            $validator->throwIfFails();
            if ($name !== (string) $existing['name'] && $this->categories->findByName($userId, $name, $id) !== null) {
                throw new HttpException(409, 'A category with that name already exists.', 'DUPLICATE_CATEGORY');
            }
            $data['name'] = $name;
        }
        if (array_key_exists('color', $input)) {
            $data['color'] = $this->validateColor($validator, $input);
        }
        if (array_key_exists('icon', $input)) {
            $data['icon'] = $this->validateIcon($validator, $input);
        }
        $validator->throwIfFails();

        $this->categories->update($id, $userId, $data);
        $updated = $this->categories->findForUser($id, $userId) ?? [];
        $updated['productCount'] = $this->categories->productCount($id, $userId);
        $updated['totalValue'] = (float) (\App\Core\App::db()->value(
            'SELECT SUM(COALESCE(currentPrice, 0)) FROM "Product" WHERE categoryId = ? AND userId = ?',
            [$id, $userId]
        ) ?? 0);

        return Response::json(['category' => Serializer::category($updated)]);
    }

    public function delete(string $id): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];
        $existing = $this->categories->findForUser($id, $userId);
        if ($existing === null) {
            throw new HttpException(404, 'Nie znaleziono kategorii.', 'CATEGORY_NOT_FOUND');
        }
        if ((string) $existing['slug'] === 'other') {
            throw new HttpException(400, 'Kategoria „Inne” jest podstawową i nie może zostać usunięta.', 'CATEGORY_REQUIRED');
        }

        $count = $this->categories->productCount($id, $userId);
        if ($count > 0) {
            throw new HttpException(
                409,
                'Ta kategoria zawiera nadal ' . $count . ' produkt' . ($count === 1 ? 'ów' : 'y') . '. Przenieś je przed usunięciem kategorii.',
                'CATEGORY_IN_USE'
            );
        }

        $this->categories->delete($id, $userId);
        return Response::json(['deleted' => true]);
    }

    private function validateColor(Validator $validator, array $input): string
    {
        if (!array_key_exists('color', $input) || $input['color'] === null || $input['color'] === '') {
            return '#D9A3B0';
        }
        $color = trim((string) $input['color']);
        if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) {
            $validator->addError('color', 'Wybierz poprawny kolor.');
            return '#D9A3B0';
        }
        return strtoupper($color);
    }

    private function validateIcon(Validator $validator, array $input): string
    {
        if (!array_key_exists('icon', $input) || $input['icon'] === null || $input['icon'] === '') {
            return 'Tag';
        }
        $icon = trim((string) $input['icon']);
        if ($icon === '' || mb_strlen($icon) > 40) {
            $validator->addError('icon', 'Wybierz poprawną ikonę.');
            return 'Tag';
        }
        return $icon;
    }
}
