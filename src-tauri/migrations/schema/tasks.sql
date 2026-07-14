CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    group_id TEXT,
    type TEXT NOT NULL CHECK (type IN ('note', 'checkbox', 'status')),
    title TEXT NOT NULL,
    description TEXT,
    payload TEXT NOT NULL DEFAULT '{}',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES task_groups (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_group_id ON tasks (group_id);
