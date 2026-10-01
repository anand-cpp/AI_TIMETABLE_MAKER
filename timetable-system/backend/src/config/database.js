const mongoose = require('mongoose');

const LOCAL_FALLBACK_URI = 'mongodb://127.0.0.1:27017/timetable_db';
const CONNECTION_OPTIONS = {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
};

const attemptConnect = async (uri) => {
  return mongoose.connect(uri, CONNECTION_OPTIONS);
};

const connectDB = async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const mongoUri = process.env.MONGODB_URI || LOCAL_FALLBACK_URI;

  try {
    const conn = await attemptConnect(mongoUri);
    console.log(`✅ Connected to MongoDB: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    if (isProduction) {
      throw new Error(
        `MongoDB connection failed for "${redact(mongoUri)}": ${error.message}. ` +
          'The local fallback is disabled in production — refusing to start against an unintended database.'
      );
    }

    console.warn(`⚠️  Could not connect to "${redact(mongoUri)}" (${error.message}). Trying local fallback...`);

    try {
      const conn = await attemptConnect(LOCAL_FALLBACK_URI);
      console.warn(`⚠️  Connected to local fallback MongoDB: ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    } catch (fallbackError) {
      throw new Error(
        `MongoDB connection failed for both "${redact(mongoUri)}" (${error.message}) ` +
          `and local fallback (${fallbackError.message}). Is MongoDB running?`
      );
    }
  }
};

const redact = (uri) => {
  try {
    const parsed = new URL(uri);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return uri;
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

module.exports = connectDB;