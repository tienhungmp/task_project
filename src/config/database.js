const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
    
    // Log khi DB disconnect
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
    });

    // Log khi có error
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB error:', err);
    });

    // Log khi reconnect
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    return mongoose.connection;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;