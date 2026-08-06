-- 117-instruction-categories.sql
-- Tenant DB: managed category catalog with sort order for instructions plugin

CREATE TABLE IF NOT EXISTS instruction_categories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_instruction_categories_user_lower_name
  ON instruction_categories (user_id, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS idx_instruction_categories_user_sort
  ON instruction_categories (user_id, sort_order ASC, id ASC);

-- Backfill distinct non-empty categories from existing instructions (alpha by name)
INSERT INTO instruction_categories (user_id, name, sort_order)
SELECT
  src.user_id,
  src.name,
  src.rn
FROM (
  SELECT
    user_id,
    btrim(category) AS name,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY lower(btrim(category)) ASC, btrim(category) ASC
    ) AS rn
  FROM (
    SELECT DISTINCT user_id, btrim(category) AS category
    FROM instructions
    WHERE category IS NOT NULL AND btrim(category) <> ''
  ) distinct_cats
) src
WHERE NOT EXISTS (
  SELECT 1
  FROM instruction_categories c
  WHERE c.user_id = src.user_id
    AND lower(btrim(c.name)) = lower(src.name)
);
