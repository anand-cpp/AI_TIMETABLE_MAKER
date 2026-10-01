# AI Timetable Maker

An AI-powered, constraint-solving timetable management system for colleges. It generates
conflict-free timetables for every class, teacher and lab, then lets admins publish,
hand-edit, override and export the result as official PDF/Excel documents.

**Stack:** React 19 + Vite (frontend) · Node.js + Express (backend) · MongoDB + Mongoose (data)

---

## Table of Contents

- [What this does](#what-this-does)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Default credentials](#default-credentials)
- [Project structure](#project-structure)
- [How the generation engine works](#how-the-generation-engine-works)
- [The timetable data model](#the-timetable-data-model)
- [API reference](#api-reference)
- [Roles and access](#roles-and-access)
- [Dev utility scripts](#dev-utility-scripts)
- [Troubleshooting](#troubleshooting)

---

## What this does

Colleges schedule hundreds of periods a week across classes, teachers, labs and rooms. Doing
that by hand in a spreadsheet is slow and produces conflicts: the same teacher in two rooms
at once, a lab class split across the lunch break, a room double-booked, elective groups
drifting out of sync between two sections.

This project does it automatically:

1. You enter the **institution data** — departments, classes (sections), teachers with their
   unavailability, subjects with weekly hour requirements, lab rooms, working days and the
   period-by-period timeline.
2. You press **Generate**.
3. The engine builds a full week timetable for every class, enforcing hard constraints so the
   result is valid by construction, then optimises it against soft quality criteria.
4. You review the quality score and the post-generation report, tweak individual slots by
   drag-and-drop or explicit override, and publish.
5. Teachers and students see their own timetables, and admins export official PDFs and
   Excel sheets.

---

## Features

### Timetable generation engine
- Constraint-based placement of theory, lab and elective subjects into a weekly grid.
- **Lab block placement** — multi-period labs are placed as contiguous blocks that cannot be
  split across a break, and occupy a real lab room rather than a classroom.
- **Batch splitting** — a lab section can be split into two batches with independent teachers
  and rooms.
- **Elective grouping** — linked electives keep the same subject code across their groups;
  open electives are handled independently.
- **Teacher-aware placement** — teacher availability/unavailability blocks, per-day workload
  limits and cross-department teachers are all respected.
- **Room allocation** from a lab room pool, with no double-booking.
- **Feasibility pre-check** — mathematically impossible inputs are detected and reported
  before generation instead of failing silently.
- **Genetic algorithm** refinement (`geneticAlgorithm.js`) — population-based optimisation
  with tournament selection, crossover, mutation and elitism, used to break ties and improve
  soft-constraint scores.
- **100% slot-utilisation validation** — no free gaps are left in a teaching day unless a slot
  is genuinely unplaceable, and anything unplaced is reported explicitly.
- **Quality score** (0–100) across teacher load balance, period distribution, lab placement,
  elective sync, travel/room optimisation, teacher gap minimisation and student stress.

### Admin portal
- Dashboard with stats cards, quick actions and system status.
- CRUD for departments, classes, teachers, subjects.
- Teacher unavailability grid (day × period).
- **Timetable Builder** — generate, review, edit, lock/unlock, swap and clear slots.
- **Department-wise** and **Year-wise** timetable views.
- **Version history** — each generation is a version; accept/unaccept, label, compare, delete.
- **Manual overrides** — every manual edit is written to an `OverrideLog` with a revert action.
- **Official export modal** — branded, printable timetable documents (PDF via `html2pdf.js`).
- **Teacher timetable export** and all-classes export.
- **Lab utilization report** — how intensively each lab room is used.
- **Post-generation report card** — what was placed, what was not, and why.
- **Overtime requests** and **publish confirmation** flows.
- Excel/CSV import with **OCR** (Tesseract.js) for scanned documents.
- SMTP email config with a test-send button and bulk timetable email dispatch.
- Settings: college info, working days, period timeline editor, and destructive reset
  operations scoped to "clear timetables", "clear subjects + timetables", or "wipe all".
- Dark mode, keyboard-friendly modals, error boundary.

### Teacher portal
- Login with per-teacher credentials, personal dashboard, own timetable grid.
- Suggestion/conflict reporting back to admins.
- Edit requests and unavailability management.

### Student / public portal
- No login required. Pick department → semester → section, view the published timetable.
- Public (unauthenticated) read-only API for departments, semesters, sections and timetables.

### Exports & reporting
- PDF per class, per teacher, or all classes / all teachers.
- Excel export for the same.
- Official-format branded timetable documents.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, React Router 7, Tailwind-style utility CSS, Framer Motion |
| PDF (client) | html2pdf.js, jspdf, jspdf-autotable |
| Backend | Node.js, Express 4, CommonJS, nodemon |
| Database | MongoDB 6+, Mongoose 8 |
| Auth | JWT (7-day expiry), bcryptjs |
| Security | helmet, cors, express-rate-limit |
| Excel / OCR | xlsx, tesseract.js, multer |
| Mail | nodemailer |

---

## Quick start

### Prerequisites

- Node.js 18+ and npm
- MongoDB running locally (or an Atlas connection string)

### 1. Install

```bash
# from the repo root — installs the root dev tooling (concurrently)
npm install

# install each workspace
cd timetable-system/backend  && npm install
cd ../frontend && npm install
```

### 2. Configure

```bash
cp timetable-system/backend/.env.example  timetable-system/backend/.env
cp timetable-system/frontend/.env.example timetable-system/frontend/.env
```

### 3. Seed data (optional but recommended)

```bash
cd timetable-system/backend
node src/seed_backend.js
```

This creates the default college settings, a demo department tree, classes, teachers,
subjects and an admin account.

### 4. Run both servers

```bash
npm run dev          # from the repo root — runs backend + frontend together
```

Or individually:

```bash
npm run dev:backend    # http://localhost:5000
npm run dev:frontend   # http://localhost:5173
```

### 5. Open it

- App: **http://localhost:5173**
- API health check: **http://localhost:5000/api/health**

On first launch, visit `/setup-admin` to create the first admin account.

---

## Environment variables

### Backend — `timetable-system/backend/.env`

| Variable | Purpose | Default |
|---|---|---|
| `NODE_ENV` | Runtime mode | `development` |
| `PORT` | API port | `5000` |
| `MONGODB_URI` | Mongo connection string | `mongodb://127.0.0.1:27017/timetable_db` |
| `JWT_SECRET` | Signing key for JWTs — **set a strong random value in production** | dev placeholder |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `CLIENT_URL` | Allowed CORS origin (frontend URL) | `http://localhost:5173` |

### Frontend — `timetable-system/frontend/.env`

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_URL` | Base URL for all API calls | `http://localhost:5000/api` |

`.env` files are gitignored; only the `.env.example` templates are tracked.

---

## Default credentials

If you ran the seed script:

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Teacher | (generated per teacher) | `Password123!` |

Change these immediately outside of local development.

---

## Project structure

```
.
├── package.json                     # root scripts: `npm run dev` runs both workspaces
├── PROJECT_DOCUMENTATION.md         # long-form internal documentation
└── timetable-system/
    ├── backend/
    │   └── src/
    │       ├── app.js               # express app: middleware, routes, error handling
    │       ├── server.js            # entrypoint: env, DB connect, listen
    │       ├── config/
    │       │   ├── constants.js     # days, roles, subject types, default settings/timeline
    │       │   ├── database.js      # mongoose connection
    │       │   └── mailer.js        # nodemailer transport
    │       ├── middleware/
    │       │   ├── auth.js          # authenticate / requireAdmin / requireTeacher / ownData
    │       │   ├── errorHandler.js  # notFound + central error handler
    │       │   ├── rateLimiter.js   # apiLimiter, heavyLimiter, authLimiter
    │       │   ├── upload.js        # multer config
    │       │   └── validate.js      # request validation helpers
    │       ├── models/              # Admin, Class, CollegeSettings, Department,
    │       │                        # EmailConfig, OverrideLog, Subject, Suggestion,
    │       │                        # Teacher, TeacherAvailability, Timetable, UploadedFile
    │       ├── controllers/         # one controller per domain
    │       ├── routes/              # one router per domain, mounted in app.js
    │       ├── services/
    │       │   ├── engine/          # ← the generation engine (see below)
    │       │   ├── emailService.js
    │       │   ├── excelService.js
    │       │   ├── ocrService.js
    │       │   └── pdfService.js
    │       └── utils/               # clearData, seedTest, timeHelpers, validators, ...
    └── frontend/
        └── src/
            ├── App.jsx             # all routes
            ├── components/         # auth, classes, dashboard, departments, layout,
            │                       # settings, student, subjects, suggestions, teachers,
            │                       # timetable, ui
            ├── context/            # AuthContext, ThemeContext, TimetableContext
            ├── hooks/              # useApi, useAuth, useDebounce, useTheme
            ├── pages/              # admin/, teacher/, public/
            ├── services/           # one API service module per domain
            ├── styles/globals.css
            └── utils/              # cn, conflictChecker, formatters, palette, validators
```

---

## How the generation engine works

The engine lives in `timetable-system/backend/src/services/engine/` and runs as a pipeline
orchestrated by `orchestrator.js`.

### Pipeline

```
dataLoader
    │  loads classes, subjects, teachers, departments, college settings
    │  expands periods-per-day and break periods per class
    ▼
feasibilityChecker
    │  can this data even fit? (hours vs available slots, teacher capacity, room capacity)
    │  returns a report instead of attempting an impossible generation
    ▼
slotPlacer
    │  places every subject into the grid, respecting hard constraints:
    │  • no teacher double-booking
    │  • no room double-booking
    │  • no class double-booking
    │  • labs placed as contiguous blocks that never cross a break
    │  • respects teacher unavailability and daily workload limits
    │  uses swap + cascade-reschedule fallbacks to resolve tight spots
    ▼
softOptimizer
    │  hill-climbing style passes that improve soft criteria without breaking hard ones
    ▼
constraintValidator
       validateGrid       → hard-constraint violations + full slot utilisation
       validateOutput     → final report including any unplaced subjects
```

### Hard vs soft constraints

**Hard constraints** (a violation makes a timetable invalid):

| Constraint | Where enforced |
|---|---|
| A teacher cannot be in two places at once | `isSlotValid` |
| A room cannot host two classes at once | `isSlotValid` |
| A class cannot have two subjects at once | grid construction |
| Lab blocks must be contiguous and must not cross a break | `isLabBlockValid`, `crossesBreak` |
| Teachers marked unavailable cannot be scheduled | availability loaded into `data` |
| A slot marked locked is never overwritten | `isLocked` flag |
| Split lab batches get separate teachers/rooms | `batch1` / `batch2` |

**Soft constraints** (optimised, scored, but never fatal):

| Criterion | Scorer |
|---|---|
| Teacher load balance across the week | `scoreTeacherLoad` |
| Period distribution per day | `scoreDistribution` |
| Lab placement quality | `scoreLabPlacement` |
| Linked elective sync across sections | `scoreElectiveSync` |
| Room travel / back-to-back optimisation | `scoreTravelOptimization` |
| Minimising idle gaps for teachers | `scoreTeacherGaps` |
| Student stress (heavy day concentration) | `scoreStudentStress` |

`qualityScorer.scoreGrid()` combines these into a weighted 0–100 score, surfaced in the UI
via `QualityScoreCard`.

### Genetic algorithm

`geneticAlgorithm.js` implements a secondary refinement stage:

- Population size 10, up to 50 generations
- Tournament selection (size 3)
- Crossover + mutation (rate 0.15)
- Elitism keeping the top 2
- Early convergence stop after 10 generations without improvement

### Versioning & overrides

Each generation is persisted as a **version** of the timetable with its own quality score,
violation list and accepted/unaccepted state. Manual edits (set, clear, swap, lock, unlock)
are applied to a version and recorded in `OverrideLog` with a revert endpoint, so every change
is auditable and reversible.

---

## The timetable data model

A timetable is stored as **versions**, each holding per-class slot arrays.

```
Timetable
├── version          Number
├── label            Human label ("Semester 5 — v3")
├── qualityScore     0–100
├── isAccepted       Published / approved state
├── constraints      Violation + unplaced report
├── classTimetables[]
│   ├── classId, className, semester, section
│   └── slots[]
│       ├── day, period
│       ├── subjectId, subjectName, subjectCode, subjectType (theory | lab | elective)
│       ├── teacherIds[], teacherNames[]
│       ├── roomName
│       ├── isBreak, isLabBlock, labBlockIndex, isBatchSplit
│       ├── batch1 { teacherId, teacherName, roomName }
│       ├── batch2 { teacherId, teacherName, roomName }
│       └── isLocked
└── editHistory[]    Who changed what, when
```

Supporting models: `CollegeSettings` (working days, periods per day, period timeline,
teacher daily limit, Friday timeline), `TeacherAvailability` (day × period unavailability),
`OverrideLog` (auditable manual changes), `Suggestion` (teacher-reported conflicts),
`EmailConfig` (SMTP settings), `UploadedFile` (import + OCR status).

---

## API reference

All endpoints are under `/api`. Authenticated routes expect `Authorization: Bearer <token>`.

### Auth — `/api/auth`
| Method | Endpoint | Access |
|---|---|---|
| GET | `/setup-status` | public |
| POST | `/setup` | public (first-run only) |
| POST | `/admin/login` | public |
| POST | `/teacher/login` | public |
| GET | `/me` | authenticated |

### Departments — `/api/departments`
`GET /`, `GET /:id` public · `POST /`, `PUT /:id`, `DELETE /:id` admin

### Classes — `/api/classes`
`GET /`, `GET /:id`, `GET /semesters/:departmentId`, `GET /sections/:departmentId/:semester` public ·
`POST /`, `PUT /:id`, `DELETE /:id` admin

### Teachers — `/api/teachers`
`GET /`, `POST /`, `PUT /:id`, `DELETE /:id` admin ·
`GET /me/profile` teacher · `GET /:id` own-data-or-admin ·
`PUT /:id/unavailability` own-data-or-admin

### Subjects — `/api/subjects`
`GET /`, `GET /:id`, `GET /lab-rooms` public · `POST /`, `PUT /:id`, `DELETE /:id` admin

### Timetable — `/api/timetable`
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/accepted` | published timetables |
| POST | `/generate` | run the engine (admin, heavy rate limit) |
| GET | `/versions`, `/versions/:id` | version list / detail (admin) |
| GET | `/versions/:id/history` | edit history (admin) |
| PATCH | `/versions/:id/accept` `/unaccept` `/label` | publish state (admin) |
| DELETE | `/versions/:id` | delete version (admin) |
| PATCH | `/versions/:id/edit/set` | set a slot (admin) |
| PATCH | `/versions/:id/edit/clear` | clear a slot (admin) |
| PATCH | `/versions/:id/edit/swap` | swap two slots (admin) |
| PATCH | `/versions/:id/edit/lock` `/unlock` | lock state (admin) |
| POST | `/teacher-availability` | save availability (admin) |
| GET | `/cross-dept-teachers/:departmentId` | shared teachers (admin) |

### Overrides — `/api/overrides` (admin)
`GET /` · `POST /` · `DELETE /:id` (revert)

### Suggestions — `/api/suggestions`
`POST /`, `GET /mine` teacher · `GET /`, `PATCH /read-all`, `PATCH /:id/read`, `DELETE /:id` admin

### Email — `/api/email` (admin)
`GET /config` · `PUT /config` · `POST /test` · `POST /send`

### Upload — `/api/upload` (admin)
`GET /` · `GET /:id` · `POST /` · `DELETE /:id` · `POST /:id/retry-ocr`

### Download — `/api/download`
`GET /pdf/class/:classId` · `/pdf/all-classes` · `/pdf/teacher/:teacherId` · `/pdf/all-teachers`
`GET /excel/class/:classId` · `/excel/all-classes`

### Settings — `/api/settings`
`GET /` public · `PUT /`, `POST /reset`, `POST /clear-timetables`,
`POST /clear-subjects-timetables`, `POST /wipe-all` admin

### Student (public) — `/api/student`
`GET /departments` · `GET /semesters/:departmentId` · `GET /sections/:departmentId/:semester` ·
`GET /timetable/:departmentId/:semester/:section` — no auth required

### Health
`GET /api/health`

---

## Roles and access

| Area | Public | Teacher | Admin |
|---|:--:|:--:|:--:|
| View published timetables | ✅ | ✅ | ✅ |
| Browse departments / classes / subjects | ✅ | ✅ | ✅ |
| Create/edit/delete departments, classes, teachers, subjects | ❌ | ❌ | ✅ |
| Generate timetables | ❌ | ❌ | ✅ |
| Edit / lock / swap slots | ❌ | ❌ | ✅ |
| Override log & revert | ❌ | ❌ | ✅ |
| Upload files, OCR retry | ❌ | ❌ | ✅ |
| Email configuration | ❌ | ❌ | ✅ |
| College settings & destructive resets | ❌ | ❌ | ✅ |
| File suggestions | ❌ | ✅ | ✅ (read all) |
| View own timetable & profile | ❌ | ✅ | ✅ |

Middleware is centralised in `backend/src/middleware/auth.js`:
`authenticate`, `requireAdmin`, `requireTeacher`, `requireOwnDataOrAdmin`.

---

## Dev utility scripts

| Script | What it does |
|---|---|
| `node src/seed_backend.js` | Seed a full demo dataset (departments, classes, teachers, subjects, admin) |
| `node src/db_check.js` | Connect to MongoDB, verify connectivity and admin credentials |
| `node src/test_generation.js` | Run the engine end-to-end against seeded data |
| `src/utils/seedTest.js` | Minimal test fixture for engine experiments |
| `src/utils/clearData.js` | Clear collections without dropping the database |

---

## Troubleshooting

**`MongooseServerSelectionError` / cannot connect to MongoDB**
MongoDB isn't running, or `MONGODB_URI` points somewhere else. Verify with
`node src/db_check.js`, and confirm the service is up (`Get-Service MongoDB` on Windows).

**Frontend loads but every request fails**
`VITE_API_URL` must match the backend port. The default is `http://localhost:5000/api`.
Also confirm `CLIENT_URL` in the backend `.env` matches the frontend origin for CORS.

**"Admin setup already completed"**
The `Admin` collection is not empty. Use `/api/auth/setup-status`, or clear the collection via
`src/utils/clearData.js`.

**Generation reports unplaced subjects**
Usually an over-subscribed teacher, a lab requirement that cannot fit contiguously around
breaks, or more weekly hours than teaching slots. The feasibility checker and post-generation
report show exactly which constraint failed — adjust the period timeline, teacher availability
or lab room pool and regenerate.

**Vite serves on port 5175 instead of 5173**
Another process holds 5173. The URL is printed in the terminal; update `CLIENT_URL` in the
backend `.env` to match.

**Blank screen in the browser**
Check the console — a React error boundary (`components/common/ErrorBoundary.jsx`) now traps
render crashes and shows a recoverable error state instead of a white page.

---

## License

Private project — all rights reserved.