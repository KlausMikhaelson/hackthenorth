const mongoose = require('mongoose');

const nftOfferSchema = new mongoose.Schema(
  {
    offerId: { type: String, required: true, unique: true },
    tokenId: { type: String, required: true },
    destination: { type: String },
    status: { type: String, enum: ['PENDING', 'ACCEPTED', 'CANCELLED'], default: 'PENDING' },
    acceptedTxHash: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.models.NFTOffer || mongoose.model('NFTOffer', nftOfferSchema);


