CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  mentions JSONB NOT NULL DEFAULT '[]',
  status TEXT DEFAULT 'not started',
  priority TEXT DEFAULT 'Medium',
  due_date TIMESTAMP NULL,
  assigned_to TEXT NULL,
  created_from_note TEXT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
