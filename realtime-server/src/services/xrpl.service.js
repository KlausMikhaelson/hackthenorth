const xrpl = require('xrpl');
const NFT = require('../models/NFT');
const NFTOffer = require('../models/NFTOffer');

class XRPLService {
  constructor() {
    this.client = null;
    this.issuerAddress = process.env.NFT_ISSUER_ADDRESS || process.env.XRPL_ISSUER_ADDRESS;
    this.issuerSeed = process.env.NFT_ISSUER_SEED || process.env.XRPL_ISSUER_SEED;
    this.wsUrl = process.env.XRPL_RPC_WSS_URL || 'wss://s.altnet.rippletest.net:51233';
    this.subscriptions = new Map();
  }

  ensureIssuerConfigured() {
    // Refresh from env on each call to avoid load-order issues
    this.issuerAddress = process.env.NFT_ISSUER_ADDRESS || process.env.XRPL_ISSUER_ADDRESS;
    this.issuerSeed = process.env.NFT_ISSUER_SEED || process.env.XRPL_ISSUER_SEED;
    if (!this.issuerAddress || !this.issuerSeed) {
      throw new Error('XRPL issuer not configured. Set NFT_ISSUER_ADDRESS and NFT_ISSUER_SEED in .env');
    }
    if (!xrpl.isValidClassicAddress(this.issuerAddress)) {
      throw new Error('NFT_ISSUER_ADDRESS is not a valid XRPL classic address');
    }
    if (typeof this.issuerSeed !== 'string' || this.issuerSeed.length < 4) {
      throw new Error('NFT_ISSUER_SEED is invalid');
    }
  }

  async connect() {
    if (this.client?.isConnected()) return;
    
    this.client = new xrpl.Client(this.wsUrl);
    await this.client.connect();
    console.log('Connected to XRPL');
    
    if (this.issuerAddress && xrpl.isValidClassicAddress(this.issuerAddress)) {
      await this.subscribeToAccount(this.issuerAddress);
    }
  }

  async disconnect() {
    if (this.client?.isConnected()) {
      await this.client.disconnect();
    }
  }

  async subscribeToAccount(address) {
    if (!this.client?.isConnected()) await this.connect();
    
    await this.client.request({
      command: 'subscribe',
      accounts: [address]
    });
    
    this.client.on('transaction', (tx) => this.handleTransaction(tx));
  }

  async handleTransaction(tx) {
    const transaction = tx.transaction || tx;
    
    if (!transaction || !transaction.TransactionType) {
      return;
    }
    
    if (transaction.TransactionType === 'NFTokenAcceptOffer') {
      const offerId = transaction.NFTokenSellOffer || transaction.NFTokenBuyOffer;
      await this.handleOfferAcceptance(offerId, transaction);
    }
  }

  async handleOfferAcceptance(offerId, transaction) {
    try {
      await NFTOffer.findOneAndUpdate(
        { offerId },
        { status: 'ACCEPTED', acceptedTxHash: transaction.hash },
        { upsert: true }
      );

      const offer = await NFTOffer.findOne({ offerId }).lean();

      if (offer) {
        await NFT.findOneAndUpdate(
          { tokenId: offer.tokenId },
          { currentOwner: offer.destination },
          { upsert: true }
        );

        this.emit('offerAccepted', {
          tokenId: offer.tokenId,
          offerId,
          acceptedTx: transaction.hash
        });
      }
    } catch (error) {
      console.error('Error handling offer acceptance:', error);
    }
  }

  hexEncode(str) {
    return Buffer.from(str, 'utf8').toString('hex').toUpperCase();
  }

  hexDecode(hex) {
    return Buffer.from(hex, 'hex').toString('utf8');
  }

  async mintNFT({ uri, sku, taxon, transferFee = 0 }) {
    this.ensureIssuerConfigured();
    if (!this.client?.isConnected()) await this.connect();
    
    const wallet = xrpl.Wallet.fromSeed(this.issuerSeed);
    
    const mintTx = {
      TransactionType: 'NFTokenMint',
      Account: this.issuerAddress,
      Flags: xrpl.NFTokenMintFlags.tfTransferable | xrpl.NFTokenMintFlags.tfBurnable,
      NFTokenTaxon: taxon,
      TransferFee: transferFee,
      Memos: [{
        Memo: {
          MemoType: this.hexEncode('sku'),
          MemoData: this.hexEncode(String(sku || ''))
        }
      }]
    };

    // Only include URI if provided and non-empty
    if (uri && String(uri).trim().length > 0) {
      mintTx.URI = this.hexEncode(String(uri));
    }

    const prepared = await this.client.autofill(mintTx);
    const signed = wallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);
    
