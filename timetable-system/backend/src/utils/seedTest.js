require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Department = require('../models/Department');
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const Subject = require('../models/Subject');
const CollegeSettings = require('../models/CollegeSettings');
const Timetable = require('../models/Timetable');
const { run } = require('../services/engine/orchestrator');

const connectLocalDB = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/timetable_db', {
      serverSelectionTimeoutMS: 3000,
    });
    console.log('✅ Connected to MongoDB: 127.0.0.1:27017/timetable_db');
  } catch (err) {
    console.error('❌ Failed to connect to local MongoDB:', err.message);
    process.exit(1);
  }
};

const seedAndGenerate = async () => {
  console.log('🚀 Starting Academic Dummy Data Seeding & Engine Validation...');

  await connectLocalDB();

  // Clear existing collections
  await Admin.deleteMany({});
  await Department.deleteMany({});
  await Class.deleteMany({});
  await Teacher.deleteMany({});
  await Subject.deleteMany({});
  await CollegeSettings.deleteMany({});
  await Timetable.deleteMany({});

  console.log('🧹 Cleaned existing database collections');

  // 1. Admin setup
  const admin = await Admin.create({
    username: 'admin',
    password: 'admin123',
  });
  console.log('✅ Admin Account Created (username: admin, password: admin123)');

  // 2. College Settings
  const settings = await CollegeSettings.create({
    collegeName: 'TinkerHub ASET College of Engineering',
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    periodsPerDay: 7,
    periodDuration: 60,
    teacherDailyLimit: 5,
    periodTimeline: [
      { periodNumber: 1, startTime: '09:00', endTime: '10:00', isBreak: false, label: 'Period 1' },
      { periodNumber: 2, startTime: '10:00', endTime: '11:00', isBreak: false, label: 'Period 2' },
      { periodNumber: 3, startTime: '11:00', endTime: '11:15', isBreak: true,  label: 'Short Break' },
      { periodNumber: 4, startTime: '11:15', endTime: '12:15', isBreak: false, label: 'Period 3' },
      { periodNumber: 5, startTime: '12:15', endTime: '13:15', isBreak: false, label: 'Period 4' },
      { periodNumber: 6, startTime: '13:15', endTime: '14:00', isBreak: true,  label: 'Lunch Break' },
      { periodNumber: 7, startTime: '14:00', endTime: '15:00', isBreak: false, label: 'Period 5' },
    ],
  });
  console.log('✅ College Settings Created');

  // 3. Departments
  const deptCSE = await Department.create({
    name: 'Computer Science & Engineering',
    code: 'CSE',
    building: 'Block A',
    floor: '2nd Floor',
    travelOptimization: true,
  });

  const deptECE = await Department.create({
    name: 'Electronics & Communication Engineering',
    code: 'ECE',
    building: 'Block B',
    floor: '1st Floor',
    travelOptimization: false,
  });
  console.log('✅ 2 Departments Created (CSE, ECE)');

  // 4. Classes
  const classCSE5A = await Class.create({
    departmentId: deptCSE._id,
    semester: 5,
    section: 'A',
    strength: 60,
    classRepName: 'Rahul Kumar',
    classRepEmail: 'rep.cse5a@aset.edu',
  });

  const classCSE5B = await Class.create({
    departmentId: deptCSE._id,
    semester: 5,
    section: 'B',
    strength: 58,
    classRepName: 'Ananya Nair',
    classRepEmail: 'rep.cse5b@aset.edu',
  });

  const classECE7A = await Class.create({
    departmentId: deptECE._id,
    semester: 7,
    section: 'A',
    strength: 55,
    classRepName: 'Siddharth V',
    classRepEmail: 'rep.ece7a@aset.edu',
  });
  console.log('✅ 3 Classes Created (CSE S5 A, CSE S5 B, ECE S7 A)');

  // 5. Teachers
  const teacherDhanya = await Teacher.create({
    name: 'Dhanya Miss',
    username: 'dhanya',
    password: 'password123',
    departmentId: deptCSE._id,
    email: 'dhanya@aset.edu',
    phone: '9876543210',
    maxPeriodsPerDay: 4,
    unavailability: [{ day: 'Friday', period: 5 }],
  });

  const teacherArun = await Teacher.create({
    name: 'Prof. Arun Sharma',
    username: 'arun',
    password: 'password123',
    departmentId: deptCSE._id,
    email: 'arun@aset.edu',
    maxPeriodsPerDay: 5,
  });

  const teacherMeera = await Teacher.create({
    name: 'Dr. Meera Paul',
    username: 'meera',
    password: 'password123',
    departmentId: deptCSE._id,
    email: 'meera@aset.edu',
    maxPeriodsPerDay: 4,
  });

  const teacherKiran = await Teacher.create({
    name: 'Prof. Kiran Das',
    username: 'kiran',
    password: 'password123',
    departmentId: deptECE._id,
    email: 'kiran@aset.edu',
    maxPeriodsPerDay: 5,
  });

  const teacherReshma = await Teacher.create({
    name: 'Prof. Reshma K',
    username: 'reshma',
    password: 'password123',
    departmentId: deptECE._id,
    email: 'reshma@aset.edu',
    maxPeriodsPerDay: 4,
  });
  console.log('✅ 5 Faculty Members Created');

  // 6. Subjects
  // CSE S5 A Subjects
  const subOS_A = await Subject.create({
    name: 'Operating Systems',
    code: 'CST301',
    classId: classCSE5A._id,
    type: 'theory',
    weeklyHours: 4,
    teachers: [teacherDhanya._id],
  });

  const subDBMS_A = await Subject.create({
    name: 'Database Management Systems',
    code: 'CST303',
    classId: classCSE5A._id,
    type: 'theory',
    weeklyHours: 4,
    teachers: [teacherArun._id],
  });

  const subOSLab_A = await Subject.create({
    name: 'OS & Network Lab',
    code: 'CSL331',
    classId: classCSE5A._id,
    type: 'lab',
    weeklyHours: 2,
    teachers: [teacherDhanya._id],
    labDetails: {
      roomName: 'CSE Network Lab 1',
      duration: 2,
      morningPreference: true,
    },
  });

  // CSE S5 B Subjects
  const subOS_B = await Subject.create({
    name: 'Operating Systems',
    code: 'CST301',
    classId: classCSE5B._id,
    type: 'theory',
    weeklyHours: 4,
    teachers: [teacherDhanya._id],
  });

  const subDBMS_B = await Subject.create({
    name: 'Database Management Systems',
    code: 'CST303',
    classId: classCSE5B._id,
    type: 'theory',
    weeklyHours: 4,
    teachers: [teacherMeera._id],
  });

  // ECE S7 A Subjects
  const subVLSI = await Subject.create({
    name: 'VLSI Circuit Design',
    code: 'ECT401',
    classId: classECE7A._id,
    type: 'theory',
    weeklyHours: 4,
    teachers: [teacherKiran._id],
  });

  const subEmbedded = await Subject.create({
    name: 'Embedded Systems',
    code: 'ECT403',
    classId: classECE7A._id,
    type: 'theory',
    weeklyHours: 4,
    teachers: [teacherReshma._id],
  });

  const subVLSILab = await Subject.create({
    name: 'VLSI & Embedded Lab',
    code: 'ECL411',
    classId: classECE7A._id,
    type: 'lab',
    weeklyHours: 2,
    teachers: [teacherKiran._id],
    labDetails: {
      roomName: 'ECE Hardware Lab 2',
      duration: 2,
      morningPreference: false,
    },
  });

  // Link subjects to class documents
  await Class.findByIdAndUpdate(classCSE5A._id, { subjects: [subOS_A._id, subDBMS_A._id, subOSLab_A._id] });
  await Class.findByIdAndUpdate(classCSE5B._id, { subjects: [subOS_B._id, subDBMS_B._id] });
  await Class.findByIdAndUpdate(classECE7A._id, { subjects: [subVLSI._id, subEmbedded._id, subVLSILab._id] });

  console.log('✅ Theory, Lab, & Elective Subjects Created');

  // 7. Execute AI Timetable Generator Orchestrator
  console.log('🧠 Running AI Timetable Genetic Algorithm Engine...');
  const result = await run({ populationSize: 10, maxGenerations: 40 });

  if (result.success) {
    console.log('🎉 Timetable Generated Successfully!');
    console.log(`📊 Quality Score: ${result.qualityScore?.overall || 0}/100`);
    console.log(`⏱️ Generation Time: ${result.generationStats?.timeMs || 0} ms`);
    console.log(`⚠️ Warnings: ${result.warnings?.length || 0}`);

    // Save as Accepted Timetable Version 1
    const newVersion = await Timetable.create({
      version: 1,
      label: 'Official Semester Timetable v1.0',
      isAccepted: true,
      acceptedAt: new Date(),
      qualityScore: result.qualityScore,
      classTimetables: result.classTimetables,
      warnings: result.warnings,
      unplacedSubjects: result.unplacedSubjects,
      generationStats: result.generationStats,
    });

    console.log(`💾 Official Timetable Version 1 Saved to MongoDB (ID: ${newVersion._id})`);
  } else {
    console.error('❌ Generation Failed:', result.error);
  }

  await mongoose.connection.close();
  console.log('🏁 Seeding & Validation Completed!');
};

seedAndGenerate().catch((err) => {
  console.error('❌ Error during seed:', err);
  process.exit(1);
});
