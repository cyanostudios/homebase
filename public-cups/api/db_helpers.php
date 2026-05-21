<?php

declare(strict_types=1);

/**
 * Shared helpers for public-cups API scripts (tenant Postgres schema may lag migrations).
 */
function publicCupsTableHasColumn(PDO $pdo, string $table, string $column): bool
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
 * SQL for listing public cups. Omits deleted_at filter if migration 070 not applied yet.
 */
function publicCupsListSql(PDO $pdo): string
{
    $deletedFilter = publicCupsTableHasColumn($pdo, 'cups', 'deleted_at')
        ? '  AND c.deleted_at IS NULL'
        : '';

    $ingestJoin = publicCupsTableHasColumn($pdo, 'cups', 'ingest_source_id')
        ? 'LEFT JOIN ingest_sources src ON src.id = c.ingest_source_id'
        : '';

    $ingestSelect = publicCupsTableHasColumn($pdo, 'cups', 'ingest_source_id')
        ? 'src.name AS ingest_source_name'
        : 'NULL::text AS ingest_source_name';

    return <<<SQL
SELECT
  c.id,
  c.name,
  c.organizer,
  c.location,
  c.start_date,
  c.end_date,
  c.categories,
  c.featured,
  c.sanctioned,
  c.team_count,
  c.match_format,
  c.registration_url,
  c.featured_image_url,
  c.description,
  c.source_url,
  c.source_type,
  c.updated_at,
  {$ingestSelect}
FROM cups c
{$ingestJoin}
WHERE COALESCE(c.visible, TRUE) = TRUE
{$deletedFilter}
ORDER BY c.start_date ASC NULLS LAST, c.name ASC
SQL;
}

/** Sitemap rows (subset of columns). */
function publicCupsSitemapSql(PDO $pdo): string
{
    $deletedFilter = publicCupsTableHasColumn($pdo, 'cups', 'deleted_at')
        ? '  AND c.deleted_at IS NULL'
        : '';

    return <<<SQL
SELECT c.id, c.name, c.start_date, c.end_date, c.updated_at
FROM cups c
WHERE COALESCE(c.visible, TRUE) = TRUE
{$deletedFilter}
ORDER BY c.start_date ASC NULLS LAST, c.name ASC, c.id ASC
SQL;
}
