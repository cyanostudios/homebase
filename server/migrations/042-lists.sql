-- 042-lists.sql
-- Shared list definitions and per-domain membership (products: one list per product; files: many-to-many).
-- Inspection: snapshot tables for "add list" from Files.

CREATE TABLE IF NOT EXISTS lists (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  namespace VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_lists_user_id ON lists(user_id);
CREATE INDEX idx_lists_namespace ON lists(namespace);
CREATE UNIQUE INDEX IF NOT EXISTS ux_lists_user_namespace_name ON lists(user_id, namespace, name);

-- Products: one list per product (folder behaviour)
CREATE TABLE IF NOT EXISTS product_list_items (
  list_id INT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (list_id, product_id)
);

CREATE INDEX idx_product_list_items_user_id ON product_list_items(user_id);
CREATE INDEX idx_product_list_items_product_id ON product_list_items(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_product_list_items_user_product ON product_list_items(user_id, product_id);

-- Files: many-to-many (same file can be in multiple lists)
CREATE TABLE IF NOT EXISTS file_list_items (
  list_id INT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  file_id INT NOT NULL REFERENCES user_files(id) ON DELETE CASCADE,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (list_id, file_id)
);

CREATE INDEX idx_file_list_items_user_id ON file_list_items(user_id);
CREATE INDEX idx_file_list_items_file_id ON file_list_items(file_id);

-- Inspection: attached list snapshot (one row per "added list" on a project)
CREATE TABLE IF NOT EXISTS inspection_project_file_lists (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  project_id INT NOT NULL REFERENCES inspection_projects(id) ON DELETE CASCADE,
  source_list_id INT REFERENCES lists(id) ON DELETE SET NULL,
  source_list_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_inspection_project_file_lists_user_id ON inspection_project_file_lists(user_id);
CREATE INDEX idx_inspection_project_file_lists_project_id ON inspection_project_file_lists(project_id);

-- Inspection: snapshot file rows for each attached list
CREATE TABLE IF NOT EXISTS inspection_project_file_list_items (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  project_file_list_id INT NOT NULL REFERENCES inspection_project_file_lists(id) ON DELETE CASCADE,
  file_id INT NOT NULL REFERENCES user_files(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_inspection_project_file_list_items_user_id ON inspection_project_file_list_items(user_id);
CREATE INDEX idx_inspection_project_file_list_items_project_file_list_id ON inspection_project_file_list_items(project_file_list_id);
CREATE INDEX idx_inspection_project_file_list_items_file_id ON inspection_project_file_list_items(file_id);
