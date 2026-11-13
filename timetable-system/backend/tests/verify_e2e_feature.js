const mongoose = require('mongoose');
const http = require('http');
const assert = require('assert');

// Load environment
require('dotenv').config({ path: './.env' });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/timetable_db';

async function runE2EVerification() {
  console.log('====================================================');
  console.log('STARTING END-TO-END VERIFICATION & AUDIT SUITE');
  console.log('====================================================');

  await mongoose.connect(MONGO_URI);
  console.log('✓ Successfully connected to MongoDB:', MONGO_URI);
  await mongoose.connection.db.collection('subjects').deleteMany({ code: 'TESTALLOCTEST101' });

  const app = require('../src/app');
  const server = http.createServer(app);
  
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`✓ Test backend server running on ${baseUrl}`);

  try {
    // ----------------------------------------------------
    // 1. ADMIN LOGIN VERIFICATION
    // ----------------------------------------------------
    console.log('\n--- 1. Testing Admin Authentication ---');
    
    // Valid login
    const loginRes = await fetch(`${baseUrl}/api/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    const loginData = await loginRes.json();
    console.log('Login attempt (admin / admin123) status:', loginRes.status);
    assert.strictEqual(loginRes.status, 200, 'Admin login must return 200 OK');
    assert.ok(loginData.data?.token, 'Response must contain a valid JWT token');
    assert.strictEqual(loginData.data?.user?.username, 'admin', 'Username in token must match');
    const adminToken = loginData.data.token;
    console.log('✓ Admin login succeeded! JWT token received.');

    // Invalid password test
    const badPassRes = await fetch(`${baseUrl}/api/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' }),
    });
    assert.strictEqual(badPassRes.status, 401, 'Invalid password must return 401 Unauthorized');
    console.log('✓ Invalid password correctly rejected (401 Unauthorized)');

    // Non-existent user test
    const fakeUserRes = await fetch(`${baseUrl}/api/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nonexistent_user', password: 'admin123' }),
    });
    assert.strictEqual(fakeUserRes.status, 401, 'Non-existent user must return 401 Unauthorized');
    console.log('✓ Non-existent user correctly rejected (401 Unauthorized)');

    // ----------------------------------------------------
    // 2. TEACHER PROFILE & ALLOCATION FLOW VERIFICATION
    // ----------------------------------------------------
    console.log('\n--- 2. Testing Teacher Profile & Allocations ---');

    // Fetch teachers
    const teachersRes = await fetch(`${baseUrl}/api/teachers`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const teachersData = await teachersRes.json();
    const teachers = teachersData.data?.teachers || [];
    assert.ok(teachers.length > 0, 'Must have active teachers in database');
    console.log(`✓ Fetched ${teachers.length} teachers`);

    // Pick first teacher (Dr S Gunasekaran or Dr Satheeshkumar)
    const targetTeacher = teachers[0];
    const teacherId = targetTeacher._id;
    console.log(`Target faculty: ${targetTeacher.name} (${teacherId})`);

    // Fetch Profile
    const profileRes = await fetch(`${baseUrl}/api/teachers/${teacherId}/profile`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const profileData = await profileRes.json();
    assert.strictEqual(profileRes.status, 200, 'Teacher profile must return 200 OK');
    const initialAllocationsCount = profileData.data?.profile?.allocations?.length || 0;
    console.log(`✓ Fetched profile. Initial allocations count: ${initialAllocationsCount}`);
    console.log('  Workload summary:', profileData.data?.profile?.summary);

    // Fetch Classes to allocate to
    const classesRes = await fetch(`${baseUrl}/api/classes`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const classesData = await classesRes.json();
    const classes = classesData.data?.classes || [];
    assert.ok(classes.length > 0, 'Must have classes in database');
    const targetClass = classes[0];
    console.log(`Target class for allocation: ${targetClass.name} (${targetClass._id})`);

    // Add Allocation
    console.log('\n  Adding test allocation...');
    const addAllocRes = await fetch(`${baseUrl}/api/teachers/${teacherId}/allocations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        subjectCode: 'TESTALLOCTEST101',
        subjectName: 'Test Subject For Profile Audit',
        classId: targetClass._id,
        type: 'theory',
        weeklyHours: 3,
      }),
    });
    const addAllocData = await addAllocRes.json();
    assert.strictEqual(addAllocRes.status, 201, `Add allocation must return 201 Created: ${JSON.stringify(addAllocData)}`);
    const createdSubject = addAllocData.data?.subject;
    const allocSubjectId = createdSubject._id;
    console.log(`  ✓ Allocation created! Subject ID: ${allocSubjectId}`);

    // Verify in Profile Readback
    const profileAfterAddRes = await fetch(`${baseUrl}/api/teachers/${teacherId}/profile`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const profileAfterAdd = await profileAfterAddRes.json();
    const allocAfterAddCount = profileAfterAdd.data?.profile?.allocations?.length || 0;
    assert.strictEqual(allocAfterAddCount, initialAllocationsCount + 1, 'Allocations count must increase by 1');
    const foundAdded = profileAfterAdd.data?.profile?.allocations?.find(a => a.subjectCode === 'TESTALLOCTEST101');
    assert.ok(foundAdded, 'Added allocation must exist in readback profile');
    console.log('  ✓ Verified allocation exists in teacher profile readback');

    // Edit Allocation
    console.log('\n  Editing test allocation...');
    const editAllocRes = await fetch(`${baseUrl}/api/teachers/${teacherId}/allocations/${allocSubjectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        subjectCode: 'TESTALLOCTEST101',
        subjectName: 'Test Subject For Profile Audit (EDITED)',
        classId: targetClass._id,
        type: 'theory',
        weeklyHours: 4,
      }),
    });
    assert.strictEqual(editAllocRes.status, 200, 'Edit allocation must return 200 OK');
    console.log('  ✓ Allocation edited successfully (hours updated to 4)');

    // Verify Edit in Profile Readback
    const profileAfterEditRes = await fetch(`${baseUrl}/api/teachers/${teacherId}/profile`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const profileAfterEdit = await profileAfterEditRes.json();
    const foundEdited = profileAfterEdit.data?.profile?.allocations?.find(a => a.subjectCode === 'TESTALLOCTEST101');
    assert.strictEqual(foundEdited?.subjectName, 'Test Subject For Profile Audit (EDITED)', 'Edited subject name must persist');
    assert.strictEqual(foundEdited?.hours, 4, 'Edited hours must persist');
    console.log('  ✓ Verified updated details in teacher profile readback');

    // Remove Allocation
    console.log('\n  Removing test allocation...');
    const removeAllocRes = await fetch(`${baseUrl}/api/teachers/${teacherId}/allocations/${allocSubjectId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(removeAllocRes.status, 200, 'Remove allocation must return 200 OK');
    console.log('  ✓ Allocation removed successfully');

    // Verify Removal in Profile Readback
    const profileAfterRemoveRes = await fetch(`${baseUrl}/api/teachers/${teacherId}/profile`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const profileAfterRemove = await profileAfterRemoveRes.json();
    const allocAfterRemoveCount = profileAfterRemove.data?.profile?.allocations?.length || 0;
    assert.strictEqual(allocAfterRemoveCount, initialAllocationsCount, 'Allocations count must revert to initial count');
    const foundRemoved = profileAfterRemove.data?.profile?.allocations?.find(a => a.subjectCode === 'TESTALLOCTEST101');
    assert.ok(!foundRemoved, 'Removed allocation must no longer exist');
    console.log('  ✓ Verified allocation removal in teacher profile readback');

    // Clean up created subject from DB
    await mongoose.connection.db.collection('subjects').deleteOne({ _id: new mongoose.Types.ObjectId(allocSubjectId) });

    // ----------------------------------------------------
    // 3. DATABASE INTEGRITY AUDIT
    // ----------------------------------------------------
    console.log('\n--- 3. Database Integrity Audit ---');
    const Subject = require('../src/models/Subject');
    const Class = require('../src/models/Class');
    const Teacher = require('../src/models/Teacher');
    const ElectiveGroup = require('../src/models/ElectiveGroup');

    const totalSubjects = await Subject.countDocuments();
    const totalClasses = await Class.countDocuments();
    const totalTeachers = await Teacher.countDocuments({ isActive: true });
    const totalElectives = await ElectiveGroup.countDocuments();

    console.log(`Database State:
  - Active Faculty: ${totalTeachers}
  - Configured Classes: ${totalClasses}
  - Subjects: ${totalSubjects}
  - Elective Groups: ${totalElectives}`);

    assert.strictEqual(totalTeachers, 13, 'Must have exactly 13 active CSE faculty');
    assert.strictEqual(totalClasses, 8, 'Must have exactly 8 configured classes (S2, S4, S6, S8)');
    assert.ok(totalSubjects >= 50, 'Must have all syllabus subjects configured');

    console.log('\n====================================================');
    console.log('ALL AUDIT CRITERIA & E2E TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================\n');

  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runE2EVerification().catch((err) => {
  console.error('❌ E2E VERIFICATION FAILED:', err);
  process.exit(1);
});
