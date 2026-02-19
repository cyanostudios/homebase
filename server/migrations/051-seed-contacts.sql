-- 051-seed-contacts.sql
-- Seed 10 contacts for testing. Inserts for the tenant owner in the tenant schema.
-- Works with schema-per-tenant (local): derives user_id from tenant_X schema name.
-- Skips if contacts already exist (idempotent).

DO $$
DECLARE
  uid INT;
  cnt INT;
BEGIN
  -- Derive user_id from schema name (tenant_1 -> 1). users table lives in public, not in tenant schema.
  uid := (SELECT NULLIF(SUBSTRING(current_schema() FROM '^tenant_(\d+)$'), '')::int);
  IF uid IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO cnt FROM contacts WHERE user_id = uid;
  IF cnt > 0 THEN
    RETURN;
  END IF;

  INSERT INTO contacts (user_id, contact_number, contact_type, company_name, email, phone, organization_number, created_at, updated_at)
  VALUES
    (uid, '1', 'company', 'Anna Andersson', 'anna@example.com', '070-1234567', NULL, NOW(), NOW()),
    (uid, '2', 'company', 'Bygg AB', 'erik.lindqvist@byggab.se', '08-1234567', '556677-8899', NOW(), NOW()),
    (uid, '3', 'company', 'Kontorsmaterial Nord', 'maria@kontorsmaterial.se', '031-123456', '112233-4455', NOW(), NOW()),
    (uid, '4', 'company', 'Svensson Electronic', 'johan@svensson-electronic.se', '040-123456', '223344-5566', NOW(), NOW()),
    (uid, '5', 'company', 'Nordic Design AB', 'sofia@nordic-design.se', '046-123456', '334455-6677', NOW(), NOW()),
    (uid, '6', 'company', 'Erikssons Mekanik', 'lars@erikssons-mekanik.se', '054-123456', '445566-7788', NOW(), NOW()),
    (uid, '7', 'company', 'Grönt Tillvaru', 'emma@gront-tillvaru.se', '018-123456', '556677-8899', NOW(), NOW()),
    (uid, '8', 'company', 'Holm Consulting', 'peter@holm-consulting.se', '011-123456', '667788-9900', NOW(), NOW()),
    (uid, '9', 'company', 'Lundgren Glas', 'lisa@lundgren-glas.se', '013-123456', '778899-0011', NOW(), NOW()),
    (uid, '10', 'company', 'Sandberg Transport', 'olof@sandberg-transport.se', '020-123456', '889900-1122', NOW(), NOW());
END $$;
