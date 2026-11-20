CREATE TABLE daily_reminders (
    user_id integer NOT NULL REFERENCES users (id),
    reading_date date NOT NULL,
    reading_count smallint NOT NULL CHECK (reading_count BETWEEN 0 AND 3),
    checked_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, reading_date)
);
