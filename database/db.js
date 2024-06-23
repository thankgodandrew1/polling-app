const mongoose = require('mongoose');
require('dotenv').config();

let isConnected = false;

const connect = async () => {
  if (isConnected) {
    console.log('Already connected to MongoDB');
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    isConnected = true;
    console.log('MongoDB connected!');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw new Error('Unable to connect to MongoDB');
  }
};

const disconnect = async () => {
  if (!isConnected) {
    console.log('Already disconnected from MongoDB');
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('MongoDB disconnected.');
  } catch (error) {
    console.error('MongoDB disconnection error:', error);
    throw new Error('Unable to disconnect from MongoDB');
  }
};

module.exports = { connect, disconnect };