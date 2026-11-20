import { Router } from "express";
import { loginSchema } from "../auth/schemas";
import { requireRole, requireUser } from "../auth/sessions";
import { pool } from "../db/pool";
import { readingIdSchema as doctorIdSchema } from "../readings/schema";

export const reportSharingRouter = Router();
reportSharingRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
reportSharingRouter.use(requireUser, requireRole("patient"));

reportSharingRouter.get("/", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT d.id, d.name, d.email
     FROM doctor_patient_assignments a
     JOIN users d ON d.id = a.doctor_id
     WHERE a.patient_id = $1
     ORDER BY d.name, d.id`,
    [res.locals.user.id],
  );
  res.json(rows);
});

const lookupSchema = loginSchema.pick({ email: true });
reportSharingRouter.post("/lookup", async (req, res) => {
  const parsed = lookupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Enter a valid email address." });
    return;
  }
  const { rows } = await pool.query(
    "SELECT id, name, email FROM users WHERE email = $1 AND role = 'doctor'",
    [parsed.data.email],
  );
  if (!rows.length) {
    res.status(404).json({ message: "No doctor account matches that email." });
    return;
  }
  res.json(rows[0]);
});

reportSharingRouter.use("/:doctorId", (req, res, next) => {
  const parsed = doctorIdSchema.safeParse(req.params.doctorId);
  if (!parsed.success) {
    res.status(400).json({ message: "Enter a valid doctor ID." });
    return;
  }
  res.locals.doctorId = parsed.data;
  next();
});

reportSharingRouter.put("/:doctorId", async (_req, res) => {
  const { rows } = await pool.query(
    `WITH doctor AS (
       SELECT id, name, email FROM users WHERE id = $1 AND role = 'doctor'
     ), grant_access AS (
       INSERT INTO doctor_patient_assignments (doctor_id, patient_id)
       SELECT id, $2 FROM doctor
       ON CONFLICT DO NOTHING
     )
     SELECT id, name, email FROM doctor`,
    [res.locals.doctorId, res.locals.user.id],
  );
  if (!rows.length) {
    res.status(404).json({ message: "Doctor account not found." });
    return;
  }
  res.json(rows[0]);
});

reportSharingRouter.delete("/:doctorId", async (_req, res) => {
  await pool.query(
    "DELETE FROM doctor_patient_assignments WHERE doctor_id = $1 AND patient_id = $2",
    [res.locals.doctorId, res.locals.user.id],
  );
  res.sendStatus(204);
});
