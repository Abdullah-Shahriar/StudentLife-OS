/* ================================================
   db.js — MongoDB connection (Mongoose)
   Caches the connection across serverless invocations.
   ================================================ */
const mongoose = require('mongoose');

let cached = global._mongooseConn || null;

async function connectDB() {
  if (cached && mongoose.connection.readyState === 1) return cached;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not set');

  cached = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 45000,
  });
  global._mongooseConn = cached;
  return cached;
}

module.exports = connectDB;
