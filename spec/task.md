APPLICATION RECEIVED

Thanks, Sharad.
Here is your assignment.
Thank you for your interest in the Junior Full Stack Developer – JavaScript & AI position at Kenpath. This is the assignment for the next stage.

Sweety – Blood Glucose Tracker (MERN + PostgreSQL)
Build Sweety, a small web app where a diabetes patient records up to 4 blood glucose readings a day and views daily and monthly reports. You will build a Node.js + Express API, a PostgreSQL database and a React frontend.

Time allowed: 3 days from receiving this assignment (we expect about 10–15 hours of work).
Level: This is designed for freshers. Finish the required parts first; bonus tasks are optional.
What matters most: working features, clean and readable code, correct validation, and a few meaningful tests. A simple UI is perfectly fine.
Stuck?: Write down your assumption in the README and move on. We value clear reasoning over a perfect result.
Features to build (required)

1. Sign up and log in

•	A user can register with name, email and password, then log in.
•	Store passwords hashed with bcrypt; never store plain text.
•	After login, the user only sees their own readings.
2. Add, view, edit and delete readings

Each reading has a date, a time slot and a value in mg/dl. The 4 slots are: Morning (fasting), After breakfast, After lunch, After dinner.

Validation rules (show a clear error message in the UI when one fails):

Rule	Example error message
Value is required	"Please enter a glucose value."
Value must be a whole number between 40 and 600	"Value must be between 40 and 600 mg/dl."
Only one reading per slot per day	"You already have an After lunch reading for this date."
Maximum 4 readings per day	"You can add only 4 readings per day."
Date cannot be in the future	"Date cannot be in the future."
3. Reports

Each report shows the highest, lowest and average reading (rounded to 1 decimal) and the number of readings. If there are no readings, show a friendly empty state.

Report	Date range	Example (selected date 15 Oct 2026)
Daily	The selected date	15 Oct 2026
Month-to-date	1st of the month to the selected date	1 Oct – 15 Oct 2026
Monthly	The whole previous month	1 Sep – 30 Sep 2026
The daily report also lists each reading with its slot.

Bonus tasks (optional)

Only attempt these after the required parts work. Pick any.

•	Pagination on GET /readings (?page=1&limit=20).
•	Charts: a line chart of readings over the month (e.g. Recharts).
•	Docker: a docker-compose.yml that starts PostgreSQL (and the app).
•	Frontend tests with React Testing Library for the reading form.
•	Caching report results in Redis, cleared when a reading changes.
•	Background job with BullMQ, e.g. a daily reminder log for users with fewer than 4 readings.
•	Doctor role: a doctor account that can view reports of patients assigned to them.
What to submit

•	A public GitHub repository link (with regular commits, not one big commit)
•	README.md with: how to install, how to set up the database, how to run server, client and tests
•	.env.example listing every variable needed (no real secrets)
•	A seed script that creates a demo user with sample readings
•	Screenshots or a short screen recording (2–3 minutes) of the app working
•	A short "Notes" section in the README: assumptions, what you'd improve with more time
SUBMISSION DEADLINE

Please submit by Friday, 20 November 2026

Reply directly to this email with your GitHub repository link and your screenshots or screen recording. Your reply will reach our hiring team in this same thread.