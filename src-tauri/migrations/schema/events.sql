CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    title TEXT NOT NULL,
    start_at TEXT NOT NULL,  -- ISO local: 'YYYY-MM-DDTHH:mm:ss'
    end_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_events_project_id ON events (project_id);
CREATE INDEX IF NOT EXISTS idx_events_start_at ON events (start_at);
