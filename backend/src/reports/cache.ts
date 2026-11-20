import { createClient } from "redis";

const ttlSeconds = 300;
const deadlineMs = 150;
const url = process.env.REDIS_URL;

export const reportRedis = url
  ? createClient({
      url,
      disableOfflineQueue: true,
      commandsQueueMaxLength: 100,
    })
  : undefined;

if (reportRedis) {
  // Keep serving reports from PostgreSQL while Redis reconnects.
  reportRedis.on("error", () => {});
  void reportRedis.connect().catch(() => {});
}

async function tryRedis<T>(
  command: (client: NonNullable<typeof reportRedis>) => Promise<T>,
): Promise<T | null> {
  if (!reportRedis?.isReady) return null;

  let timer: NodeJS.Timeout | undefined;
  try {
    const deadline = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), deadlineMs);
    });
    return await Promise.race([command(reportRedis), deadline]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function getCachedReport(key: string) {
  return tryRedis((client) => client.get(key));
}

export function cacheReport(key: string, report: unknown) {
  return tryRedis((client) =>
    client.set(key, JSON.stringify(report), { EX: ttlSeconds }),
  );
}
