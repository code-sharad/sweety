import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { Router, type Request, type RequestHandler } from "express";
import { registration } from "./signup";
import { pool } from "./db";

const login = registration.pick({ email: true, password: true });
const cookieName = "sweety_session";
const options = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api",
};

function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function sessionHash(req: Request) {
  const token = req.headers.cookie?.match(
    /(?:^|;\s*)sweety_session=([a-f0-9]{64})(?:;|$)/,
  )?.[1];
  return token ? digest(token) : null;
}

export const requireUser: RequestHandler = async (req, res, next) => {
  const result = await pool.query(
    `SELECT u.id, u.name, u.email FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sessionHash(req)],
  );
  if (!result.rowCount) {
    res.status(401).json({ message: "Please log in." });
    return;
  }
  res.locals.user = result.rows[0];
  next();
};

export const sessions = Router();
sessions.post("/login", async (req, res) => {
  const parsed = login.safeParse(req.body);
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
  const token = randomBytes(32).toString("hex");
  const lifetimeSeconds = 7 * 24 * 60 * 60;
  await pool.query(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + $3 * interval '1 second')",
    [digest(token), user.id, lifetimeSeconds],
  );
  res.cookie(cookieName, token, { ...options, maxAge: lifetimeSeconds * 1000 });
  res.json({ id: user.id, name: user.name, email: user.email });
});

sessions.get("/me", requireUser, (_req, res) => {
  res.set("Cache-Control", "no-store").json(res.locals.user);
});

sessions.post("/logout", async (req, res) => {
  await pool.query("DELETE FROM sessions WHERE token_hash = $1", [
    sessionHash(req),
  ]);
  res.clearCookie(cookieName, options).sendStatus(204);
});
