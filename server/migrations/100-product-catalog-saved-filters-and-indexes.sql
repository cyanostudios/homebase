-- Saved product catalog filter views (per tenant) + common catalog filter B-tree targets.
-- Verify heavy combinations with EXPLAIN in staging before high traffic.

CREATE TABLE IF NOT EXISTS product_saved_filters (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  definition JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_product_saved_filters_name_lower
  ON product_saved_filters (lower(name));

CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products (brand_id) WHERE brand_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products (supplier_id) WHERE supplier_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_manufacturer_id ON products (manufacturer_id) WHERE manufacturer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_quantity ON products (quantity);

CREATE INDEX IF NOT EXISTS idx_products_price_amount ON products (price_amount);

CREATE INDEX IF NOT EXISTS idx_products_lagerplats_lower ON products (lower(lagerplats)) WHERE lagerplats IS NOT NULL AND btrim(lagerplats) <> '';

-- Typical channel catalog filter: (channel_instance_id) + (product_id text join to products)
CREATE INDEX IF NOT EXISTS idx_channel_product_map_instance_product
  ON channel_product_map (channel_instance_id, product_id)
  WHERE channel_instance_id IS NOT NULL;
