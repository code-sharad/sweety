# Sweety project specification

Draft for review. The [assignment](task.md) defines the required scope. The schema and API below are proposed implementation decisions.

## Patient workflow

A patient registers with a name, email, and password, logs in, and selects a date. They can record, view, correct, and delete their own glucose readings. They can see daily and monthly summaries for the selected date. A second account can use the same dates and slots independently.

## 1. Database schema

Use PostgreSQL. All columns are required.

| Table | Column | Type and rules |
|---|---|---|
| users | id | Integer identity, primary key |
| users | name | Text, nonblank after trimming |
| users | email | Text, trimmed and lowercased before storage, unique |
| users | password_hash | Text, bcrypt hash |
| readings | id | Integer identity, primary key |
| readings | user_id | Integer, foreign key to users.id |
| readings | reading_date | DATE, the calendar date selected by the patient |
| readings | slot | Text, constrained to one of the four codes below |
| readings | value_mg_dl | Integer, inclusive range 40–600 |

| Stored slot | Display label |
|---|---|
| morning_fasting | Morning (fasting) |
| after_breakfast | After breakfast |
| after_lunch | After lunch |
| after_dinner | After dinner |

Enforce uniqueness on (user_id, reading_date, slot). Together with the four allowed slots this enforces the daily maximum under concurrent writes. Compute reports from readings so edits and deletions are reflected immediately.

The API uses Asia/Kolkata to determine today for reading-date validation.

## 2. Backend

Build a Node.js and Express JSON API. Proposed paths below share the /api prefix.

| Method and path | Contract |
|---|---|
| POST /auth/register | Accept name, email, password. Validate required fields and email format, hash password, and create account (201). Reject duplicate normalized email (409). |
| POST /auth/login | Verify email and password. Establish authenticated access (200) or return a generic invalid-credentials message (401). |
| GET /readings?date=YYYY-MM-DD | List the signed-in user's readings, optionally filtered by date (200). Order by newest day first, then slot in display order. |
| GET /readings?page=1&limit=20 | Return `{ rows, hasNext }` for the signed-in user. Supplying either pagination parameter enables paging. `page` defaults to 1 and `limit` defaults to 20, with a maximum of 100. The optional `date` filter still applies. Pages show newest dates and latest slots first. |
| POST /readings | Accept reading_date, slot, value_mg_dl. Return saved reading (201). |
| PATCH /readings/:id | Update supplied reading fields, validate the resulting reading, and return it (200). |
| DELETE /readings/:id | Delete the owned reading (204). |
| GET /reports?period=daily&date=YYYY-MM-DD | Accept daily, month_to_date, or previous_month. Return the inclusive date range, summary, and for daily reports the ordered readings (200). |

Use PostgreSQL-backed sessions with an HttpOnly cookie and a seven-day expiry. GET /api/auth/me returns the current user or 401. POST /api/auth/logout revokes the session, clears the cookie, and returns 204. Derive ownership from the authenticated identity. Require authentication for every readings and reports endpoint (401). Scope updates and deletes by both user and reading ID. Return 404 for missing or other users' readings. Keep password hashes out of responses.

### Request validation with Zod

Use Zod in the Express API to validate request bodies, path parameters, and query parameters before using their values. Define schemas for registration, login, reading creation and updates, reading IDs, and reading and report filters. Reuse the reading field validators for updates, require at least one editable field, and validate the resulting reading when a change depends on existing values.

Validate calendar dates as YYYY-MM-DD strings and glucose values as whole numbers from 40 through 600. Preserve the distinction between a missing glucose value and a supplied value outside the range. Map Zod issues to a 400 response with a user-facing message and the affected field when applicable. Enforce ownership in the backend and keep PostgreSQL constraints for uniqueness, allowed slots, and glucose bounds.

### Reading validation

- Require a valid calendar date, an allowed slot, and a whole-number glucose value. Reject invalid input with 400 and a message the UI can display. For a missing value show “Please enter a glucose value.” For a fractional or out-of-range value explain the whole-number and range requirements.
- Reject future reading dates according to the agreed timezone. Show “Date cannot be in the future.”
- Return 409 for a slot or daily-cap conflict. For a new reading on a full day show “You can add only 4 readings per day.” Otherwise identify the occupied slot and date. Apply the same rules when moving a reading and exclude the edited row when checking conflicts.
- For today in Asia/Kolkata, fasting opens at midnight, after breakfast at 08:00, after lunch at 12:00, and after dinner at 19:00. Slots stay open for late entry. Apply opening times on creation and when moving a reading to another date or slot. Past dates allow all four slots. Disable unopened slots in the tracker and mark recorded slots.
- A failed edit preserves the existing reading. Editing only the value on a full day succeeds.

### Report calculations

For a selected date of 15 October 2026, daily covers 15 October, month-to-date covers 1–15 October, and previous month covers 1–30 September. All endpoints use calendar dates and include both range boundaries. Return count, highest, lowest, and average. Display the average to one decimal place. An empty range returns count zero and null statistics. The daily report also returns each slot and its value.

## 3. Backend acceptance tests

Exercise the API against a PostgreSQL test database before starting the frontend.

- Register and log in. Verify bcrypt storage, duplicate email handling, invalid credentials, and access without login.
- Create, list, edit, and delete a reading. Verify another account cannot list, modify, delete, or include that reading in a report.
- Accept 40 and 600. Reject missing values, fractions, 39, 601, invalid slots, impossible dates, and tomorrow. Accept today.
- Reject duplicate slots, a fifth reading, and edits that collide with another reading. Concurrent submissions for one slot leave exactly one row.
- Verify daily, month-to-date, and previous-month statistics with known values. Cover empty ranges, rounding, a January selection crossing into December, and a leap-year February. Verify a successful edit or deletion changes the report.

## 4. React frontend

Provide registration and login forms and an authenticated tracker with a date selector. Show readings in slot order with values labeled mg/dl. Provide add, edit, and delete actions. Keep the entered values visible when validation fails and show the API's error message. Refresh affected readings and reports after successful changes.

Show all three report periods with their actual date ranges, count, highest, lowest, and average. Show a friendly empty state when the selected range has no readings. The daily view lists each recorded slot and value. A patient can sign out and another patient can sign in on the same browser without seeing the previous patient's data.

## Submission

Deliver a public GitHub repository with regular commits, a README covering installation, database setup, server, client, and test commands, an .env.example listing required configuration without secrets, and a demo seed user with sample readings. Include assumptions and possible improvements in the README. Supply screenshots or a 2–3 minute recording of the working app. The assignment requests the repository link and demo evidence by email by Friday, 20 November 2026.

## Optional work

After the required features work, the assignment allows pagination, monthly charts, Docker Compose, React form tests, Redis report caching, a BullMQ reminder job, or a doctor role with assigned patients. None is required for acceptance.
