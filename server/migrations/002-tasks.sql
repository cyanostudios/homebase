-- 002-tasks.sql
-- Tasks table for task management with assignments and due dates

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  mentions JSONB,
  status VARCHAR(50) DEFAULT 'not started',
  priority VARCHAR(50) DEFAULT 'Medium',
  due_date TIMESTAMP,
  assigned_to INT,
  created_from_note INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);