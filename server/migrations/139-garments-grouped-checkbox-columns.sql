-- 139-garments-grouped-checkbox-columns.sql
-- Reset all garment list checkbox columns to the fixed 15-column grouped template
-- (Shorts / Tröja / Strumpor × Betalt / Blankett Fogis / Beställt / Levererat / Utdelat).
-- Stable IDs so checkbox_values keys stay consistent across lists.

UPDATE garment_lists
SET
  checkbox_columns = '[
    {"id":"shorts_betalt","label":"Betalt","group":"Shorts","sortOrder":0},
    {"id":"shorts_blankett_fogis","label":"Blankett Fogis","group":"Shorts","sortOrder":1},
    {"id":"shorts_bestallt","label":"Beställt","group":"Shorts","sortOrder":2},
    {"id":"shorts_levererat","label":"Levererat","group":"Shorts","sortOrder":3},
    {"id":"shorts_utdelat","label":"Utdelat","group":"Shorts","sortOrder":4},
    {"id":"troja_betalt","label":"Betalt","group":"Tröja","sortOrder":5},
    {"id":"troja_blankett_fogis","label":"Blankett Fogis","group":"Tröja","sortOrder":6},
    {"id":"troja_bestallt","label":"Beställt","group":"Tröja","sortOrder":7},
    {"id":"troja_levererat","label":"Levererat","group":"Tröja","sortOrder":8},
    {"id":"troja_utdelat","label":"Utdelat","group":"Tröja","sortOrder":9},
    {"id":"strumpor_betalt","label":"Betalt","group":"Strumpor","sortOrder":10},
    {"id":"strumpor_blankett_fogis","label":"Blankett Fogis","group":"Strumpor","sortOrder":11},
    {"id":"strumpor_bestallt","label":"Beställt","group":"Strumpor","sortOrder":12},
    {"id":"strumpor_levererat","label":"Levererat","group":"Strumpor","sortOrder":13},
    {"id":"strumpor_utdelat","label":"Utdelat","group":"Strumpor","sortOrder":14}
  ]'::jsonb,
  updated_at = CURRENT_TIMESTAMP;
