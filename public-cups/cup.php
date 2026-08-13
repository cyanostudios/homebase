<?php
declare(strict_types=1);

require_once __DIR__ . '/api/pdo_env.php';
require_once __DIR__ . '/api/url_helpers.php';
require_once __DIR__ . '/api/security_headers.php';
applyPublicCupsSecurityHeaders('html');

function h(?string $value): string
{
    return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES, 'UTF-8');
}

function siteBaseUrl(): string
{
    $raw = trim((string) (getenv('CUPS_PUBLIC_SITE_URL') ?: 'https://www.cupappen.se'));
    return rtrim($raw !== '' ? $raw : 'https://www.cupappen.se', '/');
}

/** Absolut bild-/resurslänk för OG/JSON-LD (hanterar /relativa vägar mot site base). */
function absolutePublicUrl(string $baseUrl, string $url): string
{
    $url = trim($url);
    if ($url === '') {
        return '';
    }
    if (str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) {
        return $url;
    }
    if (str_starts_with($url, '//')) {
        return 'https:' . $url;
    }
    $baseUrl = rtrim($baseUrl, '/');
    if (str_starts_with($url, '/')) {
        return $baseUrl . $url;
    }

    return $url;
}

function truncateMetaDescription(string $text, int $max = 158): string
{
    $t = preg_replace('/\s+/u', ' ', trim($text)) ?? '';
    if ($t === '') {
        return '';
    }
    if (mb_strlen($t) <= $max) {
        return $t;
    }
    $slice = mb_substr($t, 0, $max - 1);
    $lastSpace = mb_strrpos($slice, ' ');
    if ($lastSpace !== false && $lastSpace > 40) {
        $slice = mb_substr($slice, 0, $lastSpace);
    }

    return rtrim($slice, ',.;:–—- ') . '…';
}

/** Ta bort null ur JSON-LD-arrayer (läsbar för LLMs/sökmotorer). */
function jsonLdStripNulls(mixed $v): mixed
{
    if (is_array($v)) {
        $out = [];
        foreach ($v as $k => $item) {
            $clean = jsonLdStripNulls($item);
            if ($clean === null) {
                continue;
            }
            if (is_array($clean)) {
                if ($clean === []) {
                    continue;
                }
            }
            $out[$k] = $clean;
        }

        return $out;
    }

    return $v;
}

