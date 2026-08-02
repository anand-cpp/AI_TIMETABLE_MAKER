const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/timetable_db';
  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
    });
    console.log(`✅ Connected to MongoDB: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`⚠️ Primary MongoDB connection failed (${error.message}). Trying local fallback...`);
    try {
      const conn = await mongoose.connect('mongodb://127.0.0.1:27017/timetable_db', {
        serverSelectionTimeoutMS: 3000,
      });
      console.log(`✅ Connected to Local MongoDB: ${conn.connection.host}`);
    } catch (fallbackError) {
      console.error(`⚠️ Could not connect to MongoDB.`);
    }
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

module.exports = connectDB;