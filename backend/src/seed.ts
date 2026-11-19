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
    await client.query(
      `INSERT INTO readings (user_id, reading_date, slot, value_mg_dl) VALUES
       ($1, '2024-02-29', 'morning_fasting', 96),
       ($1, '2024-03-01', 'after_breakfast', 128),
       ($1, '2024-03-15', 'morning_fasting', 94),
       ($1, '2024-03-15', 'after_lunch', 132)
       ON CONFLICT (user_id, reading_date, slot) DO NOTHING`,
      [userId],
    );
    await client.query("COMMIT");
    console.log("Demo patient ready. Select 2024-03-15 for sample reports.");
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
