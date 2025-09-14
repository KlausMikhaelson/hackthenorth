const mongoose = require('mongoose');

const userAssetSchema = new mongoose.Schema(
  {
    address: { type: String, required: true, unique: true },
    textures: { type: [String], default: [] },
    tankTypes: { type: [String], default: [] },
    selectedTexture: { type: String, default: null },
    selectedTankType: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.models.UserAsset || mongoose.model('UserAsset', userAssetSchema);


