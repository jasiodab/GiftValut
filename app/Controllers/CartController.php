<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\CartRepository;
use App\Repositories\ProductRepository;
use App\Repositories\TagRepository;
use App\Services\Serializer;

final class CartController extends Controller
{
    private CartRepository $cart;
    private ProductRepository $products;
    private TagRepository $tags;

    public function __construct(\App\Core\Request $request)
    {
        parent::__construct($request);
        $this->cart = new CartRepository();
        $this->products = new ProductRepository();
        $this->tags = new TagRepository();
    }

    public function index(): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];

        $items = $this->cart->listForUser($userId);

        return Response::json(['items' => $items]);
    }

    public function create(): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];

        $input = $this->jsonInput();
        $productId = (string) ($input['productId'] ?? '');
        if ($productId === '') {
            throw new HttpException(400, 'Produkt jest wymagany.', 'PRODUCT_REQUIRED');
        }

        $quantity = 1;
        if (isset($input['quantity']) && is_numeric($input['quantity'])) {
            $quantity = max(1, (int) $input['quantity']);
        }

        $existing = $this->products->findForUser($productId, $userId, $this->tags);
        if ($existing === null) {
            throw new HttpException(404, 'Nie znaleziono produktu.', 'PRODUCT_NOT_FOUND');
        }

        $cartId = $this->cart->add($userId, $productId, $quantity);

        return Response::json(['id' => $cartId], 201);
    }

    public function delete(string $id): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];

        if (!$this->cart->remove($userId, $id)) {
            throw new HttpException(404, 'Nie znaleziono przedmiotu w koszyku.', 'CART_ITEM_NOT_FOUND');
        }

        return Response::json(['deleted' => true]);
    }

    public function clear(): Response
    {
        $user = AuthMiddleware::user($this->request);
        $userId = (string) $user['id'];

        $this->cart->clear($userId);

        return Response::json(['ok' => true]);
    }
}
