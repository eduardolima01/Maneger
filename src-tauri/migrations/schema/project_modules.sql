CREATE TABLE IF NOT EXISTS project_modules (
    project_id TEXT NOT NULL,
    module_key TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (project_id, module_key),
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);
