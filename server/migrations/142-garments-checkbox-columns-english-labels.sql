-- 142-garments-checkbox-columns-english-labels.sql
-- Working language English: update stored checkbox column labels/groups.
-- Stable IDs unchanged (person_betalt, shorts_bestallt, troja_*, strumpor_*).

UPDATE garment_lists
SET
  checkbox_columns = '[
    {"id":"person_betalt","label":"Paid","sortOrder":0},
    {"id":"person_blankett_fogis","label":"Fogis form","sortOrder":1},
    {"id":"shorts_bestallt","label":"Ordered","group":"Shorts","sortOrder":2},
    {"id":"shorts_levererat","label":"Delivered","group":"Shorts","sortOrder":3},
    {"id":"shorts_utdelat","label":"Handed out","group":"Shorts","sortOrder":4},
    {"id":"troja_bestallt","label":"Ordered","group":"Shirt","sortOrder":5},
    {"id":"troja_levererat","label":"Delivered","group":"Shirt","sortOrder":6},
    {"id":"troja_utdelat","label":"Handed out","group":"Shirt","sortOrder":7},
    {"id":"strumpor_bestallt","label":"Ordered","group":"Socks","sortOrder":8},
    {"id":"strumpor_levererat","label":"Delivered","group":"Socks","sortOrder":9},
    {"id":"strumpor_utdelat","label":"Handed out","group":"Socks","sortOrder":10}
  ]'::jsonb,
  updated_at = CURRENT_TIMESTAMP;
