BEGIN;
CREATE TABLE sessions (
    token_hash text PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
);
COMMIT;
