<?php

declare(strict_types=1);

require_once __DIR__ . '/pdo_env.php';
require_once __DIR__ . '/db_helpers.php';
require_once __DIR__ . '/security_headers.php';
require_once __DIR__ . '/kiosk_gate.php';

/**
 * Set stock for one variant on a published Clubdesk article.
 * Writes clubdesk_inventory_variants.quantity, the same column admin reads.
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

// Staff cookie gate paused while developing stock UX. Re-enable with kiosk_gate.php before release.
// See docs/ai/adr/CLUBDESK_KIOSK_STAFF_GATE.md.

$raw = file_get_contents('php://input');
if (!is_string($raw) || strlen($raw) > 4096) {
    respond(400, ['error' => 'Invalid body']);
}
$body = json_decode($raw, true);
if (!is_array($body)) {
    respond(400, ['error' => 'Invalid body']);
}

$slug = strtolower(trim((string) ($body['slug'] ?? '')));
if (!preg_match('/^[a-z0-9-]{1,120}$/', $slug)) {
    respond(400, ['error' => 'Invalid slug']);
}

$quantityRaw = $body['quantity'] ?? null;
if (is_string($quantityRaw) && preg_match('/^\d+$/', $quantityRaw)) {
    $quantityRaw = (int) $quantityRaw;
}
if (!is_int($quantityRaw) || $quantityRaw < 0 || $quantityRaw > 1000000) {
    respond(400, ['error' => 'quantity must be an integer from 0 to 1000000']);
}
$quantity = $quantityRaw;

$variantRaw = $body['variantId'] ?? 0;
if (is_string($variantRaw) && preg_match('/^\d+$/', $variantRaw)) {
    $variantRaw = (int) $variantRaw;
}
if (!is_int($variantRaw) || $variantRaw < 0) {
    respond(400, ['error' => 'Invalid variant']);
}
$variantId = $variantRaw;

try {
    if (!extension_loaded('pdo_pgsql')) {
        throw new RuntimeException('PHP extension pdo_pgsql is not loaded');
    }

    $pdo = getPdoFromEnv();
    $pdo->beginTransaction();

    $itemStmt = $pdo->prepare(
        "SELECT id
         FROM clubdesk_inventory_items
         WHERE lower(slug) = lower(?)
           AND publication_status = 'published'
           AND archived_at IS NULL
         LIMIT 1
         FOR UPDATE",
    );
    $itemStmt->execute([$slug]);
    $itemId = $itemStmt->fetchColumn();
    if (!$itemId) {
        $pdo->rollBack();
        respond(404, ['error' => 'Inventory item not found']);
    }
    $itemId = (int) $itemId;

    $savedVariantId = $variantId;
    if ($variantId > 0) {
        $update = $pdo->prepare(
            'UPDATE clubdesk_inventory_variants
             SET quantity = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND item_id = ?
             RETURNING id',
        );
        $update->execute([$quantity, $variantId, $itemId]);
        $savedVariantId = (int) $update->fetchColumn();
        if ($savedVariantId <= 0) {
            $pdo->rollBack();
            respond(404, ['error' => 'Variant not found']);
        }
    } else {
        $blank = $pdo->prepare(
            "SELECT id
             FROM clubdesk_inventory_variants
             WHERE item_id = ?
               AND btrim(audience) = ''
               AND btrim(color) = ''
               AND btrim(size) = ''
             ORDER BY id ASC
             LIMIT 1
             FOR UPDATE",
        );
        $blank->execute([$itemId]);
        $blankId = $blank->fetchColumn();
        if ($blankId) {
            $savedVariantId = (int) $blankId;
            $update = $pdo->prepare(
                'UPDATE clubdesk_inventory_variants
                 SET quantity = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND item_id = ?',
            );
            $update->execute([$quantity, $savedVariantId, $itemId]);
        } else {
            $hasGtin = publicAppTableHasColumn($pdo, 'clubdesk_inventory_variants', 'gtin');
            if ($hasGtin) {
                $insert = $pdo->prepare(
                    'INSERT INTO clubdesk_inventory_variants
                       (item_id, sku, gtin, audience, color, size, quantity, sort_order)
                     VALUES (?, \'\', \'\', \'\', \'\', \'\', ?, 0)
                     RETURNING id',
                );
            } else {
                $insert = $pdo->prepare(
                    'INSERT INTO clubdesk_inventory_variants
                       (item_id, sku, audience, color, size, quantity, sort_order)
                     VALUES (?, \'\', \'\', \'\', \'\', ?, 0)
                     RETURNING id',
                );
            }
            $insert->execute([$itemId, $quantity]);
            $savedVariantId = (int) $insert->fetchColumn();
        }
    }

    $touch = $pdo->prepare(
        'UPDATE clubdesk_inventory_items SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    );
    $touch->execute([$itemId]);

    $totalStmt = $pdo->prepare(
        'SELECT COALESCE(SUM(quantity), 0)::int FROM clubdesk_inventory_variants WHERE item_id = ?',
    );
    $totalStmt->execute([$itemId]);
    $total = (int) $totalStmt->fetchColumn();

    $pdo->commit();

    respond(200, [
        'variantId' => $savedVariantId,
        'quantity' => $quantity,
        'totalQuantity' => $total,
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    $debug = filter_var(getenv('APP_DEBUG_ERRORS') ?: '0', FILTER_VALIDATE_BOOLEAN);
    if ($debug) {
        respond(500, ['error' => 'Failed to update stock', 'details' => $e->getMessage()]);
    }
    respond(500, ['error' => 'Failed to update stock']);
}
