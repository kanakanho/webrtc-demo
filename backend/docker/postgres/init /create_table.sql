\c api-db

CREATE TABLE IF NOT EXISTS users (
    id text,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
