CREATE TABLE IF NOT EXISTS kanban_card_groups (
    id TEXT PRIMARY KEY,
    kanban_id TEXT NOT NULL,
    column_id TEXT NOT NULL,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (kanban_id) REFERENCES kanbans (id) ON DELETE CASCADE,
    FOREIGN KEY (column_id) REFERENCES kanban_columns (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kanban_card_groups_kanban_id ON kanban_card_groups (kanban_id);
CREATE INDEX IF NOT EXISTS idx_kanban_card_groups_column_id ON kanban_card_groups (column_id);
