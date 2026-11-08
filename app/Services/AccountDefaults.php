<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\App;
use App\Core\Str;

final class AccountDefaults
{
    /**
     * Default categories copied from the Node.js service.
     *
     * @return list<array{name: string, slug: string, color: string, icon: string, sortOrder: int}>
     */
    public static function categories(): array
    {
        return [
            ['name' => 'Jewelry', 'slug' => 'jewelry', 'color' => '#C9A46A', 'icon' => 'Gem', 'sortOrder' => 10],
            ['name' => 'Cosmetics', 'slug' => 'cosmetics', 'color' => '#D9A3B0', 'icon' => 'Sparkles', 'sortOrder' => 20],
            ['name' => 'Fashion', 'slug' => 'fashion', 'color' => '#B7A5C9', 'icon' => 'Shirt', 'sortOrder' => 30],
            ['name' => 'Electronics', 'slug' => 'electronics', 'color' => '#8FAFC4', 'icon' => 'Headphones', 'sortOrder' => 40],
            ['name' => 'Games', 'slug' => 'games', 'color' => '#9DB8A4', 'icon' => 'Gamepad2', 'sortOrder' => 50],
            ['name' => 'Books', 'slug' => 'books', 'color' => '#C4A484', 'icon' => 'BookOpen', 'sortOrder' => 60],
            ['name' => 'Home & Decor', 'slug' => 'home-decor', 'color' => '#B4B8A5', 'icon' => 'Lamp', 'sortOrder' => 70],
            ['name' => 'Flowers', 'slug' => 'flowers', 'color' => '#E0A5A5', 'icon' => 'Flower2', 'sortOrder' => 80],
            ['name' => 'Experiences', 'slug' => 'experiences', 'color' => '#88B7B0', 'icon' => 'Ticket', 'sortOrder' => 90],
            ['name' => 'Food & Sweets', 'slug' => 'food-sweets', 'color' => '#D6A878', 'icon' => 'CakeSlice', 'sortOrder' => 100],
            ['name' => 'Other', 'slug' => 'other', 'color' => '#A8A29E', 'icon' => 'Tag', 'sortOrder' => 110],
        ];
    }

    /**
     * Ensure the account has its settings row and default categories.
     */
    public static function ensure(string $userId): void
    {
        $database = App::db();
        $now = Str::nowMs();

        $database->transaction(static function () use ($database, $userId, $now): void {
            $settings = $database->value('SELECT id FROM "Settings" WHERE userId = ? LIMIT 1', [$userId]);
            if ($settings === null) {
                $database->run(
                    'INSERT INTO "Settings" (userId, currency, autoTrackingEnabled, priceUpdateIntervalMinutes,
                        defaultProductView, createdAt, updatedAt)
                     VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [$userId, 'PLN', 0, 360, 'grid', $now, $now]
                );
            }

            $categoryCount = (int) $database->value('SELECT COUNT(*) FROM "Category" WHERE userId = ?', [$userId]);
            if ($categoryCount > 0) {
                return;
            }

            foreach (self::categories() as $category) {
                $database->run(
                    'INSERT INTO "Category" (id, userId, name, slug, color, icon, sortOrder, isDefault, createdAt, updatedAt)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        Str::id(),
                        $userId,
                        $category['name'],
                        $category['slug'],
                        $category['color'],
                        $category['icon'],
                        $category['sortOrder'],
                        1,
                        $now,
                        $now,
                    ]
                );
            }
        });
    }
}
