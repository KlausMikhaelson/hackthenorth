/**
 * XRPL Game SDK
 * Developer-friendly SDK for integrating XRPL features into games and applications
 * Supports NFTs, Escrows, RLUSD payments, and DIDs
 */

const xrpl = require('xrpl');

class XRPLGameSDK {
  constructor(config = {}) {
    this.serverUrl = config.serverUrl || 'http://localhost:3002';
    this.networkUrl = config.networkUrl || 'wss://s.altnet.rippletest.net:51233';
    this.client = null;
    this.wallet = null;
  }

  /**
   * Initialize XRPL client connection
   */
  async connect() {
    if (!this.client || !this.client.isConnected()) {
      this.client = new xrpl.Client(this.networkUrl);
      await this.client.connect();
    }
    return this.client;
  }

  /**
   * Set user wallet from seed or mnemonic
   */
  setWallet(seedOrWallet) {
    if (typeof seedOrWallet === 'string') {
      this.wallet = xrpl.Wallet.fromSeed(seedOrWallet);
    } else {
      this.wallet = seedOrWallet;
    }
    return this.wallet;
  }

  /**
   * Get wallet balance
   */
  async getBalance(address) {
    await this.connect();
    try {
      const response = await this.client.request({
        command: 'account_info',
        account: address || this.wallet?.address,
        ledger_index: 'validated'
      });
      return {
        xrp: xrpl.dropsToXrp(response.result.account_data.Balance),
        drops: response.result.account_data.Balance
      };
    } catch (error) {
      if (error.data?.error === 'actNotFound') {
        return { xrp: '0', drops: '0' };
      }
      throw error;
    }
  }

  // ========== NFT FUNCTIONS ==========

