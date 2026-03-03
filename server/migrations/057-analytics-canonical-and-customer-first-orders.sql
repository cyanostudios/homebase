-- Canonical analytics fields on orders + first-order read model for customer segments

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS channel_market_norm VARCHAR(10),
  ADD COLUMN IF NOT EXISTS currency_norm VARCHAR(10),
  ADD COLUMN IF NOT EXISTS customer_identifier_norm VARCHAR(255);

UPDATE orders o
SET
  channel_market_norm = lower(nullif(trim(o.raw->>'market'), '')),
  currency_norm = CASE
    WHEN o.channel IN ('cdon', 'fyndiq') THEN
      CASE lower(nullif(trim(o.raw->>'market'), ''))
        WHEN 'se' THEN 'SEK'
        WHEN 'dk' THEN 'DKK'
        WHEN 'fi' THEN 'EUR'
        WHEN 'no' THEN 'NOK'
        ELSE COALESCE(nullif(trim(upper(o.currency)), ''), 'SEK')
      END
    ELSE COALESCE(nullif(trim(upper(o.currency)), ''), 'SEK')
  END,
  customer_identifier_norm = CASE
    WHEN o.channel IN ('cdon', 'fyndiq')
      THEN nullif(regexp_replace(coalesce(o.customer->>'phone', ''), '[^0-9+]', '', 'g'), '')
    ELSE lower(nullif(trim(o.customer->>'email'), ''))
  END
WHERE
  o.channel_market_norm IS NULL
  OR o.currency_norm IS NULL
  OR o.customer_identifier_norm IS NULL;

CREATE TABLE IF NOT EXISTS customer_first_orders (
  user_id INT NOT NULL,
  customer_identifier_norm VARCHAR(255) NOT NULL,
  first_order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  first_order_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, customer_identifier_norm)
);

INSERT INTO customer_first_orders (
  user_id,
  customer_identifier_norm,
  first_order_id,
  first_order_at
)
SELECT DISTINCT ON (o.user_id, o.customer_identifier_norm)
  o.user_id,
  o.customer_identifier_norm,
  o.id,
  o.placed_at::timestamptz
FROM orders o
WHERE o.customer_identifier_norm IS NOT NULL
ORDER BY o.user_id, o.customer_identifier_norm, o.placed_at ASC NULLS LAST, o.id ASC
ON CONFLICT (user_id, customer_identifier_norm) DO UPDATE
SET
  first_order_id = EXCLUDED.first_order_id,
  first_order_at = EXCLUDED.first_order_at,
  updated_at = NOW();

CREATE OR REPLACE FUNCTION refresh_orders_analytics_canonical()
RETURNS TRIGGER AS $$
BEGIN
  NEW.channel_market_norm := lower(nullif(trim(NEW.raw->>'market'), ''));
  NEW.currency_norm := CASE
    WHEN NEW.channel IN ('cdon', 'fyndiq') THEN
      CASE NEW.channel_market_norm
        WHEN 'se' THEN 'SEK'
        WHEN 'dk' THEN 'DKK'
        WHEN 'fi' THEN 'EUR'
        WHEN 'no' THEN 'NOK'
        ELSE COALESCE(nullif(trim(upper(NEW.currency)), ''), 'SEK')
      END
    ELSE COALESCE(nullif(trim(upper(NEW.currency)), ''), 'SEK')
  END;
  NEW.customer_identifier_norm := CASE
    WHEN NEW.channel IN ('cdon', 'fyndiq')
      THEN nullif(regexp_replace(coalesce(NEW.customer->>'phone', ''), '[^0-9+]', '', 'g'), '')
    ELSE lower(nullif(trim(NEW.customer->>'email'), ''))
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_refresh_orders_analytics_canonical ON orders;
CREATE TRIGGER trg_refresh_orders_analytics_canonical
BEFORE INSERT OR UPDATE OF channel, currency, raw, customer
ON orders
FOR EACH ROW
EXECUTE FUNCTION refresh_orders_analytics_canonical();

CREATE OR REPLACE FUNCTION upsert_customer_first_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_identifier_norm IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO customer_first_orders (
    user_id,
    customer_identifier_norm,
    first_order_id,
    first_order_at
  )
  VALUES (
    NEW.user_id,
    NEW.customer_identifier_norm,
    NEW.id,
    NEW.placed_at::timestamptz
  )
  ON CONFLICT (user_id, customer_identifier_norm) DO UPDATE
  SET
    first_order_id = CASE
      WHEN EXCLUDED.first_order_at IS NULL THEN customer_first_orders.first_order_id
      WHEN customer_first_orders.first_order_at IS NULL THEN EXCLUDED.first_order_id
      WHEN EXCLUDED.first_order_at < customer_first_orders.first_order_at THEN EXCLUDED.first_order_id
      WHEN EXCLUDED.first_order_at = customer_first_orders.first_order_at
        AND EXCLUDED.first_order_id < customer_first_orders.first_order_id THEN EXCLUDED.first_order_id
      ELSE customer_first_orders.first_order_id
    END,
    first_order_at = CASE
      WHEN EXCLUDED.first_order_at IS NULL THEN customer_first_orders.first_order_at
      WHEN customer_first_orders.first_order_at IS NULL THEN EXCLUDED.first_order_at
      WHEN EXCLUDED.first_order_at < customer_first_orders.first_order_at THEN EXCLUDED.first_order_at
      WHEN EXCLUDED.first_order_at = customer_first_orders.first_order_at
        AND EXCLUDED.first_order_id < customer_first_orders.first_order_id THEN EXCLUDED.first_order_at
      ELSE customer_first_orders.first_order_at
    END,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_upsert_customer_first_order ON orders;
CREATE TRIGGER trg_upsert_customer_first_order
AFTER INSERT OR UPDATE OF user_id, customer_identifier_norm, placed_at
ON orders
FOR EACH ROW
EXECUTE FUNCTION upsert_customer_first_order();
