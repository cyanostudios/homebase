-- 103-guide-production-item-failure-code.sql
-- P-GEN-STATUS: persist a stable, credit-free generation failure code on job items
-- so the job API can surface it to Guides (which maps code -> i18n).

ALTER TABLE guide_production_job_items
  ADD COLUMN IF NOT EXISTS failure_code VARCHAR(50);
