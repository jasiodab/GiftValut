<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\App;
use DOMDocument;
use DOMElement;
use DOMXPath;
use Throwable;

final class Extraction
{
    /**
     * @param list<array{id: string, name: string, slug: string, color?: string, icon?: string}> $categories
     * @return array{success: bool, data: array<string, mixed>, warnings: list<string>, strategies: list<string>, error?: string}
     */
    public static function extract(
        string $rawUrl,
        string $defaultCurrency,
        array $categories,
        bool $downloadImage,
        string $userId
    ): array {
        $normalized = UrlSafety::normalizeProductUrl($rawUrl);
        $url = $normalized['url'];
        $warnings = [];
        $strategies = [];

        try {
            $response = SafeFetch::fetch($url, [
                'maxBytes' => 6 * 1024 * 1024,
                'timeoutMs' => 15000,
            ]);
        } catch (Throwable $error) {
            $message = $error->getMessage() !== '' ? $error->getMessage() : 'Sklep nie mógł zostać osiągnięty.';
            return [
                'success' => false,
                'error' => $message,
                'warnings' => ['Możesz nadal dodać produkt i wypełnić szczegóły ręcznie.'],
                'strategies' => $strategies,
                'data' => self::emptyData($url, $defaultCurrency, $categories),
            ];
        }

        $status = (int) $response['status'];
        $responseUrl = (string) $response['url'];

        if ($status === 401 || $status === 403) {
            return [
                'success' => false,
                'error' => 'Sklep odmawia automatycznego dostępu.',
                'warnings' => ['Sklep blokuje automatyczne czytniki. Dodaj produkt ręcznie, używając szczegółów, które widzisz w przeglądarce.'],
                'strategies' => $strategies,
                'data' => self::emptyData($responseUrl, $defaultCurrency, $categories),
            ];
        }
        if ($status === 429) {
            return [
                'success' => false,
                'error' => 'Sklep ogranicza liczbę żądań.',
                'warnings' => ['Poczekaj chwilę lub dodaj produkt ręcznie. Gift Vault nie będzie ponawiać żądań zbyt agresywnie.'],
                'strategies' => $strategies,
                'data' => self::emptyData($responseUrl, $defaultCurrency, $categories),
            ];
        }
        if ($status < 200 || $status >= 400) {
            return [
                'success' => false,
                'error' => 'Sklep odpowiedział kodem HTTP ' . $status . '.',
                'warnings' => ['Możesz nadal dodać produkt ręcznie.'],
                'strategies' => $strategies,
                'data' => self::emptyData($responseUrl, $defaultCurrency, $categories),
            ];
        }

        $contentType = strtolower((string) $response['contentType']);
        if ($contentType !== ''
            && !str_contains($contentType, 'html')
            && !str_contains($contentType, 'xml')
            && !str_contains($contentType, 'text/plain')) {
            return [
                'success' => false,
                'error' => 'Link nie zwrócił strony produktu.',
                'warnings' => ['Automatycznie można odczytać tylko strony produktu w formacie HTML.'],
                'strategies' => $strategies,
                'data' => self::emptyData($responseUrl, $defaultCurrency, $categories),
            ];
        }

        $html = SafeFetch::decodeHtml((string) $response['body'], $contentType);
        $document = self::loadDocument($html);
        if ($document === null) {
            return [
                'success' => false,
                'error' => 'Nie można przetworzyć strony.',
                'warnings' => ['Możesz nadal dodać produkt ręcznie.'],
                'strategies' => $strategies,
                'data' => self::emptyData($responseUrl, $defaultCurrency, $categories),
            ];
        }

        $xpath = new DOMXPath($document);

        $meta = [];
        foreach ($xpath->query('//meta') ?: [] as $node) {
            if (!$node instanceof DOMElement) {
                continue;
            }
            $key = trim(strtolower(
                $node->getAttribute('property') !== ''
                    ? $node->getAttribute('property')
                    : ($node->getAttribute('name') !== ''
                        ? $node->getAttribute('name')
                        : $node->getAttribute('itemprop'))
            ));
            $content = trim($node->getAttribute('content'));
            if ($key !== '' && $content !== '' && !isset($meta[$key])) {
                $meta[$key] = $content;
            }
        }

        $jsonLdProducts = [];
        foreach ($xpath->query('//script[@type="application/ld+json"]') ?: [] as $node) {
            $content = trim((string) $node->textContent);
            if ($content === '') {
                continue;
            }
            $decoded = json_decode($content, true);
            if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
                $warnings[] = 'Jednego z bloków danych ustrukturyzowanych nie można było odczytać.';
                continue;
            }
            foreach (self::collectProductNodes($decoded) as $product) {
                $jsonLdProducts[] = $product;
            }
        }

