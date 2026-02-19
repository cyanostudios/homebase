-- 050-contact-lists.sql
-- Contact lists (namespace 'contacts' in lists table).
-- Same pattern as file_list_items: many-to-many between lists and contacts.

CREATE TABLE IF NOT EXISTS contact_list_items (
  list_id INT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  contact_id INT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (list_id, contact_id)
);

CREATE INDEX idx_contact_list_items_user_id ON contact_list_items(user_id);
CREATE INDEX idx_contact_list_items_contact_id ON contact_list_items(contact_id);
CREATE INDEX idx_contact_list_items_list_id ON contact_list_items(list_id);
