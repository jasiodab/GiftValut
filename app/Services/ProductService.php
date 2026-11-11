<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\App;
use App\Core\HttpException;
use App\Core\Str;
use App\Repositories\CategoryGroupRepository;
use App\Repositories\CategoryRepository;
use App\Repositories\PriceHistoryRepository;
use App\Repositories\ProductRepository;
use App\Repositories\SettingsRepository;
use App\Repositories\StoreRepository;
use App\Repositories\TagRepository;
use App\Repositories\UploadRepository;

final class ProductService
{
    private ProductRepository $products;
    private CategoryRepository $categories;
    private CategoryGroupRepository $groups;
    private StoreRepository $stores;
    private TagRepository $tags;
    private UploadRepository $uploads;

    public function __construct()
    {
        $this->products = new ProductRepository();
        $this->categories = new CategoryRepository();
        $this->groups = new CategoryGroupRepository();
        $this->stores = new StoreRepository();
        $this->tags = new TagRepository();
        $this->uploads = new UploadRepository();
    }

    public function repository(): ProductRepository
    {
        return $this->products;
    }

    public function tagRepository(): TagRepository
    {
        return $this->tags;
    }

    public function categoryRepository(): CategoryRepository
    {
        return $this->categories;
    }

    public function duplicateCheck(string $userId, string $url): ?array
    {
        $normalized = UrlSafety::normalizeProductUrl($url);
        $existing = $this->products->findByNormalizedUrl($userId, $normalized['normalizedUrl']);
        if ($existing === null) {
            return null;
        }
        return [
            'id' => (string) $existing['id'],
            'name' => (string) $existing['name'],
            'createdAt' => \App\Core\Str::isoFromMs($existing['createdAt'] ?? null),
        ];
    }

    public function create(string $userId, array $input): array
    {
        $normalized = UrlSafety::normalizeProductUrl((string) $input['url']);
        $duplicate = $this->products->findByNormalizedUrl($userId, $normalized['normalizedUrl']);
        if ($duplicate !== null) {
            throw new HttpException(409, 'Ten adres URL produktu jest już w Twojej skarbnicy.', 'DUPLICATE_PRODUCT', [
                'productId' => (string) $duplicate['id'],
                'productName' => (string) $duplicate['name'],
            ]);
        }

        $category = $this->resolveCategory($userId, $input['categoryId'] ?? null);
        $groupId = $input['groupId'] ?? null;
        if ($groupId !== null && $groupId !== '') {
            if (!$this->groups->canManageProducts($groupId, $userId)) {
                throw new HttpException(403, 'Brak uprawnień do dodawania produktów do tej grupy.', 'FORBIDDEN');
            }
        }
        $store = $this->resolveStore(
            $userId,
            $input['storeName'] ?? null,
            $input['storeDomain'] ?? null,
            $normalized['url']
        );
        $tags = self::cleanTagNames($input['tags'] ?? []);
        $imagePath = $this->assertOwnedImage($userId, self::normalizeImagePath($input['imagePath'] ?? null));

        $id = App::db()->transaction(function () use ($userId, $input, $normalized, $category, $store, $tags, $imagePath, $groupId): string {
            $currentPrice = isset($input['currentPrice']) && $input['currentPrice'] !== null
                ? Money::round((float) $input['currentPrice'])
                : null;
            $originalPrice = isset($input['originalPrice']) && $input['originalPrice'] !== null
                ? Money::round((float) $input['originalPrice'])
                : null;
            $id = $this->products->create([
                'userId' => $userId,
                'name' => trim((string) $input['name']),
                'url' => $normalized['url'],
                'normalizedUrl' => $normalized['normalizedUrl'],
                'description' => self::cleanOptional($input['description'] ?? null),
                'imagePath' => $imagePath,
                'imageSourceUrl' => self::cleanOptional($input['imageSourceUrl'] ?? null),
                'currentPrice' => $currentPrice,
                'originalPrice' => $originalPrice,
                'currency' => (string) ($input['currency'] ?? 'PLN'),
                'availability' => self::cleanOptional($input['availability'] ?? null),
                'status' => (string) ($input['status'] ?? 'TO_CONSIDER'),
                'notes' => self::cleanOptional($input['notes'] ?? null),
                'storeId' => $store['id'],
                'categoryId' => $category['id'],
                'groupId' => $groupId,
            ]);
            $this->syncTags($userId, $id, $tags);
            if ($currentPrice !== null) {
                $this->recordPriceHistory($userId, $id, $currentPrice, $originalPrice, (string) ($input['currency'] ?? 'PLN'), self::cleanOptional($input['availability'] ?? null));
            }
            return $id;
        });

        return $this->requireProduct($id, $userId);
    }

