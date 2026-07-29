CREATE TABLE IF NOT EXISTS kanban_card_checklist_items (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL,
    parent_item_id TEXT,
    title TEXT NOT NULL,
    checked INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (card_id) REFERENCES kanban_cards (id) ON DELETE CASCADE,
    FOREIGN KEY (parent_item_id) REFERENCES kanban_card_checklist_items (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kanban_checklist_card_id ON kanban_card_checklist_items (card_id);
CREATE INDEX IF NOT EXISTS idx_kanban_checklist_parent_item_id ON kanban_card_checklist_items (parent_item_id);
