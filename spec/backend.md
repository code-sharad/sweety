# Backend progress

Use the [project spec](project.md) for behavior and this checklist for progress. Update the relevant box in the same commit as the feature. Record how it was checked. A live smoke check and a committed automated test are separate milestones.

## Implemented

- [x] Express and TypeScript startup, health endpoint, PostgreSQL pool.
- [x] Users, readings, and sessions migrations applied to Neon. PostgreSQL enforces one reading per patient, date, and slot.
- [x] Signup with Zod validation, normalized email, and bcrypt password hashing.
- [x] Login, current-user lookup, reusable session middleware, and logout. Live HTTP checks covered invalid credentials, missing and expired sessions, and reuse of a revoked cookie.
- [x] Create readings with POST /api/readings. Live checks covered two accounts sharing a date and slot, session-derived ownership despite supplied IDs, missing authentication, validation, concurrent duplicates, and the four-slot limit.

## Next feature

- [ ] List a patient's readings with GET /api/readings, including the optional date filter. Verify that a second account can use the same slot and only sees its own rows.

## Remaining

- [ ] Edit and delete owned readings. Verify rejected edits preserve the original row.
- [ ] Implement daily, month-to-date, and previous-month reports, including empty ranges and a daily slot list.
- [ ] Commit repeatable backend tests against an isolated test database. Cover auth, ownership, validation boundaries, concurrent duplicates, and report date boundaries and rounding.
- [ ] Add a demo seed and document environment variables, migrations, startup, tests, and assumptions in the submission README.

## Working agreements

Validate request input with Zod and enforce uniqueness in PostgreSQL. Never accept a patient ID from the client as proof of ownership. Add a new migration for changes to the deployed schema. Keep credentials out of Git. Finish required features before starting optional work.
