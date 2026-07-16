CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    parent_project_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    cover_path TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (parent_project_id) REFERENCES projects (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_projects_parent_id ON projects (parent_project_id);

