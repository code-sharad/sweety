import bcrypt from "bcrypt";
import { Router } from "express";
import { pool } from "../db/pool";
import { registrationSchema, loginSchema } from "./schemas";
import { requireUser, startSession, endSession } from "./sessions";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    res.status(400).json({ field: issue.path[0], message: issue.message });
    return;
  }

  const { name, email, password } = parsed.data;
  const hash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING RETURNING id, name, email`,
    [name, email, hash],
  );
  if (!result.rowCount) {
    res
      .status(409)
      .json({ field: "email", message: "This email is already registered." });
    return;
  }
  res.status(201).json(result.rows[0]);
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    res.status(400).json({ field: issue.path[0], message: issue.message });
    return;
  }
  const result = await pool.query(
    "SELECT id, name, email, password_hash FROM users WHERE email = $1",
    [parsed.data.email],
  );
  const user = result.rows[0];
  if (
    !user ||
    !(await bcrypt.compare(parsed.data.password, user.password_hash))
  ) {
    res.status(401).json({ message: "Invalid email or password." });
    return;
  }
  await startSession(user.id, res);
  res.json({ id: user.id, name: user.name, email: user.email });
});

authRouter.get("/me", requireUser, (_req, res) => {
  res.set("Cache-Control", "no-store").json(res.locals.user);
});

authRouter.post("/logout", async (req, res) => {
  await endSession(req, res);
  res.sendStatus(204);
});
