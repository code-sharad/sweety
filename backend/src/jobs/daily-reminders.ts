import { Queue, Worker } from "bullmq";
import { pool } from "../db/pool";
import { patientDate, patientTimeZone } from "../readings/schema";

const queueName = "daily-reminders";
const schedulerId = "evening-reading-check";

export async function recordDailyReminders(scheduledAt: number) {
  const date = patientDate.format(scheduledAt);
  const result = await pool.query(
    `INSERT INTO daily_reminders (user_id, reading_date, reading_count)
     SELECT u.id, $1::date, count(r.id)
     FROM users u
     LEFT JOIN readings r ON r.user_id = u.id AND r.reading_date = $1::date
     WHERE u.role = 'patient'
     GROUP BY u.id
     HAVING count(r.id) < 4
     ON CONFLICT (user_id, reading_date) DO NOTHING`,
    [date],
  );
  return result.rowCount;
}

export async function startDailyReminderWorker(url: string) {
  const queue = new Queue(queueName, {
    connection: { url, maxRetriesPerRequest: 1 },
  });
  queue.on("error", (error) =>
    console.error("Reminder scheduler error", error),
  );
  try {
    // Keep any run already queued before a worker restart.
    if (!(await queue.getJobScheduler(schedulerId))) {
      await queue.upsertJobScheduler(
        schedulerId,
        { pattern: "0 21 * * *", tz: patientTimeZone },
        {
          opts: {
            attempts: 3,
            backoff: { type: "exponential", delay: 30_000 },
            removeOnComplete: true,
            removeOnFail: 30,
          },
        },
      );
    }
  } finally {
    await queue.close();
  }

  const worker = new Worker(
    queueName,
    (job) => recordDailyReminders(job.opts.prevMillis ?? job.timestamp),
    { connection: { url } },
  );
  worker.on("error", (error) => console.error("Reminder worker error", error));
  worker.on("failed", (_job, error) =>
    console.error("Reminder check failed", error),
  );
  return worker;
}
