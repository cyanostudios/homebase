-- 170-sportadmin-page-type.sql
-- Allow club navigation pages (sida/start/sektion/dokument/galleri) as resource type `page`.

ALTER TABLE sportadmin_resources
  DROP CONSTRAINT IF EXISTS sportadmin_resources_type_chk;

ALTER TABLE sportadmin_resources
  ADD CONSTRAINT sportadmin_resources_type_chk
    CHECK (type IN ('organization', 'team', 'page', 'news', 'match', 'event', 'link'));
