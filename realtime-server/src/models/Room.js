const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true },
    escrowCondition: { type: String },
    escrowFulfillment: { type: String },
    escrowOwner: { type: String },
    escrowSequence: { type: Number },
    amountDrops: { type: String },
    status: { type: String, enum: ['OPEN', 'COMPLETED', 'CANCELLED'], default: 'OPEN' },
    winnerAddress: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Room || mongoose.model('Room', roomSchema);



