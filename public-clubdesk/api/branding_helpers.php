<?php

declare(strict_types=1);

/**
 * Org branding (name + logoUrl) from Account Profile
 * (Settings → Profile / main-DB tenants.organization).
 *
 * Resolution order:
 * 1. Direct main-DB Account Profile (APP_MAIN_DATABASE_URL, or local DATABASE_URL when APP_DB_URL unset)
 * 2. Homebase Node GET /api/public/clubdesk/branding (APP_HOMEBASE_API_URL) — typical Railway
 * 3. APP_ORG_NAME / APP_ORG_LOGO_URL
 * 4. Placeholder "Clubdesk"
 *
 * @return array{name: string, logoUrl: string}
 */
function publicAppFetchBranding(): array
{
    $fallback = ['name' => 'Clubdesk', 'logoUrl' => ''];

    $cacheTtl = (int) (getenv('APP_CACHE_TTL') ?: 0);
    $cacheEnabled =
        $cacheTtl > 0 &&
        function_exists('apcu_fetch') &&
        filter_var(ini_get('apc.enabled'), FILTER_VALIDATE_BOOLEAN);
    $cacheKey = 'public_clubdesk_branding_v1';

    if ($cacheEnabled) {
        $cached = apcu_fetch($cacheKey, $ok);
        if ($ok && is_array($cached) && isset($cached['name'])) {
            return [
                'name' => (string) ($cached['name'] ?? 'Clubdesk'),
                'logoUrl' => (string) ($cached['logoUrl'] ?? ''),
            ];
        }
    }

    $fromDb = publicAppFetchBrandingFromAccountProfileDb();
    $fromApi = $fromDb === null ? publicAppFetchBrandingFromHomebaseApi() : null;
    $resolved = $fromDb ?? $fromApi;

    if ($resolved === null) {
        $envName = trim((string) (getenv('APP_ORG_NAME') ?: ''));
        $envLogo = trim((string) (getenv('APP_ORG_LOGO_URL') ?: ''));
        if ($envLogo !== '' && preg_match('#^https?://#i', $envLogo) !== 1) {
            $envLogo = '';
        }
        $resolved = [
            'name' => $envName !== '' ? $envName : 'Clubdesk',
            'logoUrl' => $envLogo,
        ];
    }

    $name = trim((string) ($resolved['name'] ?? ''));
    $logoUrl = trim((string) ($resolved['logoUrl'] ?? ''));
    if ($logoUrl !== '' && preg_match('#^https?://#i', $logoUrl) !== 1) {
        $logoUrl = '';
    }

    $payload = [
        'name' => $name !== '' ? $name : 'Clubdesk',
        'logoUrl' => $logoUrl,
    ];

    if ($cacheEnabled) {
        apcu_store($cacheKey, $payload, $cacheTtl);
    }

    return $payload;
}

/**
 * Proxy Homebase public branding endpoint.
 *
 * @return array{name: string, logoUrl: string}|null
 */
function publicAppFetchBrandingFromHomebaseApi(): ?array
{
    $base = rtrim((string) (getenv('APP_HOMEBASE_API_URL') ?: ''), '/');
    if ($base === '') {
        return null;
    }

    // Only http(s) bases; no open redirect follow (SSRF surface reduction).
    if (preg_match('#^https?://#i', $base) !== 1) {
        return null;
    }

    $url = $base . '/api/public/clubdesk/branding';
    $raw = null;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        if ($ch !== false) {
            $curlOpts = [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_CONNECTTIMEOUT => 2,
                CURLOPT_TIMEOUT => 4,
                CURLOPT_HTTPHEADER => ['Accept: application/json'],
            ];
            if (defined('CURLPROTO_HTTP') && defined('CURLPROTO_HTTPS')) {
                $curlOpts[CURLOPT_PROTOCOLS] = CURLPROTO_HTTP | CURLPROTO_HTTPS;
                $curlOpts[CURLOPT_REDIR_PROTOCOLS] = 0;
            }
            curl_setopt_array($ch, $curlOpts);
            $raw = curl_exec($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            // PHP 8.5+: curl_close() is deprecated / no-op; handle auto-closes.
            unset($ch);
            if ($status < 200 || $status >= 300) {
                $raw = null;
            }
        }
    } else {
        $ctx = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 4,
                'follow_location' => 0,
                'max_redirects' => 0,
                'header' => "Accept: application/json\r\n",
            ],
        ]);
        $raw = @file_get_contents($url, false, $ctx);
    }

    if (!is_string($raw) || $raw === '') {
        return null;
    }

    $parsed = json_decode($raw, true);
    if (!is_array($parsed)) {
        return null;
    }

    return [
        'name' => trim((string) ($parsed['name'] ?? '')),
        'logoUrl' => trim((string) ($parsed['logoUrl'] ?? '')),
    ];
}

