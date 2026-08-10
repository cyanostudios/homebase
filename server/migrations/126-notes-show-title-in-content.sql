-- 126-notes-show-title-in-content.sql
-- Per-note option: show title in the note content area (default on)

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS show_title_in_content BOOLEAN NOT NULL DEFAULT true;
