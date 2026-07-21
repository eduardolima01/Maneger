CREATE TABLE IF NOT EXISTS kanban_cards (
    id TEXT PRIMARY KEY,
    kanban_id TEXT NOT NULL,
    column_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    cover_path TEXT,
    color TEXT,
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    labels TEXT NOT NULL DEFAULT '[]',
    assigned_to TEXT,
    start_date TEXT,
    due_date TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (kanban_id) REFERENCES kanbans (id) ON DELETE CASCADE,
    FOREIGN KEY (column_id) REFERENCES kanban_columns (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kanban_cards_kanban_id ON kanban_cards (kanban_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_column_id ON kanban_cards (column_id);
