import { Router } from "express";
import { requireRole, requireUser } from "../auth/sessions";
import { pool } from "../db/pool";
import { readingIdSchema } from "../readings/schema";
import { sendReport } from "../reports/routes";

export const doctorRouter = Router();
doctorRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
doctorRouter.use(requireUser, requireRole("doctor"));

doctorRouter.get("/patients", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.email
     FROM doctor_patient_assignments a
     JOIN users p ON p.id = a.patient_id AND p.role = 'patient'
     WHERE a.doctor_id = $1
     ORDER BY p.name, p.id`,
    [res.locals.user.id],
  );
  res.json(rows);
});

doctorRouter.get("/patients/:patientId/reports", async (req, res) => {
  const patientId = readingIdSchema.safeParse(req.params.patientId);
  if (!patientId.success) {
    res.status(400).json({ message: "Enter a valid patient ID." });
    return;
  }

  const { rows } = await pool.query<{ report_revision: string }>(
    `SELECT p.report_revision
     FROM doctor_patient_assignments a
     JOIN users p ON p.id = a.patient_id AND p.role = 'patient'
     WHERE a.doctor_id = $1 AND a.patient_id = $2`,
    [res.locals.user.id, patientId.data],
  );
  const patient = rows[0];
  if (!patient) {
    res.status(404).json({ message: "Assigned patient not found." });
    return;
  }

  await sendReport(req, res, patientId.data, patient.report_revision);
});
