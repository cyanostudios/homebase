-- 102-guides-place-identity.sql
-- P-PLACE: additive place-identity snapshot on guide_places.
-- Provider-agnostic PlaceResolved snapshot; geographic_reference is kept for
-- backward compatibility (legacy readers + manual fallback).

ALTER TABLE guide_places ADD COLUMN IF NOT EXISTS place_provider     VARCHAR(50);
ALTER TABLE guide_places ADD COLUMN IF NOT EXISTS place_provider_ref VARCHAR(255);
ALTER TABLE guide_places ADD COLUMN IF NOT EXISTS resolved_name      VARCHAR(255);
ALTER TABLE guide_places ADD COLUMN IF NOT EXISTS formatted_address  VARCHAR(500);
ALTER TABLE guide_places ADD COLUMN IF NOT EXISTS latitude           NUMERIC(9,6);
ALTER TABLE guide_places ADD COLUMN IF NOT EXISTS longitude          NUMERIC(9,6);
ALTER TABLE guide_places ADD COLUMN IF NOT EXISTS country_code       VARCHAR(2);
ALTER TABLE guide_places ADD COLUMN IF NOT EXISTS admin_area         VARCHAR(255);
ALTER TABLE guide_places ADD COLUMN IF NOT EXISTS locality           VARCHAR(255);
ALTER TABLE guide_places ADD COLUMN IF NOT EXISTS place_types        JSONB;
ALTER TABLE guide_places ADD COLUMN IF NOT EXISTS bbox               JSONB;
ALTER TABLE guide_places ADD COLUMN IF NOT EXISTS place_resolved_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_guide_places_provider_ref
  ON guide_places(place_provider, place_provider_ref);
