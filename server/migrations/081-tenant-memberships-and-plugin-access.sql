-- 081-tenant-memberships-and-plugin-access.sql
-- Main DB (public schema) only.
--
-- Introduces the canonical multi-user-per-tenant model:
-- - tenants.owner_user_id
-- - tenant_memberships (1 tenant per user)
-- - tenant_plugin_access (plugin access shared per tenant)

-- 1) Add owner_user_id to tenants (backfill from legacy user_id)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS owner_user_id INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'user_id'
  ) THEN
    UPDATE public.tenants
    SET owner_user_id = user_id
    WHERE owner_user_id IS NULL;
  END IF;
END $$;

-- Add FK + NOT NULL only once data is present.
DO $$
BEGIN
  -- FK
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenants_owner_user_id_fkey'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES public.users(id);
  END IF;

  -- NOT NULL (safe after backfill)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'owner_user_id'
      AND is_nullable = 'YES'
  ) THEN
    IF (SELECT COUNT(*) FROM public.tenants WHERE owner_user_id IS NULL) = 0 THEN
      ALTER TABLE public.tenants
        ALTER COLUMN owner_user_id SET NOT NULL;
    END IF;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_owner_user_id ON public.tenants(owner_user_id);

-- 2) Tenant memberships
CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'editor', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'invited')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES public.users(id),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant_id ON public.tenant_memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user_id ON public.tenant_memberships(user_id);

-- 3) Plugin access per tenant
CREATE TABLE IF NOT EXISTS public.tenant_plugin_access (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plugin_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  granted_by_user_id INTEGER REFERENCES public.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, plugin_name)
);

CREATE INDEX IF NOT EXISTS idx_tenant_plugin_access_tenant_id ON public.tenant_plugin_access(tenant_id);

