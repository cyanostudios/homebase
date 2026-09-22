<?php

declare(strict_types=1);

require_once __DIR__ . '/security_headers.php';
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/branding_helpers.php';

/**
 * Public Clubdesk org branding (name + logo from Account Profile).
 */

applyPublicAppSecurityHeaders('json');
header('Content-Type: application/json; charset=utf-8');

function respond(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

applyCors();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respond(405, ['error' => 'Method not allowed']);
}

respond(200, publicAppFetchBranding());
