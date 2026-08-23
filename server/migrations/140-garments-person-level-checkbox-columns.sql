-- 140-garments-person-level-checkbox-columns.sql
-- Betalt + Blankett Fogis are person-level (not per garment).
-- Shorts / Tröja / Strumpor each have Beställt / Levererat / Utdelat (11 columns total).

UPDATE garment_lists
SET
  checkbox_columns = '[
    {"id":"person_betalt","label":"Betalt","sortOrder":0},
    {"id":"person_blankett_fogis","label":"Blankett Fogis","sortOrder":1},
    {"id":"shorts_bestallt","label":"Beställt","group":"Shorts","sortOrder":2},
    {"id":"shorts_levererat","label":"Levererat","group":"Shorts","sortOrder":3},
    {"id":"shorts_utdelat","label":"Utdelat","group":"Shorts","sortOrder":4},
    {"id":"troja_bestallt","label":"Beställt","group":"Tröja","sortOrder":5},
    {"id":"troja_levererat","label":"Levererat","group":"Tröja","sortOrder":6},
    {"id":"troja_utdelat","label":"Utdelat","group":"Tröja","sortOrder":7},
    {"id":"strumpor_bestallt","label":"Beställt","group":"Strumpor","sortOrder":8},
    {"id":"strumpor_levererat","label":"Levererat","group":"Strumpor","sortOrder":9},
    {"id":"strumpor_utdelat","label":"Utdelat","group":"Strumpor","sortOrder":10}
  ]'::jsonb,
  updated_at = CURRENT_TIMESTAMP;
