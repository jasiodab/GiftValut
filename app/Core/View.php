<?php

declare(strict_types=1);

namespace App\Core;

final class View
{
    public static function render(string $template, array $data = [], ?string $layout = 'layout'): Response
    {
        $views = (string) App::config('paths.views');
        $viewPath = $views . '/' . $template . '.php';
        if (!is_file($viewPath)) {
            throw new HttpException(500, 'View not found: ' . $template, 'VIEW_NOT_FOUND');
        }

        $data = array_merge([
            'user' => Auth::user(),
            'flash' => Flash::pull(),
            'title' => (string) App::config('app.name'),
            'activeNav' => '',
        ], $data);

        $content = self::capture($viewPath, $data);

        if ($layout === null) {
            return Response::html($content);
        }

        $layoutPath = $views . '/' . $layout . '.php';
        if (!is_file($layoutPath)) {
            throw new HttpException(500, 'Layout not found: ' . $layout, 'VIEW_NOT_FOUND');
        }

        $data['content'] = $content;
        return Response::html(self::capture($layoutPath, $data));
    }

    public static function capture(string $path, array $data): string
    {
        extract($data, EXTR_SKIP);
        ob_start();
        try {
            require $path;
        } finally {
            $output = ob_get_clean();
        }
        return $output === false ? '' : $output;
    }

    public static function partial(string $template, array $data = []): string
    {
        $path = (string) App::config('paths.views') . '/' . $template . '.php';
        if (!is_file($path)) {
            return '';
        }
        return self::capture($path, array_merge(['user' => Auth::user()], $data));
    }
}
