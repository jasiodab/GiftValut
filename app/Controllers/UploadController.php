<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\App;
use App\Core\HttpException;
use App\Core\Response;
use App\Middleware\AuthMiddleware;
use App\Services\Images;
use Throwable;

final class UploadController extends Controller
{
    public function image(): Response
    {
        $user = AuthMiddleware::user($this->request);
        $file = $this->request->file('image');

        if ($file === null) {
            throw new HttpException(400, 'Choose an image to upload.', 'NO_IMAGE');
        }

        $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error !== UPLOAD_ERR_OK) {
            $message = in_array($error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)
                ? 'The image is larger than the 2 MB limit.'
                : 'The image could not be uploaded.';
            throw new HttpException(400, $message, 'INVALID_IMAGE');
        }

        $tmpName = (string) ($file['tmp_name'] ?? '');
        $size = (int) ($file['size'] ?? 0);
        $maxBytes = (int) App::config('uploads.max_bytes', 2 * 1024 * 1024);

        if ($tmpName === '' || !is_file($tmpName)) {
            throw new HttpException(400, 'Choose an image to upload.', 'NO_IMAGE');
        }
        if ($size <= 0 || $size > $maxBytes) {
            throw new HttpException(400, 'The image is larger than the 2 MB limit.', 'INVALID_IMAGE');
        }

        $bytes = @file_get_contents($tmpName);
        if (!is_string($bytes) || $bytes === '') {
            throw new HttpException(400, 'The image file is empty.', 'INVALID_IMAGE');
        }

        try {
            $saved = Images::saveBuffer($bytes, (string) $user['id'], (string) ($file['type'] ?? ''));
        } catch (Throwable $exception) {
            throw new HttpException(400, $exception->getMessage() !== '' ? $exception->getMessage() : 'The image could not be saved.', 'INVALID_IMAGE');
        }

        return Response::json([
            'imagePath' => $saved['path'],
            'mimeType' => $saved['mimeType'],
        ], 201);
    }
}
