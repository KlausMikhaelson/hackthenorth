const mongoose = require('mongoose');

const nftSchema = new mongoose.Schema(
  {
    tokenId: { type: String, required: true, unique: true },
    currentOwner: { type: String, required: true },
    uri: { type: String },
    taxon: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.models.NFT || mongoose.model('NFT', nftSchema);


