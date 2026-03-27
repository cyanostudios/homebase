CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenants (
  id SERIAL PRIMARY KEY,
  owner_user_id INTEGER UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  neon_project_id TEXT,
  neon_database_name TEXT,
  neon_connection_string TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','editor','admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','invited')),
  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES public.users(id),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.tenant_plugin_access (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plugin_name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  granted_by_user_id INTEGER REFERENCES public.users(id),
  granted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, plugin_name)
);

CREATE TABLE IF NOT EXISTS public.sessions (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_sessions_expire" ON public.sessions (expire);

INSERT INTO public.users (email, password_hash, role)
VALUES ('admin@local', '$2b$10$X82SgBDx/.Qp6mpJGSxfGu/sn777YkW334iN5Orm7E1/yFlQxiw8m', 'superuser')
ON CONFLICT (email) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      role = 'superuser';

WITH u AS (SELECT id FROM public.users WHERE email = 'admin@local')
INSERT INTO public.tenants (owner_user_id)
SELECT u.id
FROM u
ON CONFLICT (owner_user_id) DO NOTHING;

WITH u AS (SELECT id FROM public.users WHERE email = 'admin@local'),
     t AS (SELECT id AS tenant_id FROM public.tenants WHERE owner_user_id = (SELECT id FROM u))
INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status, created_by)
SELECT t.tenant_id, u.id, 'admin', 'active', u.id
FROM u, t
ON CONFLICT (user_id) DO NOTHING;

WITH u AS (SELECT id FROM public.users WHERE email = 'admin@local'),
     t AS (SELECT id AS tenant_id FROM public.tenants WHERE owner_user_id = (SELECT id FROM u))
INSERT INTO public.tenant_plugin_access (tenant_id, plugin_name, enabled, granted_by_user_id)
SELECT t.tenant_id, p.plugin_name, true, u.id
FROM u, t CROSS JOIN (
  VALUES 
    ('channels'),
    ('contacts'),
    ('estimates'),
    ('notes'),
    ('products'),
    ('rail'),
    ('tasks'),
    ('woocommerce-products')
) AS p(plugin_name)
ON CONFLICT (tenant_id, plugin_name) DO UPDATE SET enabled = EXCLUDED.enabled;
