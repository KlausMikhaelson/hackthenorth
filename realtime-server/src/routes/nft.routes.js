const express = require('express');
const router = express.Router();
const NFT = require('../models/NFT');
const NFTOffer = require('../models/NFTOffer');
const User = require('../models/User');
const xrplService = require('../services/xrpl.service');

// Using Mongoose models instead of Prisma

router.post('/mint', async (req, res) => {
  try {
    const { idempotencyKey, userId, xrplAddress, sku, metadata } = req.body;

    if (!idempotencyKey || !xrplAddress || !sku) {
      return res.status(400).json({ error: 'Missing required fields: idempotencyKey, xrplAddress, sku' });
    }
    if (!require('xrpl').isValidClassicAddress(xrplAddress)) {
      return res.status(400).json({ error: 'Invalid XRPL destination address' });
    }
    if (!process.env.NFT_ISSUER_ADDRESS || !process.env.NFT_ISSUER_SEED) {
      return res.status(503).json({ error: 'XRPL issuer not configured on server' });
    }

    // For simplicity, skip mint job table; dedupe by checking existing NFT by sku or by offer
    const existingOffer = await NFTOffer.findOne({ destination: xrplAddress }).lean();

    if (existingOffer) {
      return res.json({
        tokenId: existingOffer.tokenId,
        offerId: existingOffer.offerId,
        offerStatus: existingOffer.status || 'CREATED',
        mintTx: existingOffer.createdTxHash,
      });
    }

    // No mint job persistence in this minimal Mongo version

    let uri = '';
    if (metadata) {
      const metadataJson = {
        name: metadata.name,
        description: metadata.description,
        image: metadata.image,
        attributes: metadata.attributes || [],
        external_url: metadata.external_url
      };
      
      // Prefer explicit metadata image/external_url, else leave blank (URI is optional)
      uri = metadata.image || metadata.external_url || '';
    }

    const taxonBase = parseInt(process.env.NFT_COLLECTION_TAXON_BASE || '1000');
    const taxon = taxonBase + (hashCode(sku) % 100);

    try {
      const mintResult = await xrplService.mintNFT({
        uri,
        sku,
        taxon,
        transferFee: 0
      });

      await NFT.findOneAndUpdate(
        { tokenId: mintResult.tokenId },
        {
          tokenId: mintResult.tokenId,
          uri: uri || undefined,
          taxon,
          currentOwner: process.env.NFT_ISSUER_ADDRESS,
        },
        { upsert: true }
      );

      const expirationUnix = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
      
      const offerResult = await xrplService.createOffer({
        tokenId: mintResult.tokenId,
        destination: xrplAddress,
        amountDrops: '0',
        expiration: expirationUnix
      });

      await NFTOffer.findOneAndUpdate(
        { offerId: offerResult.offerId },
        {
          offerId: offerResult.offerId,
          tokenId: mintResult.tokenId,
          destination: xrplAddress,
          status: 'CREATED',
          createdTxHash: offerResult.txHash,
          expirationUnix,
        },
        { upsert: true }
      );

      // No mint job update in minimal version

      if (global.io) {
        global.io.emit('nft.offerReady', {
          tokenId: mintResult.tokenId,
          offerId: offerResult.offerId,
          destination: xrplAddress,
          expiration: expirationUnix
        });
      }

      res.json({
        tokenId: mintResult.tokenId,
        offerId: offerResult.offerId,
        offerStatus: 'CREATED',
        mintTx: mintResult.txHash,
        offerTx: offerResult.txHash,
        acceptBy: expirationUnix
      });

    } catch (error) {
      // No mint job failure persistence

      if (global.io) {
        global.io.emit('nft.error', {
          idempotencyKey,
          code: 'MINT_FAILED',
          message: error.message
        });
      }

      throw error;
    }

  } catch (error) {
    console.error('NFT mint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mint using a stored user wallet
router.post('/mintForUser', async (req, res) => {
  try {
    const { username, address, sku, metadata, signature, message } = req.body;
    if (!sku) return res.status(400).json({ error: 'sku required' });
    let user = null;
    if (address) {
      user = await User.findOne({ address }).lean();
      if (!user) {
        // auto-create placeholder user
        const created = await User.create({ username: username || `player_${(address).slice(-6)}`, address });
        user = created.toObject();
      }
    } else if (username) {
      user = await User.findOne({ username }).lean();
    }
    if (!user) return res.status(404).json({ error: 'user not found for given username/address' });

    // Verify signature if provided (simple demo message verification)
    if (signature && message) {
      try {
        const xrpl = require('xrpl');
        const wallet = xrpl.Wallet.fromSeed(user.seed || "");
        const ok = xrpl.verifySignature(message, signature, wallet.publicKey);
        if (!ok) return res.status(401).json({ error: 'invalid signature' });
      } catch (e) {
        return res.status(400).json({ error: 'signature verification failed' });
      }
    }

    // Prepare URI if provided
    let uri = '';
    if (metadata) {
      uri = metadata.image || metadata.external_url || '';
    }

    const taxonBase = parseInt(process.env.NFT_COLLECTION_TAXON_BASE || '1000');
    const taxon = taxonBase + (hashCode(sku) % 100);

    // Try to mint on-ledger; if it fails (demo), create a mock token
    let mintResult;
    try {
      mintResult = await xrplService.mintNFT({ uri, sku, taxon, transferFee: 0 });
    } catch (e) {
      console.warn('Mint failed on-ledger, using mock token:', e?.message || e);
      mintResult = { tokenId: `mock-${Date.now()}-${Math.floor(Math.random()*1e6)}`, txHash: 'mock', ledgerIndex: 0 };
    }

    await NFT.findOneAndUpdate(
      { tokenId: mintResult.tokenId },
      {
        tokenId: mintResult.tokenId,
        uri: uri || undefined,
        taxon,
        currentOwner: process.env.NFT_ISSUER_ADDRESS || process.env.XRPL_ISSUER_ADDRESS,
      },
      { upsert: true }
    );

    const expirationUnix = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
    // Create offer if possible; service will mock if NO_DST
    const offerResult = await xrplService.createOffer({
      tokenId: mintResult.tokenId,
      destination: user.address,
      amountDrops: '0',
      expiration: expirationUnix,
    });

    await NFTOffer.findOneAndUpdate(
      { offerId: offerResult.offerId },
      {
        offerId: offerResult.offerId,
        tokenId: mintResult.tokenId,
        destination: user.address,
        status: 'CREATED',
        createdTxHash: offerResult.txHash,
        expirationUnix,
      },
      { upsert: true }
    );

    if (global.io) {
      global.io.emit('nft.offerReady', {
        tokenId: mintResult.tokenId,
        offerId: offerResult.offerId,
        destination: user.address,
        expiration: expirationUnix
      });
    }

    res.json({
      tokenId: mintResult.tokenId,
      offerId: offerResult.offerId,
      destination: user.address,
      offerTx: offerResult.txHash,
      acceptBy: expirationUnix,
    });
  } catch (error) {
    console.error('mintForUser error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get inventory for a stored user
router.get('/inventoryForUser/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).lean();
    if (!user) return res.status(404).json({ error: 'user not found' });
    const issuerOnly = (req.query.issuerOnly ?? 'true') === 'true';
    const ledgerNFTs = await xrplService.getNFTInventory(user.address, issuerOnly);
    res.json(ledgerNFTs);
  } catch (error) {
    console.error('inventoryForUser error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/offers/:offerId', async (req, res) => {
  try {
    const { offerId } = req.params;

    const offer = await NFTOffer.findOne({ offerId }).lean();

    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    res.json({
      status: offer.status,
      tokenId: offer.tokenId,
      destination: offer.destination,
      createdTx: offer.createdTxHash,
      acceptedTx: offer.acceptedTxHash,
      expiration: offer.expirationUnix
    });

  } catch (error) {
    console.error('Get offer error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/inventory', async (req, res) => {
  try {
    const { address, issuerOnly = 'true' } = req.query;

    if (!address) {
      return res.status(400).json({ error: 'Address required' });
    }

    const ledgerNFTs = await xrplService.getNFTInventory(
      address, 
      issuerOnly === 'true'
    );

    const tokenIds = ledgerNFTs.map(n => n.tokenId);
    
    const dbNFTs = await NFT.find({ tokenId: { $in: tokenIds } }).lean();

    const nftMap = new Map(dbNFTs.map(n => [n.tokenId, n]));

    const inventory = ledgerNFTs.map(ledgerNFT => {
      const dbNFT = nftMap.get(ledgerNFT.tokenId);
      
      return {
        tokenId: ledgerNFT.tokenId,
        sku: dbNFT?.sku || 'unknown',
        uri: ledgerNFT.uri,
        image: '',
        name: '',
        attributes: [],
        issuer: ledgerNFT.issuer,
        taxon: ledgerNFT.taxon,
        owner: address
      };
    });

    res.json(inventory);

  } catch (error) {
    console.error('Inventory error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/metadata/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;

    const nft = await NFT.findOne({ tokenId }).lean();

    if (!nft) {
      return res.status(404).json({ error: 'NFT not found' });
    }

    const metadata = {
      name: `NFT ${nft.sku}`,
      description: `NFT for ${nft.sku}`,
      image: nft.uri,
      attributes: [],
      tokenId: nft.tokenId,
      sku: nft.sku
    };

    res.json(metadata);

  } catch (error) {
    console.error('Metadata error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/reoffer', async (req, res) => {
  try {
    const { tokenId, destination } = req.body;

    if (!tokenId || !destination) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const nft = await prisma.nFT.findUnique({
      where: { tokenId }
    });

    if (!nft) {
      return res.status(404).json({ error: 'NFT not found' });
    }

    if (nft.currentOwner !== process.env.NFT_ISSUER_ADDRESS) {
      return res.status(400).json({ error: 'NFT not owned by issuer' });
    }

    const expirationUnix = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
    
    const offerResult = await xrplService.createOffer({
      tokenId,
      destination,
      amountDrops: '0',
      expiration: expirationUnix
    });

    await NFTOffer.findOneAndUpdate(
      { offerId: offerResult.offerId },
      {
        offerId: offerResult.offerId,
        tokenId,
        destination,
        status: 'CREATED',
        createdTxHash: offerResult.txHash,
        expirationUnix,
      },
      { upsert: true }
    );

    if (global.io) {
      global.io.emit('nft.offerReady', {
        tokenId,
        offerId: offerResult.offerId,
        destination,
        expiration: expirationUnix
      });
    }

    res.json({
      offerId: offerResult.offerId,
      tokenId,
      offerTx: offerResult.txHash,
      expiration: expirationUnix
    });

  } catch (error) {
    console.error('Reoffer error:', error);
    res.status(500).json({ error: error.message });
  }
});

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

module.exports = router;