import "dotenv/config";
import { pool } from "../db/pool";
import { startDailyReminderWorker } from "./daily-reminders";

async function main() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("Set REDIS_URL to run the daily reminder worker.");

  const worker = await startDailyReminderWorker(url);
  console.log("Sweety daily reminder worker started");

  async function shutdown() {
    await worker.close();
    await pool.end();
  }

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => void shutdown().catch(reportError));
  }
}

function reportError(error: unknown) {
  console.error(error);
  process.exitCode = 1;
}

void main().catch(reportError);
