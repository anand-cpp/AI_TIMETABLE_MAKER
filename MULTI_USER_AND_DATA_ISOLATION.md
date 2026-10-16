# Multi-User Support & Data Isolation

**Verdict:** the system is **multi-user (role-based), single-tenant (single college).**
It safely separates *admin* from *teacher/student* access and prevents teachers from
reading each other's data — but it does **not** support multiple colleges, and no
tenancy key exists to build on.

---

## 1. The data model

| Aspect | Reality |
|--------|---------|
| Tenancy | **Single.** `CollegeSettings` is a `singleton: 'singleton'` document. |
| Tenant/college ID | **None** on `Teacher`, `Class`, `Department`, `Subject`, `Timetable`, `Suggestion`, `OverrideLog`. |
| Owner/creator ID | **None** anywhere. |
| Roles | `admin` (Admin collection), `teacher` (role field on Teacher), implicit `student`/anonymous (public routes). |
| Teachers collection | Has `unique` `username`. |

**Consequence:** there is no filter to apply for tenant isolation, because no
field identifies "which college a row belongs to." Adding multi-college support
requires a `tenantId` migration across every model + `mongoose` query middleware.

---

## 2. What IS isolated (enforced & tested)

### 2.1 Route-level authorization
- Write/mutate routes: `authenticate` + `requireAdmin` (departments, classes, subjects,
  teachers, settings, timetable generation/version/edit, wipe).
- Reads that expose the full roster/managerial data (e.g. `GET /api/teachers`,
  `GET /api/timetable/versions`): `requireAdmin`.
- **401** without a token (tested).
- **403** when a teacher requests another teacher's timetable — `requireOwnDataOrAdmin`
  (tested: teacher A → `/api/timetable/teacher/<B>` ⇒ 403).

### 2.2 Timetable visibility
| Consumer | Can read |
|----------|----------|
| Anonymous / student | **Accepted** timetable only (`/api/timetable/accepted`, `/api/student/timetable/...`, public PDF/Excel) |
| Teacher | Own timetable (`/api/timetable/teacher/:self`, `requireOwnDataOrAdmin`) |
| Admin | All versions, incl. drafts |

Drafts are **not** publicly downloadable: `getTimetableForDownload` restricts
anonymous users to `isAccepted` and 404s a draft-only request (tested).

### 2.3 Auth-borne downloads
Browser downloads for PDF/Excel now attach the JWT (`timetableService.js` uses
blob fetch with `Authorization`), instead of unauthenticated `window.open` —
so the same authorization rules apply.

---

## 3. What is NOT isolated (documented exposure)

1. **No tenant boundary.** One deployment = one college. There is no way for two
   colleges to coexist; data from all rows is returned by every public GET.
2. **Public reads** of the *organizational structure* (no auth):
   - `GET /api/departments`, `/api/classes`, `/api/subjects` (and `/lab-rooms`),
   - `GET /api/settings` (college name, working days, timeline),
   - `GET /api/student/*`.
   These expose department/class/subject names and the college timetable to anyone
   with the URL. For a public-facing timetable portal this is intended; for an
   internal tool it is information disclosure.
3. **Suggestions** are created via a public route (spam/DoS surface) — mitigated by
   `apiLimiter`, not by identity.
4. **CSV/Excel uploads** (`/api/upload`) are admin-gated, but the OCR worker runs
   in-process (resource exhaustion is bounded by `heavyLimiter` only).

---

## 4. Security hardening applied in this audit

- `admin_setup_lock` makes `POST /api/auth/setup` atomic → exactly one admin can
  ever be created (concurrent-race test asserts exactly one `201`).
- No default credentials in production; dev-only `admin/admin123` prints a warning.
- CORS allow-list from `CLIENT_URL` (comma-separated); unknown origins rejected.
- `JWT_SECRET` mandatory at boot; ≥32 chars in production.
- `authLimiter` 20 requests / 15 min on login + setup.
- `sendError` now returns structured `data` (so `violations` reach clients).

---

## 5. Answer to "is my data isolated?"

- **Between users of the same college:** yes for private operations
  (teacher ↔ teacher 403, admin-only writes, drafts hidden), verified by tests.
- **Between colleges:** not applicable — there is one college per deployment.
  If you need multiple colleges, that is a schema + query change (add `tenantId`
  everywhere and scope every query), not a config flag.

---

## 6. Recommended next steps (if multi-tenant is required)

1. Add `tenantId` (ObjectId) to every model + compound indexes.
2. Add tenant resolution middleware (from JWT claim) that sets `req.tenantId`.
3. Global query pre-filter (`tenantId` scope) on `find`/`findOne`/`aggregate`.
4. Make `CollegeSettings` per-tenant (replace the singleton).
5. Uploads, exports, and the OCR pipeline must carry tenant scope.
6. Seed/registration flows become tenant-scoped; admin setup issues a tenant.
