import { Router } from "express";
import { requireUser } from "../auth/sessions";
import { pool } from "../db/pool";
import { readingSchema, slotLabels } from "./schema";

export const readingsRouter = Router();

readingsRouter.post("/", requireUser, async (req, res) => {
  const parsed = readingSchema.safeParse(req.body);
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

  const day = await pool.query(
    "SELECT count(*)::int AS count FROM readings WHERE user_id = $1 AND reading_date = $2",
    [userId, reading_date],
  );
  const message =
    day.rows[0].count === 4
      ? "You can add only 4 readings per day."
      : `You already have a reading for this slot (${slotLabels[slot]}) on this date.`;
  res.status(409).json({ field: "slot", message });
});
