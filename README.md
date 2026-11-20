# Sweety

Sweety records a patient's blood glucose readings and summarizes them by day and month. Patients can sign up, sign in, manage readings by date, and view all three reports. Doctors sign in through the same form and have read-only access to reports for their assigned patients.

## Run with Docker Compose

From the repository root, run `docker compose up --build -d` and open [Sweety](http://localhost:3000). The app serves the React client and API together. PostgreSQL applies the migrations on first startup and keeps the data in a named volume. Run `docker compose down` to stop the stack.

If you already have a Compose database volume, apply any pending migrations before rebuilding. For example, if migrations 001 through 003 are already applied, run `docker compose exec -T db psql -v ON_ERROR_STOP=1 -U sweety -d sweety < backend/migrations/005_doctor_roles.sql` once.

## Local setup without Compose

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
3. [003_report_revision.sql](backend/migrations/003_report_revision.sql)
4. [005_doctor_roles.sql](backend/migrations/005_doctor_roles.sql)

### Report caching

Compose starts Redis automatically. For a local API, set `REDIS_URL` in `backend/.env` to enable caching. Report results expire after five minutes, and a reading change immediately invalidates that user's cached reports. If Redis is unavailable, the API generates reports from PostgreSQL.

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

Run `npm --prefix backend run seed` from the repository root against your development database. The seed creates the demo patient and sample readings for each day from 1 September 2026 through today in Asia/Kolkata. Past dates have four slots each, and today includes only slots that have opened. Rerunning it preserves existing readings.

With the API and client running, open the Vite URL and sign in with `demo@sweety.example` and password `sweety-local-demo`. Select **15 October 2026** to explore the daily, October month-to-date, and September monthly reports.

To try the doctor view, sign in with `doctor@sweety.example` and password `sweety-local-doctor`. The first seed run assigns Demo Patient to this doctor. Public sign-ups create patient accounts, and a trusted database operator provisions doctor accounts.

As a patient, open **Share reports**, find your doctor by their exact account email, and confirm the name and email before sharing. The doctor can refresh **Patient reports** to see you in their assigned-patient list. To stop sharing, select **Revoke access**. This blocks the doctor's next request for your reports, even if a report is cached. Rerunning the demo seed preserves your choice.

## Checks

```sh
npm --prefix backend test
npm --prefix backend run fmt:check
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run lint
```

The backend suite builds TypeScript, starts a disposable PostgreSQL cluster, applies the migrations, exercises the API over HTTP, and removes the cluster. Run it as a regular operating-system user. It supplies its own database connection. The frontend suite uses React Testing Library to exercise the reading form against a mocked API in jsdom.

To include the report cache integration test, point `TEST_REDIS_URL` at a fresh, disposable Redis instance when running the backend suite.

## Notes

- The assignment leaves the patient timezone open. Sweety uses Asia/Kolkata for both the tracker and the API so they agree on when a new day starts, even if the browser uses another timezone.
- The assignment names four meal slots and leaves their opening times unspecified. For the current day, Sweety assumes fasting opens at midnight, after breakfast at 08:00, after lunch at noon, and after dinner at 19:00 IST. Slots stay open once available so patients can enter a reading later. All four slots are available for past dates.
- From 21:00 IST, today's logbook shows an in-app reminder if any reading slots are empty. It clears once all four are filled. With more time, I would add email reminders for patients who have the app closed.
- With more time, I would automate the two-account browser flow, including switching patients on the same device and checking that editing a reading updates the report.
