# Demo Data Guide

This document describes the **sample college data** used to populate the AI
Timetable Maker for demos, testing and screenshots. Everything here was created
with the application's own models and the real scheduling engine. No timetable
was mocked, hand-written or imported.

> These credentials and data are for a **local development / demo database only**.
> Never deploy this data or these passwords to a real environment.

---

## 1. What gets created

| Entity | Count | Notes |
| --- | --- | --- |
| Department | 1 | `CSE` — "Computer Science and Engineering (Demo)" |
| Teachers | 16 | fictional, all active |
| Classes | 8 | S1/S3/S5/S7 x sections A & B |
| Subjects | 56 | 42 theory + 14 labs (all 3-period lab blocks) |
| Timetable | multiple versions | base label `DEMO College Timetable (S1-S7)`; the accepted/published version is the engine-optimized one (daily limit 4 + teacher-comfort), e.g. `DEMO College Timetable (S1-S7) [optimized L4 + teacher-comfort]` |
| Admin | 1 | `demo.admin` (in addition to any existing admin) |

Sections A and B of each semester share the **same subjects and the same
teachers**, so teacher double-booking is genuinely exercised by the engine.

Timetable config (from the existing `CollegeSettings` singleton — not modified):

- Working days: Monday–Friday
- 6 teaching periods per day, 55 minutes each
- Lunch break numbered `0`, between period 3 and period 4
- Default teacher daily limit: 4 (enforced for every demo teacher)

---

## 2. Demo credentials (dev only)

| Account | Username | Password |
| --- | --- | --- |
| Admin | `demo.admin` | `DemoAdmin123!` |
| Teachers | `first.last` (e.g. `ananya.nair`, `rahul.menon`) | `DemoPass123!` |

Teacher teacher email domain: `democollege.example.edu`.

Teacher usernames: `ananya.nair`, `rahul.menon`, `meera.joseph`, `arjun.kumar`,
`neha.thomas`, `vivek.das`, `priya.nambiar`, `adithya.raj`, `sneha.varma`,
`nikhil.suresh`, `kavya.mohan`, `alan.mathew`, `diya.krishnan`, `akhil.dev`,
`fathima.salim`, `rohit.pillai`.

The pre-existing `admin` account is **never modified** by the seeder.

---

## 3. How to run it

From `backend/`:

```bash
# Report only — connects, checks the safety guard, writes nothing.
node scripts/seedDemoData.js --dry-run

# Seed + generate + verify (idempotent; safe to re-run).
node scripts/seedDemoData.js
```

Then publish and re-verify (requires the backend running for the API probes):

```bash
node scripts/verifyDemoData.js               # report + publish via the real accept gate + privacy probes
node scripts/verifyDemoData.js --no-publish  # report + probes only
```

Environment:

- Uses `MONGODB_URI` from `backend/.env` (default
  `mongodb://127.0.0.1:27017/timetable_db`).
- `API_BASE` (default `http://127.0.0.1:5000`) is used by `verifyDemoData.js`.

---

## 4. Safety properties

The seeder is deliberately conservative:

- **Never deletes** anything. It only inserts or updates the demo records it
  owns, matched by stable keys (department `code`, teacher `username`, class
  `departmentId+semester+section`, subject `code+classId`, timetable `label`).
- **Idempotent.** Re-running updates the same records and rewrites the seeder's
  own timetable version (base label) instead of appending new versions. The
  optimizer script (`scripts/optimizeDemoTimetable.js`) is separate and
  intentionally creates a NEW labelled version; it never mutates an existing
  accepted version.
- **Database allow-list.** It refuses to run unless the database name is
  `timetable_db` or `timetable_audit_test` (tests may pass their own isolated
  name explicitly).
- **Does not touch** the existing `CollegeSettings`, the existing `admin`
  account, or any non-demo data.

> Do **not** run `backend/src/utils/seedTest.js`. It is destructive (calls
> `deleteMany({})` on every collection) and is unrelated to this demo data.

### Reset / cleanup

There is intentionally no automatic "drop" option. To remove only the demo
data, delete the demo records by their keys (department `CSE`, teachers with the
`@democollege.example.edu` email, the demo classes/subjects, the timetable with
label `DEMO College Timetable (S1-S7)`, and the `demo.admin` account). Everything
else is left untouched.

---

## 5. Verification / tests

```bash
cd backend && npm test      # 52 tests: engine, integration, demo-seed, isolation
cd frontend && npm run lint && npm run build
```

The regression suite (`backend/tests/integration/demoSeed.test.js`) proves:

- the seeder is idempotent (no duplicate teachers/classes/subjects/timetable);
- re-seeding does not change teacher password hashes;
- the generated timetable passes persisted hard-constraint validation;
- a teacher cannot read or download another teacher's data nor reach
  admin-only routes.

Negative fixtures live in `backend/tests/engine.test.js`: teacher clash, lab room
clash, lab with no room (infeasible), overlapping labs, and scheduling a teacher
during unavailability.

---

## 6. Known non-blocking observations

- The published demo timetable is **complete and hard-constraint valid**
  (0 hard violations, 0 soft warnings, all subject hours met, no
  teacher/class/room clashes).
- With the teacher daily limit now **4**, the old `TEACHER_DAILY_LIMIT_EXCEEDED`
  soft warnings no longer appear; the optimizer's gate refuses to publish a
  version that adds any soft warning or regresses overall quality.
- Teachers have **no personal draft workspace**: the app has no owner/creator
  field on timetables and all version/generate/edit routes are admin-only.
  Teachers are read-only consumers of the published timetable.
