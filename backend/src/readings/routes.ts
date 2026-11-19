import { z } from "zod";
import { DatabaseError } from "pg";
import { Router } from "express";
import { requireUser } from "../auth/sessions";
import { pool } from "../db/pool";
import {
  readingIdSchema,
  readingUpdateSchema,
  readingFilterSchema,
  readingSchema,
  scheduledReadingSchema,
  slotLabels,
} from "./schema";

export const readingsRouter = Router();

readingsRouter.get("/", requireUser, async (req, res) => {
  const parsed = readingFilterSchema.safeParse(req.query);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    res.status(400).json({ field: issue.path[0], message: issue.message });
    return;
  }

  const result = await pool.query(
    `SELECT id, to_char(reading_date, 'YYYY-MM-DD') AS reading_date, slot, value_mg_dl
     FROM readings
     WHERE user_id = $1 AND ($2::date IS NULL OR readings.reading_date = $2)
     ORDER BY readings.reading_date DESC, array_position($3::text[], slot)`,
    [res.locals.user.id, parsed.data.date ?? null, Object.keys(slotLabels)],
  );
  res.json(result.rows);
});

const historyPage = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .pipe(z.int().max(2147483647));
const historyPageSize = 10;
readingsRouter.get("/history", requireUser, async (req, res) => {
  const parsed = historyPage.safeParse(req.query.page ?? "1");
  if (!parsed.success) {
    res.status(400).json({ message: "Enter a valid history page." });
    return;
  }
  const result = await pool.query(
    `SELECT id, to_char(reading_date, 'YYYY-MM-DD') AS reading_date, slot, value_mg_dl
     FROM readings WHERE user_id = $1
     ORDER BY readings.reading_date DESC, array_position($2::text[], slot) DESC
     LIMIT $3 OFFSET $4`,
    [
      res.locals.user.id,
      Object.keys(slotLabels),
      historyPageSize + 1,
      (parsed.data - 1) * historyPageSize,
    ],
  );
  res.json({
    rows: result.rows.slice(0, historyPageSize),
    hasNext: result.rows.length > historyPageSize,
  });
});

readingsRouter.post("/", requireUser, async (req, res) => {
  const parsed = scheduledReadingSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    res.status(400).json({ field: issue.path[0], message: issue.message });
    return;
  }

  const { reading_date, slot, value_mg_dl } = parsed.data;
  const userId = res.locals.user.id;
  const saved = await pool.query(
    `INSERT INTO readings (user_id, reading_date, slot, value_mg_dl)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, reading_date, slot) DO NOTHING
     RETURNING id, to_char(reading_date, 'YYYY-MM-DD') AS reading_date, slot, value_mg_dl`,
    [userId, reading_date, slot, value_mg_dl],
  );
  if (saved.rowCount) {
    res.status(201).json(saved.rows[0]);
    return;
  }

  const message = await conflictMessage(userId, reading_date, slot);
  res.status(409).json({ field: "slot", message });
});

async function conflictMessage(
  userId: number,
  date: string,
  slot: keyof typeof slotLabels,
  excludeId?: number,
) {
  const day = await pool.query(
    "SELECT count(*)::int AS count FROM readings WHERE user_id = $1 AND reading_date = $2 AND id IS DISTINCT FROM $3",
    [userId, date, excludeId ?? null],
  );
  return day.rows[0].count === 4
    ? "You can add only 4 readings per day."
    : `You already have a reading for this slot (${slotLabels[slot]}) on this date.`;
}

readingsRouter.use("/:id", requireUser, (req, res, next) => {
  const id = readingIdSchema.safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ field: "id", message: "Enter a valid reading ID." });
    return;
  }
  res.locals.readingId = id.data;
  next();
});

readingsRouter.patch("/:id", async (req, res) => {
  const id = res.locals.readingId;
  const userId = res.locals.user.id;
  const client = await pool.connect();
  let conflict;
  try {
    await client.query("BEGIN");
    const current = await client.query(
      `SELECT to_char(reading_date, 'YYYY-MM-DD') AS reading_date, slot, value_mg_dl
       FROM readings WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [id, userId],
    );
    if (!current.rowCount) {
      await client.query("ROLLBACK");
      res.status(404).json({ message: "Reading not found." });
      return;
    }
    const changes = readingUpdateSchema.safeParse(req.body);
    const original = current.rows[0];
    const moved =
      changes.success &&
      ((changes.data.reading_date !== undefined &&
        changes.data.reading_date !== original.reading_date) ||
        (changes.data.slot !== undefined &&
          changes.data.slot !== original.slot));
    const schema = moved ? scheduledReadingSchema : readingSchema;
    const updated = changes.success
      ? schema.safeParse({ ...original, ...changes.data })
      : changes;
    if (!updated.success) {
      await client.query("ROLLBACK");
      const issue = updated.error.issues[0]!;
      res.status(400).json({ field: issue.path[0], message: issue.message });
      return;
    }
    const { reading_date, slot, value_mg_dl } = updated.data;
    conflict = { reading_date, slot };
    const saved = await client.query(
      `UPDATE readings SET reading_date = $3, slot = $4, value_mg_dl = $5
       WHERE id = $1 AND user_id = $2
       RETURNING id, to_char(reading_date, 'YYYY-MM-DD') AS reading_date, slot, value_mg_dl`,
      [id, userId, reading_date, slot, value_mg_dl],
    );
    await client.query("COMMIT");
    res.json(saved.rows[0]);
    return;
  } catch (error) {
    await client.query("ROLLBACK");
    if (!(error instanceof DatabaseError && error.code === "23505" && conflict))
      throw error;
  } finally {
    client.release();
  }
  const message = await conflictMessage(
    userId,
    conflict.reading_date,
    conflict.slot,
    id,
  );
  res.status(409).json({ field: "slot", message });
});

readingsRouter.delete("/:id", async (_req, res) => {
  const removed = await pool.query(
    "DELETE FROM readings WHERE id = $1 AND user_id = $2",
    [res.locals.readingId, res.locals.user.id],
  );
  if (!removed.rowCount) {
    res.status(404).json({ message: "Reading not found." });
    return;
  }
  res.sendStatus(204);
});