    public function update(string $userId, string $id, array $input): array
    {
        $existing = $this->products->findRowForUser($id, $userId);
        if ($existing === null) {
            throw new HttpException(404, 'Nie znaleziono produktu.', 'PRODUCT_NOT_FOUND');
        }

        $data = [];
        $url = (string) $existing['url'];

        if (array_key_exists('url', $input) && $input['url'] !== null) {
            $normalized = UrlSafety::normalizeProductUrl((string) $input['url']);
            $url = $normalized['url'];
            $duplicate = $this->products->findByNormalizedUrl($userId, $normalized['normalizedUrl'], $id);
            if ($duplicate !== null) {
                throw new HttpException(409, 'Inny produkt już używa tego adresu URL.', 'DUPLICATE_PRODUCT', [
                    'productId' => (string) $duplicate['id'],
                    'productName' => (string) $duplicate['name'],
                ]);
            }
            $data['url'] = $normalized['url'];
            $data['normalizedUrl'] = $normalized['normalizedUrl'];
        }

        if (array_key_exists('name', $input)) {
            $data['name'] = trim((string) $input['name']);
        }
        foreach (['description', 'imageSourceUrl', 'availability', 'notes'] as $field) {
            if (array_key_exists($field, $input)) {
                $data[$field] = self::cleanOptional($input[$field]);
            }
        }
        if (array_key_exists('imagePath', $input)) {
            $nextImage = self::normalizeImagePath($input['imagePath']);
            if ($nextImage !== null && $nextImage !== $existing['imagePath']) {
                $this->assertOwnedImage($userId, $nextImage);
            }
            $data['imagePath'] = $nextImage;
        }
        if (array_key_exists('currency', $input)) {
            $data['currency'] = (string) $input['currency'];
        }
        if (array_key_exists('status', $input)) {
            $data['status'] = (string) $input['status'];
        }
        $newCurrentPrice = null;
        if (array_key_exists('currentPrice', $input)) {
            $newCurrentPrice = $input['currentPrice'] === null ? null : Money::round((float) $input['currentPrice']);
            $data['currentPrice'] = $newCurrentPrice;
        }
        if (array_key_exists('originalPrice', $input)) {
            $data['originalPrice'] = $input['originalPrice'] === null ? null : Money::round((float) $input['originalPrice']);
        }

        if (array_key_exists('categoryId', $input)) {
            $category = $this->resolveCategory($userId, (string) $input['categoryId']);
            $data['categoryId'] = $category['id'];
        }

        if (array_key_exists('storeName', $input) || array_key_exists('storeDomain', $input) || array_key_exists('url', $input)) {
            $existingStoreName = null;
            if (($existing['storeId'] ?? null) !== null) {
                $existingStore = $this->stores->findForUser((string) $existing['storeId'], $userId);
                $existingStoreName = $existingStore['name'] ?? null;
            }
            $store = $this->resolveStore(
                $userId,
                array_key_exists('storeName', $input) ? $input['storeName'] : $existingStoreName,
                array_key_exists('storeDomain', $input) ? $input['storeDomain'] : null,
                $url
            );
            $data['storeId'] = $store['id'];
        }

        $newTags = null;
        if (array_key_exists('tags', $input)) {
            $newTags = self::cleanTagNames($input['tags'] ?? []);
        }

        // Group permission check for products that belong to a group.
        $existingGroupId = $existing['groupId'] ?? null;
        $newGroupId = array_key_exists('groupId', $input) ? ($input['groupId'] ?? null) : $existingGroupId;
        if ($newGroupId !== null && $newGroupId !== '') {
            if (!$this->groups->canEditProducts($newGroupId, $userId)) {
                throw new HttpException(403, 'Brak uprawnień do edytowania produktów w tej grupie.', 'FORBIDDEN');
            }
        } elseif ($existingGroupId !== null && $existingGroupId !== '') {
            // Removing a product from a group requires edit rights on that group too.
            if (!$this->groups->canEditProducts($existingGroupId, $userId)) {
                throw new HttpException(403, 'Brak uprawnień do wyjmowania produktu z tej grupy.', 'FORBIDDEN');
            }
        }

        $oldImage = $existing['imagePath'] !== null ? (string) $existing['imagePath'] : null;

        App::db()->transaction(function () use ($id, $userId, $data, $newTags, $existing, $newCurrentPrice): void {
            $this->products->update($id, $userId, $data);
            if ($newTags !== null) {
                $this->syncTags($userId, $id, $newTags);
            }
            if ($newCurrentPrice !== null && $newCurrentPrice !== (float) ($existing['currentPrice'] ?? 0)) {
                $this->recordPriceHistory(
                    $userId,
                    $id,
                    $newCurrentPrice,
                    $data['originalPrice'] ?? $existing['originalPrice'],
                    $data['currency'] ?? $existing['currency'],
                    $data['availability'] ?? $existing['availability']
                );
            }
        });

        $updated = $this->requireProduct($id, $userId);

        if ($oldImage !== null && $updated['imageUrl'] !== $oldImage) {
            $this->cleanupImage($userId, $oldImage);
        }
        if ($newTags !== null) {
            $this->tags->deleteOrphans($userId);
        }

        return $updated;
    }

