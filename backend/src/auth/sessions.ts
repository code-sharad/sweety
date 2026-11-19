import { createHash, randomBytes } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";
import { pool } from "../db/pool";

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

export async function startSession(userId: number, res: Response) {
  const token = randomBytes(32).toString("hex");
  const lifetimeSeconds = 7 * 24 * 60 * 60;
  await pool.query(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + $3 * interval '1 second')",
    [digest(token), userId, lifetimeSeconds],
  );
  res.cookie(cookieName, token, { ...options, maxAge: lifetimeSeconds * 1000 });
}

export async function endSession(req: Request, res: Response) {
  await pool.query("DELETE FROM sessions WHERE token_hash = $1", [
    sessionHash(req),
  ]);
  res.clearCookie(cookieName, options);
}
