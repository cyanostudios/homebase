-- 114-instructions.sql
-- Tenant DB: instructions plugin (parent + ordered steps)

CREATE TABLE IF NOT EXISTS instructions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  featured_image_url TEXT,
  category VARCHAR(100),
  publication_status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_instructions_user_lower_slug
  ON instructions (user_id, lower(slug));
CREATE INDEX IF NOT EXISTS idx_instructions_publication_status
  ON instructions (publication_status);
CREATE INDEX IF NOT EXISTS idx_instructions_updated_at
  ON instructions (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_instructions_user_id
  ON instructions (user_id);

CREATE TABLE IF NOT EXISTS instruction_steps (
  id SERIAL PRIMARY KEY,
  instruction_id INTEGER NOT NULL REFERENCES instructions(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  sequence_order INTEGER NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_instruction_steps_instruction_sequence
  ON instruction_steps (instruction_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_instruction_steps_instruction_id
  ON instruction_steps (instruction_id);
