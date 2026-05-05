<?php
declare(strict_types=1);

require_once __DIR__ . '/pdo_env.php';
require_once __DIR__ . '/security_headers.php';

applyPublicCupsSecurityHeaders('json');
header('Content-Type: application/json; charset=utf-8');

function respond(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function getAllowedOrigins(): array
{
    $raw = getenv('CUPS_ALLOWED_ORIGINS') ?: '';
    if ($raw === '') {
        return [];
    }
    return array_values(array_filter(array_map('trim', explode(',', $raw))));
}

function applyCors(): void
{
    $allowedOrigins = getAllowedOrigins();
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
    }
}

function ratingsPayload(PDO $pdo, int $cupId): array
{
    $summaryStmt = $pdo->prepare(
        "SELECT COUNT(*)::int AS count, ROUND(COALESCE(AVG(rating), 0)::numeric, 1) AS avg
         FROM cup_ratings
         WHERE cup_id = :cup_id",
    );
    $summaryStmt->execute(['cup_id' => $cupId]);
    $summary = $summaryStmt->fetch() ?: ['count' => 0, 'avg' => 0];

    $distribution = ['1' => 0, '2' => 0, '3' => 0, '4' => 0, '5' => 0];
    $distStmt = $pdo->prepare(
        "SELECT rating, COUNT(*)::int AS count
         FROM cup_ratings
         WHERE cup_id = :cup_id
         GROUP BY rating",
    );
    $distStmt->execute(['cup_id' => $cupId]);
    foreach ($distStmt->fetchAll() as $row) {
        $key = (string) ((int) ($row['rating'] ?? 0));
        if (array_key_exists($key, $distribution)) {
            $distribution[$key] = (int) ($row['count'] ?? 0);
        }
    }

    $ratingsStmt = $pdo->prepare(
        "SELECT id, reviewer_name, reviewer_role, reviewer_club, reviewer_class, rating, comment, created_at
         FROM cup_ratings
         WHERE cup_id = :cup_id
         ORDER BY created_at DESC
         LIMIT 100",
    );
    $ratingsStmt->execute(['cup_id' => $cupId]);
    $ratings = array_map(
        static function (array $row): array {
            return [
                'id' => (int) $row['id'],
                'reviewer_name' => (string) ($row['reviewer_name'] ?? ''),
                'reviewer_role' => $row['reviewer_role'] ?? null,
                'reviewer_club' => $row['reviewer_club'] ?? null,
                'reviewer_class' => $row['reviewer_class'] ?? null,
                'rating' => (int) ($row['rating'] ?? 0),
                'comment' => $row['comment'] ?? null,
                'created_at' => $row['created_at'] ?? null,
            ];
        },
        $ratingsStmt->fetchAll(),
    );

    return [
        'avg' => (float) ($summary['avg'] ?? 0),
        'count' => (int) ($summary['count'] ?? 0),
        'distribution' => $distribution,
        'ratings' => $ratings,
    ];
}

applyCors();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $pdo = getPdoFromEnv();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $cupId = (int) ($_GET['cup_id'] ?? 0);
        if ($cupId < 1) {
            respond(400, ['error' => 'cup_id is required']);
        }
        respond(200, ratingsPayload($pdo, $cupId));
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(405, ['error' => 'Method not allowed']);
    }

    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody ?: '{}', true);
    if (!is_array($payload)) {
        respond(400, ['error' => 'Invalid JSON body']);
    }

    $cupId = (int) ($payload['cup_id'] ?? 0);
    $reviewerName = trim((string) ($payload['reviewer_name'] ?? ''));
    $reviewerRole = trim((string) ($payload['reviewer_role'] ?? ''));
    $reviewerClub = trim((string) ($payload['reviewer_club'] ?? ''));
    $reviewerClass = trim((string) ($payload['reviewer_class'] ?? ''));
    $rating = (int) ($payload['rating'] ?? 0);
    $comment = trim((string) ($payload['comment'] ?? ''));

    if ($cupId < 1) {
        respond(400, ['error' => 'cup_id is required']);
    }
    if ($reviewerName === '' || mb_strlen($reviewerName) > 100) {
        respond(400, ['error' => 'reviewer_name is required and max 100 chars']);
    }
    if ($reviewerRole !== '' && mb_strlen($reviewerRole) > 100) {
        respond(400, ['error' => 'reviewer_role max 100 chars']);
    }
    if ($reviewerClub !== '' && mb_strlen($reviewerClub) > 120) {
        respond(400, ['error' => 'reviewer_club max 120 chars']);
    }
    if ($reviewerClass !== '' && mb_strlen($reviewerClass) > 40) {
        respond(400, ['error' => 'reviewer_class max 40 chars']);
    }
    if ($rating < 1 || $rating > 5) {
        respond(400, ['error' => 'rating must be between 1 and 5']);
    }
    if ($comment !== '' && mb_strlen($comment) > 3000) {
        respond(400, ['error' => 'comment max 3000 chars']);
    }

    $cupStmt = $pdo->prepare('SELECT id FROM cups WHERE id = :id AND COALESCE(visible, TRUE) = TRUE LIMIT 1');
    $cupStmt->execute(['id' => $cupId]);
    if (!$cupStmt->fetch()) {
        respond(404, ['error' => 'Cup not found']);
    }

    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    if (!isset($_SESSION['cup_rating_cooldown']) || !is_array($_SESSION['cup_rating_cooldown'])) {
        $_SESSION['cup_rating_cooldown'] = [];
    }

    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $cooldownKey = $cupId . '|' . $ip;
    $now = time();
    $cooldownSeconds = 24 * 60 * 60;
    $last = (int) ($_SESSION['cup_rating_cooldown'][$cooldownKey] ?? 0);
    if ($last > 0 && ($now - $last) < $cooldownSeconds) {
        respond(429, ['error' => 'You can only rate this cup once every 24 hours']);
    }

    $insertStmt = $pdo->prepare(
        "INSERT INTO cup_ratings (cup_id, reviewer_name, reviewer_role, reviewer_club, reviewer_class, rating, comment)
         VALUES (:cup_id, :reviewer_name, :reviewer_role, :reviewer_club, :reviewer_class, :rating, :comment)",
    );
    $insertStmt->execute([
        'cup_id' => $cupId,
        'reviewer_name' => $reviewerName,
        'reviewer_role' => $reviewerRole !== '' ? $reviewerRole : null,
        'reviewer_club' => $reviewerClub !== '' ? $reviewerClub : null,
        'reviewer_class' => $reviewerClass !== '' ? $reviewerClass : null,
        'rating' => $rating,
        'comment' => $comment !== '' ? $comment : null,
    ]);

    $_SESSION['cup_rating_cooldown'][$cooldownKey] = $now;
    respond(201, ratingsPayload($pdo, $cupId));
} catch (Throwable $e) {
    $debug = filter_var(getenv('CUPS_DEBUG_ERRORS') ?: '0', FILTER_VALIDATE_BOOLEAN);
    if ($debug) {
        respond(500, ['error' => 'Ratings API failed', 'details' => $e->getMessage()]);
    }
    respond(500, ['error' => 'Ratings API failed']);
}
