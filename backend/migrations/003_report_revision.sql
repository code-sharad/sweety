BEGIN;

ALTER TABLE users ADD COLUMN report_revision bigint NOT NULL DEFAULT 0;

CREATE FUNCTION bump_reading_report_revision() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    previous_user_id integer;
    current_user_id integer;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD IS NOT DISTINCT FROM NEW THEN
            RETURN NULL;
        END IF;
        previous_user_id := OLD.user_id;
        current_user_id := NEW.user_id;
    ELSIF TG_OP = 'DELETE' THEN
        previous_user_id := OLD.user_id;
    ELSE
        current_user_id := NEW.user_id;
    END IF;

    UPDATE users SET report_revision = report_revision + 1
    WHERE id IN (previous_user_id, current_user_id);
    RETURN NULL;
END;
$$;

CREATE TRIGGER readings_report_revision
AFTER INSERT OR UPDATE OR DELETE ON readings
FOR EACH ROW EXECUTE FUNCTION bump_reading_report_revision();

COMMIT;
