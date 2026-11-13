const path = require('path');
const backendDir = path.resolve(__dirname, '../timetable-system/backend');
const mongoose = require(path.join(backendDir, 'node_modules/mongoose'));

async function correctFacultyName() {
  await mongoose.connect('mongodb://127.0.0.1:27017/timetable_db');
  console.log('Connected to database.');

  const Teacher = require(path.join(backendDir, 'src/models/Teacher'));
  const Timetable = require(path.join(backendDir, 'src/models/Timetable'));

  // 1. Correct teacher record
  const sangeetha = await Teacher.findById('6aeccf3cbb1e84200c3db038');
  if (sangeetha) {
    sangeetha.name = 'Ms Sangeetha';
    sangeetha.username = 'sangeetha';
    await sangeetha.save();
    console.log(`Updated Teacher record: ${sangeetha._id} -> ${sangeetha.name}`);
  }

  // 2. Remove any accidental duplicates
  await Teacher.deleteMany({ _id: { $ne: '6aeccf3cbb1e84200c3db038' }, username: 'sangeetha' });

  // 3. Propagate to all Timetable snapshots
  const timetables = await Timetable.find({});
  let updatedTimetables = 0;

  for (const tt of timetables) {
    let modified = false;
    for (const slot of tt.slots || []) {
      if (slot.teacherIds && slot.teacherIds.includes('6aeccf3cbb1e84200c3db038')) {
        if (slot.teacherNames) {
          slot.teacherNames = slot.teacherNames.map(n => (n.includes('Sangeeth') ? 'Ms Sangeetha' : n));
        }
        modified = true;
      }
    }
    if (modified) {
      await tt.save();
      updatedTimetables++;
    }
  }

  console.log(`Propagated name correction across ${updatedTimetables} Timetable snapshots.`);
  await mongoose.disconnect();
  console.log('Done.');
}

if (require.main === module) {
  correctFacultyName().catch(console.error);
}

module.exports = { correctFacultyName };
