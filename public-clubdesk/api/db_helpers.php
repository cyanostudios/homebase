<?php

declare(strict_types=1);

/**
 * Public Clubdesk SQL helpers (tenant Neon).
 * Only published guides / price lists.
 */
function publicAppTableHasColumn(PDO $pdo, string $table, string $column): bool
{
    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = :table
           AND column_name = :column
         LIMIT 1',
    );
    $stmt->execute(['table' => $table, 'column' => $column]);

    return (bool) $stmt->fetchColumn();
}

function publicAppListSql(PDO $pdo): string
{
    $featuredSelect = publicAppTableHasColumn($pdo, 'clubdesk_guides', 'featured')
        ? 'g.featured'
        : 'FALSE AS featured';

    return <<<SQL
SELECT
  g.id,
  g.title AS name,
  g.slug,
  g.description,
  g.featured_image_url,
  {$featuredSelect},
  g.category,
  g.sort_order,
  g.updated_at,
  (
    SELECT COUNT(*)::int
    FROM clubdesk_guide_steps s
    WHERE s.guide_id = g.id
  ) AS step_count
FROM clubdesk_guides g
LEFT JOIN clubdesk_guide_categories c
  ON c.user_id = g.user_id
  AND lower(btrim(c.name)) = lower(btrim(g.category))
WHERE g.publication_status = 'published'
ORDER BY
  CASE
    WHEN g.category IS NULL OR btrim(g.category) = '' THEN 2
    WHEN c.id IS NULL THEN 1
    ELSE 0
  END ASC,
  COALESCE(c.sort_order, 2147483647) ASC,
  g.sort_order ASC NULLS LAST,
  lower(g.title) ASC,
  g.id ASC
SQL;
}

/**
 * Category catalog order for published guide owners only.
 */
function publicAppCategoryOrderSql(): string
{
    return <<<SQL
SELECT c.name
FROM clubdesk_guide_categories c
WHERE EXISTS (
  SELECT 1
  FROM clubdesk_guides g
  WHERE g.user_id = c.user_id
    AND g.publication_status = 'published'
)
ORDER BY c.sort_order ASC NULLS LAST, lower(c.name) ASC, c.id ASC
SQL;
}

function publicAppSitemapSql(PDO $pdo): string
{
    return <<<SQL
SELECT id, name, slug, category, updated_at, kind
FROM (
  SELECT g.id, g.title AS name, g.slug, g.category, g.updated_at, 'guide'::text AS kind
  FROM clubdesk_guides g
  WHERE g.publication_status = 'published'
  UNION ALL
  SELECT p.id, p.title AS name, p.slug, NULL::text AS category, p.updated_at, 'price-list'::text AS kind
  FROM clubdesk_price_lists p
  WHERE p.publication_status = 'published'
) x
ORDER BY name ASC NULLS LAST, id ASC
SQL;
}

/**
 * @return array{sql: string, params: array<int, mixed>}
 */
function publicAppItemBySlugSql(PDO $pdo, string $slugOrId): array
{
    if (ctype_digit($slugOrId)) {
        return [
            'sql' => <<<SQL
SELECT
  g.id,
  g.title AS name,
  g.slug,
  g.description,
  g.featured_image_url,
  g.category,
  g.updated_at,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'number', s.sequence_order,
          'title', s.title,
          'description', COALESCE(s.description, ''),
          'image', COALESCE(s.image_url, '')
        )
        ORDER BY s.sequence_order ASC
      )
      FROM clubdesk_guide_steps s
      WHERE s.guide_id = g.id
    ),
    '[]'::json
  ) AS steps
FROM clubdesk_guides g
WHERE g.id = ?
  AND g.publication_status = 'published'
LIMIT 1
SQL,
            'params' => [(int) $slugOrId],
        ];
    }

    return [
        'sql' => <<<SQL
SELECT
  g.id,
  g.title AS name,
  g.slug,
  g.description,
  g.featured_image_url,
  g.category,
  g.updated_at,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'number', s.sequence_order,
          'title', s.title,
          'description', COALESCE(s.description, ''),
          'image', COALESCE(s.image_url, '')
        )
        ORDER BY s.sequence_order ASC
      )
      FROM clubdesk_guide_steps s
      WHERE s.guide_id = g.id
    ),
    '[]'::json
  ) AS steps
FROM clubdesk_guides g
WHERE lower(g.slug) = lower(?)
  AND g.publication_status = 'published'
LIMIT 1
SQL,
        'params' => [$slugOrId],
    ];
}

function publicAppPriceListsSql(PDO $pdo): string
{
    $featuredSelect = publicAppTableHasColumn($pdo, 'clubdesk_price_lists', 'featured')
        ? 'p.featured'
        : 'FALSE AS featured';

    return <<<SQL
SELECT
  p.id,
  p.title AS name,
  p.slug,
  p.description,
  p.currency,
  {$featuredSelect},
  p.sort_order,
  p.updated_at,
  (
    SELECT COUNT(*)::int
    FROM clubdesk_price_list_items i
    WHERE i.price_list_id = p.id
  ) AS item_count
FROM clubdesk_price_lists p
WHERE p.publication_status = 'published'
ORDER BY
  p.sort_order ASC NULLS LAST,
  lower(p.title) ASC,
  p.id ASC
SQL;
}

