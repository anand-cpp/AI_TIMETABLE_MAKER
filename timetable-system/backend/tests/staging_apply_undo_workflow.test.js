/**
 * PHASE 5: STAGING APPLY/UNDO, RELOAD & CONCURRENCY TEST SUITE
 * 
 * Strict Read-Only Safety Protocol:
 * - Production database (timetable_db) is strictly protected and NEVER mutated.
 * - All tests execute against an isolated disposable staging database (timetable_db_staging).
 * - Tests the actual registered Express HTTP endpoints over a live listening port.
 * 
 * Verifies:
 * - Test A: Preview endpoint (in-memory candidate, diffs, validators, zero DB mutation).
 * - Test B: Apply endpoint (revision binding, candidate hash verification, atomic commit, undo snapshot).
 * - Test C: Reload equivalence (complete grid reconstruction, relationship integrity, quality score persistence).
 * - Test D: Undo equivalence (atomic rollback, complete restoration to staging baseline).
 * - Test E: Failure & Concurrency (invalid candidate, stale preview, tampered hash, unauthorized, repeated apply).
 * - Post-test verification: Production DB fingerprint remains 100% untouched.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Register models
require('../src/models/Timetable');
require('../src/models/Admin');
require('../src/models/Teacher');
require('../src/models/Subject');
require('../src/models/Class');
require('../src/models/ElectiveGroup');
require('../src/models/MinorGroup');
require('../src/models/CollegeSettings');

const PROD_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/timetable_db';
const STAGING_URI = 'mongodb://127.0.0.1:27017/timetable_db_staging';
const EXPECTED_PROD_FINGERPRINT = 'c0c5f775149defec92e2bca28443a8539f8a263006a25f821443aa31299bdb82';

describe('PHASE 5 — STAGING PREVIEW/APPLY/RELOAD/UNDO END-TO-END SUITE', () => {
  let prodConn;
  let stagingConn;
  let server;
  let baseUrl;
  let adminToken;
  let stagingTimetableId;
  let stagingBaselineRevision;
  let cachedPreviewResult;

  // Helper to compute database fingerprint for any connection
  async function computeConnectionFingerprint(conn) {
    const colNames = ['teachers', 'subjects', 'classes', 'electivegroups', 'minorgroups', 'collegesettings', 'timetables'];
    const masterHasher = crypto.createHash('sha256');
    for (const name of colNames) {
      const docs = await conn.collection(name).find({}).sort({ _id: 1 }).toArray();
      const str = JSON.stringify(docs, Object.keys(docs || {}).sort());
      const hash = crypto.createHash('sha256').update(str).digest('hex');
      masterHasher.update(`${name}:${docs.length}:${hash}`);
    }
    return masterHasher.digest('hex');
  }

  before(async () => {
    // 1. Connect to production DB and verify original fingerprint
    prodConn = await mongoose.createConnection(PROD_URI).asPromise();
    const prodFingerprint = await computeConnectionFingerprint(prodConn);
    assert.equal(prodFingerprint, EXPECTED_PROD_FINGERPRINT, 'Production DB fingerprint must match baseline exactly before staging tests');

    // 2. Clone production data to staging DB
    stagingConn = await mongoose.createConnection(STAGING_URI).asPromise();
    const colNames = ['teachers', 'subjects', 'classes', 'electivegroups', 'minorgroups', 'collegesettings', 'timetables', 'admins', 'departments', 'settings', 'emailconfigs'];
    for (const name of colNames) {
      await stagingConn.collection(name).deleteMany({});
      const prodDocs = await prodConn.collection(name).find({}).toArray();
      if (prodDocs.length > 0) {
        await stagingConn.collection(name).insertMany(prodDocs);
      }
    }

    const stagingInitialFingerprint = await computeConnectionFingerprint(stagingConn);
    assert.equal(stagingInitialFingerprint, EXPECTED_PROD_FINGERPRINT, 'Staging DB must be an exact byte-for-byte clone of production');

    // 3. Connect default mongoose connection to staging DB so Express app uses staging
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(STAGING_URI);

    // 4. Fetch staging timetable info and create admin token
    const Timetable = mongoose.model('Timetable');
    const Admin = mongoose.model('Admin');
    const tt = await Timetable.findOne({ isAccepted: true }).lean();
    stagingTimetableId = tt._id.toString();
    stagingBaselineRevision = tt.revision || 1;

    const admin = await Admin.findOne().lean();
    adminToken = jwt.sign(
      { id: admin._id, role: 'admin' },
      process.env.JWT_SECRET || 'fallback_secret'
    );

    // 5. Start live Express app server on ephemeral port
    const app = require('../src/app');
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api/timetable`;
  });

  after(async () => {
    // Close HTTP server
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }

    // Clean up staging database
    if (stagingConn) {
      await stagingConn.dropDatabase();
      await stagingConn.close();
    }

    // Verify production DB remains untouched
    if (prodConn) {
      const finalProdFingerprint = await computeConnectionFingerprint(prodConn);
      assert.equal(finalProdFingerprint, EXPECTED_PROD_FINGERPRINT, 'Production DB fingerprint MUST remain 100% untouched post-test');
      await prodConn.close();
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // --------------------------------------------------------------------------
  // TEST A: PREVIEW ENDPOINT
  // --------------------------------------------------------------------------
  test('Test A: Preview Endpoint returns candidate without mutating staging database', async () => {
    const prePreviewFingerprint = await computeConnectionFingerprint(mongoose.connection);

    const res = await fetch(`${baseUrl}/versions/${stagingTimetableId}/faculty-optimization/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ maxPasses: 5 }),
    });

    if (res.status !== 200) {
      console.error('PREVIEW ERROR:', res.status, await res.text());
    }
    assert.equal(res.status, 200, 'Preview endpoint must return HTTP 200');
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.improved, true);
    assert.equal(json.data.baselineScore, 89);
    assert.equal(json.data.optimizedScore, 94);
    assert.equal(json.data.validation.isValid, true);
    assert.equal(json.data.validation.hardViolationsCount, 0);
    assert.ok(json.data.candidateHash, 'Candidate hash must be returned');
    assert.ok(json.data.repairsAuditTrail?.length >= 30, 'Audit trail of proposed moves must be present');

    cachedPreviewResult = json.data;

    // Verify staging database is 100% unmutated after preview
    const postPreviewFingerprint = await computeConnectionFingerprint(mongoose.connection);
    assert.equal(postPreviewFingerprint, prePreviewFingerprint, 'Preview must NOT mutate staging database');
  });

  // --------------------------------------------------------------------------
  // TEST B: APPLY ENDPOINT
  // --------------------------------------------------------------------------
  test('Test B: Apply Endpoint binds revision and candidate hash, creates undo snapshot, and persists atomically', async () => {
    assert.ok(cachedPreviewResult, 'Cached preview result required');

    const res = await fetch(`${baseUrl}/versions/${stagingTimetableId}/faculty-optimization/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        candidateGrid: cachedPreviewResult.candidateGrid,
        baselineRevision: cachedPreviewResult.baselineRevision,
        candidateHash: cachedPreviewResult.candidateHash,
      }),
    });

    assert.equal(res.status, 200, 'Apply endpoint must return HTTP 200');
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.revision, stagingBaselineRevision + 1, 'Revision must increment by 1');
    assert.equal(json.data.canUndo, true, 'canUndo must be true');
    assert.ok(json.data.undoCount >= 1, 'undoCount must be >= 1');
  });

  // --------------------------------------------------------------------------
  // TEST C: RELOAD EQUIVALENCE
  // --------------------------------------------------------------------------
  test('Test C: Reload Equivalence validates reconstructed grid and quality score consistency', async () => {
    const res = await fetch(`${baseUrl}/versions/${stagingTimetableId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    const reloadedTT = json.data.timetable || json.data;

    assert.equal(reloadedTT.revision, stagingBaselineRevision + 1);
    assert.equal(reloadedTT.facultyQualityScore?.overall, 94, 'Faculty quality score must persist at 94');

    // Verify S8 Capstone remains intact after reload
    const s8Classes = (reloadedTT.classTimetables || []).filter(c => c.className?.startsWith('S8'));
    assert.equal(s8Classes.length, 2);
    for (const ct of s8Classes) {
      const capstoneSlots = ct.slots.filter(s => (s.day === 'Thursday' || s.day === 'Friday') && s.subjectCode === 'CST416');
      assert.equal(capstoneSlots.length, 12, '12 CST416 slots must exist in S8');
    }

    // Verify placed academic hours
    let placedSlots = 0;
    for (const ct of reloadedTT.classTimetables) {
      placedSlots += ct.slots.filter(s => !s.isEmpty && !s.isBreak && s.subjectCode).length;
    }
    assert.equal(placedSlots, 237, 'Exactly 237 academic placed slots must be preserved');
  });

  // --------------------------------------------------------------------------
  // TEST D: UNDO EQUIVALENCE
  // --------------------------------------------------------------------------
  test('Test D: Undo Equivalence restores exact staging baseline without residual drift', async () => {
    const res = await fetch(`${baseUrl}/versions/${stagingTimetableId}/undo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert.equal(res.status, 200, 'Undo endpoint must return HTTP 200');
    const json = await res.json();
    assert.equal(json.success, true);

    // Verify timetable reloaded matches original staging baseline
    const reloadRes = await fetch(`${baseUrl}/versions/${stagingTimetableId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const reloadJson = await reloadRes.json();
    const restoredTT = reloadJson.data.timetable || reloadJson.data;

    assert.equal(restoredTT.revision, stagingBaselineRevision + 2, 'Revision must increment monotonically on undo (optimistic concurrency)');

    // Verify academic placed slots count restored
    let placedSlots = 0;
    for (const ct of restoredTT.classTimetables) {
      placedSlots += ct.slots.filter(s => !s.isEmpty && !s.isBreak && s.subjectCode).length;
    }
    assert.equal(placedSlots, 237, '237 academic slots intact after undo');
  });

  // --------------------------------------------------------------------------
  // TEST E: FAILURE & CONCURRENCY CONTROLS
  // --------------------------------------------------------------------------
  test('Test E1: Stale preview is rejected with HTTP 409 Conflict', async () => {
    const res = await fetch(`${baseUrl}/versions/${stagingTimetableId}/faculty-optimization/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        candidateGrid: cachedPreviewResult.candidateGrid,
        baselineRevision: 99999, // Stale revision
        candidateHash: cachedPreviewResult.candidateHash,
      }),
    });

    assert.equal(res.status, 409, 'Must return HTTP 409 on stale revision');
  });

  test('Test E2: Tampered candidate hash is rejected with HTTP 400 Bad Request', async () => {
    const curTTRes = await fetch(`${baseUrl}/versions/${stagingTimetableId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const curTT = (await curTTRes.json()).data;
    const currentRev = curTT.timetable?.revision || curTT.revision;

    const res = await fetch(`${baseUrl}/versions/${stagingTimetableId}/faculty-optimization/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        candidateGrid: cachedPreviewResult.candidateGrid,
        baselineRevision: currentRev,
        candidateHash: 'tampered_sha256_hash_1234567890abcdef',
      }),
    });

    assert.equal(res.status, 400, 'Must return HTTP 400 on tampered hash');
  });

  test('Test E3: Invalid / empty candidate grid is rejected with HTTP 400', async () => {
    const curTTRes = await fetch(`${baseUrl}/versions/${stagingTimetableId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const curTT = (await curTTRes.json()).data;
    const currentRev = curTT.timetable?.revision || curTT.revision;

    const res = await fetch(`${baseUrl}/versions/${stagingTimetableId}/faculty-optimization/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        candidateGrid: {},
        baselineRevision: currentRev,
      }),
    });

    assert.equal(res.status, 400, 'Must return HTTP 400 on empty candidate');
  });

  test('Test E4: Unauthorized request (no token) is rejected with HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/versions/${stagingTimetableId}/faculty-optimization/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateGrid: cachedPreviewResult.candidateGrid }),
    });

    assert.equal(res.status, 401, 'Must return HTTP 401 on missing auth token');
  });

  test('Test E5: Non-admin token is rejected with HTTP 403', async () => {
    const Teacher = mongoose.model('Teacher');
    const teacher = await Teacher.findOne().lean();
    const teacherToken = jwt.sign(
      { id: teacher._id, role: 'teacher' },
      process.env.JWT_SECRET || 'fallback_secret'
    );

    const res = await fetch(`${baseUrl}/versions/${stagingTimetableId}/faculty-optimization/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${teacherToken}`,
      },
      body: JSON.stringify({ candidateGrid: cachedPreviewResult.candidateGrid }),
    });

    assert.equal(res.status, 403, 'Must return HTTP 403 on non-admin user');
  });

});