/**
 * Read Account Profile org name/logo from main DB tenants.organization.
 * Used locally (shared DATABASE_URL) and when APP_MAIN_DATABASE_URL is set.
 * Skipped when only tenant APP_DB_URL is available (typical Railway public service).
 *
 * @return array{name: string, logoUrl: string}|null
 */
function publicAppFetchBrandingFromAccountProfileDb(): ?array
{
    $rawId = trim((string) (getenv('PUBLIC_CLUBDESK_USER_ID') ?: ''));
    if ($rawId === '' || !ctype_digit($rawId) || (int) $rawId < 1) {
        return null;
    }
    $userId = (int) $rawId;

    $mainUrl = trim((string) (getenv('APP_MAIN_DATABASE_URL') ?: ''));
    $appDbUrl = trim((string) (getenv('APP_DB_URL') ?: ''));
    if ($mainUrl === '' && $appDbUrl === '') {
        // Local PHP -S: DATABASE_URL is main and includes tenants.organization.
        $mainUrl = trim((string) (getenv('DATABASE_URL') ?: ''));
    }
    if ($mainUrl === '') {
        return null;
    }

    if (!function_exists('parsePgUrl')) {
        require_once __DIR__ . '/pdo_env.php';
    }

    try {
        $c = parsePgUrl($mainUrl);
        if ($c['host'] === 'localhost' || $c['host'] === '127.0.0.1') {
            $c['sslmode'] = 'disable';
        }
        $dsn = sprintf(
            'pgsql:host=%s;port=%d;dbname=%s;sslmode=%s',
            $c['host'],
            (int) $c['port'],
            $c['dbName'],
            $c['sslmode'],
        );
        $pdo = new PDO(
            $dsn,
            $c['user'] !== '' ? $c['user'] : null,
            $c['pass'] !== '' ? $c['pass'] : null,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_TIMEOUT => 4,
            ],
        );

        $stmt = $pdo->prepare(
            'SELECT organization
             FROM tenants
             WHERE user_id = :uid OR owner_user_id = :uid
             ORDER BY id ASC
             LIMIT 1',
        );
        $stmt->execute(['uid' => $userId]);
        $row = $stmt->fetch();
        if (!$row || !isset($row['organization'])) {
            return null;
        }

        $org = $row['organization'];
        if (is_string($org)) {
            $org = json_decode($org, true);
        }
        if (!is_array($org)) {
            return null;
        }

        return [
            'name' => trim((string) ($org['name'] ?? '')),
            'logoUrl' => trim((string) ($org['logoUrl'] ?? '')),
        ];
    } catch (Throwable $e) {
        return null;
    }
}

/**
 * Safe attribute escape.
 */
function publicAppBrandH(?string $value): string
{
    return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/**
 * Echo sticky org brand top-bar (logo + name from Account Profile).
 *
 * @param array{name?: string, logoUrl?: string}|null $branding
 */
function publicAppRenderTopBar(?array $branding = null): void
{
    $branding = $branding ?? publicAppFetchBranding();
    $name = trim((string) ($branding['name'] ?? ''));
    if ($name === '') {
        $name = 'Clubdesk';
    }
    $logoUrl = trim((string) ($branding['logoUrl'] ?? ''));
    if ($logoUrl !== '' && preg_match('#^https?://#i', $logoUrl) !== 1) {
        $logoUrl = '';
    }
    $initial = mb_strtoupper(mb_substr($name, 0, 1));
    ?>
      <header class="top-bar" data-testid="org-brand-header">
        <div class="top-bar__inner">
          <a class="brand" href="/" aria-label="<?= publicAppBrandH($name) ?> startsida">
<?php if ($logoUrl !== ''): ?>
            <img
              class="brand__logo"
              src="<?= publicAppBrandH($logoUrl) ?>"
              alt="<?= publicAppBrandH($name) ?>"
              width="120"
              height="40"
              decoding="async"
            />
            <span class="brand__text">
              <span class="brand__title"><?= publicAppBrandH($name) ?></span>
            </span>
<?php else: ?>
            <span class="brand__mark" aria-hidden="true"><?= publicAppBrandH($initial) ?></span>
            <span class="brand__text">
              <span class="brand__title"><?= publicAppBrandH($name) ?></span>
            </span>
<?php endif; ?>
          </a>
        </div>
      </header>
    <?php
}
