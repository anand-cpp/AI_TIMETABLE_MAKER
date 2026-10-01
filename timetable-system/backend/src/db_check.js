const path = require('path');
const mongoose = require(path.join(__dirname, '../node_modules/mongoose'));
const bcrypt = require(path.join(__dirname, '../node_modules/bcryptjs'));

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/timetable_db';

const runSeed = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB...');

    const Admin = require('./models/Admin');
    const Department = require('./models/Department');
    const Teacher = require('./models/Teacher');
    const Class = require('./models/Class');
    const Subject = require('./models/Subject');
    const CollegeSettings = require('./models/CollegeSettings');

    // Ensure Admin user exists
    let admin = await Admin.findOne({ username: 'admin' });
    if (!admin) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      admin = await Admin.create({
        username: 'admin',
        password: hashedPassword,
        role: 'admin',
      });
      console.log('Created admin account: admin / admin123');
    } else {
      console.log('Admin account exists: admin');
    }

    mongoose.disconnect();
  } catch (err) {
    console.error('Seed error:', err);
  }
};

runSeed();
