CREATE TABLE IF NOT EXISTS template_fields (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    key TEXT NOT NULL,
    label TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
        'text', 'textarea', 'number', 'currency', 'duration', 'weight',
        'distance', 'percentage', 'checkbox', 'select', 'multiselect',
        'date', 'datetime', 'time'
    )),
    required INTEGER NOT NULL DEFAULT 0,
    default_value TEXT,           -- JSON: string/number/boolean/array/null
    options TEXT NOT NULL DEFAULT '[]', -- JSON [{value,label}], só select/multiselect
    placeholder TEXT,
    read_only INTEGER NOT NULL DEFAULT 0, -- arquitetura preparada, sem uso ainda
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (template_id) REFERENCES templates (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_template_fields_template_id ON template_fields (template_id);
