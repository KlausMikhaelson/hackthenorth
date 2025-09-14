const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { Wallet } = require('xrpl');
const NFT = require('../models/NFT');
const NFTOffer = require('../models/NFTOffer');
const xrplService = require('../services/xrpl.service');
const UserAsset = require('../models/UserAsset');

router.post('/signup', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'username required' });
    const existing = await User.findOne({ username }).lean();
    if (existing) return res.status(409).json({ error: 'username taken' });
    const w = Wallet.generate();
    const doc = await User.create({ username, address: w.address, seed: w.seed });
    await UserAsset.findOneAndUpdate(
      { address: w.address },
      { address: w.address, textures: [], tankTypes: [], selectedTexture: null, selectedTankType: null },
      { upsert: true }
    );
    // Dev/demo only: return seed so client can sign purchases
    res.json({ username, address: doc.address, seed: w.seed });
  } catch (e) {
    console.error('signup error', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/wallet/:username', async (req, res) => {
  try {
    const u = await User.findOne({ username: req.params.username }).lean();
    if (!u) return res.status(404).json({ error: 'not found' });
    res.json({ username: u.username, address: u.address });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Lookup user by address, and return address + derived inventory with simple shape/name mapping
router.get('/byAddress/:address', async (req, res) => {
  try {
    const { address } = req.params;
    let user = await User.findOne({ address: address }).lean();
    if (!user) {
      // Auto-create a placeholder user with generated username
      const username = `player_${address.slice(-6)}`;
      const created = await User.create({ username, address });
      await UserAsset.findOneAndUpdate(
        { address },
        { address, textures: [], tankTypes: [], selectedTexture: null, selectedTankType: null },
        { upsert: true }
      );
      user = created.toObject();
    }
    // On-ledger inventory (issuerOnly); if account not funded, return empty
    let ledgerNFTs = [];
    try {
      ledgerNFTs = await xrplService.getNFTInventory(address, true);
    } catch (e) {
      if ((e?.data?.error === 'actNotFound') || /Account not found/i.test(e?.message || '')) {
        ledgerNFTs = [];
      } else {
        throw e;
      }
    }
    // Map to simple game properties (name, shape)
    const mappedOnLedger = ledgerNFTs.map((n) => {
      const name = n.uri || `NFT-${n.tokenId.slice(-6)}`;
      // naive shape map based on taxon modulo
      const shape = (n.taxon % 3 === 0) ? 'cube' : (n.taxon % 3 === 1) ? 'cylinder' : 'sphere';
      return { tokenId: n.tokenId, name, shape, source: 'ledger' };
    });

    // Include pending offers to this address from DB as pseudo inventory
    const offers = await NFTOffer.find({ destination: address }).lean();
    const nftsByToken = new Map();
    mappedOnLedger.forEach((m) => nftsByToken.set(m.tokenId, m));

    for (const off of offers) {
      if (!nftsByToken.has(off.tokenId)) {
        const nft = await NFT.findOne({ tokenId: off.tokenId }).lean();
        const uri = nft?.uri || '';
        const taxon = nft?.taxon || 0;
        const name = uri || `NFT-${off.tokenId.slice(-6)}`;
        const shape = (taxon % 3 === 0) ? 'cube' : (taxon % 3 === 1) ? 'cylinder' : 'sphere';
        nftsByToken.set(off.tokenId, { tokenId: off.tokenId, name, shape, source: 'offer', status: off.status });
      }
    }

    const mapped = Array.from(nftsByToken.values());
    res.json({ username: user.username, address: user.address, nfts: mapped });
  } catch (e) {
    console.error('byAddress error', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

// Asset store APIs
// Get user's texture/tank store
router.get('/assets/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const assets = await UserAsset.findOne({ address }).lean();
    if (!assets) return res.json({ address, textures: [], tankTypes: [], selectedTexture: null, selectedTankType: null });
    res.json(assets);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update user's selected texture/tank (and optionally add to store)
router.post('/assets/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { addTexture, addTankType, selectedTexture, selectedTankType } = req.body || {};
    const update = { };
    if (selectedTexture !== undefined) update.selectedTexture = selectedTexture;
    if (selectedTankType !== undefined) update.selectedTankType = selectedTankType;
    if (addTexture) update.$addToSet = { ...(update.$addToSet||{}), textures: addTexture };
    if (addTankType) update.$addToSet = { ...(update.$addToSet||{}), tankTypes: addTankType };
    const doc = await UserAsset.findOneAndUpdate(
      { address },
      { address, ...update },
      { upsert: true, new: true }
    ).lean();
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


