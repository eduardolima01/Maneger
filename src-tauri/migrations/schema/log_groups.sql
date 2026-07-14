CREATE TABLE IF NOT EXISTS log_groups (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES templates (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_log_groups_project_id ON log_groups (project_id);
CREATE INDEX IF NOT EXISTS idx_log_groups_template_id ON log_groups (template_id);
