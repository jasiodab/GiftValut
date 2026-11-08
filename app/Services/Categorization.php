<?php

declare(strict_types=1);

namespace App\Services;

final class Categorization
{
    /**
     * Keyword rules ported from the old Node service. Order matters: the first
     * category with the highest score wins.
     *
     * @return array<int, array{slug: string, keywords: list<string>}>
     */
    public static function rules(): array
    {
        return [
            ['slug' => 'jewelry', 'keywords' => [
                'jewelry', 'jewellery', 'ring', 'earring', 'necklace', 'bracelet', 'pendant',
                'gold', 'silver', 'diamond', 'pearl', 'chain', 'brooch', 'anklet',
                'biżuteria', 'bizuteria', 'pierścionek', 'pierscionek', 'kolczyki', 'naszyjnik',
                'bransoletka', 'złoto', 'złoty', 'srebro', 'srebrny', 'diament', 'perła', 'perły',
                'zegarek', 'zegarki', 'watch',
            ]],
            ['slug' => 'cosmetics', 'keywords' => [
                'cosmetic', 'makeup', 'beauty', 'skincare', 'perfume', 'fragrance', 'lipstick',
                'mascara', 'serum', 'cream', 'moisturizer', 'shampoo', 'conditioner', 'cleanser',
                'eyeshadow', 'blush', 'foundation', 'nail polish', 'kosmetyk', 'kosmetyki',
                'makijaż', 'makijaz', 'perfumy', 'perfum', 'krem', 'szampon', 'pomadka',
                'tusz do rzęs', 'podkład', 'pielęgnacja',
            ]],
            ['slug' => 'fashion', 'keywords' => [
                'fashion', 'clothing', 'apparel', 'shirt', 't-shirt', 'dress', 'skirt',
                'trousers', 'jeans', 'jacket', 'coat', 'sweater', 'hoodie', 'shoes', 'sneakers',
                'boots', 'bag', 'handbag', 'backpack', 'wallet', 'scarf', 'hat', 'socks',
                'lingerie', 'swimwear', 'sunglasses', 'odzież', 'odziez', 'ubrania', 'sukienka',
                'spódnica', 'spodnica', 'spodnie', 'jeansy', 'koszula', 'bluza', 'sweter',
                'kurtka', 'płaszcz', 'plaszcz', 'buty', 'sneakersy', 'torebka', 'plecak',
                'portfel', 'szalik', 'czapka', 'skarpetki',
            ]],
            ['slug' => 'electronics', 'keywords' => [
                'electronic', 'headphones', 'earbuds', 'speaker', 'phone', 'smartphone',
                'laptop', 'computer', 'tablet', 'smartwatch', 'camera', 'monitor', 'keyboard',
                'mouse', 'charger', 'powerbank', 'console', 'playstation', 'xbox',
                'nintendo switch', 'airpods', 'tv', 'television', 'router', 'drone',
                'elektronika', 'słuchawki', 'sluchawki', 'głośnik', 'glosnik', 'telefon',
                'smartfon', 'komputer', 'aparat', 'klawiatura', 'mysz', 'ładowarka',
                'ladowarka', 'konsola',
            ]],
            ['slug' => 'games', 'keywords' => [
                'game', 'board game', 'video game', 'puzzle', 'lego', 'card game', 'dice',
                'role playing', 'rpg', 'gaming', 'gra planszowa', 'gra', 'gry', 'planszówka',
                'planszowka', 'układanka', 'ukladanka', 'karty', 'kości',
            ]],
            ['slug' => 'books', 'keywords' => [
                'book', 'novel', 'paperback', 'hardcover', 'ebook', 'audiobook', 'comic',
                'manga', 'cookbook', 'diary', 'journal', 'książka', 'ksiazka', 'książki',
                'ksiazki', 'powieść', 'powiesc', 'komiks', 'poradnik', 'album', 'dziennik',
            ]],
            ['slug' => 'home-decor', 'keywords' => [
                'home', 'decor', 'interior', 'furniture', 'lamp', 'candle', 'vase', 'pillow',
                'cushion', 'blanket', 'rug', 'mirror', 'frame', 'kitchen', 'mug', 'plate',
                'bowl', 'plant', 'planter', 'diffuser', 'dom', 'wnętrze', 'wnetrze',
                'dekoracja', 'meble', 'lampa', 'świeca', 'swieca', 'wazon', 'poduszka', 'koc',
                'dywan', 'lustro', 'kubek', 'talerz', 'roślina', 'roslina', 'donica',
            ]],
            ['slug' => 'flowers', 'keywords' => [
                'flower', 'bouquet', 'rose', 'roses', 'tulip', 'orchid', 'peony', 'sunflower',
                'florist', 'plant', 'kwiat', 'kwiaty', 'bukiet', 'róża', 'roza', 'róże', 'roze',
                'tulipan', 'tulipany', 'orchidea', 'piwonia', 'słonecznik', 'slonecznik',
                'florysta', 'roślina',
            ]],
            ['slug' => 'experiences', 'keywords' => [
                'experience', 'voucher', 'gift card', 'ticket', 'concert', 'spa', 'massage',
                'workshop', 'course', 'class', 'adventure', 'hot air balloon', 'dinner',
                'hotel', 'travel', 'vr', 'escape room', 'prezent', 'bon podarunkowy',
                'karta podarunkowa', 'bilet', 'koncert', 'masaż', 'masaz', 'warsztat', 'kurs',
                'przeżycie', 'przezycie', 'lot balonem', 'kolacja', 'podróż', 'podroz',
            ]],
            ['slug' => 'food-sweets', 'keywords' => [
                'chocolate', 'sweets', 'candy', 'cake', 'cookie', 'biscuit', 'coffee', 'tea',
                'wine', 'whisky', 'champagne', 'honey', 'gift box', 'hamper', 'truffle',
                'praline', 'czekolada', 'czekoladki', 'słodycze', 'slodycze', 'cukierki',
                'ciasto', 'ciastka', 'kawa', 'herbata', 'wino', 'szampan', 'miód', 'miod',
                'bombonierka', 'praliny', 'kosz prezentowy',
            ]],
        ];
    }

