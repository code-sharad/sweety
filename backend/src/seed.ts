import "dotenv/config";
import bcrypt from "bcrypt";
import type { PoolClient } from "pg";
import { pool } from "./db/pool";

async function seedAccount(
  client: PoolClient,
  name: string,
  email: string,
  password: string,
  role: "patient" | "doctor",
): Promise<{ id: number; created: boolean }> {
  const inserted = await client.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING RETURNING id`,
    [name, email, await bcrypt.hash(password, 12), role],
  );
  if (inserted.rowCount) return { id: inserted.rows[0].id, created: true };

  const existing = await client.query(
    "SELECT id, password_hash, role FROM users WHERE email = $1 FOR UPDATE",
    [email],
  );
  const account = existing.rows[0];
  if (
    !account ||
    account.role !== role ||
    !(await bcrypt.compare(password, account.password_hash))
  ) {
    throw new Error(
      `Demo email ${email} is in use with a different role or password.`,
    );
  }
  return { id: account.id, created: false };
}

async function seed() {
  if (!process.env.DATABASE_URL)
    throw new Error("Set DATABASE_URL before seeding.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id: userId } = await seedAccount(
      client,
      "Demo Patient",
      "demo@sweety.example",
      "sweety-local-demo",
      "patient",
    );
    const doctor = await seedAccount(
      client,
      "Demo Doctor",
      "doctor@sweety.example",
      "sweety-local-doctor",
      "doctor",
    );
    if (doctor.created) {
      await client.query(
        `INSERT INTO doctor_patient_assignments (doctor_id, patient_id)
         VALUES ($1, $2)`,
        [doctor.id, userId],
      );
    }
    const samples = await client.query(
      `WITH local_clock AS (
         SELECT now() AT TIME ZONE 'Asia/Kolkata' AS local_now
       ), slots(slot, opening_hour, baseline) AS (
         VALUES ('morning_fasting', 0, 94), ('after_breakfast', 8, 120),
                ('after_lunch', 12, 128), ('after_dinner', 19, 123)
       )
       INSERT INTO readings (user_id, reading_date, slot, value_mg_dl)
       SELECT $1, DATE '2026-09-01' + day_offset, slot,
              baseline + (day_offset * 7 + opening_hour * 3) % 23
       FROM local_clock
       CROSS JOIN generate_series(0, local_now::date - DATE '2026-09-01') AS days(day_offset)
       CROSS JOIN slots
       WHERE DATE '2026-09-01' + day_offset < local_now::date
          OR opening_hour <= EXTRACT(HOUR FROM local_now)
       ON CONFLICT (user_id, reading_date, slot) DO NOTHING`,
      [userId],
    );
    await client.query("COMMIT");
    console.log(
      `Demo patient and doctor ready. Added ${samples.rowCount} sample readings.`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

seed()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