/**
 * @return array{sql: string, params: array<int, mixed>}
 */
function publicAppPriceListBySlugSql(string $slugOrId): array
{
    if (ctype_digit($slugOrId)) {
        return [
            'sql' => <<<SQL
SELECT
  p.id,
  p.title AS name,
  p.slug,
  p.description,
  p.currency,
  p.updated_at,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'title', i.title,
          'description', COALESCE(i.description, ''),
          'price', i.price,
          'category', COALESCE(i.category, ''),
          'sequenceOrder', i.sequence_order
        )
        ORDER BY
          CASE WHEN i.category IS NULL OR btrim(i.category) = '' THEN 1 ELSE 0 END ASC,
          COALESCE(c.sort_order, 2147483647) ASC,
          lower(COALESCE(NULLIF(btrim(i.category), ''), '')) ASC,
          i.sequence_order ASC,
          i.id ASC
      )
      FROM clubdesk_price_list_items i
      LEFT JOIN clubdesk_price_list_item_categories c
        ON c.price_list_id = i.price_list_id
        AND lower(btrim(c.name)) = lower(btrim(COALESCE(i.category, '')))
      WHERE i.price_list_id = p.id
    ),
    '[]'::json
  ) AS items
FROM clubdesk_price_lists p
WHERE p.id = ?
  AND p.publication_status = 'published'
LIMIT 1
SQL,
            'params' => [(int) $slugOrId],
        ];
    }

    return [
        'sql' => <<<SQL
SELECT
  p.id,
  p.title AS name,
  p.slug,
  p.description,
  p.currency,
  p.updated_at,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'title', i.title,
          'description', COALESCE(i.description, ''),
          'price', i.price,
          'category', COALESCE(i.category, ''),
          'sequenceOrder', i.sequence_order
        )
        ORDER BY
          CASE WHEN i.category IS NULL OR btrim(i.category) = '' THEN 1 ELSE 0 END ASC,
          COALESCE(c.sort_order, 2147483647) ASC,
          lower(COALESCE(NULLIF(btrim(i.category), ''), '')) ASC,
          i.sequence_order ASC,
          i.id ASC
      )
      FROM clubdesk_price_list_items i
      LEFT JOIN clubdesk_price_list_item_categories c
        ON c.price_list_id = i.price_list_id
        AND lower(btrim(c.name)) = lower(btrim(COALESCE(i.category, '')))
      WHERE i.price_list_id = p.id
    ),
    '[]'::json
  ) AS items
FROM clubdesk_price_lists p
WHERE lower(p.slug) = lower(?)
  AND p.publication_status = 'published'
LIMIT 1
SQL,
        'params' => [$slugOrId],
    ];
}

/**
 * Swish profile linked to a published price list (at most one via UNIQUE price_list_id).
 *
 * @return array{sql: string, params: list<mixed>}
 */
function publicAppSwishByPriceListIdSql(int $priceListId): array
{
    return [
        'sql' => <<<SQL
SELECT
  sp.payee,
  sp.message
FROM clubdesk_swish_profile_price_lists j
INNER JOIN clubdesk_swish_profiles sp ON sp.id = j.profile_id
INNER JOIN clubdesk_price_lists p ON p.id = j.price_list_id
WHERE j.price_list_id = ?
  AND p.publication_status = 'published'
LIMIT 1
SQL,
        'params' => [$priceListId],
    ];
}

/**
 * Primary org Swish profile for the public Swish page (oldest non-empty payee).
 *
 * @return array{sql: string, params: list<mixed>}
 */
function publicAppPrimarySwishProfileSql(): array
{
    return [
        'sql' => <<<SQL
SELECT
  payee,
  message
FROM clubdesk_swish_profiles
WHERE TRIM(payee) <> ''
ORDER BY id ASC
LIMIT 1
SQL,
        'params' => [],
    ];
}

/**
 * Public Info contact list (join contacts; whitelist fields only).
 */
function publicAppInfoContactsSql(PDO $pdo): ?string
{
    if (!publicAppTableHasColumn($pdo, 'clubdesk_info_contacts', 'contact_id')) {
        return null;
    }

    return <<<SQL
SELECT
  ic.id,
  ic.blurb,
  ic.sort_order,
  c.company_name,
  c.email,
  c.phone,
  c.contact_persons
FROM clubdesk_info_contacts ic
INNER JOIN contacts c ON c.id = ic.contact_id
ORDER BY ic.sort_order ASC, ic.id ASC
SQL;
}

/**
 * Site content cards for public home + info tabs (never swish).
 */
function publicAppSiteContentSql(): string
{
    return <<<SQL
SELECT DISTINCT ON (card_key)
  card_key,
  content,
  meta
FROM clubdesk_site_content
WHERE card_key IN ('home', 'info')
ORDER BY card_key, updated_at DESC NULLS LAST, id DESC
SQL;
}
