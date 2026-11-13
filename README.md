# AI Timetable Maker

An intelligent, institutional-grade academic timetable management and constraint-aware scheduling platform. Built for university engineering departments, the system automates conflict-free scheduling across classes, faculty, laboratories, and synchronized elective/minor baskets, providing real-time diagnostics, deterministic undo/redo state management, and official export generation.

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Institutional Scheduling Rules & Policies](#institutional-scheduling-rules--policies)
  - [1. Faculty Rest-Period Policy & Guaranteed Rest Gap](#1-faculty-rest-period-policy--guaranteed-rest-gap)
  - [2. Dynamic Global Minor-Track Synchronization](#2-dynamic-global-minor-track-synchronization)
  - [3. Institutional Laboratory Allocation Matrix](#3-institutional-laboratory-allocation-matrix)
  - [4. Mandatory Elective Basket Synchronization](#4-mandatory-elective-basket-synchronization)
  - [5. Daily Subject Uniqueness & Workload Conservation](#5-daily-subject-uniqueness--workload-conservation)
  - [6. Realistic Quality Scoring Model](#6-realistic-quality-scoring-model)
  - [7. Interactive Conflict Diagnostics & Optimization Intelligence](#7-interactive-conflict-diagnostics--optimization-intelligence)
  - [8. Deterministic Undo/Redo Engine & Atomic Swapping](#8-deterministic-undoredo-engine--atomic-swapping)
  - [9. Teacher Profile Management & Synchronized Name Propagation](#9-teacher-profile-management--synchronized-name-propagation)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Engine Pipeline & Verification Gates](#engine-pipeline--verification-gates)
- [REST API Reference](#rest-api-reference)
- [Installation & Local Setup](#installation--local-setup)
- [Verification & Automated Test Suite](#verification--automated-test-suite)
- [License](#license)

---

## Overview

Academic timetable scheduling in higher education institutions involves strict combinatorial constraints:

- **Faculty Workload & Rest Gaps**: Every instructor must receive sufficient breathing room throughout the teaching day. No instructor may be assigned 3 or more consecutive teaching periods without a rest gap.
- **Lunch Boundary Separation**: Midday lunch breaks (Mon–Thu between P3 and P4; Friday between P4 and P5) physically reset fatigue runs. Consecutive teaching across lunch is prohibited from being counted as back-to-back fatigue.
- **Physical Laboratory Isolation**: Practicals must follow exact institutional room assignments without double-booking. S1/S2 practicals are restricted to Lab 1–3; S3–S8 practicals and mini-projects are restricted to Lab 4; S8 Capstone Project is assigned dedicated rooms.
- **Dynamic Minor Synchronization**: S4 CSE A and S4 CSE B taking university Minor tracks must have identical time slots selected dynamically by the scheduler, avoiding hardcoded time slots.
- **Synchronized Electives**: Paired class sections sharing an elective basket must have identical periods.

**AI Timetable Maker** solves these challenges using a deterministic multi-stage constraint-satisfaction engine coupled with local search optimization and interactive administrative tooling.

---

## System Architecture

```mermaid
flowchart TD
    subgraph Client ["Frontend (React 19 + Vite + Tailwind CSS)"]
        UI[Timetable Builder & Grid]
        CD[Conflict Diagnostics Modal]
        UR[Deterministic Undo / Redo Engine]
        FP[Faculty Profile & Management]
        EX[Official PDF / Excel Exporter]
    end

    subgraph API ["Express API Gateway (Node.js)"]
        AUTH[Auth & RBAC Middleware]
        TC[Timetable Controller]
        MC[Minor & Elective Controllers]
        TEACH[Teacher Profile Controller]
        DS[Diagnostic & Quality Scorer Service]
    end

    subgraph Engine ["Scheduling & Constraint Engine"]
        FC[Feasibility Checker]
        SP[Slot Placer & Dynamic Minor Solver]
        CV[Hard/Soft Constraint Validator]
        PV[Persisted Validator]
        QS[Realistic Quality Scorer & Optimizer]
    end

    subgraph Storage ["Persistence Layer"]
        MDB[(MongoDB Database)]
    end

    UI -->|REST / JWT| TC
    CD -->|Diagnostics API| DS
    FP -->|Profile Updates| TEACH
    UR -->|Atomic Swaps & Revisions| TC
    TC --> AUTH
    TEACH --> AUTH
    AUTH --> Engine
    Engine --> FC --> SP --> CV --> PV --> QS
    PV --> MDB
    TC --> MDB
    TEACH --> MDB
    EX -->|Download Endpoints| TC
```

---

## Institutional Scheduling Rules & Policies

### 1. Faculty Rest-Period Policy & Guaranteed Rest Gap
- **Hard Constraint (`FACULTY_REST_GAP`)**: A maximum of 2 consecutive teaching periods is permitted globally across all classes, sections, and departments. 3 or more consecutive teaching periods without a free period are strictly prohibited.
- **Lunch Boundary Reset**:
  - **Monday–Thursday**: Lunch break occurs between Period 3 and Period 4. Periods P3 and P4 are physically separated by lunch and are **not** consecutive teaching periods.
  - **Friday**: Jum'ah / Lunch break occurs between Period 4 and Period 5. Periods P4 and P5 are physically separated by lunch.
- **Rest Optimization Preference**: The scheduling optimizer prioritizes the alternating pattern `Teaching -> Free -> Teaching -> Free -> Teaching` to prevent educator fatigue.
- **3-Period Lab Instructor Staggering**: In 3-period laboratory blocks, primary and co-instructors are staggered (Period 1: Primary; Period 2: Primary + Co-instructor; Period 3: Co-instructor) ensuring that no instructor exceeds 2 consecutive periods during practicals.

### 2. Dynamic Global Minor-Track Synchronization
- **Dynamic Slot Discovery**: Removes all legacy hardcoded Minor period assumptions (`Mon P3, Thu P3, Fri P4, Fri P6`). The engine dynamically computes common free periods across participating sections.
- **Section Synchronization**: S4 CSE A and S4 CSE B receive 100% identical Minor-track day and period slots.
- **Sub-Minor Parallelism**: Within each synchronized Minor slot, parallel sub-minor tracks (`Minor / OS`, `Minor / DBMS`, `Minor / COA`, `Minor / Mathematics`) run concurrently without teacher collisions.

### 3. Mandatory Institutional Laboratory Allocation Matrix
- **Exact Semester Eligibility Policy**:
  | Academic Activity | Permitted Laboratory | Strict Prohibitions |
  | :--- | :--- | :--- |
  | **S1 Regular Practicals** | `Lab 1` or `Lab 2` | Prohibited from `Lab 3` and `Lab 4` |
  | **S2 Regular Practicals** | `Lab 1` or `Lab 2` | Prohibited from `Lab 3` and `Lab 4` |
  | **S1/S2 Mini Projects** | `Lab 3` | Prohibited from `Lab 1`, `Lab 2`, and `Lab 4` |
  | **S3–S8 Regular Practicals** | `Lab 4` | Prohibited from `Lab 1`, `Lab 2`, and `Lab 3` |
  | **S3–S8 Mini Projects** | `Lab 4` | Prohibited from `Lab 1`, `Lab 2`, and `Lab 3` |
  | **S8 Capstone Project Phase-2** | Dedicated `Room 501` / `Room 502` | Prohibited from all scheduled laboratories (`Lab 1–4`) |
- **Full-Duration Multi-Period Occupancy**: Multi-period practicals reserve the designated laboratory across their entire duration (e.g. P1–P3 or P4–P6). Partial reservations or mid-session intrusions are strictly blocked.
- **Absolute Global Double-Booking Prevention**: Centralized `labValidationService.js` enforces single-occupancy across all classes, sections, and departments simultaneously.

### 4. Mandatory Elective Basket Synchronization
- Paired sections sharing an elective basket (e.g., S4 Professional Elective 1, S8 Electives) are locked into identical day and period coordinates.
- **Bidirectional Movement**: Dragging or swapping an elective slot in Section A automatically synchronizes the corresponding slot in Section B, preventing cross-section elective divergence (`ELECTIVE_DESYNCHRONIZATION`).

### 5. Daily Subject Uniqueness & Workload Conservation
- **Theory Distribution**: Under-scheduled theory courses are prohibited from scheduling excess periods on a single day unless mathematically required by high-credit loads ($\ge 5$ hours) or compressed schedules (e.g., S8 3-day window).
- **Workload Conservation**: Weekly lecture, tutorial, and practical contact hours strictly match KTU syllabus credit requirements.

### 6. Realistic Quality Scoring Model
- **No Fictitious 100/100 Scores**: The quality scorer evaluates both hard conflicts and soft warnings. Timetables with conflicts or warnings are realistically scored (e.g., 15/100 to 81/100) using weighted deductions:
  $$\text{Score} = 100 - (\text{HardConflicts} \times 8) - (\text{SoftWarnings} \times 0.6) - (\text{Unplaced} \times 10)$$
- **Publishability Gate**: A timetable version is only publishable if it has 0 unplaced subjects and 0 hard conflicts.

### 7. Interactive Conflict Diagnostics & Optimization Intelligence
- **Clickable Badges**: Diagnostic indicators in Quick Timetable (`Hard Conflicts`, `Soft Warnings`, `Optimization`) are fully interactive with "About & Issues ▾" subtitles.
- **Issue Diagnostics Modal**: Clicking any badge opens the modal showing:
  - Affected Class, Day, Period, Subject, Faculty, and Room
  - Detailed description and failure justification
  - Underlying Root Cause analysis
  - Actionable Recommended Resolution
  - **Locate in Grid**: Highlights and focuses the conflicting cell directly in the timetable grid.

### 8. Deterministic Undo/Redo Engine & Atomic Swapping
- **Atomic Multi-Period Swapping**: Swapping a multi-period laboratory block automatically displaces or exchanges the complete contiguous block.
- **State History**: Full undo and redo capabilities for manual swap operations with instant database synchronization.

### 9. Teacher Profile Management & Synchronized Name Propagation
- **RESTful Endpoints**: Full CRUD support (`create`, `update`, `getById`) in `teacherService.js` and `teacherController.js`.
- **Field Support**: Supports `designation`, `maxPeriodsPerWeek`, and `unavailability`.
- **Faculty Name Correction**: Corrected `Mr Sangeeth` to `Ms Sangeetha` across all MongoDB records, active timetable snapshots, and JSON caches.

### 10. Automatic Pre-Publication Analysis & Conflict Repair Engine
The scheduler does not merely generate a timetable and display errors—it takes active responsibility for diagnosing and solving scheduling conflicts:
```
SOURCE DATA
→ REQUIREMENT VALIDATION
→ INITIAL TIMETABLE GENERATION
→ COMPLETE CONSTRAINT ANALYSIS
→ AUTOMATIC CONFLICT DETECTION
→ AUTOMATIC REPAIR
→ RE-OPTIMIZATION
→ INDEPENDENT VALIDATION
→ FINAL MATHEMATICAL AUDIT
→ PUBLICATION DECISION
→ DISPLAY FINAL TIMETABLE
```
- **Automated Repair Engine (`conflictRepairEngine.js`)**:
  - Automatically identifies root causes of hard conflicts.
  - Explores candidate valid repairs using domain pruning and bounded backtracking.
  - Executes atomic lab room reassignments, lab block relocations, teacher presence staggering, and intra-class theory swaps.
  - Evaluates every candidate for safety—never introduces new hard conflicts.
  - Maintains a full audit trail of all repairs attempted and applied.

### 11. Independent Final Validation & Publication Gate
- **Authoritative Independent Ground-Truth Validator (`independentValidator.js`)**:
  - Reconstructs faculty, laboratory, section, and room occupancy maps from scratch directly from final allocation records.
  - Compares scheduled contact hours against authoritative syllabus curriculum requirements.
  - Strictly enforces the three publication gate outcomes:
    - **Outcome A — Fully Valid**: All hard constraints pass, all syllabus contact hours satisfied, independent audit passes -> **Publishable**.
    - **Outcome B — Partially Feasible**: Some requirements cannot be satisfied within budget -> clearly identifies missing allocations and reasons -> **Publication Blocked**.
    - **Outcome C — Infeasible**: Mathematical contradiction or conflicting data prevents finding a valid solution -> **Publication Blocked**.

---

## Technology Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, Canvas Confetti
- **Backend**: Node.js, Express.js, MongoDB, Mongoose
- **Testing & Verification**: Playwright E2E, Node.js Assertions
- **Export Engines**: PDFKit, ExcelJS

---

## Project Structure

```
AI_TIMETABLE_MAKER/
├── scripts/
│   ├── master_verification_suite.js     # 7-point integration test suite
│   ├── capture_ui_verification.js       # Playwright E2E UI screenshot script
│   └── correct_sangeetha_name.js        # Faculty name synchronization script
├── timetable-system/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── controllers/             # Timetable, teacher, and auth controllers
│   │   │   ├── models/                  # Mongoose schemas (Timetable, Teacher, Class)
│   │   │   └── services/engine/         # Core constraint and scheduling engine
│   │   │       ├── constraintValidator.js # Hard/soft rule validation
│   │   │       ├── dataLoader.js        # Normalized academic data hydration
│   │   │       ├── diagnosticService.js  # Diagnostic explanations and root causes
│   │   │       ├── orchestrator.js       # Multi-pass schedule orchestrator
│   │   │       ├── qualityScorer.js      # Realistic score calculation
│   │   │       ├── slotPlacer.js         # Placement engine and rest-gap logic
│   │   │       └── subMinorSolver.js     # Dynamic minor allocation solver
│   │   └── server.js                    # Express application entrypoint
│   └── frontend/
│       ├── src/
│       │   ├── components/timetable/    # ConflictDiagnosticsModal, VersionHistory
│       │   ├── pages/admin/             # TimetableBuilder, FacultyProfile
│       │   └── services/                # teacherService, timetableService
│       └── package.json
└── README.md
```

---

## Installation & Local Setup

### Prerequisites
- Node.js (v18+ or v20+)
- MongoDB running locally on `mongodb://127.0.0.1:27017`

### Setup Backend
```bash
cd timetable-system/backend
npm install
npm run dev
# Backend runs on http://127.0.0.1:5000
```

### Setup Frontend
```bash
cd timetable-system/frontend
npm install
npm run dev
# Frontend runs on http://localhost:5174
```

---

## Verification & Automated Test Suite

Run the master verification suite and mandatory laboratory/repair regression suite:

```bash
# 1. Run the 7-Point Master Institutional Verification Suite
node scripts/master_verification_suite.js

# 2. Run the 23-Point Mandatory Lab Allocation & Automatic Repair Test Suite
cd timetable-system/backend
node --test tests/mandatory_lab_and_auto_repair.test.js
```

### Test Suite Coverage:
1. **Mandatory Laboratory Matrix (Part 8.1 - 17 Tests)**:
   - S1/S2 regular practicals in `Lab 1` or `Lab 2` -> PASS; `Lab 3` or `Lab 4` -> FAIL.
   - S1/S2 Mini Projects in `Lab 3` -> PASS; `Lab 1`, `Lab 2`, or `Lab 4` -> FAIL.
   - S3–S8 regular practicals in `Lab 4` -> PASS; `Lab 1`, `Lab 2`, or `Lab 3` -> FAIL.
   - S3–S8 Mini Projects in `Lab 4` -> PASS; `Lab 1`, `Lab 2`, or `Lab 3` -> FAIL.
   - Simultaneous double-booking of any laboratory -> FAIL.
   - Multi-period practical collision in 2nd or 3rd period -> FAIL.
2. **Automatic Conflict Resolution & Repair (Part 8.2 - 3 Tests)**:
   - Automatically repairs injected invalid laboratory assignments to permitted laboratories.
   - Automatically repairs faculty rest-gap violations ($\ge 3$ consecutive periods) via teacher presence staggering and intra-class slot exchanges.
   - Detects mathematically impossible scenarios and safely triggers **Outcome C (Infeasible)** without fabricating invalid timetables.
3. **Full Pre-Publication Generation & Validation Pipeline (Part 8.3)**:
   - Executes all 8 stages: Requirement Validation -> Initial Placement -> Constraint Analysis -> Conflict Detection -> Automatic Repair -> Re-Optimization -> Independent Validation -> Publication Gate Decision.
4. **Faculty Rest Gap & Lunch Reset**: Confirms lunch boundary separation and rejects $\ge 3$ consecutive periods globally.
5. **Dynamic Minor Sync**: Verifies 100% identical Minor slots between S4 CSE A and S4 CSE B.
6. **Teacher Profile Management**: Validates `teacherService.create`/`update` and Edit Profile modal.
7. **Realistic Quality Scoring & Interactive Conflict Diagnostics UI**: Ensures scores are mathematically deducted and badges provide interactive explanations with root causes and resolutions.

---

## License

This project is licensed under the MIT License.
