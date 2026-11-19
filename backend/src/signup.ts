import bcrypt from "bcrypt";
import { Router } from "express";
import { z } from "zod";
import { pool } from "./db";

const registration = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
  password: z
    .string()
    .min(1, "Enter a password.")
    .refine(
      (password) => Buffer.byteLength(password) <= 72,
      "Use a password of 72 bytes or fewer.",
    ),
});

export const signup = Router();

signup.post("/register", async (req, res) => {
  const parsed = registration.safeParse(req.body);
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