function normalizeText(?string $value): string
{
    return trim(html_entity_decode((string) ($value ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
}

function slugify(string $value): string
{
    $v = mb_strtolower(trim($value), 'UTF-8');
    $replacements = [
        'å' => 'a',
        'ä' => 'a',
        'ö' => 'o',
        'é' => 'e',
        'è' => 'e',
        'ü' => 'u',
    ];
    $v = strtr($v, $replacements);
    $v = preg_replace('/[^a-z0-9]+/u', '-', $v) ?? '';
    return trim($v, '-') ?: 'cup';
}

function cupYear(array $cup): ?int
{
    $raw = (string) ($cup['start_date'] ?? $cup['end_date'] ?? '');
    if ($raw === '') {
        return null;
    }
    $ts = strtotime($raw);
    if ($ts === false) {
        return null;
    }
    return (int) date('Y', $ts);
}

function cupPrettySlug(array $cup): string
{
    $base = slugify((string) ($cup['name'] ?? 'cup'));
    $year = cupYear($cup);
    return $year ? ($base . '-' . $year) : $base;
}

/** District path segment for a cup (empty source → ovrigt). */
function cupDistrictSlug(array $cup): string
{
    $name = normalizeText((string) ($cup['ingest_source_name'] ?? ''));
    if ($name === '') {
        return 'ovrigt';
    }

    return slugify($name);
}

/** Canonical cup path: /{district}/{name}-{year} */
function cupCanonicalPath(array $cup): string
{
    return '/' . cupDistrictSlug($cup) . '/' . cupPrettySlug($cup);
}

/** First path segments that must never be treated as district names. */
function cupReservedDistrictSegments(): array
{
    return [
        'api',
        'assets',
        'cup',
        'lib',
        'favicon.ico',
        'favicon.svg',
        'index.html',
        'llms.txt',
        'robots.txt',
        'sitemap.xml',
        'styles.css',
        'app.js',
        'cupappen-cup-detail.css',
        'cup.php',
        'sok',
        'kommande',
        'alla',
        'info',
        'distrikt',
    ];
}

/**
 * @return array{legacyId:?int,slug:string,slugYear:?int,districtSlug:?string,legacyCupPrefix:bool}|null
 */
function parseCupPath(): ?array
{
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

    if (preg_match('#^/cup/(\d+)(?:-([a-z0-9-]+))?/?$#i', $path, $matches)) {
        return [
            'legacyId' => (int) $matches[1],
            'slug' => $matches[2] ?? '',
            'slugYear' => null,
            'districtSlug' => null,
            'legacyCupPrefix' => true,
        ];
    }
    /** Måste testas innan ”slug-only” så `/cup/foo-2026` blir slug+år — inte år saknas. */
    if (preg_match('#^/cup/([a-z0-9-]+?)-(\d{4})/?$#i', $path, $matches)) {
        return [
            'legacyId' => null,
            'slug' => strtolower((string) $matches[1]),
            'slugYear' => (int) $matches[2],
            'districtSlug' => null,
            'legacyCupPrefix' => true,
        ];
    }
    if (preg_match('#^/cup/([a-z0-9-]+)/?$#i', $path, $matches)) {
        return [
            'legacyId' => null,
            'slug' => strtolower((string) $matches[1]),
            'slugYear' => null,
            'districtSlug' => null,
            'legacyCupPrefix' => true,
        ];
    }

    if (preg_match('#^/([a-z0-9-]+)/([a-z0-9-]+?)-(\d{4})/?$#i', $path, $matches)) {
        $district = strtolower((string) $matches[1]);
        if (in_array($district, cupReservedDistrictSegments(), true)) {
            return null;
        }

        return [
            'legacyId' => null,
            'slug' => strtolower((string) $matches[2]),
            'slugYear' => (int) $matches[3],
            'districtSlug' => $district,
            'legacyCupPrefix' => false,
        ];
    }
    if (preg_match('#^/([a-z0-9-]+)/([a-z0-9-]+)/?$#i', $path, $matches)) {
        $district = strtolower((string) $matches[1]);
        if (in_array($district, cupReservedDistrictSegments(), true)) {
            return null;
        }

        return [
            'legacyId' => null,
            'slug' => strtolower((string) $matches[2]),
            'slugYear' => null,
            'districtSlug' => $district,
            'legacyCupPrefix' => false,
        ];
    }

    return null;
}

function cupRequestPathNormalized(): string
{
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $path = '/' . trim($path, '/');

    return $path === '/' ? '/' : rtrim($path, '/');
}

/**
 * Flera säsonger med samma namn-slug: först kommande/löpande (tidigast start bland dem), annars senast passerade.
 *
 * @param array<int, array<string, mixed>> $candidates
 */
function pickCupForSharedSlug(array $candidates): ?array
{
    if ($candidates === []) {
        return null;
    }
    if (count($candidates) === 1) {
        return $candidates[0];
    }

    $now = time();
    $ongoingOrUpcoming = [];
    foreach ($candidates as $row) {
        $endRaw = (string) ($row['end_date'] ?? '');
        $startRaw = (string) ($row['start_date'] ?? '');
        $endTs = $endRaw !== '' ? strtotime($endRaw) : false;
        $startTs = $startRaw !== '' ? strtotime($startRaw) : false;
        $compareTs = ($endTs !== false && $endTs > 0) ? $endTs : (($startTs !== false && $startTs > 0) ? $startTs : false);
        if ($compareTs !== false && $compareTs >= $now) {
            $ongoingOrUpcoming[] = $row;
        }
    }
    $pool = $ongoingOrUpcoming !== [] ? $ongoingOrUpcoming : $candidates;
    sortCupsLikeHomepage($pool);

    return $ongoingOrUpcoming !== [] ? $pool[0] : $pool[array_key_last($pool)];
}

function formatDateSv(?string $value): string
{
    if (!$value) {
        return 'Datum saknas';
    }
    $ts = strtotime($value);
    if ($ts === false) {
        return $value;
    }
    static $monthsSv = [
        1 => 'jan',
        2 => 'feb',
        3 => 'mar',
        4 => 'apr',
        5 => 'maj',
        6 => 'jun',
        7 => 'jul',
        8 => 'aug',
        9 => 'sep',
        10 => 'okt',
        11 => 'nov',
        12 => 'dec',
    ];
    $day = (int) date('j', $ts);
    $month = $monthsSv[(int) date('n', $ts)] ?? '';
    $year = date('Y', $ts);

    return $month !== '' ? ($day . ' ' . $month . ' ' . $year) : date('j M Y', $ts);
}

function dateRangeLabel(array $cup): string
{
    $start = $cup['start_date'] ?? null;
    $end = $cup['end_date'] ?? null;
    if (!$start && !$end) {
        return 'Datum saknas';
    }
    $startLabel = $start ? formatDateSv((string) $start) : '';
    $endLabel = $end ? formatDateSv((string) $end) : '';
    if ($startLabel !== '' && $endLabel !== '' && $startLabel !== $endLabel) {
        return $startLabel . ' - ' . $endLabel;
    }
    return $startLabel !== '' ? $startLabel : $endLabel;
}

function splitCategories(?string $categories): array
{
    if (!$categories) {
        return [];
    }
    $parts = array_map(
        static fn($s) => capitalizeBadgeLabel(trim((string) $s)),
        explode(',', $categories),
    );
    return array_values(array_filter($parts, static fn($s) => $s !== ''));
}

/** First character uppercase (UTF-8) for badge labels. */
function capitalizeBadgeLabel(string $value): string
{
    $value = trim($value);
    if ($value === '') {
        return '';
    }
    $first = mb_substr($value, 0, 1, 'UTF-8');
    $rest = mb_substr($value, 1, null, 'UTF-8');

    return mb_strtoupper($first, 'UTF-8') . $rest;
}

/** Samma som startsidans filtrering för “utvalda” (featured). */
function cupIsFeaturedPublic(array $cup): bool
{
    $f = $cup['featured'] ?? false;

    return $f === true || $f === 'true' || $f === 't' || $f === 1 || $f === '1';
}

/** Sortering som i `app.js` compareByDate (närmast i tid först). */
function cupScheduleSortKey(array $cup): int
{
    $raw = (string) ($cup['start_date'] ?? $cup['end_date'] ?? '');
    if ($raw === '') {
        return PHP_INT_MAX;
    }
    $ts = strtotime($raw);

    return $ts === false ? PHP_INT_MAX : $ts;
}

/** @param array<int, array<string, mixed>> $rows */
function sortCupsLikeHomepage(array &$rows): void
{
    usort(
        $rows,
        static function (array $a, array $b): int {
            $cmp = cupScheduleSortKey($a) <=> cupScheduleSortKey($b);
            if ($cmp !== 0) {
                return $cmp;
            }
            $nameCmp = strcmp(
                normalizeText((string) ($a['name'] ?? '')),
                normalizeText((string) ($b['name'] ?? '')),
            );
            if ($nameCmp !== 0) {
                return $nameCmp;
            }

            return ((int) ($a['id'] ?? 0)) <=> ((int) ($b['id'] ?? 0));
        },
    );
}

/**
 * Upcoming for district “next cup” nav (same compare date as past-cup banner).
 *
 * @param array<string, mixed> $cup
 */
function cupIsUpcomingForNav(array $cup): bool
{
    $raw = (string) ($cup['end_date'] ?? $cup['start_date'] ?? '');
    if ($raw === '') {
        return false;
    }
    $ts = strtotime($raw);

    return $ts !== false && $ts >= time();
}

/**
 * Next upcoming cup in the same district (sorted like homepage). Wraps among upcoming only.
 *
 * @param array<string, mixed> $current
 * @param array<int, array<string, mixed>> $districtCups
 * @return array<string, mixed>|null
 */
function nextCupInDistrict(array $current, array $districtCups): ?array
{
    $upcoming = array_values(
        array_filter(
            $districtCups,
            static fn (array $row): bool => cupIsUpcomingForNav($row),
        ),
    );
    if ($upcoming === []) {
        return null;
    }
    sortCupsLikeHomepage($upcoming);
    $currentId = (int) ($current['id'] ?? 0);
    $idx = -1;
    foreach ($upcoming as $i => $row) {
        if ((int) ($row['id'] ?? 0) === $currentId) {
            $idx = $i;
            break;
        }
    }
    if ($idx < 0) {
        return $upcoming[0] ?? null;
    }
    if (count($upcoming) < 2) {
        return null;
    }

    return $upcoming[($idx + 1) % count($upcoming)] ?? null;
}

/**
 * @param array<string, mixed> $current
 * @return array<int, array<string, mixed>>
 */
function fetchDistrictCupsForNav(PDO $pdo, array $current): array
{
    require_once __DIR__ . '/api/db_helpers.php';
    $deletedFilter = publicCupsTableHasColumn($pdo, 'cups', 'deleted_at')
        ? ' AND c.deleted_at IS NULL'
        : '';
    $hasIngest = publicCupsTableHasColumn($pdo, 'cups', 'ingest_source_id');

    $upcomingFilter = ' AND COALESCE(c.end_date, c.start_date) IS NOT NULL'
        . ' AND COALESCE(c.end_date, c.start_date)::timestamp >= NOW()';

    if ($hasIngest) {
        $sourceId = $current['ingest_source_id'] ?? null;
        if ($sourceId === null || $sourceId === '') {
            $sql = "SELECT c.id, c.name, c.start_date, c.end_date, src.name AS ingest_source_name
                    FROM cups c
                    LEFT JOIN ingest_sources src ON src.id = c.ingest_source_id
                    WHERE COALESCE(c.visible, TRUE) = TRUE
                      AND c.ingest_source_id IS NULL
                      {$deletedFilter}
                      {$upcomingFilter}
                    ORDER BY c.start_date ASC NULLS LAST, c.name ASC, c.id ASC";
            $stmt = $pdo->query($sql);
        } else {
            $sql = "SELECT c.id, c.name, c.start_date, c.end_date, src.name AS ingest_source_name
                    FROM cups c
                    LEFT JOIN ingest_sources src ON src.id = c.ingest_source_id
                    WHERE COALESCE(c.visible, TRUE) = TRUE
                      AND c.ingest_source_id = :sid
                      {$deletedFilter}
                      {$upcomingFilter}
                    ORDER BY c.start_date ASC NULLS LAST, c.name ASC, c.id ASC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute(['sid' => (int) $sourceId]);
        }
        $rows = $stmt ? $stmt->fetchAll() : [];
        return array_values(array_filter($rows, static fn ($r) => is_array($r)));
    }

    $districtSlug = cupDistrictSlug($current);
    $sql = "SELECT c.id, c.name, c.start_date, c.end_date, NULL::text AS ingest_source_name
            FROM cups c
            WHERE COALESCE(c.visible, TRUE) = TRUE
              {$deletedFilter}
              {$upcomingFilter}
            ORDER BY c.start_date ASC NULLS LAST, c.name ASC, c.id ASC";
    $stmt = $pdo->query($sql);
    $rows = $stmt ? $stmt->fetchAll() : [];
    return array_values(
        array_filter(
            $rows,
            static function ($r) use ($districtSlug): bool {
                return is_array($r) && cupDistrictSlug($r) === $districtSlug;
            },
        ),
    );
}

function genericImageForCup(array $cup, ?array $pool = null): string
{
    $images = is_array($pool) && $pool !== []
        ? $pool
        : [
            '/assets/fallback/01.jpg',
            '/assets/fallback/02.jpg',
            '/assets/fallback/03.jpg',
            '/assets/fallback/04.jpg',
            '/assets/fallback/05.jpg',
            '/assets/fallback/06.jpg',
            '/assets/fallback/07.jpg',
            '/assets/fallback/08.jpg',
            '/assets/fallback/09.jpg',
            '/assets/fallback/10.jpg',
            '/assets/fallback/11.jpg',
            '/assets/fallback/12.jpg',
            '/assets/fallback/13.jpg',
            '/assets/fallback/14.jpg',
            '/assets/fallback/15.jpg',
            '/assets/fallback/16.jpg',
            '/assets/fallback/17.jpg',
            '/assets/fallback/18.jpg',
            '/assets/fallback/19.jpg',
            '/assets/fallback/20.jpg',
            '/assets/fallback/21.jpg',
            '/assets/fallback/22.jpg',
            '/assets/fallback/23.jpg',
            '/assets/fallback/24.jpg',
            '/assets/fallback/25.jpg',
        ];
    $idPart = trim((string) ($cup['id'] ?? ''));
    $namePart = trim(preg_replace('/\s+/', ' ', (string) ($cup['name'] ?? '')) ?? '');
    $key = ($idPart !== '' ? $idPart : ($namePart !== '' ? $namePart : 'cup'));
    $idx = abs(crc32($key)) % count($images);

    return $images[$idx];
}

/**
 * @return list<string>
 */
function loadFallbackImagePool(PDO $pdo): array
{
    static $cached = null;
    if (is_array($cached)) {
        return $cached;
    }
    $cached = [];
    try {
        $check = $pdo->query(
            "SELECT 1 FROM information_schema.tables
             WHERE table_schema = current_schema()
               AND table_name = 'cups_site_config'
             LIMIT 1",
        );
        if (!$check || !$check->fetchColumn()) {
            return $cached;
        }
        $ownerId = trim((string) (getenv('PUBLIC_CUPS_USER_ID') ?: ''));
        if ($ownerId !== '' && ctype_digit($ownerId)) {
            $stmt = $pdo->prepare(
                "SELECT value FROM cups_site_config
                  WHERE user_id = :uid AND config_key = 'fallback_images'
                  LIMIT 1",
            );
            $stmt->execute(['uid' => (int) $ownerId]);
        } else {
            $stmt = $pdo->query(
                "SELECT value FROM cups_site_config
                  WHERE config_key = 'fallback_images'
                  ORDER BY updated_at DESC
                  LIMIT 1",
            );
        }
        $row = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : false;
        if (!is_array($row)) {
            return $cached;
        }
        $raw = $row['value'] ?? null;
        if (is_string($raw)) {
            $raw = json_decode($raw, true);
        }
        $list = [];
        if (is_array($raw)) {
            if (array_is_list($raw)) {
                $list = $raw;
            } elseif (isset($raw['urls']) && is_array($raw['urls'])) {
                $list = $raw['urls'];
            }
        }
        $out = [];
        $seen = [];
        foreach ($list as $item) {
            $url = trim((string) $item);
            if ($url === '' || !preg_match('#^https?://#i', $url)) {
                continue;
            }
            if (preg_match('#^https?://[^/]+/api/#i', $url)) {
                continue;
            }
            if (isset($seen[$url])) {
                continue;
            }
            $seen[$url] = true;
            $out[] = $url;
        }
        $cached = $out;
    } catch (Throwable $e) {
        $cached = [];
    }

    return $cached;
}

function cupImageUrl(array $cup, ?array $fallbackPool = null): string
{
    $raw = trim((string) ($cup['featured_image_url'] ?? ''));
    if ($raw !== ''
        && (str_starts_with($raw, 'http://') || str_starts_with($raw, 'https://') || str_starts_with($raw, '/'))
        && !str_starts_with($raw, '/api/')
    ) {
        return $raw;
    }
    return genericImageForCup($cup, $fallbackPool);
}

function starString(float $avg): string
{
    $filled = (int) round($avg);
    $out = '';
    for ($i = 1; $i <= 5; $i++) {
        $out .= $i <= $filled ? '★' : '☆';
    }
    return $out;
}

function fetchPublicCupsFallback(): array
{
    $envUrl = trim((string) (getenv('PUBLIC_CUPS_API_URL') ?: ''));
    $url = $envUrl !== '' ? $envUrl : 'http://localhost:3002/api/public/cups';
    $ctx = stream_context_create([
        'http' => [
            'timeout' => 12.0,
            'ignore_errors' => true,
        ],
    ]);
    $json = @file_get_contents($url, false, $ctx);
    if ($json === false) {
        return [];
    }
    $payload = json_decode($json, true);
    if (!is_array($payload) || !isset($payload['cups']) || !is_array($payload['cups'])) {
        return [];
    }
    return array_values(
        array_filter(
            $payload['cups'],
            static fn($c) => is_array($c) && (($c['visible'] ?? true) !== false) && (($c['visible'] ?? 'true') !== 'false'),
        ),
    );
}

$pathParts = parseCupPath();
if ($pathParts === null) {
    http_response_code(404);
    ?>
<!doctype html>
<html lang="sv">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Sidan hittades inte · Cupappen</title>
  <link rel="canonical" href="<?= h(siteBaseUrl() . '/') ?>" />
  <link rel="stylesheet" href="/cupappen-cup-detail.css" />
</head>
<body>
  <main class="detail-not-found">
    <div>
      <h1>Sidan hittades inte</h1>
      <p>Adressen du angav finns inte. Gå tillbaka till startsidan för att söka bland cuper.</p>
      <a href="/">Till startsidan</a>
    </div>
  </main>
</body>
</html>
<?php
    exit;
}

try {
    $pdo = null;
    $allCupsFallback = [];
    $pdo = getPdoFromEnv();
    if ($pathParts['legacyId']) {
        $cupStmt = $pdo->prepare(
            "SELECT c.*, src.name AS ingest_source_name
             FROM cups c
             LEFT JOIN ingest_sources src ON src.id = c.ingest_source_id
             WHERE c.id = :id AND COALESCE(c.visible, TRUE) = TRUE
             LIMIT 1",
        );
        $cupStmt->execute(['id' => $pathParts['legacyId']]);
        $cup = $cupStmt->fetch();
    } else {
        /** Two-phase lookup: lightweight rows first, full `SELECT c.*` only for resolved id (reduces RSS per slug request). */
        $needle = (string) $pathParts['slug'];
        $slugYearParam = $pathParts['slugYear'];
        $cupId = null;

        if ($slugYearParam !== null) {
            $y = (int) $slugYearParam;
            $lightStmt = $pdo->prepare(
                'SELECT c.id, c.name, c.start_date, c.end_date, src.name AS ingest_source_name
                 FROM cups c
                 LEFT JOIN ingest_sources src ON src.id = c.ingest_source_id
                 WHERE COALESCE(c.visible, TRUE) = TRUE
                   AND (
                     (c.start_date IS NOT NULL AND EXTRACT(YEAR FROM c.start_date::timestamp) = :y)
                     OR (c.end_date IS NOT NULL AND EXTRACT(YEAR FROM c.end_date::timestamp) = :y)
                   )',
            );
            $lightStmt->execute(['y' => $y]);
            $lightRows = $lightStmt->fetchAll();
            $districtNeedle = isset($pathParts['districtSlug'])
                ? strtolower((string) $pathParts['districtSlug'])
                : null;
            foreach ($lightRows as $row) {
                if ((int) (cupYear($row) ?? 0) !== $y) {
                    continue;
                }
                if (cupPrettySlug($row) !== ($needle . '-' . $y)) {
                    continue;
                }
                if ($districtNeedle !== null && cupDistrictSlug($row) !== $districtNeedle) {
                    continue;
                }
                $cupId = (int) $row['id'];
                break;
            }
            /** Legacy /cup/... or wrong district: fall back to first slug+year match, then 301 to canonical. */
            if ($cupId === null && $districtNeedle !== null) {
                foreach ($lightRows as $row) {
                    if ((int) (cupYear($row) ?? 0) !== $y) {
                        continue;
                    }
                    if (cupPrettySlug($row) === ($needle . '-' . $y)) {
                        $cupId = (int) $row['id'];
                        break;
                    }
                }
            }
        } else {
            $lightStmt = $pdo->query(
                'SELECT c.id, c.name, c.start_date, c.end_date, src.name AS ingest_source_name
                 FROM cups c
                 LEFT JOIN ingest_sources src ON src.id = c.ingest_source_id
                 WHERE COALESCE(c.visible, TRUE) = TRUE',
            );
            $lightRows = $lightStmt->fetchAll();
            $districtNeedle = isset($pathParts['districtSlug'])
                ? strtolower((string) $pathParts['districtSlug'])
                : null;
            $candidates = [];
            foreach ($lightRows as $row) {
                if (slugify((string) ($row['name'] ?? 'cup')) !== $needle) {
                    continue;
                }
                if ($districtNeedle !== null && cupDistrictSlug($row) !== $districtNeedle) {
                    continue;
                }
                $candidates[] = $row;
            }
            if ($candidates === [] && $districtNeedle !== null) {
                foreach ($lightRows as $row) {
                    if (slugify((string) ($row['name'] ?? 'cup')) === $needle) {
                        $candidates[] = $row;
                    }
                }
            }
            $picked = pickCupForSharedSlug($candidates);
            $cupId = $picked ? (int) $picked['id'] : null;
        }

        if ($cupId !== null && $cupId > 0) {
            $cupStmt = $pdo->prepare(
                'SELECT c.*, src.name AS ingest_source_name
                 FROM cups c
                 LEFT JOIN ingest_sources src ON src.id = c.ingest_source_id
                 WHERE c.id = :id AND COALESCE(c.visible, TRUE) = TRUE
                 LIMIT 1',
            );
            $cupStmt->execute(['id' => $cupId]);
            $cup = $cupStmt->fetch();
        } else {
            $cup = false;
        }
    }
} catch (Throwable $e) {
    $pdo = null;
    $allCupsFallback = fetchPublicCupsFallback();
    $cup = null;
    if ($pathParts['legacyId']) {
        foreach ($allCupsFallback as $row) {
            if ((int) ($row['id'] ?? 0) === (int) $pathParts['legacyId']) {
                $cup = $row;
                break;
            }
        }
    } elseif ($pathParts['slugYear'] !== null) {
        $slugYear = (int) $pathParts['slugYear'];
        $districtNeedle = isset($pathParts['districtSlug'])
            ? strtolower((string) $pathParts['districtSlug'])
            : null;
        foreach ($allCupsFallback as $row) {
            if ((int) (cupYear($row) ?? 0) !== $slugYear) {
                continue;
            }
            if (cupPrettySlug($row) !== ($pathParts['slug'] . '-' . $slugYear)) {
                continue;
            }
            if ($districtNeedle !== null && cupDistrictSlug($row) !== $districtNeedle) {
                continue;
            }
            $cup = $row;
            break;
        }
        if (!$cup && $districtNeedle !== null) {
            foreach ($allCupsFallback as $row) {
                if ((int) (cupYear($row) ?? 0) !== $slugYear) {
                    continue;
                }
                if (cupPrettySlug($row) === ($pathParts['slug'] . '-' . $slugYear)) {
                    $cup = $row;
                    break;
                }
            }
        }
    } else {
        $needle = (string) $pathParts['slug'];
        $districtNeedle = isset($pathParts['districtSlug'])
            ? strtolower((string) $pathParts['districtSlug'])
            : null;
        $candidates = [];
        foreach ($allCupsFallback as $row) {
            if (slugify((string) ($row['name'] ?? 'cup')) !== $needle) {
                continue;
            }
            if ($districtNeedle !== null && cupDistrictSlug($row) !== $districtNeedle) {
                continue;
            }
            $candidates[] = $row;
        }
        if ($candidates === [] && $districtNeedle !== null) {
            foreach ($allCupsFallback as $row) {
                if (slugify((string) ($row['name'] ?? 'cup')) === $needle) {
                    $candidates[] = $row;
                }
            }
        }
        $cup = pickCupForSharedSlug($candidates);
    }
}

if (!$cup) {
    http_response_code(404);
    ?>
<!doctype html>
<html lang="sv">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, follow" />
  <meta
    name="description"
    content="Den här cupen finns inte längre på Cupappen eller är inte publik. Utforska aktuella fotbollscuper på cupappen.se."
  />
  <title>Cup hittades inte - Cupappen</title>
  <link rel="stylesheet" href="/cupappen-cup-detail.css" />
</head>
<body>
  <main class="detail-not-found">
    <div>
      <h1>Cupen kunde inte hittas</h1>
      <p>Den här sidan finns inte längre eller är inte publik.</p>
      <a href="/">Tillbaka till Cupappen</a>
    </div>
  </main>
</body>
</html>
<?php
    exit;
}

$canonicalPath = cupCanonicalPath($cup);
$requestedPath = cupRequestPathNormalized();
$expectedPath = rtrim($canonicalPath, '/');

if (
    !empty($pathParts['legacyCupPrefix'])
    || !empty($pathParts['legacyId'])
    || $requestedPath !== $expectedPath
) {
    header('Location: ' . $canonicalPath, true, 301);
    exit;
}

$baseUrl = siteBaseUrl();
$canonicalUrl = $baseUrl . $canonicalPath;
$title = normalizeText((string) ($cup['name'] ?? 'Cup'));
$dateRange = dateRangeLabel($cup);
$location = normalizeText((string) ($cup['location'] ?? ''));
$organizer = normalizeText((string) ($cup['organizer'] ?? ''));
$description = normalizeText((string) ($cup['description'] ?? ''));
$categories = splitCategories($cup['categories'] ?? null);
$fallbackPool = $pdo instanceof PDO ? loadFallbackImagePool($pdo) : [];
$imageUrl = cupImageUrl($cup, $fallbackPool !== [] ? $fallbackPool : null);
$compareDateRaw = (string) ($cup['end_date'] ?? $cup['start_date'] ?? '');
$compareTs = $compareDateRaw !== '' ? strtotime($compareDateRaw) : false;
$isPastCup = $compareTs !== false && $compareTs < time();

$ratingsCount = 0;
$ratingsAvg = 0.0;
$distribution = ['1' => 0, '2' => 0, '3' => 0, '4' => 0, '5' => 0];
$ratings = [];
$sidebarUtvaldaLimit = 6;
$sidebarFeaturedCups = [];

if ($pdo instanceof PDO) {
    $ratingsSummaryStmt = $pdo->prepare(
        "SELECT COUNT(*)::int AS count, ROUND(COALESCE(AVG(rating), 0)::numeric, 1) AS avg
         FROM cup_ratings WHERE cup_id = :cup_id",
    );
    $ratingsSummaryStmt->execute(['cup_id' => (int) $cup['id']]);
    $ratingsSummary = $ratingsSummaryStmt->fetch() ?: ['count' => 0, 'avg' => 0];
    $ratingsCount = (int) ($ratingsSummary['count'] ?? 0);
    $ratingsAvg = (float) ($ratingsSummary['avg'] ?? 0);

    $distStmt = $pdo->prepare("SELECT rating, COUNT(*)::int AS count FROM cup_ratings WHERE cup_id = :cup_id GROUP BY rating");
    $distStmt->execute(['cup_id' => (int) $cup['id']]);
    foreach ($distStmt->fetchAll() as $row) {
        $k = (string) ((int) ($row['rating'] ?? 0));
        if (isset($distribution[$k])) {
            $distribution[$k] = (int) ($row['count'] ?? 0);
        }
    }

    $ratingsStmt = $pdo->prepare(
        "SELECT reviewer_name, reviewer_role, reviewer_club, reviewer_class, rating, comment, created_at
         FROM cup_ratings
         WHERE cup_id = :cup_id
         ORDER BY created_at DESC
         LIMIT 30",
    );
    $ratingsStmt->execute(['cup_id' => (int) $cup['id']]);
    $ratings = $ratingsStmt->fetchAll();

    $lim = max(1, min(48, $sidebarUtvaldaLimit));
    $featuredStmt = $pdo->prepare(
        'SELECT c.id, c.name, c.location, c.start_date, c.end_date, c.featured_image_url,
                src.name AS ingest_source_name
         FROM cups c
         LEFT JOIN ingest_sources src ON src.id = c.ingest_source_id
         WHERE c.id <> :id
           AND COALESCE(c.visible, TRUE) = TRUE
           AND COALESCE(c.featured, FALSE) = TRUE
         ORDER BY c.start_date ASC NULLS LAST, c.end_date ASC NULLS LAST, c.name ASC
         LIMIT ' . (string) ((int) $lim),
    );
    $featuredStmt->execute([
        'id' => (int) $cup['id'],
    ]);
    $sidebarFeaturedCups = $featuredStmt->fetchAll();
} else {
    if (!isset($allCupsFallback) || !is_array($allCupsFallback)) {
        $allCupsFallback = fetchPublicCupsFallback();
    }
    $pool = array_values(
        array_filter(
            $allCupsFallback,
            static function ($row) use ($cup): bool {
                return is_array($row)
                    && (int) ($row['id'] ?? 0) !== (int) ($cup['id'] ?? 0)
                    && cupIsFeaturedPublic($row);
            },
        ),
    );
    sortCupsLikeHomepage($pool);
    $sidebarFeaturedCups = array_slice($pool, 0, $sidebarUtvaldaLimit);
}

$nextCupInDistrict = null;
$nextCupHref = '';
if ($pdo instanceof PDO) {
    try {
        $districtNavCups = fetchDistrictCupsForNav($pdo, $cup);
        $nextCupInDistrict = nextCupInDistrict($cup, $districtNavCups);
    } catch (Throwable $e) {
        $nextCupInDistrict = null;
    }
} else {
    if (!isset($allCupsFallback) || !is_array($allCupsFallback)) {
        $allCupsFallback = fetchPublicCupsFallback();
    }
    $districtSlug = cupDistrictSlug($cup);
    $districtNavCups = array_values(
        array_filter(
            $allCupsFallback,
            static function ($row) use ($districtSlug): bool {
                return is_array($row)
                    && cupDistrictSlug($row) === $districtSlug
                    && cupIsUpcomingForNav($row);
            },
        ),
    );
    $nextCupInDistrict = nextCupInDistrict($cup, $districtNavCups);
}
if (is_array($nextCupInDistrict) && (int) ($nextCupInDistrict['id'] ?? 0) > 0) {
    $nextCupHref = cupCanonicalPath($nextCupInDistrict);
}

$metaDescription = $description !== '' ? $description : trim($title . ' i ' . ($location !== '' ? $location : 'Sverige') . '. Datum, arrangör och anmälan på Cupappen.');
$metaDescriptionHtml = truncateMetaDescription($metaDescription !== '' ? $metaDescription : $title);
$ogImageUrl = absolutePublicUrl($baseUrl, $imageUrl);

$registrationRaw = trim((string) ($cup['registration_url'] ?? ''));
$registrationAbs = $registrationRaw !== '' ? absolutePublicUrl($baseUrl, $registrationRaw) : '';
$registrationWithUtm = $registrationAbs !== '' ? withCupappenUtm($registrationAbs) : '';

$keywordsParts = $categories;
$matchFormatKw = normalizeText((string) ($cup['match_format'] ?? ''));
if ($matchFormatKw !== '') {
    $keywordsParts[] = $matchFormatKw;
}
$districtKw = normalizeText((string) ($cup['ingest_source_name'] ?? ''));
if ($districtKw !== '') {
    $keywordsParts[] = $districtKw;
}
$keywordsCsv = implode(', ', array_unique(array_values(array_filter($keywordsParts))));

$sportsEventLd = [
    '@type' => 'SportsEvent',
    '@id' => $canonicalUrl . '#cup',
    'identifier' => ((int) ($cup['id'] ?? 0)) > 0 ? (string) ((int) $cup['id']) : null,
    'name' => $title,
    'url' => $canonicalUrl,
    'inLanguage' => 'sv-SE',
    'startDate' => $cup['start_date'] ?: null,
    'endDate' => $cup['end_date'] ?: null,
    'sport' => 'Fotboll',
    'description' => $metaDescriptionHtml !== '' ? $metaDescriptionHtml : $metaDescription,
    'eventAttendanceMode' => 'https://schema.org/OfflineEventAttendanceMode',
    'eventStatus' => 'https://schema.org/EventScheduled',
];
if ($keywordsCsv !== '') {
    $sportsEventLd['keywords'] = $keywordsCsv;
}
$sportsEventLd['image'] = [$ogImageUrl];
if ($location !== '') {
    $sportsEventLd['location'] = ['@type' => 'Place', 'name' => $location];
}
if ($organizer !== '') {
    $sportsEventLd['organizer'] = ['@type' => 'Organization', 'name' => $organizer];
}
if ($registrationWithUtm !== '' && (str_starts_with($registrationWithUtm, 'http://') || str_starts_with($registrationWithUtm, 'https://'))) {
    $sportsEventLd['offers'] = [
        '@type' => 'Offer',
        'url' => $registrationWithUtm,
        'availability' => 'https://schema.org/InStock',
        'price' => '0',
        'priceCurrency' => 'SEK',
    ];
}
if (!empty($cup['team_count'])) {
    $tc = (int) $cup['team_count'];
    if ($tc > 0) {
        $sportsEventLd['maximumAttendeeCapacity'] = $tc;
    }
}
if ($ratingsCount > 0) {
    $sportsEventLd['aggregateRating'] = [
        '@type' => 'AggregateRating',
        'ratingValue' => round($ratingsAvg, 1),
        'bestRating' => 5,
        'worstRating' => 1,
        'ratingCount' => $ratingsCount,
    ];
}
$sportsEventLd['mainEntityOfPage'] = ['@id' => $canonicalUrl . '#webpage'];

$organizationLd = [
    '@type' => 'Organization',
    '@id' => $baseUrl . '/#organization',
    'name' => 'Cupappen',
    'url' => $baseUrl . '/',
    'email' => 'info@cupappen.se',
    'logo' => [
        '@type' => 'ImageObject',
        'url' => absolutePublicUrl($baseUrl, '/assets/cupappen-logo.png'),
        'width' => 1536,
        'height' => 1024,
    ],
];

$websiteLd = [
    '@type' => 'WebSite',
    '@id' => $baseUrl . '/#website',
    'name' => 'Cupappen',
    'url' => $baseUrl . '/',
    'inLanguage' => 'sv-SE',
    'publisher' => ['@id' => $organizationLd['@id']],
];

$districtLabel = normalizeText((string) ($cup['ingest_source_name'] ?? ''));
if ($districtLabel === '') {
    $districtLabel = 'Övrigt';
}
$districtHref = $baseUrl . '/' . cupDistrictSlug($cup) . '/';

$breadcrumbLd = [
    '@type' => 'BreadcrumbList',
    '@id' => $canonicalUrl . '#breadcrumb',
    'itemListElement' => [
        [
            '@type' => 'ListItem',
            'position' => 1,
            'name' => 'Cupappen',
            'item' => $baseUrl . '/',
        ],
        [
            '@type' => 'ListItem',
            'position' => 2,
            'name' => $districtLabel,
            'item' => $districtHref,
        ],
        [
            '@type' => 'ListItem',
            'position' => 3,
            'name' => $title,
            'item' => $canonicalUrl,
        ],
    ],
];

$webPageLd = [
    '@type' => 'WebPage',
    '@id' => $canonicalUrl . '#webpage',
    'url' => $canonicalUrl,
    'name' => $title . ' | Cupappen',
    'description' => $metaDescriptionHtml !== '' ? $metaDescriptionHtml : $metaDescription,
    'inLanguage' => 'sv-SE',
    'primaryImageOfPage' => ['@type' => 'ImageObject', 'url' => $ogImageUrl],
    'publisher' => ['@id' => $organizationLd['@id']],
    'isPartOf' => ['@id' => $websiteLd['@id']],
    'about' => ['@id' => $canonicalUrl . '#cup'],
    'mainEntity' => ['@id' => $canonicalUrl . '#cup'],
    'breadcrumb' => ['@id' => $canonicalUrl . '#breadcrumb'],
];

$jsonLdGraph = jsonLdStripNulls([
    '@context' => 'https://schema.org',
    '@graph' => [$organizationLd, $websiteLd, $webPageLd, $breadcrumbLd, $sportsEventLd],
]);

?>
<!doctype html>
<html lang="sv">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title><?= h($title) ?> · Cupappen</title>
  <meta name="description" content="<?= h($metaDescriptionHtml !== '' ? $metaDescriptionHtml : $metaDescription) ?>" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <meta name="theme-color" content="#099ea2" />
  <meta name="author" content="Cupappen" />
  <meta name="application-name" content="Cupappen" />
  <?php if ($keywordsCsv !== ''): ?>
    <meta name="keywords" content="<?= h($keywordsCsv) ?>" />
  <?php endif; ?>
  <link rel="canonical" href="<?= h($canonicalUrl) ?>" />
  <link rel="alternate" hreflang="sv-SE" href="<?= h($canonicalUrl) ?>" />
  <link rel="alternate" hreflang="x-default" href="<?= h($canonicalUrl) ?>" />
  <meta property="og:locale" content="sv_SE" />
  <meta property="og:site_name" content="Cupappen" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="<?= h($title) ?> · Cupappen" />
  <meta property="og:description" content="<?= h($metaDescriptionHtml !== '' ? $metaDescriptionHtml : $metaDescription) ?>" />
  <meta property="og:url" content="<?= h($canonicalUrl) ?>" />
  <meta property="og:image" content="<?= h($ogImageUrl) ?>" />
  <?php if (str_starts_with($ogImageUrl, 'https://')): ?>
    <meta property="og:image:secure_url" content="<?= h($ogImageUrl) ?>" />
  <?php endif; ?>
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:alt" content="<?= h($title) ?>" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="<?= h($title) ?> · Cupappen" />
  <meta name="twitter:description" content="<?= h($metaDescriptionHtml !== '' ? $metaDescriptionHtml : $metaDescription) ?>" />
  <meta name="twitter:image" content="<?= h($ogImageUrl) ?>" />
  <meta name="twitter:image:alt" content="<?= h($title) ?>" />
  <link rel="icon" type="image/svg+xml" href="<?= h($baseUrl . '/favicon.svg') ?>" />
  <link rel="icon" type="image/png" sizes="48x48" href="<?= h($baseUrl . '/assets/cupappen-favicon.png') ?>" />
  <link rel="apple-touch-icon" sizes="180x180" href="<?= h($baseUrl . '/assets/cupappen-favicon.png') ?>" />
  <link rel="sitemap" type="application/xml" title="Cupappen sitemap" href="<?= h($baseUrl . '/sitemap.xml') ?>" />
  <link rel="alternate" type="text/plain" title="LLM / AI site guide (llms.txt)" href="<?= h($baseUrl . '/llms.txt') ?>" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/cupappen-cup-detail.css" />
  <script type="application/ld+json"><?= h(json_encode($jsonLdGraph, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) ?></script>
</head>
<body>
  <header class="detail-header">
    <div class="detail-header__inner">
      <a href="/" class="logo" id="detail-logo" aria-label="Cupappen startsida">
        <picture>
          <source srcset="/assets/cupappen-logo.webp" type="image/webp" />
          <img
            class="logo__img"
            src="/assets/cupappen-logo.png"
            alt="Cupappen"
            width="120"
            height="40"
            decoding="async"
          />
        </picture>
      </a>
      <div class="detail-header__actions">
        <?php if ($nextCupHref !== ''): ?>
          <a class="detail-next" href="<?= h($nextCupHref) ?>" title="Nästa cup i samma distrikt">
            <span class="detail-next__long">Nästa cup i samma distrikt</span>
            <span class="detail-next__short">Nästa cup</span>
          </a>
        <?php endif; ?>
        <a class="detail-back" href="<?= h('/' . cupDistrictSlug($cup) . '/') ?>" id="detail-back-btn">Tillbaka</a>
      </div>
    </div>
  </header>

  <section class="cover">
    <div class="cover__media">
      <img src="<?= h($imageUrl) ?>" alt="<?= h($title) ?>" width="1200" height="630" fetchpriority="high" decoding="async" />
      <div class="cover__gradient"></div>
      <div class="cover__content">
        <span class="cover__chip"><span class="dot"></span>Cupdetaljer</span>
        <h1 class="cover__title"><?= h($title) ?></h1>
        <div class="cover__meta">
          <?php if ($location !== ''): ?><span class="cover__meta-item"><?= h($location) ?></span><?php endif; ?>
          <span class="cover__meta-item"><?= h($dateRange) ?></span>
          <?php if (!empty($cup['team_count'])): ?><span class="cover__meta-item"><?= h((string) ((int) $cup['team_count'])) ?> lag</span><?php endif; ?>
        </div>
      </div>
    </div>
  </section>

  <main id="main" class="container detail-layout">
    <div class="detail-layout__main">
      <div class="summary-row">
        <span class="summary-chip"><?= h(starString($ratingsAvg)) ?> <strong><?= h(number_format($ratingsAvg, 1)) ?></strong> <span class="summary-chip__count">(<?= h((string) $ratingsCount) ?>)</span></span>
        <button class="share-btn" id="share-btn" type="button">Dela</button>
      </div>

      <?php
        $isSanctioned = ($cup['sanctioned'] ?? true) !== false && ($cup['sanctioned'] ?? 'true') !== 'false';
        $matchFormat = normalizeText((string) ($cup['match_format'] ?? ''));
        $metaBadges = [];
        if ($matchFormat !== '') {
            $metaBadges[] = capitalizeBadgeLabel('Spelform: ' . $matchFormat);
        }
        if ($organizer !== '') {
            $metaBadges[] = capitalizeBadgeLabel('Arrangör: ' . $organizer);
        }
      ?>
      <?php if (count($metaBadges) > 0): ?>
        <div class="meta-badges" aria-label="Cupmeta">
          <?php foreach ($metaBadges as $badge): ?>
            <span class="meta-badge"><?= h($badge) ?></span>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
      <?php if (count($categories) > 0): ?>
        <div class="meta-badges meta-badges--categories" aria-label="Ålderskategorier">
          <?php foreach ($categories as $category): ?>
            <span class="meta-badge meta-badge--category"><?= h(capitalizeBadgeLabel($category)) ?></span>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>

      <?php if ($description !== ''): ?>
        <section class="cup-about" style="margin-top: 2rem;">
          <h2 class="h3">Om cupen</h2>
          <div class="cup-description"><?= h($description) ?></div>
        </section>
      <?php endif; ?>

      <section class="ratings-block" id="ratings">
        <h2 class="h3">Betyg och omdömen</h2>
        <div class="ratings-summary">
          <div class="ratings-summary__avg">
            <div class="ratings-summary__avg-num"><?= h(number_format($ratingsAvg, 1)) ?></div>
            <div><?= h(starString($ratingsAvg)) ?></div>
            <div class="ratings-summary__count"><?= h((string) $ratingsCount) ?> omdömen</div>
          </div>
          <div class="ratings-bars">
            <?php for ($star = 5; $star >= 1; $star--):
                $count = $distribution[(string) $star];
                $width = $ratingsCount > 0 ? ($count / $ratingsCount) * 100 : 0;
                ?>
              <div class="rating-bar-row">
                <span class="rating-bar-row__label"><?= h((string) $star) ?></span>
                <div class="rating-bar-row__track"><div class="rating-bar-row__fill" style="width: <?= h(number_format($width, 2, '.', '')) ?>%"></div></div>
                <span class="rating-bar-row__count"><?= h((string) $count) ?></span>
              </div>
            <?php endfor; ?>
          </div>
        </div>

        <?php if (count($ratings) === 0): ?>
          <div class="ratings-list ratings-list--empty">Inga omdömen än. Bli först med att lämna ett betyg.</div>
        <?php else: ?>
          <div class="ratings-list">
            <?php foreach ($ratings as $rating):
                $name = normalizeText((string) ($rating['reviewer_name'] ?? 'Anonym'));
                $initial = mb_substr($name, 0, 1, 'UTF-8');
                ?>
              <article class="rating-item">
                <div class="rating-item__row">
                  <div class="rating-avatar"><?= h(mb_strtoupper($initial, 'UTF-8')) ?></div>
                  <div>
                    <div class="rating-item__stars"><?= h(str_repeat('★', (int) $rating['rating']) . str_repeat('☆', max(0, 5 - (int) $rating['rating']))) ?></div>
                    <div class="rating-item__head">
                      <span class="rating-item__name"><?= h($name) ?></span>
                      <?php if (!empty($rating['reviewer_role'])): ?><span class="rating-item__role"><?= h((string) $rating['reviewer_role']) ?></span><?php endif; ?>
                      <?php if (!empty($rating['reviewer_club'])): ?><span class="rating-item__role"><?= h((string) $rating['reviewer_club']) ?></span><?php endif; ?>
                      <?php if (!empty($rating['reviewer_class'])): ?><span class="rating-item__role"><?= h((string) $rating['reviewer_class']) ?></span><?php endif; ?>
                    </div>
                    <?php if (!empty($rating['comment'])): ?><p class="rating-item__comment"><?= h((string) $rating['comment']) ?></p><?php endif; ?>
                    <?php if (!empty($rating['created_at'])): ?><span class="rating-item__date"><?= h(date('Y-m-d', strtotime((string) $rating['created_at']))) ?></span><?php endif; ?>
                  </div>
                </div>
              </article>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>

        <form class="rating-form" id="rating-form">
          <h3 class="rating-form__title">Lämna omdöme</h3>
          <p class="rating-form__lead">Ditt omdöme hjälper andra lag att välja rätt cup.</p>
          <div class="form-stack">
            <div class="form-field">
              <label class="form-field__label">Betyg</label>
              <div class="star-picker" id="star-picker"></div>
              <input type="hidden" name="rating" id="rating-value" value="0" />
            </div>
            <div class="form-row">
              <div class="form-field">
                <label class="form-field__label" for="reviewer_name">Namn</label>
                <input class="form-input" id="reviewer_name" name="reviewer_name" required />
              </div>
              <div class="form-field">
                <label class="form-field__label" for="reviewer_role">Roll</label>
                <input class="form-input" id="reviewer_role" name="reviewer_role" placeholder="Tränare / Förälder / Spelare" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label class="form-field__label" for="reviewer_club">Förening / Klubb</label>
                <input class="form-input" id="reviewer_club" name="reviewer_club" placeholder="Ex. IFK Göteborg" />
              </div>
              <div class="form-field">
                <label class="form-field__label" for="reviewer_class">Klass</label>
                <input class="form-input" id="reviewer_class" name="reviewer_class" placeholder="Ex. F16, P12" maxlength="40" />
              </div>
            </div>
            <div class="form-field">
              <label class="form-field__label" for="comment">Kommentar</label>
              <textarea class="form-textarea" id="comment" name="comment" rows="4"></textarea>
            </div>
            <button class="info-card__cta" type="submit">Skicka omdöme</button>
            <p class="form-error" id="rating-error" hidden></p>
            <p class="form-success" id="rating-success" hidden>Tack! Omdömet är sparat.</p>
          </div>
        </form>
      </section>
    </div>

    <aside class="sidebar">
      <section class="info-card">
        <span class="info-card__label">Cupinfo</span>
        <div class="info-card__price"><?= h(number_format($ratingsAvg, 1)) ?>/5</div>
        <?php if ($isPastCup): ?>
          <p class="info-card__alert-expired">Cupdatumet har passerat</p>
        <?php endif; ?>
        <ul class="info-list">
          <li class="info-list__row"><div><span class="info-list__label">Datum</span><p class="info-list__value"><?= h($dateRange) ?></p></div></li>
          <?php if ($location !== ''): ?><li class="info-list__row"><div><span class="info-list__label">Plats</span><p class="info-list__value"><?= h($location) ?></p></div></li><?php endif; ?>
          <?php if ($organizer !== ''): ?><li class="info-list__row"><div><span class="info-list__label">Arrangör</span><p class="info-list__value"><?= h($organizer) ?></p></div></li><?php endif; ?>
          <?php if ($isSanctioned): ?>
            <li class="info-list__row info-list__row--sanction">
              <div class="info-list__sanction">
                <p class="info-list__sanction-label">
                  <span class="info-list__sanction-check" aria-hidden="true">✓</span>
                  Sanktionerad av distrikt
                </p>
                <a class="info-list__district-link" href="<?= h('/' . cupDistrictSlug($cup) . '/') ?>"><?= h($districtLabel) ?></a>
              </div>
            </li>
          <?php endif; ?>
          <?php if (!empty($cup['team_count'])): ?><li class="info-list__row"><div><span class="info-list__label">Lag</span><p class="info-list__value"><?= h((string) ((int) $cup['team_count'])) ?></p></div></li><?php endif; ?>
        </ul>
        <?php if ($registrationWithUtm !== ''): ?>
          <a class="info-card__cta" target="_blank" rel="noopener noreferrer" href="<?= h($registrationWithUtm) ?>">Till anmälan</a>
        <?php else: ?>
          <p class="info-card__cta-missing">Det finns tyvärr ingen anmälningslänk</p>
        <?php endif; ?>
        <?php
            $mailSubject = 'Uppdatering: ' . $title;
            $mailBody = "Hej,\n\nJag vill uppdatera informationen om " . $title . ".\n\n";
            $mailtoHref = 'mailto:info@cupappen.se?subject=' . rawurlencode($mailSubject) . '&body=' . rawurlencode($mailBody);
        ?>
        <a class="info-card__update-link" href="<?= h($mailtoHref) ?>">Uppdatera cupen</a>
      </section>

      <?php if (count($sidebarFeaturedCups) > 0): ?>
      <section class="related-card" aria-label="Utvalda cuper">
        <h3 class="related-card__title">Utvalda cuper</h3>
        <ul class="related-list">
          <?php foreach ($sidebarFeaturedCups as $rel):
              $relName = normalizeText((string) ($rel['name'] ?? 'Cup'));
              $relHref = cupCanonicalPath($rel);
              $relImage = cupImageUrl($rel, $fallbackPool !== [] ? $fallbackPool : null);
              ?>
            <li>
              <a class="related-link" href="<?= h($relHref) ?>">
                <img src="<?= h($relImage) ?>" alt="<?= h($relName) ?>" />
                <div class="related-link__body">
                  <div class="related-link__name"><?= h($relName) ?></div>
                  <div class="related-link__meta"><?= h(normalizeText((string) ($rel['location'] ?? ''))) ?> · <?= h(dateRangeLabel($rel)) ?></div>
                </div>
              </a>
            </li>
          <?php endforeach; ?>
        </ul>
      </section>
      <?php endif; ?>
    </aside>
  </main>

  <footer class="detail-footer">
    <a href="<?= h('/' . cupDistrictSlug($cup) . '/') ?>" id="detail-footer-back">Tillbaka till <?= h($districtLabel) ?></a>
  </footer>

  <script>
    (function () {
      document.querySelectorAll('#detail-logo, a.logo').forEach(function (el) {
        el.addEventListener('click', function () {
          try {
            sessionStorage.setItem('cupappen_active_tab', 'home');
          } catch (err) {
            /* ignore */
          }
        });
      });

      const cupId = <?= (int) $cup['id'] ?>;

      (function trackCupPageview() {
        const body = JSON.stringify({
          page_kind: 'cup',
          cup_id: cupId,
          referrer: document.referrer || '',
        });
        try {
          if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/pageview.php', new Blob([body], { type: 'application/json' }));
            return;
          }
        } catch (_) {}
        fetch('/api/pageview.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(function () {});
      })();

      const form = document.getElementById('rating-form');
      const errorEl = document.getElementById('rating-error');
      const successEl = document.getElementById('rating-success');
      const picker = document.getElementById('star-picker');
      const ratingValue = document.getElementById('rating-value');
      const shareBtn = document.getElementById('share-btn');
      let currentRating = 0;

      function renderStars() {
        if (!picker) return;
        picker.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.dataset.active = i <= currentRating ? 'true' : 'false';
          btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="m12 17.3-6.18 3.73 1.64-7.03L2 9.27l7.19-.62L12 2l2.81 6.65 7.19.62-5.46 4.73 1.64 7.03z"/></svg>';
          btn.addEventListener('click', function () {
            currentRating = i;
            if (ratingValue) ratingValue.value = String(i);
            renderStars();
          });
          picker.appendChild(btn);
        }
      }
      renderStars();

      if (shareBtn) {
        shareBtn.addEventListener('click', async function () {
          try {
            if (navigator.share) {
              await navigator.share({ url: window.location.href });
            } else {
              await navigator.clipboard.writeText(window.location.href);
              shareBtn.textContent = 'Länk kopierad';
              setTimeout(() => (shareBtn.textContent = 'Dela'), 1500);
            }
          } catch (_) {}
        });
      }

      if (!form) return;
      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (errorEl) {
          errorEl.hidden = true;
          errorEl.textContent = '';
        }
        if (successEl) successEl.hidden = true;

        const body = {
          cup_id: cupId,
          reviewer_name: String(document.getElementById('reviewer_name')?.value || '').trim(),
          reviewer_role: String(document.getElementById('reviewer_role')?.value || '').trim(),
          reviewer_club: String(document.getElementById('reviewer_club')?.value || '').trim(),
          reviewer_class: String(document.getElementById('reviewer_class')?.value || '').trim(),
          comment: String(document.getElementById('comment')?.value || '').trim(),
          rating: Number(ratingValue?.value || 0),
        };

        if (!body.reviewer_name || body.rating < 1 || body.rating > 5) {
          if (errorEl) {
            errorEl.hidden = false;
            errorEl.textContent = 'Namn och betyg (1-5) krävs.';
          }
          return;
        }

        try {
          const response = await fetch('/api/ratings.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload?.error || 'Kunde inte spara omdömet.');
          }
          if (successEl) successEl.hidden = false;
          setTimeout(() => window.location.reload(), 500);
        } catch (err) {
          if (errorEl) {
            errorEl.hidden = false;
            errorEl.textContent = err?.message || 'Kunde inte spara omdömet.';
          }
        }
      });
    })();
  </script>
</body>
</html>
