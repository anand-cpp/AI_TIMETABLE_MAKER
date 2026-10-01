import departmentService from '../services/departmentService';
import classService from '../services/classService';
import teacherService from '../services/teacherService';
import subjectService from '../services/subjectService';
import settingsService from '../services/settingsService';

export const seedKTUDummyData = async () => {
  try {
    // 1. Wipe existing data first for clean seed
    await settingsService.wipeAllData();

    // 2. Configure College Settings for ASET College of Engineering (KTU) — 6 Periods / Day
    await settingsService.update({
      collegeName: 'ASET College of Engineering, KTU, Kerala',
      teacherDailyLimit: 4,
      periodDuration: 55,
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      periodsPerDay: 6,
      periodTimeline: [
        { periodNumber: 1, startTime: '09:00', endTime: '09:55', isBreak: false, label: 'Period 1' },
        { periodNumber: 2, startTime: '09:55', endTime: '10:50', isBreak: false, label: 'Period 2' },
        { periodNumber: 3, startTime: '10:50', endTime: '11:45', isBreak: false, label: 'Period 3' },
        { periodNumber: 0, startTime: '11:45', endTime: '12:30', isBreak: true,  label: 'Lunch Break' },
        { periodNumber: 4, startTime: '12:30', endTime: '13:25', isBreak: false, label: 'Period 4' },
        { periodNumber: 5, startTime: '13:25', endTime: '14:20', isBreak: false, label: 'Period 5' },
        { periodNumber: 6, startTime: '14:20', endTime: '15:15', isBreak: false, label: 'Period 6' },
      ],
      fridaySeparate: false,
    });

    // 3. Create 6 Departments
    const deptsToCreate = [
      { name: 'Computer Science & Engineering', code: 'CSE', block: 'IIT BLOCK', hodName: 'Dr. Anoop Kumar' },
      { name: 'Electronics & Communication Eng.', code: 'ECE', block: 'ASET BLOCK', hodName: 'Dr. Meera Nair' },
      { name: 'Electrical & Electronics Eng.', code: 'EEE', block: 'ASET BLOCK', hodName: 'Prof. Rajesh Pillai' },
      { name: 'Mechanical Engineering', code: 'ME', block: 'MECH BLOCK', hodName: 'Dr. Suresh Babu' },
      { name: 'Civil Engineering', code: 'CE', block: 'ASET BLOCK', hodName: 'Prof. Lekha Menon' },
      { name: 'AI & Machine Learning', code: 'AIML', block: 'IIT BLOCK', hodName: 'Dr. Priya Sharma' },
    ];

    const createdDeptsMap = {};
    for (const d of deptsToCreate) {
      const res = await departmentService.create(d);
      createdDeptsMap[d.code] = res.data.department._id;
    }

    // 4. Create Teachers (CSE Faculty + Cross-Dept Teachers)
    const teachersData = [
      // CSE Teachers (10 + 3 cross-dept)
      { name: 'Dr. Anoop Kumar', username: 'anoop_cse', email: 'anoop@aset.edu', deptCode: 'CSE', dailyLimit: 3, weeklyLimit: 14 },
      { name: 'Prof. Deepa Menon', username: 'deepa_cse', email: 'deepa@aset.edu', deptCode: 'CSE', dailyLimit: 4, weeklyLimit: 20 },
      { name: 'Prof. Arjun Nair', username: 'arjun_cse', email: 'arjun@aset.edu', deptCode: 'CSE', dailyLimit: 4, weeklyLimit: 20 },
      { name: 'Dr. Kavitha Rajan', username: 'kavitha_cse', email: 'kavitha@aset.edu', deptCode: 'CSE', dailyLimit: 4, weeklyLimit: 20 },
      { name: 'Prof. Vineeth Thomas', username: 'vineeth_cse', email: 'vineeth@aset.edu', deptCode: 'CSE', dailyLimit: 4, weeklyLimit: 20 },
      { name: 'Prof. Anjali Krishna', username: 'anjali_cse', email: 'anjali@aset.edu', deptCode: 'CSE', dailyLimit: 5, weeklyLimit: 22 },
      { name: 'Dr. Divya Prasad', username: 'divya_cse', email: 'divya@aset.edu', deptCode: 'CSE', dailyLimit: 5, weeklyLimit: 22 },
      { name: 'Mr. Vivek Nambiar', username: 'vivek_lab', email: 'vivek@aset.edu', deptCode: 'CSE', dailyLimit: 6, weeklyLimit: 24 },
      { name: 'Ms. Gayathri Mohan', username: 'gayathri_lab', email: 'gayathri@aset.edu', deptCode: 'CSE', dailyLimit: 6, weeklyLimit: 24 },
      { name: 'Mr. Rahul Dev', username: 'rahul_lab', email: 'rahul@aset.edu', deptCode: 'CSE', dailyLimit: 6, weeklyLimit: 24 },

      // Cross-dept Teachers
      { name: 'Dr. Ramesh Krishnan', username: 'ramesh_math', email: 'ramesh@aset.edu', deptCode: 'CSE', dailyLimit: 4, weeklyLimit: 16 },
      { name: 'Dr. Lakshmi Priya', username: 'lakshmi_phy', email: 'lakshmi@aset.edu', deptCode: 'ECE', dailyLimit: 4, weeklyLimit: 12 },
      { name: 'Prof. Sunil Varma', username: 'sunil_eng', email: 'sunil@aset.edu', deptCode: 'EEE', dailyLimit: 4, weeklyLimit: 8 },
      { name: 'Dr. Beena George', username: 'beena_chem', email: 'beena@aset.edu', deptCode: 'CE', dailyLimit: 4, weeklyLimit: 18 },

      // ECE (6)
      { name: 'Dr. Meera Nair', username: 'meera_ece', email: 'meera@aset.edu', deptCode: 'ECE', dailyLimit: 3, weeklyLimit: 14 },
      { name: 'Prof. Sanjay Mohan', username: 'sanjay_ece', email: 'sanjay@aset.edu', deptCode: 'ECE', dailyLimit: 4, weeklyLimit: 20 },
      { name: 'Prof. Nisha Raj', username: 'nisha_ece', email: 'nisha@aset.edu', deptCode: 'ECE', dailyLimit: 4, weeklyLimit: 20 },
      { name: 'Dr. Anil Kumar P', username: 'anil_ece', email: 'anil@aset.edu', deptCode: 'ECE', dailyLimit: 4, weeklyLimit: 20 },
      { name: 'Ms. Revathi S', username: 'revathi_ece', email: 'revathi@aset.edu', deptCode: 'ECE', dailyLimit: 4, weeklyLimit: 20 },
      { name: 'Mr. Jithin Jose', username: 'jithin_ece', email: 'jithin@aset.edu', deptCode: 'ECE', dailyLimit: 4, weeklyLimit: 20 },

      // EEE (5)
      { name: 'Prof. Rajesh Pillai', username: 'rajesh_eee', email: 'rajesh@aset.edu', deptCode: 'EEE', dailyLimit: 3, weeklyLimit: 14 },
      { name: 'Dr. Smitha Rajan', username: 'smitha_eee', email: 'smitha@aset.edu', deptCode: 'EEE', dailyLimit: 4, weeklyLimit: 20 },
      { name: 'Prof. Unni Krishnan', username: 'unni_eee', email: 'unni@aset.edu', deptCode: 'EEE', dailyLimit: 4, weeklyLimit: 20 },
      { name: 'Ms. Athira Babu', username: 'athira_eee', email: 'athira@aset.edu', deptCode: 'EEE', dailyLimit: 4, weeklyLimit: 20 },
      { name: 'Mr. Prasanth K', username: 'prasanth_eee', email: 'prasanth@aset.edu', deptCode: 'EEE', dailyLimit: 4, weeklyLimit: 20 },

      // ME (6)
      { name: 'Dr. Suresh Babu', username: 'suresh_me', email: 'suresh@aset.edu', deptCode: 'ME', dailyLimit: 3, weeklyLimit: 14 },
      { name: 'Prof. Girish Menon', username: 'girish_me', email: 'girish@aset.edu', deptCode: 'ME', dailyLimit: 4, weeklyLimit: 20 },
      { name: 'Prof. Neethu Joseph', username: 'neethu_me', email: 'neethu@aset.edu', deptCode: 'ME', dailyLimit: 4, weeklyLimit: 20 },
      { name: 'Dr. Hari Prasad', username: 'hari_me', email: 'hari@aset.edu', deptCode: 'ME', dailyLimit: 4, weeklyLimit: 20 },
      { name: 'Mr. Bipin Kumar', username: 'bipin_me', email: 'bipin@aset.edu', deptCode: 'ME', dailyLimit: 4, weeklyLimit: 20 },
      { name: 'Mr. Ajith Rajan', username: 'ajith_me', email: 'ajith@aset.edu', deptCode: 'ME', dailyLimit: 4, weeklyLimit: 20 },

      // CE (4)
      { name: 'Prof. Lekha Menon', username: 'lekha_ce', email: 'lekha@aset.edu', deptCode: 'CE', dailyLimit: 3, weeklyLimit: 14 },
      { name: 'Prof. Sandeep Nair', username: 'sandeep_ce', email: 'sandeep@aset.edu', deptCode: 'CE', dailyLimit: 4, weeklyLimit: 20 },
      { name: 'Dr. Manju Krishnan', username: 'manju_ce', email: 'manju@aset.edu', deptCode: 'CE', dailyLimit: 4, weeklyLimit: 20 },
      { name: 'Mr. Dileep Kumar', username: 'dileep_ce', email: 'dileep@aset.edu', deptCode: 'CE', dailyLimit: 4, weeklyLimit: 20 },

      // AIML (5)
      { name: 'Dr. Priya Sharma', username: 'priya_aiml', email: 'priya@aset.edu', deptCode: 'AIML', dailyLimit: 3, weeklyLimit: 14 },
      { name: 'Prof. Ashwin Raj', username: 'ashwin_aiml', email: 'ashwin@aset.edu', deptCode: 'AIML', dailyLimit: 4, weeklyLimit: 20 },
      { name: 'Dr. Rekha Menon', username: 'rekha_aiml', email: 'rekha@aset.edu', deptCode: 'AIML', dailyLimit: 4, weeklyLimit: 20 },
      { name: 'Prof. Nikhil Das', username: 'nikhil_aiml', email: 'nikhil@aset.edu', deptCode: 'AIML', dailyLimit: 4, weeklyLimit: 20 },
      { name: 'Ms. Aparna Nair', username: 'aparna_aiml', email: 'aparna@aset.edu', deptCode: 'AIML', dailyLimit: 4, weeklyLimit: 20 },
    ];

    const createdTeachersMap = {};
    for (const t of teachersData) {
      const res = await teacherService.create({
        name: t.name,
        username: t.username,
        email: t.email,
        departmentId: createdDeptsMap[t.deptCode],
        maxPeriodsPerDay: t.dailyLimit,
        maxPeriodsPerWeek: t.weeklyLimit,
        unavailability: t.unavailability || [],
        password: 'Password123!',
      });
      createdTeachersMap[t.name] = res.data.teacher._id;
    }

    // 5. Create Classes (4 for CSE, 4 each for others)
    const classesData = [
      // CSE (4 classes — 1 section per year)
      { deptCode: 'CSE', year: 1, semester: 1, section: 'A', room: 'CS-101', count: 60 },
      { deptCode: 'CSE', year: 2, semester: 3, section: 'A', room: 'CS-201', count: 55 },
      { deptCode: 'CSE', year: 3, semester: 5, section: 'A', room: 'CS-301', count: 50 },
      { deptCode: 'CSE', year: 4, semester: 7, section: 'A', room: 'CS-401', count: 45 },

      // ECE (4)
      { deptCode: 'ECE', year: 1, semester: 1, section: 'A', room: 'EC-101', count: 60 },
      { deptCode: 'ECE', year: 2, semester: 3, section: 'A', room: 'EC-201', count: 55 },
      { deptCode: 'ECE', year: 3, semester: 5, section: 'A', room: 'EC-301', count: 50 },
      { deptCode: 'ECE', year: 4, semester: 7, section: 'A', room: 'EC-401', count: 45 },

      // EEE (4)
      { deptCode: 'EEE', year: 1, semester: 1, section: 'A', room: 'EE-101', count: 55 },
      { deptCode: 'EEE', year: 2, semester: 3, section: 'A', room: 'EE-201', count: 50 },
      { deptCode: 'EEE', year: 3, semester: 5, section: 'A', room: 'EE-301', count: 45 },
      { deptCode: 'EEE', year: 4, semester: 7, section: 'A', room: 'EE-401', count: 40 },

      // ME (4)
      { deptCode: 'ME', year: 1, semester: 1, section: 'A', room: 'ME-101', count: 60 },
      { deptCode: 'ME', year: 2, semester: 3, section: 'A', room: 'ME-201', count: 55 },
      { deptCode: 'ME', year: 3, semester: 5, section: 'A', room: 'ME-301', count: 50 },
      { deptCode: 'ME', year: 4, semester: 7, section: 'A', room: 'ME-401', count: 45 },

      // CE (4)
      { deptCode: 'CE', year: 1, semester: 1, section: 'A', room: 'CV-101', count: 50 },
      { deptCode: 'CE', year: 2, semester: 3, section: 'A', room: 'CV-201', count: 45 },
      { deptCode: 'CE', year: 3, semester: 5, section: 'A', room: 'CV-301', count: 40 },
      { deptCode: 'CE', year: 4, semester: 7, section: 'A', room: 'CV-401', count: 35 },

      // AIML (4)
      { deptCode: 'AIML', year: 1, semester: 1, section: 'A', room: 'AI-101', count: 60 },
      { deptCode: 'AIML', year: 2, semester: 3, section: 'A', room: 'AI-201', count: 55 },
      { deptCode: 'AIML', year: 3, semester: 5, section: 'A', room: 'AI-301', count: 50 },
      { deptCode: 'AIML', year: 4, semester: 7, section: 'A', room: 'AI-401', count: 45 },
    ];

    const createdClassesMap = {};
    for (const c of classesData) {
      const res = await classService.create({
        name: `${c.deptCode} S${c.semester} ${c.section}`,
        departmentId: createdDeptsMap[c.deptCode],
        year: c.year,
        semester: c.semester,
        section: c.section,
        roomNumber: c.room,
        studentCount: c.count,
      });
      const key = `${c.deptCode}_S${c.semester}_${c.section}`;
      createdClassesMap[key] = res.data.class._id;
    }

    // 6. Helper for Subjects
    const createSub = async (classKey, name, code, type, hours, teacherNames, options = {}) => {
      const classId = createdClassesMap[classKey];
      if (!classId) return null;

      const teacherIds = teacherNames.map((n) => createdTeachersMap[n]).filter(Boolean);
      const payload = {
        name,
        code,
        type,
        weeklyHours: hours,
        classId,
        teachers: teacherIds,
        isConsecutive: options.isConsecutive || false,
        consecutiveCount: options.consecutiveCount || 1,
      };

      if (type === 'lab' || type === 'project') {
        payload.labDetails = {
          roomName: options.roomName || 'CS-LAB-1',
          duration: options.consecutiveCount || 3,
          isBatchSplit: options.isBatchSplit || false,
          batch1Teacher: options.batch1Teacher ? createdTeachersMap[options.batch1Teacher] : null,
          batch2Teacher: options.batch2Teacher ? createdTeachersMap[options.batch2Teacher] : null,
          batch1Room: options.batch1Room || '',
          batch2Room: options.batch2Room || '',
          morningPreference: options.morningPreference || false,
        };
      }

      if (options.isElective) {
        payload.isElective = true;
        payload.electiveDetails = options.electiveDetails || null;
      }

      const res = await subjectService.create(payload);
      return res.data.subject._id;
    };

    // ── MATHEMATICALLY PERFECT CSE SUBJECTS (6 periods/day = 30 slots/week) ─────────────

    // S1 CSE A (Year 1 — 27 subject hrs + 3 auto = 30 slots)
    await createSub('CSE_S1_A', 'Engineering Mathematics I', 'MAT101', 'theory', 4, ['Dr. Ramesh Krishnan']);
    await createSub('CSE_S1_A', 'Engineering Physics', 'PHY100', 'theory', 3, ['Dr. Lakshmi Priya']);
    await createSub('CSE_S1_A', 'Basics of Programming', 'CST100', 'theory', 3, ['Prof. Deepa Menon']);
    await createSub('CSE_S1_A', 'Engineering Mechanics', 'EST100', 'theory', 3, ['Prof. Arjun Nair']);
    await createSub('CSE_S1_A', 'Engineering Chemistry', 'CYS100', 'theory', 3, ['Prof. Vineeth Thomas']);
    await createSub('CSE_S1_A', 'Professional Communication', 'HUN101', 'theory', 2, ['Prof. Sunil Varma']);
    await createSub('CSE_S1_A', 'Physics Lab', 'PHY110', 'lab', 3, ['Dr. Lakshmi Priya'], { isConsecutive: true, consecutiveCount: 3, roomName: 'CS-LAB-2' });
    await createSub('CSE_S1_A', 'Programming Lab', 'CSL100', 'lab', 3, ['Mr. Vivek Nambiar'], { isConsecutive: true, consecutiveCount: 3, roomName: 'CS-LAB-2' });
    await createSub('CSE_S1_A', 'Workshop', 'EST110', 'lab', 3, ['Ms. Gayathri Mohan'], { isConsecutive: true, consecutiveCount: 3, roomName: 'CS-LAB-2' });

    // S3 CSE A (Year 2 — 28 subject hrs + 2 auto = 30 slots)
    await createSub('CSE_S3_A', 'Discrete Mathematics', 'MAT201', 'theory', 4, ['Dr. Ramesh Krishnan']);
    await createSub('CSE_S3_A', 'Data Structures', 'CST201', 'theory', 4, ['Prof. Deepa Menon']);
    await createSub('CSE_S3_A', 'Logic System Design', 'CST203', 'theory', 3, ['Prof. Arjun Nair']);
    await createSub('CSE_S3_A', 'Object Oriented Programming', 'CST205', 'theory', 3, ['Dr. Kavitha Rajan']);
    await createSub('CSE_S3_A', 'Computer Organization', 'CST207', 'theory', 3, ['Prof. Vineeth Thomas']);
    await createSub('CSE_S3_A', 'Life Skills', 'HUN201', 'theory', 2, ['Prof. Sunil Varma']);
    await createSub('CSE_S3_A', 'Data Structures Lab', 'CSL201', 'lab', 3, ['Mr. Vivek Nambiar'], { isConsecutive: true, consecutiveCount: 3, roomName: 'CS-LAB-1' });
    await createSub('CSE_S3_A', 'OOP Lab', 'CSL203', 'lab', 3, ['Ms. Gayathri Mohan'], { isConsecutive: true, consecutiveCount: 3, roomName: 'CS-LAB-1' });
    await createSub('CSE_S3_A', 'Digital Lab', 'CSL205', 'lab', 3, ['Mr. Rahul Dev'], { isConsecutive: true, consecutiveCount: 3, roomName: 'CS-LAB-1' });

    // S5 CSE A (Year 3 — 27 subject hrs + 3 auto = 30 slots)
    await createSub('CSE_S5_A', 'Compiler Design', 'CST301', 'theory', 3, ['Dr. Anoop Kumar']);
    await createSub('CSE_S5_A', 'Computer Networks', 'CST303', 'theory', 4, ['Prof. Deepa Menon']);
    await createSub('CSE_S5_A', 'Database Management', 'CST305', 'theory', 3, ['Dr. Kavitha Rajan']);
    await createSub('CSE_S5_A', 'Operating Systems', 'CST307', 'theory', 3, ['Prof. Arjun Nair']);
    await createSub('CSE_S5_A', 'Elective: Machine Learning', 'CST309', 'elective', 3, ['Dr. Divya Prasad'], {
      isElective: true,
      electiveDetails: {
        electiveType: 'linked',
        linkedGroupId: 'S5_CSE_E1',
        openElectiveOptions: [
          { optionName: 'Machine Learning', teacherId: createdTeachersMap['Dr. Divya Prasad'], roomName: 'CS-201' },
          { optionName: 'Cloud Computing', teacherId: createdTeachersMap['Prof. Vineeth Thomas'], roomName: 'CS-202' },
        ],
      },
    });
    await createSub('CSE_S5_A', 'Networks Lab', 'CSL331', 'lab', 3, ['Mr. Rahul Dev'], { isConsecutive: true, consecutiveCount: 3, roomName: 'CS-LAB-1' });
    await createSub('CSE_S5_A', 'DBMS Lab', 'CSL333', 'lab', 3, ['Mr. Vivek Nambiar'], { isConsecutive: true, consecutiveCount: 3, roomName: 'CS-LAB-1' });
    await createSub('CSE_S5_A', 'Seminar', 'CSQ301', 'theory', 2, ['Prof. Anjali Krishna']);
    await createSub('CSE_S5_A', 'Industrial Economics', 'HUN301', 'theory', 3, ['Prof. Sunil Varma']);

    // S7 CSE A (Year 4 — 22 subject hrs + 8 auto = 30 slots)
    await createSub('CSE_S7_A', 'Distributed Computing', 'CST401', 'theory', 3, ['Dr. Anoop Kumar']);
    await createSub('CSE_S7_A', 'Elective: Blockchain', 'CST403', 'elective', 3, ['Prof. Vineeth Thomas'], {
      isElective: true,
      electiveDetails: {
        electiveType: 'linked',
        linkedGroupId: 'S7_CSE_E2',
        openElectiveOptions: [
          { optionName: 'Blockchain Technology', teacherId: createdTeachersMap['Prof. Vineeth Thomas'], roomName: 'CS-301' },
          { optionName: 'Deep Learning', teacherId: createdTeachersMap['Dr. Divya Prasad'], roomName: 'CS-302' },
        ],
      },
    });
    await createSub('CSE_S7_A', 'Elective: Cyber Security', 'CST405', 'elective', 3, ['Dr. Kavitha Rajan'], {
      isElective: true,
      electiveDetails: {
        electiveType: 'linked',
        linkedGroupId: 'S7_CSE_E3',
        openElectiveOptions: [
          { optionName: 'Cyber Security', teacherId: createdTeachersMap['Dr. Kavitha Rajan'], roomName: 'CS-301' },
          { optionName: 'IoT & Embedded', teacherId: createdTeachersMap['Prof. Anjali Krishna'], roomName: 'CS-302' },
        ],
      },
    });
    await createSub('CSE_S7_A', 'Project Phase 1', 'CSD415', 'lab', 4, ['Prof. Anjali Krishna'], { isConsecutive: true, consecutiveCount: 4, roomName: 'CS-401' });
    await createSub('CSE_S7_A', 'Comprehensive Seminar', 'CSQ413', 'theory', 2, ['Prof. Arjun Nair']);
    await createSub('CSE_S7_A', 'Networking Lab', 'CSL411', 'lab', 3, ['Mr. Rahul Dev'], { isConsecutive: true, consecutiveCount: 3, roomName: 'CS-LAB-1' });
    await createSub('CSE_S7_A', 'Management for Engineers', 'HUN401', 'theory', 3, ['Prof. Deepa Menon']);
    await createSub('CSE_S7_A', 'Disaster Management', 'MCN401', 'theory', 1, ['Prof. Sunil Varma']);

    // ── OTHER DEPARTMENTS (ECE, EEE, ME, CE, AIML) ──────────────────────────────
    // ECE
    await createSub('ECE_S1_A', 'Engineering Mathematics I', 'MAT101', 'theory', 4, ['Prof. Sanjay Mohan']);
    await createSub('ECE_S1_A', 'Engineering Physics', 'PHY100', 'theory', 3, ['Dr. Meera Nair']);
    await createSub('ECE_S1_A', 'Professional Communication', 'HUN101', 'theory', 2, ['Prof. Nisha Raj']);
    await createSub('ECE_S1_A', 'Engineering Mechanics', 'EST100', 'theory', 3, ['Dr. Anil Kumar P']);
    await createSub('ECE_S1_A', 'Engineering Physics Lab', 'PHY110', 'lab', 3, ['Dr. Meera Nair'], { isConsecutive: true, consecutiveCount: 3, roomName: 'EC-LAB-1' });

    // EEE
    await createSub('EEE_S1_A', 'Engineering Mathematics I', 'MAT101', 'theory', 4, ['Prof. Rajesh Pillai']);
    await createSub('EEE_S1_A', 'Engineering Physics', 'PHY100', 'theory', 3, ['Dr. Smitha Rajan']);
    await createSub('EEE_S1_A', 'Professional Communication', 'HUN101', 'theory', 2, ['Prof. Unni Krishnan']);
    await createSub('EEE_S1_A', 'Engineering Mechanics', 'EST100', 'theory', 3, ['Ms. Athira Babu']);
    await createSub('EEE_S1_A', 'Engineering Physics Lab', 'PHY110', 'lab', 3, ['Dr. Smitha Rajan'], { isConsecutive: true, consecutiveCount: 3, roomName: 'EE-LAB-1' });

    // ME
    await createSub('ME_S1_A', 'Engineering Mathematics I', 'MAT101', 'theory', 4, ['Dr. Suresh Babu']);
    await createSub('ME_S1_A', 'Engineering Physics', 'PHY100', 'theory', 3, ['Prof. Girish Menon']);
    await createSub('ME_S1_A', 'Professional Communication', 'HUN101', 'theory', 2, ['Prof. Neethu Joseph']);
    await createSub('ME_S1_A', 'Engineering Mechanics', 'EST100', 'theory', 3, ['Dr. Hari Prasad']);
    await createSub('ME_S1_A', 'Engineering Physics Lab', 'PHY110', 'lab', 3, ['Prof. Girish Menon'], { isConsecutive: true, consecutiveCount: 3, roomName: 'ME-LAB-1' });

    // CE
    await createSub('CE_S1_A', 'Engineering Mathematics I', 'MAT101', 'theory', 4, ['Prof. Lekha Menon']);
    await createSub('CE_S1_A', 'Engineering Physics', 'PHY100', 'theory', 3, ['Prof. Sandeep Nair']);
    await createSub('CE_S1_A', 'Professional Communication', 'HUN101', 'theory', 2, ['Dr. Manju Krishnan']);
    await createSub('CE_S1_A', 'Engineering Mechanics', 'EST100', 'theory', 3, ['Dr. Beena George']);
    await createSub('CE_S1_A', 'Engineering Physics Lab', 'PHY110', 'lab', 3, ['Prof. Sandeep Nair'], { isConsecutive: true, consecutiveCount: 3, roomName: 'CV-LAB-1' });

    // AIML
    await createSub('AIML_S1_A', 'Engineering Mathematics I', 'MAT101', 'theory', 4, ['Dr. Priya Sharma']);
    await createSub('AIML_S1_A', 'Engineering Physics', 'PHY100', 'theory', 3, ['Prof. Ashwin Raj']);
    await createSub('AIML_S1_A', 'Professional Communication', 'HUN101', 'theory', 2, ['Dr. Rekha Menon']);
    await createSub('AIML_S1_A', 'Engineering Mechanics', 'EST100', 'theory', 3, ['Prof. Nikhil Das']);
    await createSub('AIML_S1_A', 'Engineering Physics Lab', 'PHY110', 'lab', 3, ['Prof. Ashwin Raj'], { isConsecutive: true, consecutiveCount: 3, roomName: 'AI-LAB-1' });

    return true;
  } catch (err) {
    console.error('Frontend dummy seed failed:', err);
    throw err;
  }
};
