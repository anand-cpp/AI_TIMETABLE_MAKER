require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Department = require('../models/Department');
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const Subject = require('../models/Subject');
const CollegeSettings = require('../models/CollegeSettings');
const Timetable = require('../models/Timetable');
const Suggestion = require('../models/Suggestion');
const UploadedFile = require('../models/UploadedFile');
const { DEFAULT_SETTINGS } = require('../config/constants');

const clearAllData = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/timetable_db';
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  }

  console.log('🧹 Clearing all collections...');

  await Department.deleteMany({});
  await Class.deleteMany({});
  await Teacher.deleteMany({});
  await Subject.deleteMany({});
  await Timetable.deleteMany({});
  await Suggestion.deleteMany({});
  await UploadedFile.deleteMany({});
  await CollegeSettings.deleteMany({});

  // Reset settings singleton
  await CollegeSettings.create({
    singleton: 'singleton',
    ...DEFAULT_SETTINGS,
  });

  // Ensure an admin account exists. In production we must NEVER silently
  // recreate the well-known default credentials — that would be a backdoor.
  let admin = await Admin.findOne();
  if (!admin) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '⚠️ No admin account exists after wipe. Use POST /api/auth/setup to create one.'
      );
      // Allow one-time setup again.
      await mongoose.connection.db.collection('admin_setup_lock').deleteOne({ _id: 'admin-setup' }).catch(() => {});
    } else {
      admin = await Admin.create({
        username: 'admin',
        password: 'admin123',
      });
      console.log('⚠️  DEV ONLY: default admin created (admin / admin123). Never use in production.');
    }
  } else {
    console.log('✅ Existing admin account retained (username: %s)', admin.username);
  }

  console.log('✨ All system data successfully wiped!');
};

if (require.main === module) {
  clearAllData()
    .then(() => {
      mongoose.connection.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Error clearing data:', err);
      process.exit(1);
    });
}

module.exports = clearAllData;
