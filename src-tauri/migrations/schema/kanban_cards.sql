CREATE TABLE IF NOT EXISTS kanban_cards (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kanban_cards_project_id ON kanban_cards (project_id);
