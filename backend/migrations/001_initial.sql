BEGIN;

CREATE TABLE users (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL CHECK (name ~ '[^[:space:]]'),
    email text NOT NULL UNIQUE CHECK (email <> '' AND email = lower(btrim(email))),
    password_hash text NOT NULL
);

CREATE TABLE readings (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users (id),
    reading_date date NOT NULL,
    slot text NOT NULL CHECK (slot IN (
        'morning_fasting', 'after_breakfast', 'after_lunch', 'after_dinner'
    )),
    value_mg_dl integer NOT NULL CHECK (value_mg_dl BETWEEN 40 AND 600),
    UNIQUE (user_id, reading_date, slot)
);

COMMIT;
