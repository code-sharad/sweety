import "dotenv/config";
import bcrypt from "bcrypt";
import { pool } from "./db/pool";

const email = "demo@sweety.example";
const password = "sweety-local-demo";

async function seed() {
  if (!process.env.DATABASE_URL)
    throw new Error("Set DATABASE_URL before seeding.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING RETURNING id`,
      ["Demo Patient", email, await bcrypt.hash(password, 12)],
    );
    let userId = inserted.rows[0]?.id;
    if (!userId) {
      const existing = await client.query(
        "SELECT id, password_hash FROM users WHERE email = $1 FOR UPDATE",
        [email],
      );
      if (
        !existing.rowCount ||
        !(await bcrypt.compare(password, existing.rows[0].password_hash))
      ) {
        throw new Error(
          "Demo email is already in use with different credentials.",
        );
      }
      userId = existing.rows[0].id;
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
      `Demo patient ready. Added ${samples.rowCount} sample readings.`,
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
