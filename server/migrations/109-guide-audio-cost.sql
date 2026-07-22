-- 109-guide-audio-cost.sql
-- Persist estimated TTS cost on guide_audio (manual generate ledger).

ALTER TABLE guide_audio
  ADD COLUMN IF NOT EXISTS cost JSONB;
