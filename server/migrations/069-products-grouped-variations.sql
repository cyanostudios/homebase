-- 069-products-grouped-variations.sql
-- Grupperade produkter med variationer (Sello, CDON, Fyndiq).
-- parent_product_id: variantens parent (null för parent eller icke-grupperad).
-- group_variation_type: "color"|"size"|"model" (Sello grupptyp).
-- model: fritext för Sello "Modell" variation (inget model_text – ingen fast lista).

ALTER TABLE products ADD COLUMN IF NOT EXISTS parent_product_id INT REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS group_variation_type VARCHAR(20);
ALTER TABLE products ADD COLUMN IF NOT EXISTS model VARCHAR(255);