    if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`Mint failed: ${result.result.meta.TransactionResult}`);
    }

    const nfts = result.result.meta.CreatedNodes?.filter(
      node => node.CreatedNode?.LedgerEntryType === 'NFTokenPage'
    );
    
    const tokenId = this.extractTokenId(result.result.meta);
    
    return {
      tokenId,
      txHash: result.result.hash,
      ledgerIndex: result.result.ledger_index
    };
  }

  extractTokenId(meta) {
    const affectedNodes = meta.AffectedNodes || [];
    
    for (const node of affectedNodes) {
      const nodeData = node.CreatedNode || node.ModifiedNode;
      if (nodeData?.LedgerEntryType === 'NFTokenPage') {
        const prevTokens = nodeData.PreviousFields?.NFTokens || [];
        const finalTokens = nodeData.FinalFields?.NFTokens || nodeData.NewFields?.NFTokens || [];
        
        // Find the newly added token
        for (const token of finalTokens) {
          const tokenId = token.NFToken?.NFTokenID;
          const isNew = !prevTokens.some(prev => 
            prev.NFToken?.NFTokenID === tokenId
          );
          if (isNew && tokenId) {
            return tokenId;
          }
        }
      }
    }
    
    // Fallback: if only one NFT in the page, return it
    for (const node of affectedNodes) {
      const nodeData = node.CreatedNode || node.ModifiedNode;
      if (nodeData?.LedgerEntryType === 'NFTokenPage') {
        const tokens = nodeData.FinalFields?.NFTokens || nodeData.NewFields?.NFTokens;
        if (tokens && tokens.length === 1) {
          return tokens[0].NFToken.NFTokenID;
        }
      }
    }
    
    throw new Error('Could not extract token ID from transaction');
  }

  async createOffer({ tokenId, destination, amountDrops = '0', expiration = null }) {
    if (!this.client?.isConnected()) await this.connect();
    
    const wallet = xrpl.Wallet.fromSeed(this.issuerSeed);
    
    const offerTx = {
      TransactionType: 'NFTokenCreateOffer',
      Account: this.issuerAddress,
      NFTokenID: tokenId,
      Amount: amountDrops,
      Flags: xrpl.NFTokenCreateOfferFlags.tfSellNFToken,
      Destination: destination
    };

    if (expiration) {
      offerTx.Expiration = expiration;
    }

    // Demo mode: if destination not funded, skip on-ledger offer creation, just return a mock offer
    try {
      const prepared = await this.client.autofill(offerTx);
      const signed = wallet.sign(prepared);
      const result = await this.client.submitAndWait(signed.tx_blob);
      if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
        throw new Error(`Offer creation failed: ${result.result.meta.TransactionResult}`);
      }
    } catch (e) {
      if ((e?.message || '').includes('NO_DST') || (e?.data?.error === 'actNotFound')) {
        return { offerId: `mock-${tokenId.slice(-6)}-${Date.now()}`, txHash: 'mock' };
      }
      throw e;
    }

    const offerId = this.extractOfferId(result.result.meta);
    
    return {
      offerId,
      txHash: result.result.hash
    };
  }

  extractOfferId(meta) {
    const affectedNodes = meta.AffectedNodes || [];
    
    for (const node of affectedNodes) {
      if (node.CreatedNode?.LedgerEntryType === 'NFTokenOffer') {
        return node.CreatedNode.LedgerIndex;
      }
    }
    
    throw new Error('Could not extract offer ID from transaction');
  }

  async getNFTInventory(address, issuerOnly = true) {
    if (!this.client?.isConnected()) await this.connect();
    
    const response = await this.client.request({
      command: 'account_nfts',
      account: address,
      ledger_index: 'validated'
    });

    let nfts = response.result.account_nfts || [];
    
    if (issuerOnly) {
      nfts = nfts.filter(nft => nft.Issuer === this.issuerAddress);
    }

    return nfts.map(nft => ({
      tokenId: nft.NFTokenID,
      issuer: nft.Issuer,
      taxon: nft.NFTokenTaxon,
      uri: this.hexDecode(nft.URI || ''),
      flags: nft.Flags
    }));
  }

  async getAccountInfo(address) {
    if (!this.client?.isConnected()) await this.connect();
    
    const response = await this.client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated'
    });

    return response.result.account_data;
  }

  emit(event, data) {
    if (global.io) {
      global.io.emit(`nft.${event}`, data);
    }
  }
}

module.exports = new XRPLService();