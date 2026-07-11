-- 095-guide-audio.sql
-- Guide CMS Epic 5: Audio metadata under VariantPresentation

CREATE TABLE IF NOT EXISTS guide_audio (
  id SERIAL PRIMARY KEY,
  variant_presentation_id INTEGER NOT NULL UNIQUE REFERENCES guide_variant_presentations(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  provider_key VARCHAR(50) NOT NULL DEFAULT 'noop',
  storage_ref VARCHAR(500),
  duration_ms INTEGER,
  mime_type VARCHAR(100),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guide_audio_variant_presentation_id
  ON guide_audio(variant_presentation_id);

CREATE INDEX IF NOT EXISTS idx_guide_audio_status ON guide_audio(status);