  /**
   * Mint an NFT (server-side minting)
   */
  async mintNFT(params) {
    const response = await fetch(`${this.serverUrl}/api/nft/mint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotencyKey: params.idempotencyKey || `mint-${Date.now()}`,
        userId: params.userId,
        xrplAddress: params.buyerAddress || this.wallet?.address,
        sku: params.sku,
        metadata: params.metadata
      })
    });
    return response.json();
  }

  /**
   * Accept an NFT offer (client-side signing)
   */
  async acceptNFTOffer(offerId) {
    if (!this.wallet) throw new Error('Wallet not set');
    await this.connect();

    const acceptTx = {
      TransactionType: 'NFTokenAcceptOffer',
      Account: this.wallet.address,
      NFTokenSellOffer: offerId
    };

    const prepared = await this.client.autofill(acceptTx);
    const signed = this.wallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);
    
    return {
      success: result.result.meta.TransactionResult === 'tesSUCCESS',
      txHash: result.result.hash,
      result: result.result
    };
  }

  /**
   * Get NFT inventory for an address
   */
  async getNFTInventory(address) {
    const response = await fetch(
      `${this.serverUrl}/api/nft/inventory?address=${address || this.wallet?.address}`
    );
    return response.json();
  }

  /**
   * Get NFT metadata
   */
  async getNFTMetadata(tokenId) {
    const response = await fetch(`${this.serverUrl}/api/nft/metadata/${tokenId}`);
    return response.json();
  }

  /**
   * Transfer NFT to another address
   */
  async transferNFT(tokenId, destinationAddress, price = '0') {
    if (!this.wallet) throw new Error('Wallet not set');
    await this.connect();

    const offerTx = {
      TransactionType: 'NFTokenCreateOffer',
      Account: this.wallet.address,
      NFTokenID: tokenId,
      Amount: price,
      Destination: destinationAddress,
      Flags: xrpl.NFTokenCreateOfferFlags.tfSellNFToken
    };

    const prepared = await this.client.autofill(offerTx);
    const signed = this.wallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

    return {
      success: result.result.meta.TransactionResult === 'tesSUCCESS',
      offerId: this.extractOfferId(result.result.meta),
      txHash: result.result.hash
    };
  }

  // ========== ESCROW FUNCTIONS ==========

  /**
   * Create an escrow for NFT trading with XRP/RLUSD
   */
  async createEscrow(params) {
    if (!this.wallet) throw new Error('Wallet not set');
    await this.connect();

    const escrowTx = {
      TransactionType: 'EscrowCreate',
      Account: this.wallet.address,
      Destination: params.destination,
      Amount: params.amount,
      Condition: params.condition,
      DestinationTag: params.destinationTag,
      FinishAfter: params.finishAfter || Math.floor(Date.now() / 1000) + 86400
    };

    if (params.cancelAfter) {
      escrowTx.CancelAfter = params.cancelAfter;
    }

    const prepared = await this.client.autofill(escrowTx);
    const signed = this.wallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

    return {
      success: result.result.meta.TransactionResult === 'tesSUCCESS',
      escrowId: this.extractEscrowId(result.result),
      txHash: result.result.hash
    };
  }

  /**
   * Finish an escrow
   */
  async finishEscrow(params) {
    if (!this.wallet) throw new Error('Wallet not set');
    await this.connect();

    const finishTx = {
      TransactionType: 'EscrowFinish',
      Account: this.wallet.address,
      Owner: params.owner,
      OfferSequence: params.offerSequence,
      Condition: params.condition,
      Fulfillment: params.fulfillment
    };

    const prepared = await this.client.autofill(finishTx);
    const signed = this.wallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

    return {
      success: result.result.meta.TransactionResult === 'tesSUCCESS',
      txHash: result.result.hash
    };
  }

  /**
   * Cancel an escrow
   */
  async cancelEscrow(params) {
    if (!this.wallet) throw new Error('Wallet not set');
    await this.connect();

    const cancelTx = {
      TransactionType: 'EscrowCancel',
      Account: this.wallet.address,
      Owner: params.owner,
      OfferSequence: params.offerSequence
    };

    const prepared = await this.client.autofill(cancelTx);
    const signed = this.wallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

    return {
      success: result.result.meta.TransactionResult === 'tesSUCCESS',
      txHash: result.result.hash
    };
  }

  // ========== PAYMENT FUNCTIONS ==========

  /**
   * Send XRP payment
   */
  async sendPayment(params) {
    if (!this.wallet) throw new Error('Wallet not set');
    await this.connect();

    const paymentTx = {
      TransactionType: 'Payment',
      Account: this.wallet.address,
      Destination: params.destination,
      Amount: xrpl.xrpToDrops(params.amount),
      DestinationTag: params.destinationTag
    };

    if (params.memo) {
      paymentTx.Memos = [{
        Memo: {
          MemoData: Buffer.from(params.memo).toString('hex').toUpperCase()
        }
      }];
    }

    const prepared = await this.client.autofill(paymentTx);
    const signed = this.wallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

    return {
      success: result.result.meta.TransactionResult === 'tesSUCCESS',
      txHash: result.result.hash,
      result: result.result
    };
  }

  /**
   * Send RLUSD or other token payment
   */
  async sendToken(params) {
    if (!this.wallet) throw new Error('Wallet not set');
    await this.connect();

    const tokenAmount = {
      currency: params.currency || 'RLUSD',
      value: params.amount,
      issuer: params.issuer
    };

    const paymentTx = {
      TransactionType: 'Payment',
      Account: this.wallet.address,
      Destination: params.destination,
      Amount: tokenAmount,
      DestinationTag: params.destinationTag
    };

    const prepared = await this.client.autofill(paymentTx);
    const signed = this.wallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

    return {
      success: result.result.meta.TransactionResult === 'tesSUCCESS',
      txHash: result.result.hash
    };
  }

  // ========== DID FUNCTIONS ==========

  /**
   * Create or update DID document
   */
  async setDID(didDocument) {
    if (!this.wallet) throw new Error('Wallet not set');
    await this.connect();

    const didTx = {
      TransactionType: 'DIDSet',
      Account: this.wallet.address,
      Data: Buffer.from(JSON.stringify(didDocument)).toString('hex').toUpperCase(),
      DIDDocument: Buffer.from(JSON.stringify(didDocument)).toString('hex').toUpperCase()
    };

    const prepared = await this.client.autofill(didTx);
    const signed = this.wallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

    return {
      success: result.result.meta.TransactionResult === 'tesSUCCESS',
      txHash: result.result.hash
    };
  }

  /**
   * Delete DID
   */
  async deleteDID() {
    if (!this.wallet) throw new Error('Wallet not set');
    await this.connect();

    const didTx = {
      TransactionType: 'DIDDelete',
      Account: this.wallet.address
    };

    const prepared = await this.client.autofill(didTx);
    const signed = this.wallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);

    return {
      success: result.result.meta.TransactionResult === 'tesSUCCESS',
      txHash: result.result.hash
    };
  }

  // ========== HELPER FUNCTIONS ==========

  /**
   * Generate new wallet
   */
  static generateWallet() {
    return xrpl.Wallet.generate();
  }

  /**
   * Fund wallet from testnet faucet
   */
  async fundWallet(address) {
    await this.connect();
    const wallet = address ? { address } : this.wallet;
    const result = await this.client.fundWallet(wallet);
    return result;
  }

  /**
   * Subscribe to account transactions
   */
  async subscribeToAccount(address, callback) {
    await this.connect();
    
    await this.client.request({
      command: 'subscribe',
      accounts: [address || this.wallet?.address]
    });

    this.client.on('transaction', callback);
  }

  /**
   * Extract offer ID from transaction metadata
   */
  extractOfferId(meta) {
    const affectedNodes = meta.AffectedNodes || [];
    for (const node of affectedNodes) {
      if (node.CreatedNode?.LedgerEntryType === 'NFTokenOffer') {
        return node.CreatedNode.LedgerIndex;
      }
    }
    return null;
  }

  /**
   * Extract escrow ID from transaction
   */
  extractEscrowId(tx) {
    return {
      owner: tx.Account,
      sequence: tx.Sequence
    };
  }

  /**
   * Disconnect from XRPL
   */
  async disconnect() {
    if (this.client?.isConnected()) {
      await this.client.disconnect();
    }
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = XRPLGameSDK;
}

if (typeof window !== 'undefined') {
  window.XRPLGameSDK = XRPLGameSDK;
}