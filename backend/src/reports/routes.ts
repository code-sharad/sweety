import { Router } from "express";
import { z } from "zod";
import { requireUser } from "../auth/sessions";
import { pool } from "../db/pool";
import { calendarDate, slotLabels } from "../readings/schema";

export const reportsRouter = Router();

const reportFilter = z.object({
  date: calendarDate,
  period: z.enum(
    ["daily", "month_to_date", "previous_month"],
    "Select a valid report period.",
  ),
});

function reportRange({ date, period }: z.infer<typeof reportFilter>) {
  const monthStart = date.slice(0, 7) + "-01";
  if (period === "previous_month") {
    const previousEnd = new Date(monthStart + "T00:00:00Z");
    previousEnd.setUTCDate(0);
    const end = previousEnd.toISOString().slice(0, 10);
    return { start: end.slice(0, 7) + "-01", end };
  }
  return { start: period === "daily" ? date : monthStart, end: date };
}

reportsRouter.get("/", requireUser, async (req, res) => {
  const parsed = reportFilter.safeParse(req.query);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    res.status(400).json({ field: issue.path[0], message: issue.message });
    return;
  }

  const { period } = parsed.data;
  const range = reportRange(parsed.data);
  // PostgreSQL represents ISO year 0000 as 1 BC.
  const sqlDate = (date: string) =>
    date.startsWith("0000") ? "0001" + date.slice(4) + " BC" : date;
  const result = await pool.query(
    `SELECT count(*)::int AS count, max(value_mg_dl) AS highest,
            min(value_mg_dl) AS lowest, round(avg(value_mg_dl), 1)::float8 AS average,
            json_agg(json_build_object('slot', slot, 'value_mg_dl', value_mg_dl)
                     ORDER BY array_position($4::text[], slot))
              FILTER (WHERE $5::boolean) AS readings
     FROM readings
     WHERE user_id = $1 AND reading_date BETWEEN $2::date AND $3::date`,
    [
      res.locals.user.id,
      sqlDate(range.start),
      sqlDate(range.end),
      Object.keys(slotLabels),
      period === "daily",
    ],
  );
  const { readings, ...summary } = result.rows[0];
  res.json({
    period,
    range,
    summary,
    ...(period === "daily" && { readings: readings ?? [] }),
  });
});
