require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/database');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    // Start Express server on all network interfaces (0.0.0.0)
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://127.0.0.1:${PORT} and http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Client URL: ${process.env.CLIENT_URL || 'http://localhost:5175'}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('\nSIGINT received, shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    process.on('unhandledRejection', (err) => {
      console.error('⚠️ Unhandled Promise Rejection:', err.message);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
  }
};

startServer();