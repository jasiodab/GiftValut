<?php

declare(strict_types=1);

namespace App\Core;

final class Router
{
    /** @var array<int, array{method: string, regex: string, params: list<string>, handler: callable|array}> */
    private array $routes = [];
    private Request $request;

    public function __construct(Request $request)
    {
        $this->request = $request;
    }

    public function get(string $pattern, callable|array $handler): void
    {
        $this->add('GET', $pattern, $handler);
    }

    public function post(string $pattern, callable|array $handler): void
    {
        $this->add('POST', $pattern, $handler);
    }

    public function patch(string $pattern, callable|array $handler): void
    {
        $this->add('PATCH', $pattern, $handler);
    }

    public function delete(string $pattern, callable|array $handler): void
    {
        $this->add('DELETE', $pattern, $handler);
    }

    public function add(string $method, string $pattern, callable|array $handler): void
    {
        $params = [];
        $regex = preg_replace_callback(
            '/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/',
            static function (array $matches) use (&$params): string {
                $params[] = $matches[1];
                return '(?P<' . $matches[1] . '>[^/]+)';
            },
            $pattern
        ) ?? $pattern;

        $this->routes[] = [
            'method' => strtoupper($method),
            'regex' => '#^' . $regex . '$#',
            'params' => $params,
            'handler' => $handler,
        ];
    }

    public function dispatch(): Response
    {
        foreach ($this->routes as $route) {
            if ($route['method'] !== $this->request->method) {
                continue;
            }
            if (!preg_match($route['regex'], $this->request->path, $matches)) {
                continue;
            }

            $arguments = [];
            foreach ($route['params'] as $name) {
                $arguments[] = rawurldecode((string) ($matches[$name] ?? ''));
            }

            $handler = $route['handler'];
            if (is_array($handler) && isset($handler[0], $handler[1]) && is_string($handler[0])) {
                $class = $handler[0];
                $method = $handler[1];
                $controller = new $class($this->request);
                $result = $controller->{$method}(...$arguments);
            } else {
                $result = $handler($this->request, ...$arguments);
            }

            if ($result instanceof Response) {
                return $result;
            }
            if (is_array($result) || is_object($result)) {
                return Response::json($result);
            }
            return Response::text((string) $result);
        }

        throw new HttpException(404, 'The requested page was not found.', 'NOT_FOUND');
    }
}
