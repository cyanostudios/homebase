<?php

declare(strict_types=1);

/**
 * Shared helpers for public-app SQL (tenant schema may lag migrations).
 * Replace table/column names when wiring a real domain (items → cups, guides, …).
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

/**
 * List SQL skeleton — assumes table `items` with visible + optional deleted_at / category / steps.
 * Rewrite SELECT columns for your domain.
 */
function publicAppListSql(PDO $pdo): string
{
    $deletedFilter = publicAppTableHasColumn($pdo, 'items', 'deleted_at')
        ? '  AND i.deleted_at IS NULL'
        : '';
    $categorySelect = publicAppTableHasColumn($pdo, 'items', 'category')
        ? '  i.category,'
        : '  NULL::text AS category,';
    $stepsSelect = publicAppTableHasColumn($pdo, 'items', 'steps')
        ? '  i.steps,'
        : '  NULL::jsonb AS steps,';

    return <<<SQL
SELECT
  i.id,
  i.name,
  i.slug,
  i.description,
  i.featured_image_url,
{$categorySelect}
{$stepsSelect}
  i.updated_at
FROM items i
WHERE COALESCE(i.visible, TRUE) = TRUE
{$deletedFilter}
ORDER BY i.name ASC NULLS LAST, i.id ASC
SQL;
}

/**
 * Optional category catalog order for listing chips/rows.
 * Stub returns empty — wire to your domain catalog when available.
 * Keep this generic — do not hard-wire a domain-specific catalog table here.
 *
 * @return list<string>
 */
function publicAppCategoryOrder(PDO $pdo): array
{
    // Placeholder: return ordered category names when you have a catalog table, e.g.:
    // SELECT name FROM your_categories WHERE … ORDER BY sort_order ASC, name ASC
    unset($pdo);

    return [];
}

/** Sitemap rows (subset). */
function publicAppSitemapSql(PDO $pdo): string
{
    $deletedFilter = publicAppTableHasColumn($pdo, 'items', 'deleted_at')
        ? '  AND i.deleted_at IS NULL'
        : '';
    $categorySelect = publicAppTableHasColumn($pdo, 'items', 'category')
        ? '  i.category,'
        : '  NULL::text AS category,';

    return <<<SQL
SELECT i.id, i.name, i.slug,{$categorySelect} i.updated_at
FROM items i
WHERE COALESCE(i.visible, TRUE) = TRUE
{$deletedFilter}
ORDER BY i.name ASC NULLS LAST, i.id ASC
SQL;
}

/**
 * Single-item lookup by slug (or numeric id fallback).
 *
 * @return array{sql: string, params: array<int, mixed>}
 */
function publicAppItemBySlugSql(PDO $pdo, string $slugOrId): array
{
    $deletedFilter = publicAppTableHasColumn($pdo, 'items', 'deleted_at')
        ? '  AND i.deleted_at IS NULL'
        : '';
    $categorySelect = publicAppTableHasColumn($pdo, 'items', 'category')
        ? '  i.category,'
        : '  NULL::text AS category,';
    $stepsSelect = publicAppTableHasColumn($pdo, 'items', 'steps')
        ? '  i.steps,'
        : '  NULL::jsonb AS steps,';

    if (ctype_digit($slugOrId)) {
        return [
            'sql' => <<<SQL
SELECT i.id, i.name, i.slug, i.description, i.featured_image_url,
{$categorySelect}
{$stepsSelect}
  i.updated_at
FROM items i
WHERE i.id = ?
  AND COALESCE(i.visible, TRUE) = TRUE
{$deletedFilter}
LIMIT 1
SQL,
            'params' => [(int) $slugOrId],
        ];
    }

    return [
        'sql' => <<<SQL
SELECT i.id, i.name, i.slug, i.description, i.featured_image_url,
{$categorySelect}
{$stepsSelect}
  i.updated_at
FROM items i
WHERE lower(i.slug) = lower(?)
  AND COALESCE(i.visible, TRUE) = TRUE
{$deletedFilter}
LIMIT 1
SQL,
        'params' => [$slugOrId],
    ];
}
