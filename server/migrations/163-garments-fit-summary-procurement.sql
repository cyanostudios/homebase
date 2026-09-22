-- 163-garments-fit-summary-procurement.sql
-- List-level supplier/batch order progress for Size summary (independent of person inv_*_ordered)

ALTER TABLE garment_lists
ADD COLUMN IF NOT EXISTS fit_summary_procurement JSONB NOT NULL DEFAULT '{}'::jsonb;
