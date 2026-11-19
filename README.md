# Sweety

Sweety records a patient's blood glucose readings and summarizes them by day and month. The Express API supports registration, cookie-based login, reading management, and reports. The React client currently provides signup. Login and the patient tracker are the next frontend milestones.

## Local setup

Install Node.js 26 and npm. Run these commands from the repository root.

```sh
npm --prefix backend ci
npm --prefix frontend ci
```

Copy `backend/.env.example` to `backend/.env`, then choose one PostgreSQL setup below. The API uses `DATABASE_URL` from that file.

### Option 1 — Neon Postgres

Create or open a project in Neon. In the project dashboard, select **Connect**, choose your branch, database, and role, and copy the connection string. Paste the full value into `backend/.env`, including its SSL parameters. For example:

```dotenv
DATABASE_URL='postgresql://ROLE:PASSWORD@HOST/DATABASE?sslmode=require'
```

### Option 2 — Local PostgreSQL with Docker

With Docker running, start a container from the official PostgreSQL image. This creates the `sweety` database, makes it available on localhost, and stores its data in a named volume.

```sh
docker run --name sweety-postgres -e POSTGRES_DB=sweety -e POSTGRES_USER=sweety -e POSTGRES_PASSWORD=sweety_local_dev -p 127.0.0.1:5432:5432 -v sweety-pgdata:/var/lib/postgresql/data -d postgres:16
```

Use the matching development connection string in `backend/.env`:

```dotenv
DATABASE_URL='postgresql://sweety:sweety_local_dev@127.0.0.1:5432/sweety'
```

To restart the container after stopping it, run `docker start sweety-postgres`.

### Apply the migrations

For Neon, open the SQL Editor on the same branch and database. For Docker, connect a SQL client such as pgAdmin to the local database using the credentials above. Execute these files once in order, skipping any already applied:

1. [001_initial.sql](backend/migrations/001_initial.sql)
2. [002_sessions.sql](backend/migrations/002_sessions.sql)

## Run the app

Start the API and client in separate terminals from the repository root.

```sh
npm --prefix backend run dev
```

```sh
npm --prefix frontend run dev
```

Open the local URL printed by Vite. The API health check is available at `http://localhost:3000/api/health`.

## Try the demo

Run `npm --prefix backend run seed` from the repository root against your development database. The seed creates a demo patient and four sample readings. Rerunning it fills missing sample slots and preserves existing values.

With the API running, open [the health endpoint](http://localhost:3000/api/health) in your browser. Open its developer console and run the following JavaScript. The browser keeps the session cookie for the second request.

```js
const login = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "demo@sweety.example",
    password: "sweety-local-demo",
  }),
});
if (!login.ok) throw new Error(await login.text());
const report = await fetch("/api/reports?period=daily&date=2024-03-15");
console.log(await report.json());
```

For March 15, the seeded daily report contains two readings, 94 and 132 mg/dl, averaging 113. Use the same date with `month_to_date` to include March 1, or `previous_month` to see the February 29 reading.

## Checks

```sh
npm --prefix backend test
npm --prefix backend run fmt:check
npm --prefix frontend run build
npm --prefix frontend run lint
```

The backend suite builds TypeScript, starts a disposable PostgreSQL cluster, applies the migrations, exercises the API over HTTP, and removes the cluster. Run it as a regular operating-system user. It supplies its own database connection.

## Notes

- Dates and slot opening times use Asia/Kolkata. For today, fasting opens at midnight, after breakfast at 08:00, after lunch at noon, and after dinner at 19:00. Earlier slots stay open for late entries.
- Each patient can record one whole-number value from 40 through 600 mg/dl per slot per date. Reports use the selected calendar date and reflect saved edits and deletions immediately.
- After completing the tracker, the first improvement would be browser tests covering a patient's full workflow from login through editing a reading and seeing the updated report.
