<?php
declare(strict_types=1);

$uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$docRoot = rtrim($_SERVER['DOCUMENT_ROOT'] ?? __DIR__, '/');
$targetPath = realpath($docRoot . $uriPath);

// Let built-in server serve existing files directly.
if ($uriPath !== '/' && $targetPath !== false && str_starts_with($targetPath, $docRoot) && is_file($targetPath)) {
    return false;
}

if ($uriPath === '/cup' || str_starts_with($uriPath, '/cup/')) {
    require __DIR__ . '/cup.php';
    return true;
}

// Fallback to index shell for non-file routes.
require __DIR__ . '/index.html';
return true;
