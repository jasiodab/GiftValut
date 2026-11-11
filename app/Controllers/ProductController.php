<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Response;
use App\Core\Validator;
use App\Middleware\AuthMiddleware;
use App\Services\ProductService;

final class ProductController extends Controller
{
    private ProductService $service;

    public function __construct(\App\Core\Request $request)
    {
        parent::__construct($request);
        $this->service = new ProductService();
    }

    public function index(): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];

        $query = $this->request->query;
        $search = trim((string) ($query['search'] ?? ''));
        if (mb_strlen($search) > 200) {
            throw $this->validationError(['search' => ['Wyszukiwanie jest za długie.']]);
        }
        $status = (string) ($query['status'] ?? 'ALL');
        if (!in_array($status, ['ALL', 'TO_CONSIDER', 'FAVORITE', 'TO_BUY', 'PURCHASED'], true)) {
            throw $this->validationError(['status' => ['Wybierz poprawny status.']]);
        }
        $favorite = (string) ($query['favorite'] ?? '') === 'true';
        $sort = (string) ($query['sort'] ?? 'recent');
        if (!in_array($sort, ['recent', 'updated', 'price-asc', 'price-desc', 'name'], true)) {
            throw $this->validationError(['sort' => ['Wybierz poprawną kolejność sortowania.']]);
        }
        $page = max(1, (int) ($query['page'] ?? 1));
        $pageSize = (int) ($query['pageSize'] ?? 24);
        $pageSize = max(1, min(100, $pageSize));

        $result = $this->service->repository()->paginateForUser($userId, [
            'search' => $search,
            'status' => $status,
            'categoryId' => (string) ($query['categoryId'] ?? ''),
            'groupId' => (string) ($query['groupId'] ?? ''),
            'favorite' => $favorite,
            'sort' => $sort,
        ], $page, $pageSize, $this->service->tagRepository());

        return Response::json([
            'products' => array_map([\App\Services\Serializer::class, 'product'], $result['products']),
            'pagination' => [
                'page' => $page,
                'pageSize' => $pageSize,
                'total' => $result['total'],
                'totalPages' => max(1, (int) ceil($result['total'] / $pageSize)),
            ],
        ]);
    }

    public function checkUrl(): Response
    {
        $user = AuthMiddleware::user($this->request);
        $url = trim((string) $this->request->query('url', ''));
        if ($url === '') {
            throw new HttpException(400, 'Podaj adres URL.', 'INVALID_URL');
        }
        return Response::json(['duplicate' => $this->service->duplicateCheck((string) $user['id'], $url)]);
    }

    public function show(string $id): Response
    {
        $user = AuthMiddleware::user($this->request);
        $row = $this->service->repository()->findForUser($id, (string) $user['id'], $this->service->tagRepository());
        if ($row === null) {
            throw new HttpException(404, 'Nie znaleziono produktu.', 'PRODUCT_NOT_FOUND');
        }
        return Response::json(['product' => \App\Services\Serializer::product($row)]);
    }

    public function create(): Response
    {
        $user = AuthMiddleware::user($this->request);
        $input = $this->validate($this->jsonInput(), false);
        $product = $this->service->create((string) $user['id'], $input);
        return Response::json(['product' => $product], 201);
    }

    public function update(string $id): Response
    {
        $user = AuthMiddleware::user($this->request);
        $input = $this->validate($this->jsonInput(), true);
        $product = $this->service->update((string) $user['id'], $id, $input);
        return Response::json(['product' => $product]);
    }

    public function delete(string $id): Response
    {
        $user = AuthMiddleware::user($this->request);
        $existing = $this->service->repository()->findRowForUser($id, (string) $user['id']);
        if ($existing === null) {
            throw new HttpException(404, 'Nie znaleziono.', 'NOT_FOUND');
        }
        $this->service->delete((string) $user['id'], $id);
        return Response::json(['deleted' => true]);
    }

    public function priceHistory(string $id): Response
    {
        $user = AuthMiddleware::user($this->request);
        $row = $this->service->repository()->findRowForUser($id, (string) $user['id']);
        if ($row === null) {
            throw new HttpException(404, 'Nie znaleziono produktu.', 'PRODUCT_NOT_FOUND');
        }

        $history = (new \App\Repositories\PriceHistoryRepository())->forProduct((string) $user['id'], $id);

        return Response::json(['history' => $history]);
    }

    public function bulk(): Response
    {
        $user = AuthMiddleware::user($this->request);
        $payload = $this->jsonInput();
        $action = $payload['action'] ?? null;
        if (!in_array($action, ['delete', 'status'], true)) {
            throw $this->validationError(['action' => ['Wybierz poprawną akcję zbiorczą.']]);
        }

        $ids = $payload['ids'] ?? null;
        if (!is_array($ids) || count($ids) < 1 || count($ids) > 200) {
            throw $this->validationError(['ids' => ['Wybierz od 1 do 200 produktów.']]);
        }

        $cleanIds = [];
        foreach ($ids as $id) {
            if (!is_scalar($id) || trim((string) $id) === '') {
                throw $this->validationError(['ids' => ['Jeden z wybranych produktów jest nieprawidłowy.']]);
            }
            $cleanIds[] = (string) $id;
        }

        if ($action === 'delete') {
            return Response::json(['deleted' => $this->service->deleteBulk((string) $user['id'], $cleanIds)]);
        }

        $status = $payload['status'] ?? null;
        if (!in_array($status, ['TO_CONSIDER', 'FAVORITE', 'TO_BUY', 'PURCHASED'], true)) {
            throw $this->validationError(['status' => ['Wybierz poprawny status.']]);
        }
        return Response::json([
            'updated' => $this->service->updateStatusBulk((string) $user['id'], $cleanIds, (string) $status),
        ]);
    }

    private function validate(array $payload, bool $partial): array
    {
        $validator = new Validator($payload);
        $data = [];

        if (!$partial || array_key_exists('name', $payload)) {
            $data['name'] = $validator->requiredString('name', 300, 'Product name');
        }
        if (!$partial || array_key_exists('url', $payload)) {
            $data['url'] = $validator->requiredString('url', 4000, 'Product URL');
        }

        foreach ([
            'description' => [5000, 'Description'],
            'imagePath' => [500, 'Image path'],
            'imageSourceUrl' => [4000, 'Image source URL'],
            'availability' => [120, 'Availability'],
            'notes' => [5000, 'Notes'],
            'storeName' => [120, 'Store name'],
            'storeDomain' => [255, 'Store domain'],
        ] as $field => [$max, $label]) {
            if (array_key_exists($field, $payload)) {
                $data[$field] = $validator->optionalString($field, $max, $label);
            }
        }

        foreach (['currentPrice' => 'Price', 'originalPrice' => 'Original price'] as $field => $label) {
            if (array_key_exists($field, $payload)) {
                if ($payload[$field] === null || $payload[$field] === '') {
                    $data[$field] = null;
                } else {
                    $data[$field] = $validator->optionalNumber($field, $label, 0, 1000000000);
                }
            }
        }

        if (array_key_exists('currency', $payload)) {
            $currency = strtoupper(trim((string) $payload['currency']));
            if (!preg_match('/^[A-Z]{3}$/', $currency)) {
                $validator->addError('currency', 'Wybierz poprawną walutę.');
            } else {
                $data['currency'] = $currency;
            }
        } elseif (!$partial) {
            $data['currency'] = 'PLN';
        }

        if (array_key_exists('status', $payload)) {
            $status = (string) $payload['status'];
            if (!in_array($status, ['TO_CONSIDER', 'FAVORITE', 'TO_BUY', 'PURCHASED'], true)) {
                $validator->addError('status', 'Wybierz poprawny status.');
            } else {
                $data['status'] = $status;
            }
        } elseif (!$partial) {
            $data['status'] = 'TO_CONSIDER';
        }

        if (array_key_exists('categoryId', $payload)) {
            $categoryId = $validator->optionalString('categoryId', 191, 'Category');
            if ($categoryId !== null) {
                $data['categoryId'] = $categoryId;
            }
        }

        if (array_key_exists('groupId', $payload)) {
            $groupId = $validator->optionalString('groupId', 191, 'Group');
            if ($groupId !== null) {
                $data['groupId'] = $groupId;
            }
        }

        if (array_key_exists('tags', $payload)) {
            $data['tags'] = $validator->stringList('tags', 15, 40, 'Tags');
        } elseif (!$partial) {
            $data['tags'] = [];
        }

        $validator->throwIfFails();
        return $data;
    }

    private function validationError(array $fieldErrors): HttpException
    {
        return new HttpException(400, 'Sprawdź zaznaczone pola.', 'VALIDATION_ERROR', [
            'formErrors' => [],
            'fieldErrors' => $fieldErrors,
        ]);
    }
}
