ALTER TABLE estimates
  DROP CONSTRAINT IF EXISTS estimates_status_check;

ALTER TABLE estimates
  ADD CONSTRAINT estimates_status_check
  CHECK (status IN ('draft','sent','accepted','rejected','invoiced'));
