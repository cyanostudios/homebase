-- 070-drop-products-model-text.sql
-- Ta bort model_text; kolumnen används inte av appen, Sello-import eller kanal-mappare.

ALTER TABLE products DROP COLUMN IF EXISTS model_text;