        $jsonProduct = $jsonLdProducts[0] ?? null;
        $jsonOffer = $jsonProduct !== null ? self::extractOfferData($jsonProduct) : null;

        $titleFromH1 = self::firstText($xpath, '//h1');
        $titleTag = self::firstText($xpath, '//title');

        $metaName = self::firstNonEmpty([
            $meta['og:title'] ?? null,
            $meta['twitter:title'] ?? null,
            $meta['title'] ?? null,
            $jsonProduct['name'] ?? null,
            $titleFromH1,
            $titleTag,
        ], 300);

        $description = self::firstNonEmpty([
            $meta['og:description'] ?? null,
            $meta['description'] ?? null,
            $meta['twitter:description'] ?? null,
            $jsonProduct['description'] ?? null,
        ], 2500);

        $ogImage = self::firstString([
            $meta['og:image:secure_url'] ?? null,
            $meta['og:image'] ?? null,
            $meta['og:image:url'] ?? null,
            $meta['twitter:image'] ?? null,
            $meta['twitter:image:src'] ?? null,
            $jsonProduct['image'] ?? null,
        ]);
        $imageSourceUrl = null;
        if ($ogImage !== null) {
            $resolved = SafeFetch::resolveUrl($ogImage, $responseUrl);
            if (preg_match('#^https?://#i', $resolved)) {
                $imageSourceUrl = $resolved;
            } else {
                $warnings[] = 'Strona odwołuje się do nieprawidłowego adresu URL obrazu.';
            }
        }

        $microdataPrice = self::firstPrice([
            self::attr($xpath, '//*[@itemprop="price"]', 'content'),
            self::firstText($xpath, '//*[@itemprop="price"]'),
            self::attr($xpath, '//*[@data-price]', 'data-price'),
        ]);

        $metaPrice = self::firstPrice([
            $meta['product:price:amount'] ?? null,
            $meta['og:price:amount'] ?? null,
            $meta['product:sale_price:amount'] ?? null,
            $meta['price'] ?? null,
        ]);

        $currentPrice = $jsonOffer['price'] ?? $metaPrice ?? $microdataPrice;

        $metaOriginal = self::firstPrice([
            $meta['product:original_price:amount'] ?? null,
            $meta['og:price:original_amount'] ?? null,
            $meta['product:list_price:amount'] ?? null,
            $meta['product:original-price'] ?? null,
        ]);

        $originalPrice = null;
        if ($jsonOffer !== null && $jsonOffer['originalPrice'] !== null && $currentPrice !== null && $jsonOffer['originalPrice'] > $currentPrice) {
            $originalPrice = $jsonOffer['originalPrice'];
        } elseif ($metaOriginal !== null && $currentPrice !== null && $metaOriginal > $currentPrice) {
            $originalPrice = $metaOriginal;
        }

        $currency = Money::normalizeCurrency(self::firstString([
            $jsonOffer['currency'] ?? null,
            $meta['product:price:currency'] ?? null,
            $meta['og:price:currency'] ?? null,
            self::attr($xpath, '//*[@itemprop="priceCurrency"]', 'content'),
            self::firstText($xpath, '//*[@itemprop="priceCurrency"]'),
        ]), $defaultCurrency);

        $availability = self::normalizeAvailability(self::firstString([
            $jsonOffer['availability'] ?? null,
            $meta['product:availability'] ?? null,
            $meta['og:availability'] ?? null,
            self::attr($xpath, '//*[@itemprop="availability"]', 'href'),
            self::attr($xpath, '//*[@itemprop="availability"]', 'content'),
        ]));

        $ogSiteName = self::cleanText($meta['og:site_name'] ?? null, 100);
        $applicationName = self::cleanText($meta['application-name'] ?? null, 100);
        $host = (string) parse_url($responseUrl, PHP_URL_HOST);
        $storeDomain = strtolower((string) preg_replace('/^www\./i', '', $host));
        $storeName = $ogSiteName ?? $applicationName ?? self::storeNameFromDomain($storeDomain);

        if ($jsonProduct !== null) {
            $strategies[] = 'JSON-LD';
        }
        if (isset($meta['og:title']) || isset($meta['og:image']) || isset($meta['og:price:amount'])) {
            $strategies[] = 'Open Graph';
        }
        if ($meta !== []) {
            $strategies[] = 'Meta tags';
        }
        if ($titleFromH1 !== null || $titleTag !== null) {
            $strategies[] = 'Page title';
        }

        if ($currentPrice === null) {
            $warnings[] = 'Nie znaleziono wiarygodnej ceny na stronie. Możesz wpisać ją ręcznie.';
        }
        if ($description === null) {
            $warnings[] = 'Brak opisu produktu.';
        }

