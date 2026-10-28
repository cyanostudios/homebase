-- 186-site-audit-runs-cancelled.sql
-- Allow user-cancelled audit runs (stop button).

ALTER TABLE site_audit_runs DROP CONSTRAINT IF EXISTS site_audit_runs_status_check;

ALTER TABLE site_audit_runs
  ADD CONSTRAINT site_audit_runs_status_check
  CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled'));
