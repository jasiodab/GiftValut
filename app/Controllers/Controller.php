<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;

abstract class Controller
{
    protected Request $request;

    public function __construct(Request $request)
    {
        $this->request = $request;
    }

    protected function jsonInput(): array
    {
        return is_array($this->request->body) ? $this->request->body : [];
    }
}
