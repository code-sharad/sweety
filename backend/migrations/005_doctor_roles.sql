BEGIN;

ALTER TABLE users ADD COLUMN role text NOT NULL DEFAULT 'patient'
    CHECK (role IN ('patient', 'doctor'));

CREATE TABLE doctor_patient_assignments (
    doctor_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    patient_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    PRIMARY KEY (doctor_id, patient_id),
    CHECK (doctor_id <> patient_id)
);

COMMIT;
