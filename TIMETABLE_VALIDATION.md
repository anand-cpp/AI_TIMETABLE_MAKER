# Timetable Validation & Correctness

How the system decides a timetable is complete, conflict-free, and publishable.

---

## 1. Validation layers

```
slot placement (slotPlacer.js)
        ↓
in-memory grid validation (constraintValidator.js  →  validateOutput / validateGrid)
        ↓
persisted re-validation (persistedValidator.js  →  validatePersistedTimetable)
        ↓
publish gate (PATCH /versions/:id/accept)  +  manual-edit gate (checkEdit)
```

Validation runs **twice**: once on the engine's in-memory grid, and again on the
document loaded from MongoDB before anything is published. This prevents
"engine said it was fine, DB stored something else" drift.

---

## 2. `checks` object (persisted in `Timetable.validationChecks`)

| Key | Meaning |
|-----|---------|
| `all_subjects_placed` | every subject got its required periods |
| `all_subject_hours_met` | sum of placed periods == `weeklyHours` (no over/under) |
| `zero_teacher_conflicts` | no teacher teaches two classes in the same cell |
| `zero_class_conflicts` | a class never has two subjects in the same cell |
| `zero_room_conflicts` | shared rooms (esp. labs) are exclusive |
| `zero_availability_violations` | respect teacher `unavailability` |
| `zero_invalid_slots` | every occupied cell is within the period timeline and is not a break |
| `zero_lab_block_violations` | labs are one consecutive block, not crossing lunch |
| `all_slots_filled` | no non-break teaching slot left empty (auto-fill accounted) |
| `hardViolationsCount` | total hard violations (0 ⇒ publishable) |

---

## 3. Hard constraint types

`HARD_VIOLATION_TYPES` in `constraintValidator.js`:

- `TEACHER_DOUBLE_BOOKED`
- `CLASS_DOUBLE_BOOKED`
- `ROOM_CONFLICT` / `LAB_ROOM_CONFLICT`
- `TEACHER_UNAVAILABLE`
- `INVALID_SLOT_NO_TEACHER`
- `SLOT_OUT_OF_TIMELINE`
- `BREAK_SLOT_USED`
- `LAB_BLOCK_SPLIT` / `LAB_BLOCK_NON_CONSECUTIVE` / `LAB_BREAK_CROSSED`
- `SUBJECT_OVER_SCHEDULED` / `SUBJECT_UNDER_SCHEDULED`

### Subtlety: shared electives
An open or linked elective is **one physical session attended by several classes**
with the **same teacher**. A naive teacher-conflict check flags this as a double
booking. `sharedElectiveToken(slot)` (built from `electiveGroupId` / `linkedGroupId`)
lets two classes share the same cell **only when the token matches**. Without the
token the same cell *is* a conflict.

### Subtlety: break numbered `0`
The period timeline stores the break as `periodNumber: 0` (between e.g. P3 and P4).
Validation therefore accepts `0` for break entries (requires `>= 1` for teaching
periods), and `crossesBreak()` walks the timeline **in array order** rather than by
numeric period — so a break at index 3 is detected even though its number is 0.

---

## 4. Completeness (`isComplete`)

Computed by the orchestrator and persisted (`Timetable.isComplete`):

1. Every subject accounted for (no unreported failures).
2. Subject hours met exactly.
3. Zero hard violations.
4. No empty non-break slots.

If data is genuinely unschedulable (e.g. a teacher whose capacity cannot cover the
required hours), the engine returns `success: false` with an error list rather than
shipping a partial timetable — and `unplacedSubjects` names exactly which subjects
could not be placed.

---

## 5. Auto-fill & manual edits

- Remaining non-break slots are filled with Tutorials / Physical Education /
  Mentoring / Skill Development / Self-Study.
- A tutorial slot only carries teachers when `isSlotValid` passes; otherwise the
  teacher list is left empty so no false conflicts are created.
- The cascade (fill-around) guard skips lab blocks, elective sessions, batch-split
  slots, and non-theory cells.

Manual edits (`edit/set`, `edit/clear`, `edit/swap`) run `checkEdit()` which
filters violations through `EDIT_BLOCKING_TYPES` and returns **400**
(`This edit would create a conflict and was rejected`) — while still allowing an
admin to clear/adjust a slot (empty-slot and subject-hour errors are intentionally
not edit-blocking).

---

## 6. Publish gate

`PATCH /api/timetable/versions/:id/accept`:

1. Loads the version.
2. Runs `validatePersistedTimetable`.
3. **400** + `{ validationChecks, hardViolationsCount, violations }` if invalid.
4. Otherwise marks this version accepted and un-accepts all others, storing the
   revalidation (`revalidatedAt`) on the document.

---

## 7. Automated verification

`npm test` (backend, `node --test`):

**Engine (16):** break-order handling · full weekly hours, zero hard violations ·
no escalation over-allocation · under-schedulable reported · no teacher
double-booking · unavailability respected · lab single consecutive block not
crossing lunch · shared lab room exclusivity · open-elective shared session not a
conflict · validator catches an injected double-booking · over-scheduling flagged ·
empty-slot counter detects missing cells · determinism with `randomize:false` ·
feasibility reports missing teacher · feasibility reports over-capacity ·
`gridToClassTimetables` includes every class.

**Integration (9):** health · 401 without token · concurrent admin setup → exactly
one 201 · admin login · break `periodNumber: 0` accepted · teacher 403 on another
teacher's timetable · generation → accept → publish → anonymous download ·
invalid version rejected 400 · conflicting manual edit rejected 400.
