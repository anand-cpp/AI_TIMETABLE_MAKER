# AI TIMETABLE MAKER 2.0 - Complete Project Documentation

> Written so that anyone (even a 10-year-old) can understand how this system works.

---

## Table of Contents

1. [What Is This Project?](#1-what-is-this-project)
2. [How It Works (The Big Picture)](#2-how-it-works-the-big-picture)
3. [Tech Stack - What Tools Were Used](#3-tech-stack---what-tools-were-used)
4. [Project Structure (File Organization)](#4-project-structure-file-organization)
5. [Database - Where Data Is Stored](#5-database---where-data-is-stored)
6. [Features - Everything the App Can Do](#6-features---everything-the-app-can-do)
7. [The AI Scheduling Engine - The Brain](#7-the-ai-scheduling-engine---the-brain)
8. [Security](#8-security)
9. [How the Frontend Works](#9-how-the-frontend-works)
10. [API Routes (How Frontend Talks to Backend)](#10-api-routes-how-frontend-talks-to-backend)
11. [Roles & Access Control](#11-roles--access-control)
12. [Problems, Bugs & Areas to Fix](#12-problems-bugs--areas-to-fix)
13. [How to Run the Project](#13-how-to-run-the-project)
14. [Glossary (Big Words Explained)](#14-glossary-big-words-explained)

---

## 1. What Is This Project?

Imagine your college has 500 students, 80 teachers, 20 classrooms, and 100 subjects. Creating a timetable by hand is a nightmare - you have to make sure:

- No two teachers teach at the same time in different places
- No student has two classes at once
- Labs (which take 2-3 periods) fit without breaking things
- Teachers get breaks and aren't overworked
- Elective subjects (where students pick courses) sync across classes

**AI Timetable Maker 2.0** does ALL of this automatically. An admin types in the college data, clicks "Generate", and the AI creates a perfect, conflict-free timetable in seconds.

### Who Uses It?

| Person | What They Do |
|--------|-------------|
| **Admin** | Manages everything: departments, teachers, subjects, generates timetables, publishes them |
| **Teacher** | Logs in to see their personal timetable and sends suggestions to admin |
| **Student** | No login needed. Selects their class and views the published timetable |

---

## 2. How It Works (The Big Picture)

Think of it like cooking:

```
Step 1: Add Ingredients (Departments, Teachers, Subjects, Classes)
         |
Step 2: Click "Cook" (AI Engine generates the timetable)
         |
Step 3: Taste Test (Quality Score checks how good it is)
         |
Step 4: Adjust Seasoning (Admin can drag-and-drop to swap slots)
         |
Step 5: Serve (Publish timetable, students/teachers can see it)
         |
Step 6: Share (Export as PDF/Excel, email notifications to everyone)
```

The system has **two parts** running at the same time:
- **Frontend** (the website you see) - runs on port 5175
- **Backend** (the brain that does the work) - runs on port 5000

They talk to each other using something called **API** (like a waiter taking your order to the kitchen and bringing food back).

---

## 3. Tech Stack - What Tools Were Used

### Frontend (What the User Sees)

| Tool | What It Does | Analogy |
|------|-------------|---------|
| **React 19** | Builds the website's interactive parts | Like LEGO blocks that change when you click them |
| **Vite** | Makes the website start super fast | Like a sports car engine for your website |
| **Tailwind CSS** | Makes the website look beautiful | Like a box of crayons, but for websites |
| **React Router** | Lets you go from page to page | Like doors in a house |
| **React Query** | Fetches data from the server efficiently | Like a快递员 (delivery person) who caches packages |
| **Framer Motion** | Adds smooth animations | Like the bouncing effect in cartoons |
| **Recharts** | Draws charts and graphs | Like drawing with math |
| **React Hook Form + Zod** | Handles forms and validates input | Like a teacher checking your homework |
| **Axios** | Sends requests to the backend | Like a telephone to call the server |
| **dnd-kit** | Drag and drop functionality | Like physically moving sticky notes |
| **Lucide React** | Beautiful icons | Like emoji, but prettier |
| **React Hot Toast** | Shows popup notifications | Like little popup messages |
| **html2pdf.js** | Converts pages to PDF | Like a "Save as PDF" button |

### Backend (The Brain)

| Tool | What It Does | Analogy |
|------|-------------|---------|
| **Node.js** | Runs JavaScript on the server | Like having JavaScript work outside the browser |
| **Express.js** | Creates the API (the communication system) | Like a receptionist who routes calls |
| **MongoDB + Mongoose** | Stores all the data | Like a super-organized filing cabinet |
| **bcryptjs** | Encrypts passwords | Like putting passwords through a secret decoder ring |
| **jsonwebtoken (JWT)** | Keeps users logged in securely | Like a VIP wristband at a concert |
| **Nodemailer** | Sends emails | Like a robot mailman |
| **Tesseract.js** | Reads text from images (OCR) | Like teaching a computer to read |
| **jsPDF + jspdf-autotable** | Creates PDF files | Like a printer inside your computer |
| **xlsx** | Creates Excel files | Like making spreadsheets automatically |
| **Multer** | Handles file uploads | Like a mailbox that accepts packages |
| **Helmet** | Security for the server | Like a lock on your door |
| **express-rate-limit** | Prevents spam/abuse | Like a bouncer at a club |

### Development Tools

| Tool | What It Does |
|------|-------------|
| **nodemon** | Auto-restarts the server when code changes |
| **concurrently** | Runs frontend and backend at the same time |
| **ESLint** | Checks code for mistakes (like spellcheck for code) |
| **PostCSS** | Processes CSS for Tailwind |

---

## 4. Project Structure (File Organization)

```
AI TIMETABLE MAKER 2.0/
├── package.json                  # Root: runs both frontend & backend together
├── timetable-system/
│   ├── backend/                  # The Brain
│   │   └── src/
│   │       ├── server.js         # Entry point - starts the server
│   │       ├── app.js            # Sets up Express app with all routes
│   │       ├── config/
│   │       │   ├── database.js   # Connects to MongoDB
│   │       │   ├── constants.js  # Defines default values (days, periods, etc.)
│   │       │   └── mailer.js     # Email configuration
│   │       ├── models/           # Database "blueprints" (12 models)
│   │       │   ├── Admin.js
│   │       │   ├── Teacher.js
│   │       │   ├── Student.js
│   │       │   ├── Subject.js
│   │       │   ├── Class.js
│   │       │   ├── Department.js
│   │       │   ├── Timetable.js
│   │       │   ├── TeacherAvailability.js
│   │       │   ├── Suggestion.js
│   │       │   ├── CollegeSettings.js
│   │       │   ├── OverrideLog.js
│   │       │   ├── EmailConfig.js
│   │       │   └── UploadedFile.js
│   │       ├── controllers/      # Handles API requests (12 controllers)
│   │       ├── routes/           # Maps URLs to controllers (13 route files)
│   │       ├── middleware/       # Security & validation layers
│   │       │   ├── auth.js       # JWT authentication
│   │       │   ├── rateLimiter.js # Prevents spam
│   │       │   ├── errorHandler.js # Catches errors
│   │       │   ├── validate.js   # Validates request data
│   │       │   └── upload.js     # Handles file uploads
│   │       ├── services/         # Business logic
│   │       │   ├── engine/       # THE AI SCHEDULING BRAIN
│   │       │   │   ├── orchestrator.js     # Main coordinator
│   │       │   │   ├── dataLoader.js       # Loads data from DB
│   │       │   │   ├── feasibilityChecker.js # Pre-generation check
│   │       │   │   ├── constraintValidator.js # Validates rules
│   │       │   │   ├── slotPlacer.js       # THE CORE: Places subjects
│   │       │   │   ├── geneticAlgorithm.js # Unused GA engine
│   │       │   │   ├── qualityScorer.js    # Rates timetable quality
│   │       │   │   └── softOptimizer.js    # Post-placement improvement
│   │       │   ├── emailService.js
│   │       │   ├── pdfService.js
│   │       │   ├── excelService.js
│   │       │   └── ocrService.js
│   │       └── utils/            # Helper functions
│   │
│   └── frontend/                 # The Face
│       └── src/
│           ├── App.jsx           # Main app with all routes
│           ├── main.jsx          # React entry point
│           ├── context/          # Global state management
│           │   ├── AuthContext.jsx
│           │   ├── ThemeContext.jsx
│           │   └── TimetableContext.jsx
│           ├── pages/            # Different screens
│           │   ├── public/       # Login, Home, Student View
│           │   ├── admin/        # Admin panels (12 pages)
│           │   └── teacher/      # Teacher panels (3 pages)
│           ├── components/       # Reusable UI pieces (50+ components)
│           │   ├── timetable/    # The timetable grid, editor, etc.
│           │   ├── ui/           # Generic buttons, modals, inputs
│           │   ├── layout/       # Sidebar, Topbar, Page layouts
│           │   └── ...
│           ├── services/         # API calls to the backend
│           ├── hooks/            # Custom React hooks
│           ├── utils/            # Helper functions
│           └── data/             # Test data
```

---

## 5. Database - Where Data Is Stored

The app uses **MongoDB** (a NoSQL database). Think of it like a bunch of spreadsheets that are all linked together.

### All 12 Data Collections (Collections = Tables)

#### 1. Admin
Who can log in as admin.
```
Fields: username, password (encrypted), role (always "admin")
```

#### 2. Department
College departments like "Computer Science", "Electronics".
```
Fields: name, code (short form like "CS"), building, floor
```

#### 3. Class
A specific group of students (like "Semester 5, Section A").
```
Fields: departmentId, semester (1-8), section (A/B/C), strength (number of students),
        classRepName, classRepEmail, hodEmail, subjects[]
```

#### 4. Teacher
Teacher profiles with login credentials.
```
Fields: name, username, password, departmentId, email, phone,
        unavailability[] (when they CAN'T teach),
        morningLabPreference, maxPeriodsPerDay, isActive
```

#### 5. Subject
What is being taught and by whom.
```
Fields: name, code, classId, type (theory/lab/elective),
        weeklyHours, teachers[], labDetails{}, electiveDetails{}
```

**Special Subject Types:**
- **Theory**: Regular classroom teaching (1 period)
- **Lab**: Practical class (2-4 consecutive periods, may split into batches)
- **Elective**: Student picks a course (linked across classes or open choice)

#### 6. Timetable (THE BIG ONE)
Stores a complete generated timetable version.
```
Fields: version (1, 2, 3...), label, isAccepted, qualityScore{},
        classTimetables[] (one per class, each has slots[]),
        warnings[], unplacedSubjects[], editHistory[], generationStats{}
```

Each **slot** in a class timetable:
```
day, period, subjectId, subjectName, subjectType,
teacherIds[], roomName, isLocked, isBreak, isLabBlock,
isBatchSplit, batch1{}, batch2{}, isElective
```

#### 7. TeacherAvailability
Extra availability tracking (separate from teacher model).
```
Fields: teacherId, departmentId, unavailability[], source (manual/ocr/imported)
```

#### 8. Suggestion
Teachers can send feedback to admin.
```
Fields: teacherId, teacherName, message, isRead, readAt
```

#### 9. CollegeSettings (Singleton - only one row)
College-wide configuration.
```
Fields: collegeName, workingDays[], periodsPerDay, periodDuration,
        teacherDailyLimit, periodTimeline[], fridaySeparate, fridayTimeline[]
```

#### 10. OverrideLog
Tracks when admin overrides AI decisions.
```
Fields: requestType, teacherName, subjectName, className,
        issueDescription, selectedOption, status, adminNotes
```

#### 11. EmailConfig (Singleton)
SMTP email server settings.
```
Fields: smtpConfig{host, port, secure, user, pass, fromName, fromEmail}, isConfigured
```

#### 12. UploadedFile
Tracks uploaded documents (for OCR).
```
Fields: originalName, storedName, filePath, mimeType, size,
        ocrStatus, ocrResult, ocrError
```

### How Data Connects (Relationships)

```
Department ----< Class ----< Subject ----< Teacher
    |              |            |              |
    |              |            |              +-- unavailability[]
    |              |            |
    |              +-- subjects[]  (Class has many subjects)
    |              +-- classRep, hod
    |
    +-- Teacher.departmentId
    
Timetable ----< ClassTimetable ----< Slot
    |                                    |
    +-- editHistory[]                    +-- references Subject & Teacher
    +-- qualityScore{}
    +-- warnings[]
```

---

## 6. Features - Everything the App Can Do

### A. Admin Features

#### 1. Dashboard
- Shows setup progress (4 steps: Departments > Classes > Teachers > Subjects)
- Animated counters for stats
- Quick action cards for 3 types of timetable creation
- Published timetable status with quality score
- 3 levels of data reset (safe, curriculum, full wipe)
- Hidden dev seed button (Ctrl+Shift+D) for testing

#### 2. Department Management
- Create, edit, delete departments
- Code auto-generates from name
- Building and floor tracking

#### 3. Class Management
- Create classes with department, semester, section
- Track student strength, class representative, HOD email
- Link subjects to classes

#### 4. Teacher Management
- Create teacher accounts (with auto-generated login credentials)
- Set unavailability grid (visual day-period picker)
- Morning lab preference setting
- Max periods per day limit
- Active/inactive toggle

#### 5. Subject Management
- Three types: Theory, Lab, Elective
- **Theory**: Weekly hours, assigned teachers
- **Lab**: Room name, duration (2-4 periods), batch split option, separate batch teachers
- **Elective**: 
  - **Linked**: Multiple classes share same elective at same time
  - **Open**: Students choose from multiple options

#### 6. Timetable Builder (THE MAIN EVENT)
Three ways to create timetables:
- **Quick Timetable**: Full college at once
- **Department Timetable**: Single department
- **Year-Wise Timetable**: Specific semester/section

Features:
- AI generation with quality scoring
- Drag-and-drop slot swapping
- Manual slot editing (click to change subject/teacher/room)
- Lock/unlock slots (locked slots don't change on regeneration)
- Version history (keep old versions, compare)
- Accept/publish a version as "official"
- Post-generation report card
- Quality score visualization

#### 7. Export & Download
- **PDF**: Individual class, all classes, individual teacher, all teachers
- **Excel**: Individual class, all classes
- **Official Ahalia Format PDF**: Custom branded format

#### 8. Email Manager
- Configure SMTP (Gmail, custom server)
- Test connection
- Send timetable notifications to: Teachers, HODs, Class Representatives

#### 9. Upload (OCR)
- Upload images/PDFs of existing timetables
- OCR (Optical Character Recognition) reads the text
- Retry failed OCR processing

#### 10. Settings
- College name and info
- Working days (Mon-Fri, optional Saturday)
- Period timeline (start/end times, breaks)
- Friday can have a separate schedule
- Teacher daily limit
- Period duration

#### 11. Override Log
- See all admin override decisions
- Track what was changed and why
- Revert overrides

### B. Teacher Features

- **Dashboard**: Personal stats and quick links
- **My Timetable**: See their personal schedule (which classes, when, where)
- **Suggestions**: Send feedback/requests to admin

### C. Student Features (Public - No Login)

- Select Department > Semester > Section
- View the published timetable for their class
- Color-coded by subject type (theory, lab, elective)

---

## 7. The AI Scheduling Engine - The Brain

This is the most important part. It lives in `backend/src/services/engine/` and has 8 files.

### How It Thinks (Step by Step)

```
STEP 1: LOAD DATA (dataLoader.js)
   "Who are the teachers? What subjects? What classes?"
         |
STEP 2: CHECK FEASIBILITY (feasibilityChecker.js)
   "Is it even possible? Are there enough slots?"
   - Checks: enough time slots for all subjects
   - Checks: each subject has a teacher
   - Checks: teachers aren't overloaded
   - If impossible => STOP with error
         |
STEP 3: PLACE SUBJECTS (slotPlacer.js) - THE CORE
   Uses a 10-level escalation system:
   
   Level 1-4: Theory subjects (normal placement)
   Level 5:   Labs (normal placement)
   Level 6:   Theory with swap displacement
   Level 7:   Theory with cascade reschedule
   Level 8-9: Labs with alt rooms, split blocks
   Level 10:  Saturday overtime, permission requests
   
   ORDER: Open Electives -> Linked Electives -> Labs -> Theory -> Auto-fill
         |
STEP 4: OPTIMIZE (softOptimizer.js)
   "Can I make it even better?"
   - Swaps random theory slots
   - Keeps changes only if quality improves
   - Runs up to 200 iterations
         |
STEP 5: SCORE (qualityScorer.js)
   "How good is this timetable?"
   - 7 dimensions, each scored 0-100
   - Weighted average = overall score
         |
STEP 6: RETURN RESULT
   The timetable is saved to MongoDB
```

### The 7 Quality Dimensions

| Dimension | Weight | What It Measures |
|-----------|--------|-----------------|
| Teacher Load Balance | 1x | Are teachers equally loaded each day? |
| Subject Distribution | 1x | Are subjects spread across the week (not just Monday)? |
| Lab Placement | 1x | Are labs in the morning (when minds are fresh)? |
| Elective Sync | **2x** | Do linked electives happen at the same time across classes? |
| Travel Optimization | 1x | Are teacher gaps minimized (no 3-hour waits)? |
| Teacher Gaps | 1x | Are teaching periods consecutive (not scattered)? |
| Student Stress | 1x | No more than 3 theory periods in a row? |

### Constraint Rules (Hard - Cannot Break)

1. **No teacher teaches two classes at the same time** (no double-booking)
2. **No teaching during lunch break**
3. **Respect teacher unavailability** (if they said they can't teach Monday Period 3, don't assign them)
4. **No lab room conflicts** (two labs in same room at same time)
5. **Teacher daily limit** (don't assign more than X periods per day)
6. **Lab blocks are consecutive** (a 2-hour lab must be periods 1-2 or 4-5, not 2-3 crossing lunch)

### The Escalation System (When Normal Placement Fails)

Think of it like this: if you can't find a parking spot in the front row, you try:
1. The next row (Level 2)
2. The back lot (Level 3)
3. Ask someone to move their car (Level 6 - swap displacement)
4. Rearrange the whole parking lot (Level 7 - cascade reschedule)
5. Build a new parking lot (Level 10 - overtime/Saturday)

---

## 8. Security

### What's Protected

| Feature | How |
|---------|-----|
| Passwords | Encrypted with bcrypt (can't be read even if database is stolen) |
| Login sessions | JWT tokens (like a temporary pass) that expire after 7 days |
| API abuse | Rate limiting (100 requests per 15 minutes) |
| Admin routes | Only accessible if you have admin token |
| Teacher routes | Only accessible if you have teacher token |
| CORS | Only allows requests from known origins |
| Helmet | Adds security headers to prevent common attacks |

### What's NOT Secure (Problems)

See Section 12 for security issues.

---

## 9. How the Frontend Works

### State Management (How Data Flows)

The app uses **React Context** (3 contexts) instead of a state management library:

```
AuthContext     - Who is logged in? (user, token, role)
ThemeContext    - Dark mode or light mode?
TimetableContext - Timetable versions and active timetable
```

### Routing (Pages)

```
PUBLIC PAGES (no login needed):
  /                    - Home page (landing)
  /admin/login         - Admin login
  /teacher/login       - Teacher login
  /student             - Student timetable view
  /setup-admin         - First-time admin setup

ADMIN PAGES (need admin login):
  /admin/dashboard     - Control center
  /admin/departments   - Manage departments
  /admin/classes       - Manage classes
  /admin/teachers      - Manage teachers
  /admin/subjects      - Manage subjects
  /admin/timetable     - Build & manage timetables
  /admin/department-timetable  - Dept-specific timetable
  /admin/year-timetable        - Year-specific timetable
  /admin/upload        - Upload files (OCR)
  /admin/suggestions   - View teacher suggestions
  /admin/email         - Email configuration
  /admin/override-log  - Override history
  /admin/settings      - College settings

TEACHER PAGES (need teacher login):
  /teacher/dashboard   - Teacher's home
  /teacher/timetable   - Personal timetable
  /teacher/suggestions - Send suggestions to admin
```

### UI Components (50+ reusable pieces)

The app has a custom component library with:
- **Layout**: Sidebar, Topbar, PublicLayout, AdminLayout, TeacherLayout
- **Timetable**: TimetableGrid, SlotCell, DraggableSlotCell, EditSlotModal, GeneratePanel, QualityScoreCard, VersionHistory, etc.
- **UI Primitives**: Button, Input, Select, Modal, Table, Badge, Toggle, Tabs, Tooltip, Card, Spinner, ConfirmDialog, etc.

### Dark Mode

The app supports dark and light themes via CSS variables. The theme persists in localStorage and respects the user's system preference.

---

## 10. API Routes (How Frontend Talks to Backend)

### Authentication
```
POST /api/auth/setup          - Create admin (one-time)
GET  /api/auth/setup-status   - Check if admin exists
POST /api/auth/admin/login    - Admin login
POST /api/auth/teacher/login  - Teacher login
GET  /api/auth/me             - Get current user
```

### Data Management
```
GET/POST    /api/departments
GET/POST    /api/classes
GET/POST    /api/teachers
GET/POST    /api/subjects
GET         /api/settings
PUT         /api/settings
POST        /api/settings/reset
POST        /api/settings/clear-timetables
POST        /api/settings/clear-subjects-timetables
POST        /api/settings/wipe-all
```

### Timetable Operations
```
POST /api/timetable/generate              - Generate new timetable
GET  /api/timetable/versions              - List all versions
GET  /api/timetable/versions/:id          - Get specific version
GET  /api/timetable/accepted              - Get published version
PATCH /api/timetable/versions/:id/accept  - Publish a version
PATCH /api/timetable/versions/:id/unaccept - Unpublish
DELETE /api/timetable/versions/:id        - Delete version
PATCH /api/timetable/versions/:id/edit/set     - Edit a slot
PATCH /api/timetable/versions/:id/edit/clear   - Clear a slot
PATCH /api/timetable/versions/:id/edit/lock    - Lock a slot
PATCH /api/timetable/versions/:id/edit/unlock  - Unlock a slot
PATCH /api/timetable/versions/:id/edit/swap    - Swap two slots
GET  /api/timetable/teacher/:teacherId    - Teacher's personal timetable
```

### Downloads
```
GET /api/download/pdf/class/:classId
GET /api/download/pdf/all-classes
GET /api/download/pdf/teacher/:teacherId
GET /api/download/pdf/all-teachers
GET /api/download/excel/class/:classId
GET /api/download/excel/all-classes
```

### Other
```
POST /api/upload           - Upload file (OCR)
POST /api/email/send       - Send timetable emails
GET/POST /api/suggestions
GET/POST /api/overrides
GET /api/student/timetable/:deptId/:semester/:section  (public)
```

---

## 11. Roles & Access Control

| Feature | Admin | Teacher | Student (Public) |
|---------|-------|---------|-------------------|
| Login | Yes | Yes | No login needed |
| Manage Departments/Classes/Teachers/Subjects | Yes | No | No |
| Generate Timetables | Yes | No | No |
| Edit Timetable Slots | Yes | No | No |
| Accept/Publish Timetables | Yes | No | No |
| Export PDF/Excel | Yes | No | No |
| Configure Email | Yes | No | No |
| View Own Timetable | Yes (all) | Yes (own) | Yes (class) |
| Send Suggestions | No | Yes | No |
| View Published Timetable | Yes | Yes | Yes |

---

## 12. Problems, Bugs & Areas to Fix

### CRITICAL Issues

#### 1. Genetic Algorithm is Dead Code
**File**: `backend/src/services/engine/geneticAlgorithm.js`
**Problem**: A full genetic algorithm (333 lines) is implemented but **never called** from the orchestrator. It has population generation, crossover, mutation, and fitness evaluation - all wasted code.

#### 2. Fake Generation Stats
**File**: `backend/src/services/engine/orchestrator.js:174`
**Problem**: `generationStats.generations` is hardcoded to `1247` and `generationStats.timeMs` doesn't reflect actual time. This is misleading to users.

#### 3. Hardcoded Quality Score
**File**: `backend/src/services/engine/orchestrator.js`
**Problem**: The quality score is calculated as `Math.max(92 - hardViolations*2, 85)` instead of using the detailed `qualityScorer.js` that has 7 dimensions. The quality scorer exists but isn't connected.

#### 4. CORS is Too Open
**File**: `backend/src/app.js:34-41`
**Problem**: `origin: true` reflects any requesting origin. This should be restricted to specific domains in production.

#### 5. Helmet Security Mostly Disabled
**File**: `backend/src/app.js:27-31`
**Problem**: Both `crossOriginResourcePolicy` and `contentSecurityPolicy` are set to `false`, defeating much of Helmet's purpose.

### HIGH Priority Issues

#### 6. No Environment Variables File
**Problem**: No `.env` file or `.env.example` exists. The code references `process.env.JWT_SECRET`, `process.env.MONGODB_URI`, `process.env.CLIENT_URL`, etc. but there's no template for developers.

#### 7. Database Doesn't Exit on Failure
**File**: `backend/src/config/database.js:18-20`
**Problem**: If MongoDB can't connect at all, the server just logs a warning and continues running, which would cause every API call to fail with cryptic errors.

#### 8. Unhandled Promise Rejection Doesn't Exit
**File**: `backend/src/server.js:36-38`
**Problem**: `unhandledRejection` only logs the error but doesn't exit the process. In Node.js 15+, unhandled rejections should crash the process to prevent silent data corruption.

#### 9. JWT Secret Has No Default
**Problem**: `jwt.sign({ id, role }, process.env.JWT_SECRET, ...)` - if `JWT_SECRET` is undefined, tokens are signed with `undefined`, which is a security vulnerability.

#### 10. No Input Sanitization on Timetable Edit
**File**: `backend/src/controllers/timetableController.js`
**Problem**: The `editSetSlot` endpoint accepts `slotData` from the request body and spreads it into the slot without validation. Malicious data could corrupt the timetable.

### MEDIUM Priority Issues

#### 11. Email Password Stored in Plain Text (in DB)
**File**: `backend/src/models/EmailConfig.js`
**Problem**: SMTP password is stored as-is in MongoDB. Should be encrypted like user passwords.

#### 12. No Pagination on List Endpoints
**Problem**: Endpoints like `GET /api/teachers`, `GET /api/subjects`, etc. return ALL records. With hundreds of teachers/subjects, this could be slow.

#### 13. No Rate Limiting on Auth Endpoints Specifically
**Problem**: While there's a general rate limiter, there's no specific brute-force protection on login endpoints.

#### 14. `seedTest.js` and `seed_backend.js` in Production Code
**Problem**: Test seeding scripts are left in the source code. These should be in a separate `scripts/` or `dev/` directory.

#### 15. Missing Error Boundaries in Some Routes
**Problem**: While `ErrorBoundary` wraps the main app, individual page-level errors might not be caught gracefully.

#### 16. OCR Service Processing in Background Without Queue
**File**: `backend/src/controllers/uploadController.js:33-35`
**Problem**: OCR is triggered with `.catch()` in the background. If many files are uploaded simultaneously, this could overwhelm the server (Tesseract.js is CPU-intensive).

#### 17. localStorage Cache Without Expiration
**File**: `TimetableBuilder.jsx`
**Problem**: Timetables are cached in localStorage without any expiration. Stale data could be shown to users.

#### 18. No Database Backup/Restore Mechanism
**Problem**: The "Wipe All" feature has no undo. There's no export/import mechanism for backing up data.

### LOW Priority / Code Quality Issues

#### 19. Inconsistent Module Systems
- Backend uses CommonJS (`require`)
- Frontend uses ES Modules (`import`)
- This is technically fine but could confuse new developers

#### 20. Console.log Statements in Production Code
- Multiple `console.log` and `console.error` statements throughout the backend
- Should use a proper logging library (like Winston or Pino)

#### 21. No TypeScript
- The entire codebase is plain JavaScript
- TypeScript would catch many bugs at compile time

#### 22. No Unit Tests
- No test files exist (no `__tests__/`, no `.test.js`, no `.spec.js`)
- The `seedTest.js` is not a test file, it's a data seeder

#### 23. `uuid` Package Used Twice
- Both backend and frontend have `uuid` as a dependency
- The frontend version (`^14.0.1`) is much newer than backend (`^10.0.0`)

#### 24. Vite Config May Need Proxy
- Frontend runs on port 5175, backend on 5000
- No proxy configuration visible in `vite.config.js` for API calls
- CORS handles this, but a proxy would be cleaner for development

#### 25. Missing `.env.example`
- No template file showing what environment variables are needed

---

## 13. How to Run the Project

### Prerequisites
1. Install [Node.js](https://nodejs.org/) (version 18 or higher)
2. Install [MongoDB](https://www.mongodb.com/) (running locally on port 27017)
3. Clone the project

### Setup

```bash
# 1. Go to project folder
cd "AI TIMETABLE MAKER 2.0"

# 2. Install root dependencies
npm install

# 3. Install backend dependencies
cd timetable-system/backend
npm install

# 4. Install frontend dependencies
cd ../frontend
npm install

# 5. Go back to root
cd ../..

# 6. Create a .env file in timetable-system/backend/ with:
#    JWT_SECRET=your-secret-key-here
#    MONGODB_URI=mongodb://127.0.0.1:27017/timetable_db
#    PORT=5000
#    CLIENT_URL=http://localhost:5175

# 7. Start everything
npm run dev
```

This runs both:
- Backend at http://localhost:5000
- Frontend at http://localhost:5175

### First Time Setup
1. Open http://localhost:5175
2. You'll be redirected to /setup-admin
3. Create your admin account
4. Start adding departments, classes, teachers, subjects
5. Generate your first timetable!

---

## 14. Glossary (Big Words Explained)

| Word | What It Means |
|------|-------------|
| **API** | A way for two computer programs to talk to each other |
| **Backend** | The server-side code that processes data (invisible to users) |
| **Frontend** | The website/UI that users see and interact with |
| **MongoDB** | A database that stores data in flexible "documents" |
| **Mongoose** | A tool that makes MongoDB easier to use with JavaScript |
| **JWT** | JSON Web Token - a digital pass that proves you're logged in |
| **bcrypt** | A tool that scrambles passwords so nobody can read them |
| **React** | A JavaScript library for building user interfaces |
| **Component** | A reusable piece of UI (like a LEGO block) |
| **State** | Data that changes over time (like a score counter) |
| **Context** | A way to share data between components without passing it through every level |
| **Route** | A URL path that shows a specific page (like `/admin/dashboard`) |
| **Endpoint** | A specific URL that the backend listens to (like `GET /api/teachers`) |
| **CORS** | Cross-Origin Resource Sharing - controls which websites can call your API |
| **OCR** | Optical Character Recognition - teaching a computer to read text from images |
| **Constraint** | A rule that MUST be followed (like "no teacher double-booking") |
| **Hard Constraint** | A rule that CANNOT be broken under any circumstances |
| **Soft Constraint** | A rule that should be followed but CAN be broken if necessary |
| **Escalation** | When the first approach fails, try increasingly aggressive alternatives |
| **Singleton** | A database collection that only ever has ONE row (like settings) |
| **Rate Limiting** | limiting how many requests someone can make in a time period |
| **Graceful Shutdown** | Properly closing connections when the server stops |
| **Docker** | (Not used here, but...) A tool to package apps in containers |
| **Mutation** | In genetic algorithms: randomly changing part of a solution |
| **Crossover** | In genetic algorithms: combining two solutions to make a better one |
| **Hill Climbing** | A optimization technique: keep making small changes that improve the result |

---

## Summary

**AI Timetable Maker 2.0** is a full-stack web application that uses a constraint-based scheduling engine to automatically generate conflict-free college timetables. It supports:

- Multi-role access (Admin/Teacher/Student)
- Complex scheduling constraints (teacher conflicts, lab blocks, electives, availability)
- Manual editing with drag-and-drop
- Quality scoring across 7 dimensions
- PDF/Excel export
- Email notifications
- Dark mode UI
- File upload with OCR

The main areas for improvement are:
1. Connect the quality scorer and genetic algorithm that are already written but unused
2. Add environment variable templates and proper configuration
3. Strengthen security (restrict CORS, enable Helmet, encrypt email passwords)
4. Add tests and TypeScript for reliability
5. Add proper logging instead of console.log

---

*Documentation generated on: August 17, 2026*
*Project: AI Timetable Maker 2.0*
*Total Files Analyzed: 100+ source files*
