# Sweety

Sweety records a patient's blood glucose readings and summarizes them by day and month. The Express API supports registration, cookie-based login, reading management, and reports. The React client currently provides signup. Login and the patient tracker are the next frontend milestones.

## Local setup

Use Node.js 26, npm, PostgreSQL, and the PostgreSQL command-line tools. Run these commands from the repository root.

```sh
(cd backend && npm ci)
(cd frontend && npm ci)
cp backend/.env.example backend/.env
```

Create an empty database using a PostgreSQL role that can create databases, or provision an empty database with your PostgreSQL provider.

```sh
createdb sweety
```

Edit `backend/.env`. Set `DATABASE_URL` to the connection URI for your database and keep it single-quoted so the shell can load it. `PORT` defaults to 3000, the API port expected by the frontend development proxy. Use `NODE_ENV=development` locally. In production, `NODE_ENV=production` enables secure session cookies and requires HTTPS for authenticated browser requests.

Apply the SQL migrations once, in filename order. On an existing database, run only the migrations it still needs.

```sh
(
  set -e
  . ./backend/.env
  for migration in backend/migrations/*.sql; do
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
  done
)
```

## Run the app

Start the API and client in separate terminals from the repository root.

```sh
cd backend && npm run dev
```

```sh
cd frontend && npm run dev
```

Open the local URL printed by Vite. The API health check is available at `http://localhost:3000/api/health`.

## Try the demo

Run `cd backend && npm run seed` from the repository root against your development database. The seed creates a demo patient and four sample readings. Rerunning it fills missing sample slots and preserves existing values.

With the API running, log in and request the daily report using the public demo credentials. Run these commands in the same shell.

```sh
cookies=$(mktemp)
curl -sS -c "$cookies" -H 'Content-Type: application/json' \
  -d '{"email":"demo@sweety.example","password":"sweety-local-demo"}' \
  http://localhost:3000/api/auth/login
curl -sS -b "$cookies" 'http://localhost:3000/api/reports?period=daily&date=2024-03-15'
rm "$cookies"
```

For March 15, the seeded daily report contains two readings, 94 and 132 mg/dl, averaging 113. Use the same date with `month_to_date` to include March 1, or `previous_month` to see the February 29 reading.

## Checks

```sh
(cd backend && npm test && npm run fmt:check)
(cd frontend && npm run build && npm run lint)
```

The backend suite builds TypeScript, starts a disposable PostgreSQL cluster, applies the migrations, exercises the API over HTTP, and removes the cluster. Run it as a regular operating-system user. It supplies its own database connection.

## Notes

- Dates and slot opening times use Asia/Kolkata. For today, fasting opens at midnight, after breakfast at 08:00, after lunch at noon, and after dinner at 19:00. Earlier slots stay open for late entries.
- Each patient can record one whole-number value from 40 through 600 mg/dl per slot per date. Reports use the selected calendar date and reflect saved edits and deletions immediately.
- After completing the tracker, the first improvement would be browser tests covering a patient's full workflow from login through editing a reading and seeing the updated report.
