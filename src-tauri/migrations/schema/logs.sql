CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}', -- JSON chave/valor, chaves = template_fields.key
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (group_id) REFERENCES log_groups (id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES templates (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_logs_group_id ON logs (group_id);
CREATE INDEX IF NOT EXISTS idx_logs_template_id ON logs (template_id);
