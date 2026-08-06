-- 116-instructions-sort-order.sql
-- Tenant DB: manual order of guides within a category (and uncategorized bucket)

ALTER TABLE instructions
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Backfill existing rows per user + category (stable by updated_at, then id)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        user_id,
        COALESCE(NULLIF(trim(category), ''), '')
      ORDER BY updated_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM instructions
  WHERE sort_order IS NULL
)
UPDATE instructions i
SET sort_order = ranked.rn
FROM ranked
WHERE i.id = ranked.id;

ALTER TABLE instructions
  ALTER COLUMN sort_order SET DEFAULT 1;

UPDATE instructions
SET sort_order = 1
WHERE sort_order IS NULL;

ALTER TABLE instructions
  ALTER COLUMN sort_order SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_instructions_user_category_sort
  ON instructions (
    user_id,
    (COALESCE(NULLIF(trim(category), ''), '')),
    sort_order ASC,
    id ASC
  );