    /**
     * @param array{name?: ?string, description?: ?string, storeName?: ?string, tags?: list<string>} $input
     * @param list<array{id: string, name: string, slug: string}> $categories
     */
    public static function suggest(array $input, array $categories): ?array
    {
        $name = mb_strtolower((string) ($input['name'] ?? ''));
        $description = mb_strtolower((string) ($input['description'] ?? ''));
        $store = mb_strtolower((string) ($input['storeName'] ?? ''));
        $tags = mb_strtolower(implode(' ', $input['tags'] ?? []));

        $bestSlug = null;
        $bestScore = 0;

        foreach (self::rules() as $rule) {
            $score = 0;
            foreach ($rule['keywords'] as $keyword) {
                $needle = mb_strtolower($keyword);
                if ($name !== '' && str_contains($name, $needle)) {
                    $score += 4;
                }
                if ($tags !== '' && str_contains($tags, $needle)) {
                    $score += 2;
                }
                if ($description !== '' && str_contains($description, $needle)) {
                    $score += 1;
                }
                if ($store !== '' && str_contains($store, $needle)) {
                    $score += 1;
                }
            }
            if ($score > $bestScore) {
                $bestScore = $score;
                $bestSlug = $rule['slug'];
            }
        }

        if ($bestSlug !== null) {
            foreach ($categories as $category) {
                if ($category['slug'] === $bestSlug) {
                    return $category;
                }
            }
        }

        foreach ($categories as $category) {
            if ($category['slug'] === 'other') {
                return $category;
            }
        }

        return $categories[0] ?? null;
    }
}
