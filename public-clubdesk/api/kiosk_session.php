<?php

declare(strict_types=1);

require_once __DIR__ . '/security_headers.php';
require_once __DIR__ . '/kiosk_gate.php';

/**
 * Opens the kiosk staff gate. Sets an HttpOnly cookie. Does not echo the secret.
 */

applyPublicAppSecurityHeaders('json');
header('Content-Type: application/json; charset=utf-8');

function respond(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['error' => 'Method not allowed']);
}

if (!kioskSameOriginAllowed()) {
    respond(403, ['error' => 'Same-origin request required']);
}

$raw = file_get_contents('php://input');
if (!is_string($raw) || strlen($raw) > 4096) {
    respond(400, ['error' => 'Invalid body']);
}
$body = json_decode($raw, true);
if (!is_array($body) || !is_string($body['secret'] ?? null)) {
    respond(401, ['error' => 'Staff sign-in required']);
}

$secret = kioskStaffSecret();
if (!kioskStaffGateOpen($secret)) {
    respond(503, ['error' => 'Staff gate is not configured']);
}

$presented = $body['secret'];
if (strlen($presented) > 512 || !hash_equals($secret, $presented)) {
    respond(401, ['error' => 'Staff sign-in required']);
}

$now = time();
$expiry = $now + KIOSK_STAFF_TTL_SECONDS;
kioskStaffSetCookie(kioskStaffIssueCookie($now, $secret), $expiry);
http_response_code(204);
exit;
