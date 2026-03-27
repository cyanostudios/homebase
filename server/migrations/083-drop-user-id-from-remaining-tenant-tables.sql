-- 083-drop-user-id-from-remaining-tenant-tables.sql
-- Tenant schemas only.
-- Removes legacy user_id scoping from remaining tenant data tables now that
-- tenant isolation is handled by schema/database routing.

DO $$
DECLARE
  v_table_name text;
  constraint_name text;
  index_name text;
BEGIN
  FOREACH v_table_name IN ARRAY ARRAY[
    'products',
    'brands',
    'suppliers',
    'manufacturers',
    'channel_product_map',
    'channel_product_overrides',
    'channel_instances',
    'channel_error_log',
    'orders',
    'order_number_counter',
    'customer_first_orders',
    'order_sync_state',
    'cdon_settings',
    'fyndiq_settings',
    'sello_settings',
    'woocommerce_settings',
    'postnord_settings',
    'shipping_senders',
    'shipping_service_presets',
    'googledrive_settings',
    'inspection_projects',
    'inspection_project_files',
    'invoices',
    'invoice_shares',
    'estimates',
    'category_cache'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = v_table_name
        AND column_name = 'user_id'
    ) THEN
      FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        INNER JOIN pg_class tbl ON tbl.oid = c.conrelid
        INNER JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
        INNER JOIN unnest(c.conkey) AS key(attnum) ON TRUE
        INNER JOIN pg_attribute a ON a.attrelid = tbl.oid AND a.attnum = key.attnum
        WHERE ns.nspname = current_schema()
          AND tbl.relname = v_table_name
          AND a.attname = 'user_id'
      LOOP
        EXECUTE format(
          'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
          current_schema(),
          v_table_name,
          constraint_name
        );
      END LOOP;

      FOR index_name IN
        SELECT idx.indexname
        FROM pg_indexes idx
        WHERE idx.schemaname = current_schema()
          AND idx.tablename = v_table_name
          AND idx.indexdef ILIKE '%user_id%'
      LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I.%I', current_schema(), index_name);
      END LOOP;

      EXECUTE format(
        'ALTER TABLE %I.%I DROP COLUMN IF EXISTS user_id CASCADE',
        current_schema(),
        v_table_name
      );
    END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS ux_products_sku
  ON products(sku)
  WHERE sku IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'products'
      AND column_name = 'product_number'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_products_product_number ON products(product_number);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_products_product_number
      ON products(product_number)
      WHERE product_number IS NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_brands_name ON brands(name);
CREATE UNIQUE INDEX IF NOT EXISTS ux_suppliers_name ON suppliers(name);
CREATE UNIQUE INDEX IF NOT EXISTS ux_manufacturers_name ON manufacturers(name);

CREATE INDEX IF NOT EXISTS idx_channel_product_map_channel ON channel_product_map(channel);
CREATE INDEX IF NOT EXISTS idx_channel_product_map_product_id ON channel_product_map(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_channel_product_map_product_channel_instance
  ON channel_product_map(product_id, channel, channel_instance_id) NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS idx_channel_product_overrides_product_id
  ON channel_product_overrides(product_id);
CREATE INDEX IF NOT EXISTS idx_channel_product_overrides_channel_instance
  ON channel_product_overrides(channel, instance);
CREATE INDEX IF NOT EXISTS idx_channel_product_overrides_instance_id
  ON channel_product_overrides(channel_instance_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_channel_product_overrides_product_channel_instance
  ON channel_product_overrides(product_id, channel, instance);
CREATE UNIQUE INDEX IF NOT EXISTS ux_channel_product_overrides_instance_product
  ON channel_product_overrides(channel_instance_id, product_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_channel_instances_channel_instance_key
  ON channel_instances(channel, instance_key);
CREATE INDEX IF NOT EXISTS idx_channel_instances_channel
  ON channel_instances(channel);

CREATE INDEX IF NOT EXISTS idx_channel_error_log_channel ON channel_error_log(channel);
CREATE INDEX IF NOT EXISTS idx_channel_error_log_created_at ON channel_error_log(created_at);

CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_channel_instance_order
  ON orders(channel, COALESCE(channel_instance_id, 0), channel_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_order_number
  ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_placed_at ON orders(placed_at);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'order_sync_state'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      INNER JOIN pg_class tbl ON tbl.oid = c.conrelid
      INNER JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
      WHERE ns.nspname = current_schema()
        AND tbl.relname = 'order_sync_state'
        AND c.conname = 'order_sync_state_pkey'
    ) THEN
      ALTER TABLE order_sync_state
        ADD CONSTRAINT order_sync_state_pkey PRIMARY KEY (channel, channel_instance_id);
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_sync_state_next_run
  ON order_sync_state(next_run_at)
  WHERE next_run_at IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_customer_first_orders_customer_identifier
  ON customer_first_orders(customer_identifier_norm);

CREATE UNIQUE INDEX IF NOT EXISTS ux_cdon_settings_singleton ON cdon_settings((1));
CREATE UNIQUE INDEX IF NOT EXISTS ux_fyndiq_settings_singleton ON fyndiq_settings((1));
CREATE UNIQUE INDEX IF NOT EXISTS ux_sello_settings_singleton ON sello_settings((1));
CREATE UNIQUE INDEX IF NOT EXISTS ux_woocommerce_settings_singleton ON woocommerce_settings((1));
CREATE UNIQUE INDEX IF NOT EXISTS ux_postnord_settings_singleton ON postnord_settings((1));
CREATE UNIQUE INDEX IF NOT EXISTS ux_googledrive_settings_singleton ON googledrive_settings((1));

CREATE INDEX IF NOT EXISTS idx_shipping_senders_name ON shipping_senders(name);
CREATE UNIQUE INDEX IF NOT EXISTS ux_shipping_service_presets_code
  ON shipping_service_presets(code);

CREATE INDEX IF NOT EXISTS idx_inspection_projects_created_at
  ON inspection_projects(created_at);
CREATE INDEX IF NOT EXISTS idx_inspection_project_files_project_id
  ON inspection_project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_inspection_project_files_file_id
  ON inspection_project_files(file_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_invoice_number_unique
  ON invoices(invoice_number)
  WHERE invoice_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_contact_id ON invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoice_shares_invoice_id ON invoice_shares(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_shares_share_token ON invoice_shares(share_token);

CREATE INDEX IF NOT EXISTS idx_estimates_estimate_number ON estimates(estimate_number);
CREATE INDEX IF NOT EXISTS idx_estimates_contact_id ON estimates(contact_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimates_valid_to ON estimates(valid_to);
CREATE INDEX IF NOT EXISTS idx_estimates_share_token ON estimates(share_token);
CREATE INDEX IF NOT EXISTS idx_estimates_created_at ON estimates(created_at);

CREATE UNIQUE INDEX IF NOT EXISTS ux_category_cache_key
  ON category_cache(cache_key);