    public function delete(string $userId, string $id): void
    {
        $existing = $this->products->findRowForUser($id, $userId);
        if ($existing === null) {
            throw new HttpException(404, 'Nie znaleziono produktu.', 'PRODUCT_NOT_FOUND');
        }

        App::db()->transaction(function () use ($id, $userId): void {
            $this->products->delete($id, $userId);
            $this->tags->deleteOrphans($userId);
        });

        if (($existing['imagePath'] ?? null) !== null) {
            $this->cleanupImage($userId, (string) $existing['imagePath']);
        }
    }

    /**
     * @param list<string> $ids
     */
    public function deleteBulk(string $userId, array $ids): int
    {
        $unique = array_values(array_unique(array_filter($ids, static fn ($id) => is_string($id) && $id !== '')));
        if ($unique === []) {
            return 0;
        }

        $rows = $this->products->findManyForUser($userId, $unique);
        if ($rows === []) {
            return 0;
        }

        $productIds = array_map(static fn (array $row): string => (string) $row['id'], $rows);
        $imagePaths = array_values(array_unique(array_filter(
            array_map(static fn (array $row) => $row['imagePath'], $rows),
            static fn ($path) => is_string($path) && $path !== ''
        )));

        App::db()->transaction(function () use ($userId, $productIds): void {
            foreach ($productIds as $productId) {
                $this->products->delete($productId, $userId);
            }
            $this->tags->deleteOrphans($userId);
        });

        foreach ($imagePaths as $imagePath) {
            $this->cleanupImage($userId, (string) $imagePath);
        }

        return count($rows);
    }

    /**
     * @param list<string> $ids
     */
    public function updateStatusBulk(string $userId, array $ids, string $status): int
    {
        return $this->products->updateStatusBulk($userId, array_values(array_unique($ids)), $status);
    }

    private function requireProduct(string $id, string $userId): array
    {
        $row = $this->products->findForUser($id, $userId, $this->tags);
        if ($row === null) {
            throw new HttpException(404, 'Nie znaleziono produktu.', 'PRODUCT_NOT_FOUND');
        }
        return Serializer::product($row);
    }

    private function resolveCategory(string $userId, ?string $categoryId): array
    {
        if ($categoryId !== null && $categoryId !== '') {
            $category = $this->categories->findForUser($categoryId, $userId);
            if ($category === null) {
                throw new HttpException(400, 'Wybrana kategoria nie istnieje już.', 'INVALID_CATEGORY');
            }
            return $category;
        }

        $fallback = $this->categories->findOther($userId) ?? $this->categories->firstForUser($userId);
        if ($fallback === null) {
            throw new HttpException(500, 'Brak kategorii w bazie danych.', 'NO_CATEGORIES');
        }
        return $fallback;
    }

