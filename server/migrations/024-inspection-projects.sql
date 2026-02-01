-- 024-inspection-projects.sql
-- Inspection projects and project files

CREATE TABLE IF NOT EXISTS inspection_projects (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_inspection_projects_user_id ON inspection_projects(user_id);
CREATE INDEX idx_inspection_projects_created_at ON inspection_projects(created_at);

CREATE TABLE IF NOT EXISTS inspection_project_files (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  project_id INT NOT NULL REFERENCES inspection_projects(id) ON DELETE CASCADE,
  file_id INT NOT NULL REFERENCES user_files(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_inspection_project_files_user_id ON inspection_project_files(user_id);

CREATE INDEX idx_inspection_project_files_project_id ON inspection_project_files(project_id);
CREATE INDEX idx_inspection_project_files_file_id ON inspection_project_files(file_id);
