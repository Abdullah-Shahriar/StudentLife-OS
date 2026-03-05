const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  id:        { type: String, required: true, unique: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true },
  name:      { type: String, required: true },
  phone:     { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