    private function resolveStore(string $userId, ?string $storeName, ?string $storeDomain, string $url): array
    {
        $domain = self::domainFromInput($storeDomain, $url);
        $requestedName = self::cleanOptional($storeName) ?? self::titleFromDomain($domain);
        return $this->stores->upsert($userId, $domain, $requestedName);
    }

    private function assertOwnedImage(string $userId, ?string $imagePath): ?string
    {
        if ($imagePath === null) {
            return null;
        }
        $filename = basename($imagePath);
        if (!$this->uploads->existsForUser($filename, $userId)) {
            throw new HttpException(400, 'Wybrane zdjęcie nie jest dostępne na Twoim koncie.', 'INVALID_IMAGE_PATH');
        }
        return $imagePath;
    }

    /**
     * @param list<string> $tags
     */
    private function syncTags(string $userId, string $productId, array $tags): void
    {
        $this->tags->detachAll($productId);
        foreach ($tags as $name) {
            $tag = $this->tags->findByName($userId, $name);
            if ($tag === null) {
                $tag = $this->tags->create($userId, $name);
            }
            $this->tags->attach($productId, (string) $tag['id']);
        }
    }

    private function cleanupImage(string $userId, string $imagePath): void
    {
        $filename = basename($imagePath);
        if ($this->products->countByImagePath($imagePath, $userId) === 0) {
            $this->uploads->deleteForUser($filename, $userId);
        }
        if ($this->products->countByImagePath($imagePath) === 0) {
            Images::deleteLocal($imagePath);
        }
    }

    private static function cleanOptional(mixed $value): ?string
    {
        if ($value === null || !is_scalar($value)) {
            return null;
        }
        $cleaned = trim((string) $value);
        return $cleaned !== '' ? $cleaned : null;
    }

    private function recordPriceHistory(string $userId, string $productId, float $price, ?float $originalPrice, string $currency, ?string $availability): void
    {
        App::db()->run(
            'INSERT INTO "PriceHistory" (id, userId, productId, price, originalPrice, currency, availability, source, recordedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                Str::id(),
                $userId,
                $productId,
                $price,
                $originalPrice,
                $currency,
                $availability,
                'MANUAL',
                date('Y-m-d H:i:s'),
            ]
        );
    }

    private static function normalizeImagePath(mixed $value): ?string
    {
        $cleaned = self::cleanOptional($value);
        if ($cleaned === null) {
            return null;
        }
        if (!str_starts_with($cleaned, '/uploads/')) {
            throw new HttpException(400, 'Zdjęcia muszą być przechowywane w lokalnym folderze uploads.', 'INVALID_IMAGE_PATH');
        }
        $filename = basename($cleaned);
        if ($filename === '' || $filename === '.' || $filename === '..') {
            throw new HttpException(400, 'Nieprawidłowe odwołanie do zdjęcia.', 'INVALID_IMAGE_PATH');
        }
        return '/uploads/' . $filename;
    }

    /**
     * @param list<mixed> $tags
     * @return list<string>
     */
    private static function cleanTagNames(array $tags): array
    {
        $seen = [];
        $result = [];
        foreach ($tags as $raw) {
            if (!is_scalar($raw)) {
                continue;
            }
            $tag = mb_substr(trim((string) $raw), 0, 40);
            if ($tag === '') {
                continue;
            }
            $key = mb_strtolower($tag);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $result[] = $tag;
            if (count($result) >= 15) {
                break;
            }
        }
        return $result;
    }

    private static function domainFromInput(?string $storeDomain, string $url): string
    {
        $candidate = self::cleanOptional($storeDomain);
        if ($candidate !== null) {
            $target = str_contains($candidate, '://') ? $candidate : 'https://' . $candidate;
            $host = parse_url($target, PHP_URL_HOST);
            if (is_string($host) && $host !== '') {
                return strtolower((string) preg_replace('/^www\./i', '', $host));
            }
        }
        $host = parse_url($url, PHP_URL_HOST);
        return strtolower((string) preg_replace('/^www\./i', '', (string) $host));
    }

    private static function titleFromDomain(string $domain): string
    {
        $core = explode('.', (string) preg_replace('/^www\./', '', $domain))[0] ?? $domain;
        $parts = array_values(array_filter(explode('-', str_replace('_', '-', $core)), static fn ($part) => $part !== ''));
        return implode(' ', array_map(static fn ($part) => ucfirst($part), $parts));
    }
}