        $imagePath = null;
        if ($imageSourceUrl !== null && $downloadImage) {
            $stored = Images::download($imageSourceUrl, $responseUrl, $userId);
            if ($stored !== null) {
                $imagePath = $stored['path'];
            } else {
                $warnings[] = 'Nie można pobrać zdjęcia produktu. Możesz przesłać je ręcznie.';
            }
        } elseif ($imageSourceUrl !== null && !$downloadImage) {
            $warnings[] = 'Pobieranie zdjęcia zostało pominięte przy tej aktualizacji.';
        }

        $suggested = $categories !== []
            ? Categorization::suggest(
                ['name' => $metaName, 'description' => $description, 'storeName' => $storeName],
                $categories
            )
            : null;

        if ($metaName === null) {
            $warnings[] = 'Strona może wymagać JavaScriptu lub blokować automatyczny dostęp. Dodaj produkt ręcznie.';
            return [
                'success' => false,
                'error' => 'Nie można zidentyfikować szczegółów produktu na tej stronie.',
                'warnings' => $warnings,
                'strategies' => $strategies,
                'data' => self::emptyData($responseUrl, $defaultCurrency, $categories),
            ];
        }

        return [
            'success' => true,
            'warnings' => $warnings,
            'strategies' => $strategies,
            'data' => [
                'name' => $metaName,
                'url' => $responseUrl,
                'storeName' => $storeName,
                'storeDomain' => $storeDomain,
                'description' => $description,
                'imagePath' => $imagePath,
                'imageSourceUrl' => $imageSourceUrl,
                'currentPrice' => $currentPrice,
                'originalPrice' => $originalPrice,
                'currency' => $currency,
                'availability' => $availability,
                'suggestedCategoryId' => $suggested['id'] ?? null,
                'suggestedCategoryName' => $suggested['name'] ?? null,
            ],
        ];
    }

    private static function loadDocument(string $html): ?DOMDocument
    {
        if (trim($html) === '') {
            return null;
        }
        $document = new DOMDocument();
        $previous = libxml_use_internal_errors(true);
        try {
            $loaded = $document->loadHTML(
                '<?xml encoding="UTF-8">' . $html,
                LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING | LIBXML_COMPACT
            );
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
        return $loaded ? $document : null;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function collectProductNodes(mixed $value, int $depth = 0, array $found = []): array
    {
        if ($depth > 8 || $value === null) {
            return $found;
        }
        if (is_array($value) && array_is_list($value)) {
            foreach ($value as $item) {
                $found = self::collectProductNodes($item, $depth + 1, $found);
            }
            return $found;
        }
        if (!is_array($value)) {
            return $found;
        }

        $types = $value['@type'] ?? null;
        $types = is_array($types) ? $types : [$types];
        $types = array_values(array_filter(array_map(
            static fn ($type) => is_string($type) ? strtolower($type) : null,
            $types
        )));

        foreach ($types as $type) {
            if (str_ends_with($type, 'product') || str_ends_with($type, 'productgroup')) {
                $found[] = $value;
                break;
            }
        }

        foreach ($value as $key => $child) {
            if (!is_string($key) || str_starts_with($key, '@') || in_array($key, ['offers', 'review', 'aggregateRating'], true)) {
                continue;
            }
            if (is_array($child)) {
                $found = self::collectProductNodes($child, $depth + 1, $found);
            }
        }

        return $found;
    }

    /**
     * @return array{price: ?float, originalPrice: ?float, currency: ?string, availability: ?string}
     */
    private static function extractOfferData(array $node): array
    {
        $rawOffers = $node['offers'] ?? null;
        $offers = is_array($rawOffers) && array_is_list($rawOffers) ? $rawOffers : ($rawOffers !== null ? [$rawOffers] : []);

        $price = null;
        $originalPrice = null;
        $currency = null;
        $availability = null;

        foreach ($offers as $rawOffer) {
            if (!is_array($rawOffer)) {
                continue;
            }
            $specification = is_array($rawOffer['priceSpecification'] ?? null) ? $rawOffer['priceSpecification'] : [];
            $candidate = self::firstPrice([
                $rawOffer['price'] ?? null,
                $rawOffer['lowPrice'] ?? null,
                $specification['price'] ?? null,
                $node['price'] ?? null,
            ]);
            if ($candidate === null) {
                continue;
            }
            if ($price === null || $candidate < $price) {
                $price = $candidate;
                $listPrice = self::firstPrice([
                    $rawOffer['listPrice'] ?? null,
                    $rawOffer['msrp'] ?? null,
                    $specification['listPrice'] ?? null,
                ]);
                $highPrice = self::firstPrice([$rawOffer['highPrice'] ?? null]);
                $possibleOriginal = $listPrice ?? $highPrice;
                $originalPrice = $possibleOriginal !== null && $possibleOriginal > $candidate ? $possibleOriginal : null;
                $currency = self::firstString([
                    $rawOffer['priceCurrency'] ?? null,
                    $specification['priceCurrency'] ?? null,
                ]) ?? $currency;
                $availability = self::firstString([$rawOffer['availability'] ?? null]) ?? $availability;
            }
        }

        return [
            'price' => $price,
            'originalPrice' => $originalPrice,
            'currency' => $currency,
            'availability' => $availability,
        ];
    }

    private static function normalizeAvailability(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $normalized = strtolower($value);
        if (str_contains($normalized, 'outofstock') || str_contains($normalized, 'soldout') || str_contains($normalized, 'out of stock')) {
            return 'Out of stock';
        }
        if (str_contains($normalized, 'preorder') || str_contains($normalized, 'pre-order')) {
            return 'Pre-order';
        }
        if (str_contains($normalized, 'backorder') || str_contains($normalized, 'back order')) {
            return 'Back order';
        }
        if (str_contains($normalized, 'limitedavailability') || str_contains($normalized, 'limited')) {
            return 'Limited availability';
        }
        if (str_contains($normalized, 'discontinued')) {
            return 'Discontinued';
        }
        if (str_contains($normalized, 'instock') || str_contains($normalized, 'in stock') || $normalized === 'available') {
            return 'In stock';
        }
        return self::cleanText($value, 80);
    }

    private static function storeNameFromDomain(string $domain): string
    {
        $withoutWww = (string) preg_replace('/^www\./', '', $domain);
        $parts = explode('.', $withoutWww);
        $core = $parts[0] !== '' ? $parts[0] : $withoutWww;
        $words = array_values(array_filter(explode('-', str_replace('_', '-', $core)), static fn ($part) => $part !== ''));
        return implode(' ', array_map(static fn ($part) => ucfirst($part), $words));
    }

    private static function firstText(DOMXPath $xpath, string $query): ?string
    {
        $nodes = $xpath->query($query);
        if ($nodes === false || $nodes->length === 0) {
            return null;
        }
        return self::cleanText($nodes->item(0)?->textContent, 4000);
    }

    private static function attr(DOMXPath $xpath, string $query, string $attribute): ?string
    {
        $nodes = $xpath->query($query);
        if ($nodes === false || $nodes->length === 0) {
            return null;
        }
        $node = $nodes->item(0);
        if (!$node instanceof DOMElement) {
            return null;
        }
        $value = trim($node->getAttribute($attribute));
        return $value !== '' ? $value : null;
    }

    private static function cleanText(mixed $value, int $maxLength = 4000): ?string
    {
        if (!is_string($value)) {
            return null;
        }
        $text = $value;
        if (preg_match('/<[a-z][\s\S]*>/i', $text)) {
            $text = strip_tags($text);
        }
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = (string) preg_replace('/\s+/u', ' ', $text);
        $text = trim($text);
        if ($text === '') {
            return null;
        }
        return mb_substr($text, 0, $maxLength);
    }

    /**
     * @param list<mixed> $values
     */
    private static function firstNonEmpty(array $values, int $maxLength): ?string
    {
        foreach ($values as $value) {
            $clean = self::cleanText($value, $maxLength);
            if ($clean !== null) {
                return $clean;
            }
        }
        return null;
    }

    /**
     * @param list<mixed> $values
     */
    private static function firstString(array $values): ?string
    {
        foreach ($values as $value) {
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
            if (is_array($value)) {
                $found = self::firstString(array_is_list($value) ? $value : [$value['url'] ?? null, $value['contentUrl'] ?? null, $value['@id'] ?? null]);
                if ($found !== null) {
                    return $found;
                }
            }
        }
        return null;
    }

    /**
     * @param list<mixed> $values
     */
    private static function firstPrice(array $values): ?float
    {
        foreach ($values as $value) {
            $price = Money::parsePriceValue($value);
            if ($price !== null) {
                return $price;
            }
        }
        return null;
    }

    /**
     * @param list<array{id: string, name: string, slug: string, color?: string, icon?: string}> $categories
     * @return array<string, mixed>
     */
    private static function emptyData(string $url, string $currency, array $categories): array
    {
        $host = (string) parse_url($url, PHP_URL_HOST);
        $storeDomain = strtolower((string) preg_replace('/^www\./i', '', $host));
        $other = null;
        foreach ($categories as $category) {
            if (($category['slug'] ?? '') === 'other') {
                $other = $category;
                break;
            }
        }
        return [
            'name' => null,
            'url' => $url,
            'storeName' => self::storeNameFromDomain($storeDomain),
            'storeDomain' => $storeDomain,
            'description' => null,
            'imagePath' => null,
            'imageSourceUrl' => null,
            'currentPrice' => null,
            'originalPrice' => null,
            'currency' => $currency,
            'availability' => null,
            'suggestedCategoryId' => $other['id'] ?? null,
            'suggestedCategoryName' => $other['name'] ?? null,
        ];
    }
}
