const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const xrplService = require('../services/xrpl.service');

const prisma = new PrismaClient();

router.post('/mint', async (req, res) => {
  try {
    const { idempotencyKey, userId, xrplAddress, sku, metadata } = req.body;

    if (!idempotencyKey || !xrplAddress || !sku) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingJob = await prisma.nFTMintJob.findUnique({
      where: { idempotencyKey }
    });

    if (existingJob) {
      if (existingJob.status === 'FAILED') {
        return res.status(400).json({ 
          error: 'Previous mint failed', 
          details: existingJob.error 
        });
      }

      if (existingJob.nftTokenId) {
        const nft = await prisma.nFT.findUnique({
          where: { tokenId: existingJob.nftTokenId },
          include: { offers: true }
        });

        const activeOffer = nft?.offers.find(o => o.status === 'CREATED');
        
        return res.json({
          tokenId: existingJob.nftTokenId,
          offerId: activeOffer?.offerId,
          offerStatus: activeOffer?.status || 'NONE',
          mintTx: nft?.mintedTxHash,
          offerTx: activeOffer?.createdTxHash
        });
      }
    }

    const mintJob = await prisma.nFTMintJob.upsert({
      where: { idempotencyKey },
      update: {},
      create: {
        idempotencyKey,
        xrplAddress,
        sku,
        status: 'PENDING'
      }
    });

    let uri = '';
    if (metadata) {
      const metadataJson = {
        name: metadata.name,
        description: metadata.description,
        image: metadata.image,
        attributes: metadata.attributes || [],
        external_url: metadata.external_url
      };
      
      uri = `https://api.example.com/metadata/${idempotencyKey}`;
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

      await prisma.nFT.create({
        data: {
          tokenId: mintResult.tokenId,
          sku,
          uri,
          uriHex: xrplService.hexEncode(uri),
          issuer: process.env.NFT_ISSUER_ADDRESS,
          taxon,
          flags: 3,
          mintedTxHash: mintResult.txHash,
          mintedLedgerIndex: mintResult.ledgerIndex,
          currentOwner: process.env.NFT_ISSUER_ADDRESS
        }
      });

      const expirationUnix = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
      
      const offerResult = await xrplService.createOffer({
        tokenId: mintResult.tokenId,
        destination: xrplAddress,
        amountDrops: '0',
        expiration: expirationUnix
      });

      await prisma.nFTOffer.create({
        data: {
          offerId: offerResult.offerId,
          tokenId: mintResult.tokenId,
          destination: xrplAddress,
          amountDrops: '0',
          status: 'CREATED',
          createdTxHash: offerResult.txHash,
          expirationUnix
        }
      });

      await prisma.nFTMintJob.update({
        where: { idempotencyKey },
        data: {
          status: 'MINTED',
          nftTokenId: mintResult.tokenId
        }
      });

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
      await prisma.nFTMintJob.update({
        where: { idempotencyKey },
        data: {
          status: 'FAILED',
          error: error.message
        }
      });

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

router.get('/offers/:offerId', async (req, res) => {
  try {
    const { offerId } = req.params;

    const offer = await prisma.nFTOffer.findUnique({
      where: { offerId }
    });

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
    
    const dbNFTs = await prisma.nFT.findMany({
      where: { tokenId: { in: tokenIds } }
    });

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

    const nft = await prisma.nFT.findUnique({
      where: { tokenId }
    });

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

    await prisma.nFTOffer.create({
      data: {
        offerId: offerResult.offerId,
        tokenId,
        destination,
        amountDrops: '0',
        status: 'CREATED',
        createdTxHash: offerResult.txHash,
        expirationUnix
      }
    });

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