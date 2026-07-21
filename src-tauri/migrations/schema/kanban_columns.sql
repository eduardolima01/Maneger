CREATE TABLE IF NOT EXISTS kanban_columns (
    id TEXT PRIMARY KEY,
    kanban_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    icon TEXT,
    wip_limit INTEGER,
    visible INTEGER NOT NULL DEFAULT 1,
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (kanban_id) REFERENCES kanbans (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kanban_columns_kanban_id ON kanban_columns (kanban_id);
