-- 107-guide-audio-presentations.sql
-- Audio metadata 1:1 under place-level guide_presentations (prep / P-AUDIO_GENERATION_PREP).
-- Drop any legacy guide_audio (variant_presentation_id) left after incomplete 106 applies.

DROP TABLE IF EXISTS guide_audio;

CREATE TABLE guide_audio (
  id SERIAL PRIMARY KEY,
  presentation_id INTEGER NOT NULL UNIQUE REFERENCES guide_presentations(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  provider_key VARCHAR(50) NOT NULL DEFAULT 'noop',
  storage_ref VARCHAR(500),
  duration_ms INTEGER,
  mime_type VARCHAR(100),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guide_audio_presentation_id
  ON guide_audio(presentation_id);

CREATE INDEX IF NOT EXISTS idx_guide_audio_status ON guide_audio(status);
