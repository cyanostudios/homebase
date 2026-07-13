-- 096-guide-approval-status.sql
-- Content Production Pipeline P2: HITL approval_status on stops and variants

ALTER TABLE guide_stops
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) NOT NULL DEFAULT 'draft';

ALTER TABLE guide_variant_presentations
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) NOT NULL DEFAULT 'draft';

CREATE INDEX IF NOT EXISTS idx_guide_stops_approval_status ON guide_stops(approval_status);
CREATE INDEX IF NOT EXISTS idx_guide_variant_presentations_approval_status
  ON guide_variant_presentations(approval_status);

-- Published variants are treated as already editor-approved.
UPDATE guide_variant_presentations
SET approval_status = 'approved'
WHERE publication_status = 'published'
  AND approval_status = 'draft';
