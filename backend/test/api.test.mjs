import assert from "node:assert/strict";
import { before, after, beforeEach, test } from "node:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { once } from "node:events";
import EmbeddedPostgres from "embedded-postgres";
import bcrypt from "bcrypt";
import { execFileSync } from "node:child_process";

const testRedisUrl = process.env.TEST_REDIS_URL;
let db, dir, pool, server, url, alice, bob, reportRedis;
const slots = [
  "morning_fasting",
  "after_breakfast",
  "after_lunch",
  "after_dinner",
];

async function request(method, path, cookie, body) {
  const response = await fetch(url + path, {
    method,
    headers: { "content-type": "application/json", ...(cookie && { cookie }) },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    data: response.status === 204 ? null : await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}

async function account(name) {
  const login = { email: name + "@example.test", password: "test password" };
  const registered = await request("POST", "/auth/register", null, {
    ...login,
    name,
  });
  assert.equal(registered.status, 201);
  const session = await request("POST", "/auth/login", null, login);
  assert.equal(session.status, 200);
  return { ...registered.data, cookie: session.cookie };
}

before(async () => {
  const probe = createServer().listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  dir = await mkdtemp(join(tmpdir(), "sweety-test-"));
  const password = randomUUID();
  db = new EmbeddedPostgres({
    databaseDir: join(dir, "pg"),
    port,
    password,
    autoRehydrateSymlinks: true,
    onLog() {},
    postgresFlags: ["-k", dir],
  });
  await db.initialise();
  await db.start();
  process.env.DATABASE_URL = `postgresql://postgres:${password}@127.0.0.1:${port}/postgres`;
  ({ pool } = await import("../dist/db/pool.js"));
  for (const file of (await readdir("migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await pool.query(await readFile(join("migrations", file), "utf8"));
  }
  if (testRedisUrl) process.env.REDIS_URL = testRedisUrl;
  else delete process.env.REDIS_URL;
  const { app } = await import("../dist/app.js");
  ({ reportRedis } = await import("../dist/reports/cache.js"));
  if (reportRedis && !reportRedis.isReady) await once(reportRedis, "ready");
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  url = `http://127.0.0.1:${server.address().port}/api`;
  alice = await account("Alice");
  bob = await account("Bob");
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (reportRedis?.isOpen) reportRedis.destroy();
  await pool?.end();
  await db?.stop();
  if (dir) await rm(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  await pool.query("DELETE FROM readings");
});

function reading(date = "2024-02-29", slot = slots[0], value = 100) {
  return { reading_date: date, slot, value_mg_dl: value };
}
async function add(body, user = alice) {
  const result = await request("POST", "/readings", user.cookie, body);
  assert.equal(result.status, 201);
  return result.data;
}
async function report(period, date, user = alice) {
  const result = await request(
    "GET",
    `/reports?period=${period}&date=${date}`,
    user.cookie,
  );
  assert.equal(result.status, 200);
  return result.data;
}

test("registration, normalized email, password hashing and session lifecycle", async () => {
  const user = await account("Session");
  assert.equal(user.email, "session@example.test");
  const {
    rows: [stored],
  } = await pool.query("SELECT password_hash FROM users WHERE id=$1", [
    user.id,
  ]);
  assert.ok(await bcrypt.compare("test password", stored.password_hash));
  const credentials = { email: " SESSION@EXAMPLE.TEST ", password: "wrong" };
  assert.equal(
    (
      await request("POST", "/auth/register", null, {
        name: "Duplicate",
        ...credentials,
      })
    ).status,
    409,
  );
  assert.equal(
    (await request("POST", "/auth/login", null, credentials)).status,
    401,
  );
  const me = await request("GET", "/auth/me", user.cookie);
  assert.deepEqual(me.data, {
    id: user.id,
    name: "Session",
    email: user.email,
    role: "patient",
  });
  assert.equal(
    (await request("POST", "/auth/logout", user.cookie)).status,
    204,
  );
  assert.equal((await request("GET", "/auth/me", user.cookie)).status, 401);
  for (const [method, path] of [
    ["GET", "/readings"],
    ["POST", "/readings"],
    ["PATCH", "/readings/1"],
    ["DELETE", "/readings/1"],
    ["GET", "/reports"],
  ]) {
    assert.equal((await request(method, path)).status, 401);
  }
});

test("patients can share a date and slot and access only their own readings", async () => {
  const own = await add({ ...reading(), user_id: bob.id });
  await add(reading(undefined, undefined, 600), bob);
  assert.deepEqual(
    (
      await request(
        "GET",
        `/readings?date=2024-02-29&user_id=${bob.id}`,
        alice.cookie,
      )
    ).data,
    [own],
  );
  for (const method of ["PATCH", "DELETE"]) {
    assert.equal(
      (
        await request(
          method,
          "/readings/" + own.id,
          bob.cookie,
          method === "PATCH" ? { value_mg_dl: 88 } : undefined,
        )
      ).status,
      404,
    );
  }
  assert.equal((await report("daily", own.reading_date)).summary.highest, 100);
});

test("reading limits, date validity and slot opening boundaries", async (t) => {
  const fixed = Date.parse("2026-11-18T18:30:00Z"); // Midnight in Kolkata.
  t.mock.timers.enable({ apis: ["Date"], now: fixed });
  const today = "2026-11-19";
  await add(reading(today, slots[0], 40));
  const oldDinner = await add(reading("2026-11-18", slots[3], 600));
  const moved = await request(
    "PATCH",
    "/readings/" + oldDinner.id,
    alice.cookie,
    { reading_date: today },
  );
  assert.equal(moved.status, 400);
  assert.deepEqual(
    (await request("GET", "/readings?date=2026-11-18", alice.cookie)).data,
    [oldDinner],
  );
  for (const patch of [
    { value_mg_dl: undefined },
    { value_mg_dl: 39 },
    { value_mg_dl: 601 },
    { value_mg_dl: 40.5 },
    { slot: "unknown" },
    { reading_date: "2026-02-29" },
    { reading_date: "2026-11-20" },
  ]) {
    assert.equal(
      (
        await request("POST", "/readings", alice.cookie, {
          ...reading(),
          ...patch,
        })
      ).status,
      400,
    );
  }
  for (const [slot, hour] of [
    [slots[1], 8],
    [slots[2], 12],
    [slots[3], 19],
  ]) {
    const opens = fixed + hour * 3600000;
    t.mock.timers.setTime(opens - 1);
    const body = reading(today, slot);
    assert.equal(
      (await request("POST", "/readings", alice.cookie, body)).status,
      400,
    );
    t.mock.timers.setTime(opens);
    await add(body);
  }
});

test("concurrent duplicates, four-slot cap and atomic edits", async () => {
  const results = await Promise.all(
    Array.from({ length: 4 }, () =>
      request("POST", "/readings", alice.cookie, reading()),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409, 409]);
  for (const slot of slots.slice(1)) await add(reading(undefined, slot));
  const full = await request("POST", "/readings", alice.cookie, reading());
  assert.equal(full.status, 409);
  assert.match(full.data.message, /4 readings/);
  const path = "/readings/" + results.find((r) => r.status === 201).data.id;
  const updated = await request("PATCH", path, alice.cookie, {
    value_mg_dl: 123,
  });
  assert.equal(updated.status, 200);
  for (const [patch, status] of [
    [{ slot: slots[3], value_mg_dl: 200 }, 409],
    [{ value_mg_dl: 38 }, 400],
    [{}, 400],
  ]) {
    assert.equal(
      (await request("PATCH", path, alice.cookie, patch)).status,
      status,
    );
    const list = await request("GET", "/readings", alice.cookie);
    assert.equal(list.data.length, 4);
    assert.deepEqual(list.data[0], updated.data);
  }
  assert.equal((await request("DELETE", path, alice.cookie)).status, 204);
  assert.equal((await request("DELETE", path, alice.cookie)).status, 404);
});

test("inclusive report ranges, slot order, rounding and changes after edit and delete", async () => {
  await add(reading("2023-12-31"));
  await add(reading("2024-02-01", slots[2], 80));
  const dinner = await add(reading("2024-02-29", slots[3], 110));
  await add(reading("2024-02-29", slots[0], 91));
  await add(reading("2024-03-01"));
  const daily = await report("daily", "2024-02-29");
  assert.deepEqual(daily.readings, [
    { slot: slots[0], value_mg_dl: 91 },
    { slot: slots[3], value_mg_dl: 110 },
  ]);
  const month = await report("previous_month", "2024-03-08");
  assert.deepEqual(month.range, { start: "2024-02-01", end: "2024-02-29" });
  assert.deepEqual(month.summary, {
    count: 3,
    lowest: 80,
    highest: 110,
    average: 93.7,
  });
  const mtd = await report("month_to_date", "2024-02-28");
  assert.deepEqual(mtd.range, { start: "2024-02-01", end: "2024-02-28" });
  assert.equal(mtd.summary.count, 1);
  assert.deepEqual(mtd.series, [
    { date: "2024-02-01", slot: slots[2], value_mg_dl: 80 },
  ]);
  assert.equal(month.series.length, 3);
  const january = await report("previous_month", "2024-01-01");
  assert.deepEqual(january.range, { start: "2023-12-01", end: "2023-12-31" });
  assert.equal(january.summary.count, 1);
  const empty = await report("daily", "2024-02-10");
  assert.deepEqual(empty.summary, {
    count: 0,
    lowest: null,
    highest: null,
    average: null,
  });
  assert.deepEqual(empty.readings, []);
  const path = "/readings/" + dinner.id;
  assert.equal(
    (await request("PATCH", path, alice.cookie, { value_mg_dl: 101 })).status,
    200,
  );
  assert.equal((await report("daily", "2024-02-29")).summary.average, 96);
  assert.equal((await request("DELETE", path, alice.cookie)).status, 204);
  assert.equal((await report("daily", "2024-02-29")).summary.average, 91);
});

test("patients can share only their own reports and revoke even cached access", async () => {
  const credentials = {
    email: "doctor@example.test",
    password: "test password",
  };
  const registered = await request("POST", "/auth/register", null, {
    ...credentials,
    name: "Doctor",
    role: "doctor",
  });
  assert.equal(registered.status, 201);
  assert.equal(registered.data.role, "patient");
  const doctorId = registered.data.id;
  await pool.query("UPDATE users SET role = 'doctor' WHERE id = $1", [
    doctorId,
  ]);
  const session = await request("POST", "/auth/login", null, credentials);
  assert.equal(session.status, 200);
  assert.equal(session.data.role, "doctor");
  const { cookie } = session;
  const patientsPath = "/doctor/patients";
  assert.equal((await request("GET", patientsPath)).status, 401);
  assert.equal((await request("GET", patientsPath, alice.cookie)).status, 403);
  assert.deepEqual((await request("GET", patientsPath, cookie)).data, []);
  const sharingPath = "/report-sharing";
  const grantPath = `${sharingPath}/${doctorId}`;
  assert.equal((await request("GET", sharingPath)).status, 401);
  for (const [method, path] of [
    ["GET", sharingPath],
    ["POST", `${sharingPath}/lookup`],
    ["PUT", grantPath],
    ["DELETE", grantPath],
  ]) {
    assert.equal((await request(method, path, cookie)).status, 403);
  }
  assert.equal(
    (
      await request("POST", `${sharingPath}/lookup`, alice.cookie, {
        email: bob.email,
      })
    ).status,
    404,
  );
  assert.equal(
    (await request("PUT", `${sharingPath}/${bob.id}`, alice.cookie)).status,
    404,
  );
  const doctor = { id: doctorId, name: "Doctor", email: credentials.email };
  const lookup = await request("POST", `${sharingPath}/lookup`, alice.cookie, {
    email: ` ${credentials.email.toUpperCase()} `,
  });
  assert.equal(lookup.status, 200);
  assert.deepEqual(lookup.data, doctor);
  assert.deepEqual((await request("GET", sharingPath, alice.cookie)).data, []);
  assert.deepEqual((await request("GET", patientsPath, cookie)).data, []);
  for (const grant of await Promise.all([
    request("PUT", grantPath, alice.cookie, { patient_id: bob.id }),
    request("PUT", grantPath, alice.cookie),
  ])) {
    assert.equal(grant.status, 200);
    assert.deepEqual(grant.data, doctor);
  }
  assert.deepEqual((await request("GET", sharingPath, alice.cookie)).data, [
    doctor,
  ]);
  assert.deepEqual((await request("GET", sharingPath, bob.cookie)).data, []);
  assert.equal(
    (await request("DELETE", grantPath, bob.cookie, { patient_id: alice.id }))
      .status,
    204,
  );
  assert.deepEqual((await request("GET", patientsPath, cookie)).data, [
    { id: alice.id, name: alice.name, email: alice.email },
  ]);

  const date = "2024-02-29";
  const ownReading = await add(reading(date, slots[0], 123));
  await add(reading(date, slots[0], 185), bob);
  const patientReport = (id) =>
    `${patientsPath}/${id}/reports?period=daily&date=${date}`;
  const assigned = await request("GET", patientReport(alice.id), cookie);
  assert.equal(assigned.status, 200);
  assert.equal(assigned.data.summary.average, 123);
  assert.equal(
    (await request("GET", patientReport(bob.id), cookie)).status,
    404,
  );
  assert.equal(
    (await request("GET", patientReport(alice.id), alice.cookie)).status,
    403,
  );
  for (const [method, path] of [
    ["GET", "/readings"],
    ["GET", "/readings/history"],
    ["POST", "/readings"],
    ["PATCH", `/readings/${ownReading.id}`],
    ["DELETE", `/readings/${ownReading.id}`],
    ["GET", `/reports?period=daily&date=${date}`],
  ]) {
    assert.equal((await request(method, path, cookie)).status, 403);
  }
  const updated = await request(
    "PATCH",
    `/readings/${ownReading.id}`,
    alice.cookie,
    {
      value_mg_dl: 137,
    },
  );
  assert.equal(updated.status, 200);
  const fresh = await request("GET", patientReport(alice.id), cookie);
  assert.equal(fresh.data.summary.average, 137);

  if (reportRedis) {
    const {
      rows: [{ report_revision: revision }],
    } = await pool.query("SELECT report_revision FROM users WHERE id = $1", [
      alice.id,
    ]);
    assert.ok(
      await reportRedis.get(
        `sweety:reports:v1:${alice.id}:${revision}:daily:${date}:${date}`,
      ),
    );
  }
  assert.equal((await request("DELETE", grantPath, alice.cookie)).status, 204);
  assert.deepEqual((await request("GET", sharingPath, alice.cookie)).data, []);
  assert.equal(
    (await request("GET", patientReport(alice.id), cookie)).status,
    404,
  );
  assert.deepEqual((await request("GET", patientsPath, cookie)).data, []);
  assert.equal((await report("daily", date)).summary.average, 137);
});

test("demo seed preserves edited readings and revoked access on rerun", async () => {
  const seed = () => execFileSync("npm", ["run", "seed"], { env: process.env });
  seed();
  const login = await request("POST", "/auth/login", null, {
    email: "demo@sweety.example",
    password: "sweety-local-demo",
  });
  assert.equal(login.status, 200);
  const doctor = await request("POST", "/auth/login", null, {
    email: "doctor@sweety.example",
    password: "sweety-local-doctor",
  });
  assert.equal(doctor.status, 200);
  assert.equal(doctor.data.role, "doctor");
  assert.deepEqual(
    (await request("GET", "/doctor/patients", doctor.cookie)).data,
    [{ id: login.data.id, name: login.data.name, email: login.data.email }],
  );
  const list = await request("GET", "/readings", login.cookie);
  assert.equal(list.status, 200);
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const days = (Date.parse(today) - Date.parse("2026-09-01")) / 86400000;
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  const count = Math.max(
    0,
    days * 4 + [0, 8, 12, 19].filter((open) => open <= hour).length,
  );
  assert.equal(list.data.length, count);
  if (!count) return;
  assert.equal(list.data[0].reading_date, today);
  assert.equal(list.data.at(-1).reading_date, "2026-09-01");
  const path = "/readings/" + list.data[0].id;
  assert.equal(
    (await request("PATCH", path, login.cookie, { value_mg_dl: 105 })).status,
    200,
  );
  assert.equal(
    (await request("DELETE", `/report-sharing/${doctor.data.id}`, login.cookie))
      .status,
    204,
  );
  seed();
  const after = await request("GET", "/readings", login.cookie);
  assert.equal(after.data.length, count);
  assert.equal(after.data[0].value_mg_dl, 105);
  assert.deepEqual(
    (await request("GET", "/doctor/patients", doctor.cookie)).data,
    [],
  );
});

test("reading history pages contain only the signed-in user's readings, newest first", async () => {
  for (let day = 1; day <= 11; day++) {
    await add(reading("2024-03-" + String(day).padStart(2, "0")));
  }
  await add(reading("2024-03-12"), bob);
  const first = await request("GET", "/readings/history", alice.cookie);
  const last = await request("GET", "/readings/history?page=2", alice.cookie);
  assert.equal(first.data.rows.length, 10);
  assert.equal(first.data.rows[0].reading_date, "2024-03-11");
  assert.equal(first.data.hasNext, true);
  assert.deepEqual(
    last.data.rows.map((row) => row.reading_date),
    ["2024-03-01"],
  );
  assert.equal(last.data.hasNext, false);
  assert.equal(
    (await request("GET", "/readings/history?page=0", alice.cookie)).status,
    400,
  );
  assert.equal((await request("GET", "/readings/history")).status, 401);
});

test(
  "Redis reuses reports and invalidates only the patient whose readings change",
  { skip: !testRedisUrl },
  async (t) => {
    let aggregations = 0;
    const query = pool.query.bind(pool);
    t.mock.method(pool, "query", (sql, ...args) => {
      if (sql.startsWith("SELECT count(*)::int AS count, max(value_mg_dl)"))
        aggregations++;
      return query(sql, ...args);
    });

    const april = "2024-04-10";
    const may = "2024-05-10";
    assert.equal((await report("daily", april)).summary.count, 0);
    assert.equal((await report("daily", april)).summary.count, 0);
    assert.equal(aggregations, 1);

    await add(reading(april, slots[0], 170), bob);
    assert.equal((await report("daily", april, bob)).summary.average, 170);
    const countBeforeCreate = aggregations;
    const created = await add(reading(april));
    assert.equal((await report("daily", april)).summary.average, 100);
    assert.equal((await report("daily", april, bob)).summary.average, 170);
    assert.equal(aggregations, countBeforeCreate + 1);

    assert.equal((await report("previous_month", may)).summary.count, 1);
    const countBeforeRepeat = aggregations;
    assert.equal(
      (await report("previous_month", "2024-05-23")).summary.count,
      1,
    );
    assert.equal(aggregations, countBeforeRepeat);
    assert.equal((await report("month_to_date", may)).summary.count, 0);

    const path = `/readings/${created.id}`;
    const moved = await request("PATCH", path, alice.cookie, {
      reading_date: may,
      value_mg_dl: 120,
    });
    assert.equal(moved.status, 200);
    assert.equal((await report("daily", april)).summary.count, 0);
    assert.equal((await report("previous_month", may)).summary.count, 0);
    assert.equal((await report("month_to_date", may)).summary.average, 120);
    assert.equal((await request("DELETE", path, alice.cookie)).status, 204);
    assert.equal((await report("month_to_date", may)).summary.count, 0);
  },
);
