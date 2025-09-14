const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    address: { type: String, required: true, unique: true },
    seed: { type: String }, // optional
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);


