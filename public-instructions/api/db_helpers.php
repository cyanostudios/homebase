<?php

declare(strict_types=1);

/**
 * Public instructions SQL helpers (tenant Neon).
 * Only published rows; steps assembled at read time as public-app steps JSON shape.
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
    return <<<SQL
SELECT
  i.id,
  i.title AS name,
  i.slug,
  i.description,
  i.featured_image_url,
  i.category,
  i.sort_order,
  i.updated_at,
  (
    SELECT COUNT(*)::int
    FROM instruction_steps s
    WHERE s.instruction_id = i.id
  ) AS step_count
FROM instructions i
LEFT JOIN instruction_categories c
  ON c.user_id = i.user_id
  AND lower(btrim(c.name)) = lower(btrim(i.category))
WHERE i.publication_status = 'published'
ORDER BY
  CASE
    WHEN i.category IS NULL OR btrim(i.category) = '' THEN 2
    WHEN c.id IS NULL THEN 1
    ELSE 0
  END ASC,
  COALESCE(c.sort_order, 2147483647) ASC,
  i.sort_order ASC NULLS LAST,
  lower(i.title) ASC,
  i.id ASC
SQL;
}

/**
 * Category catalog order for published content owners only.
 * Scopes by user_id via EXISTS so multi-user DBs do not mix catalogs.
 */
function publicAppCategoryOrderSql(): string
{
    return <<<SQL
SELECT c.name
FROM instruction_categories c
WHERE EXISTS (
  SELECT 1
  FROM instructions i
  WHERE i.user_id = c.user_id
    AND i.publication_status = 'published'
)
ORDER BY c.sort_order ASC NULLS LAST, lower(c.name) ASC, c.id ASC
SQL;
}

function publicAppSitemapSql(PDO $pdo): string
{
    return <<<SQL
SELECT i.id, i.title AS name, i.slug, i.category, i.updated_at
FROM instructions i
WHERE i.publication_status = 'published'
ORDER BY i.title ASC NULLS LAST, i.id ASC
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
  i.id,
  i.title AS name,
  i.slug,
  i.description,
  i.featured_image_url,
  i.category,
  i.updated_at,
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
      FROM instruction_steps s
      WHERE s.instruction_id = i.id
    ),
    '[]'::json
  ) AS steps
FROM instructions i
WHERE i.id = ?
  AND i.publication_status = 'published'
LIMIT 1
SQL,
            'params' => [(int) $slugOrId],
        ];
    }

    return [
        'sql' => <<<SQL
SELECT
  i.id,
  i.title AS name,
  i.slug,
  i.description,
  i.featured_image_url,
  i.category,
  i.updated_at,
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
      FROM instruction_steps s
      WHERE s.instruction_id = i.id
    ),
    '[]'::json
  ) AS steps
FROM instructions i
WHERE lower(i.slug) = lower(?)
  AND i.publication_status = 'published'
LIMIT 1
SQL,
        'params' => [$slugOrId],
    ];
}
