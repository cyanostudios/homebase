CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_plugin_access (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  plugin_name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (user_id, plugin_name)
);

CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_sessions_expire" ON sessions (expire);

INSERT INTO users (email, password_hash, role)
VALUES ('admin@local', '$2b$10$X82SgBDx/.Qp6mpJGSxfGu/sn777YkW334iN5Orm7E1/yFlQxiw8m', 'superuser')
ON CONFLICT (email) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      role = 'superuser';

WITH u AS (SELECT id FROM users WHERE email = 'admin@local')
INSERT INTO user_plugin_access (user_id, plugin_name, enabled)
SELECT u.id, p.plugin_name, true
FROM u CROSS JOIN (
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
ON CONFLICT (user_id, plugin_name) DO UPDATE SET enabled = EXCLUDED.enabled;
