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

if ($uriPath === '/item' || str_starts_with($uriPath, '/item/')) {
    require __DIR__ . '/item.php';
    return true;
}

// SPA listing paths — serve index.html (real URLs, not hash).
if (
    preg_match('#^/(alla|info)/?$#', $uriPath) === 1
    || preg_match('#^/kategori/[^/]+/?$#', $uriPath) === 1
) {
    require_once __DIR__ . '/api/security_headers.php';
    applyPublicAppSecurityHeaders('html');
    readfile(__DIR__ . '/index.html');
    return true;
}

require_once __DIR__ . '/api/security_headers.php';
applyPublicAppSecurityHeaders('html');
readfile(__DIR__ . '/index.html');
return true;
