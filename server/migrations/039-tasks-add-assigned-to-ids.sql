-- 039-tasks-add-assigned-to-ids.sql
-- Support multiple assignees for tasks while keeping legacy assigned_to.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS assigned_to_ids TEXT;
