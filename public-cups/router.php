<?php
declare(strict_types=1);

$uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$docRoot = rtrim($_SERVER['DOCUMENT_ROOT'] ?? __DIR__, '/');
$targetPath = realpath($docRoot . $uriPath);

// Let built-in server serve existing static files directly (no PHP processing).
if ($uriPath !== '/' && $targetPath !== false && str_starts_with($targetPath, $docRoot) && is_file($targetPath)) {
    return false;
}

if ($uriPath === '/sitemap.xml') {
    require __DIR__ . '/api/sitemap.php';
    return true;
}

if ($uriPath === '/cup' || str_starts_with($uriPath, '/cup/')) {
    // cup.php applies its own security headers.
    require __DIR__ . '/cup.php';
    return true;
}

// Fallback: serve the index.html SPA shell — apply HTTP security headers first.
require_once __DIR__ . '/api/security_headers.php';
applyPublicCupsSecurityHeaders('html');
readfile(__DIR__ . '/index.html');
return true;
