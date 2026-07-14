CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    cover_path TEXT,
    archived INTEGER NOT NULL DEFAULT 0
);
