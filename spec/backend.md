# Backend progress

Use the [project spec](project.md) for behavior and this checklist for progress. Update the relevant box in the same commit as the feature. Record how it was checked. A live smoke check and a committed automated test are separate milestones.

## Implemented

- [x] Express and TypeScript startup, health endpoint, PostgreSQL pool.
- [x] Users, readings, and sessions migrations applied to Neon. PostgreSQL enforces one reading per patient, date, and slot.
- [x] Signup with Zod validation, normalized email, and bcrypt password hashing.
- [x] Login, current-user lookup, reusable session middleware, and logout. Live HTTP checks covered invalid credentials, missing and expired sessions, and reuse of a revoked cookie.
- [x] Create readings with POST /api/readings. Live checks covered two accounts sharing a date and slot, session-derived ownership despite supplied IDs, missing authentication, validation, concurrent duplicates, and the four-slot limit.
- [x] List owned readings with GET /api/readings and an optional date filter. Live HTTP checks against PostgreSQL covered two accounts sharing a slot, session-scoped results, date filtering, ordering, empty results, invalid dates, and missing authentication.
- [x] Edit and delete owned readings. Live PostgreSQL-backed HTTP checks compared the entire row after invalid, conflicting, and unauthorized requests. Checks also covered moving a reading, editing its value on a full day, and deleting it.

- [x] Enforce slot opening times for new and moved readings. Fixed-clock schema checks covered all four opening boundaries in Asia/Kolkata and past-date entries.
- [x] Daily, month-to-date, and previous-month reports. PostgreSQL-backed HTTP checks covered ownership, authentication, invalid filters, ordered daily slots, rounding, empty results, leap February, the January year boundary, and updated results after editing and deleting readings.

## Next feature

- [ ] Commit repeatable backend tests against an isolated test database. Cover auth, ownership, validation boundaries, concurrent duplicates, and report date boundaries and rounding.

## Remaining

- [ ] Add a demo seed and document environment variables, migrations, startup, tests, and assumptions in the submission README.

## Working agreements

Validate request input with Zod and enforce uniqueness in PostgreSQL. Never accept a patient ID from the client as proof of ownership. Add a new migration for changes to the deployed schema. Keep credentials out of Git. Finish required features before starting optional work.
