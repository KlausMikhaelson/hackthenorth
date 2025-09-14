/**
 * XRPL Game SDK - Usage Examples
 * Shows how developers can easily integrate XRPL features
 */

const XRPLGameSDK = require('./xrpl-game-sdk');

async function examples() {
  // Initialize SDK
  const sdk = new XRPLGameSDK({
    serverUrl: 'http://localhost:3002',
    networkUrl: 'wss://s.altnet.rippletest.net:51233'
  });

  try {
    // Connect to XRPL
    await sdk.connect();
    console.log('✅ Connected to XRPL');

    // ========== EXAMPLE 1: Generate and Fund Wallet ==========
    console.log('\n📝 Example 1: Wallet Setup');
    
    // Generate new wallet
    const wallet = XRPLGameSDK.generateWallet();
    console.log('New wallet address:', wallet.address);
    
    // Set wallet in SDK
    sdk.setWallet(wallet);
    
    // Fund from testnet faucet
    console.log('Funding wallet from faucet...');
    await sdk.fundWallet();
    
    // Check balance
    const balance = await sdk.getBalance();
    console.log('Balance:', balance.xrp, 'XRP');

    // ========== EXAMPLE 2: Mint and Trade NFT ==========
    console.log('\n🎮 Example 2: NFT Minting');
    
    // Mint an NFT for a game item
    const mintResult = await sdk.mintNFT({
      sku: 'sword_legendary_001',
      buyerAddress: wallet.address,
      metadata: {
        name: 'Legendary Sword of Flames',
        description: 'A powerful weapon forged in dragon fire',
        image: 'ipfs://QmXxx.../sword.png',
        attributes: [
          { trait_type: 'Damage', value: '150' },
          { trait_type: 'Element', value: 'Fire' },
          { trait_type: 'Rarity', value: 'Legendary' }
        ]
      }
    });
    
    console.log('NFT Minted!');
    console.log('Token ID:', mintResult.tokenId);
    console.log('Offer ID:', mintResult.offerId);
    
    // Accept the NFT offer
    console.log('Accepting NFT offer...');
    const acceptResult = await sdk.acceptNFTOffer(mintResult.offerId);
    console.log('NFT received:', acceptResult.success);

    // ========== EXAMPLE 3: Create Escrow for Trading ==========
    console.log('\n💱 Example 3: Escrow Trading');
    
    // Create escrow for NFT trade (10 XRP)
    const escrowResult = await sdk.createEscrow({
      destination: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
      amount: '10000000', // 10 XRP in drops
      condition: 'A02580203B6B51602EA8B59D320CF0C2539BF1F9493105D47EC6CEFE3728290FE949734C810120', // Example condition
      finishAfter: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
    });
    
    console.log('Escrow created:', escrowResult.escrowId);

    // ========== EXAMPLE 4: Send Payments ==========
    console.log('\n💰 Example 4: Payments');
    
    // Send XRP payment
    const paymentResult = await sdk.sendPayment({
      destination: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
      amount: '1', // 1 XRP
      memo: 'Payment for game item'
    });
    
    console.log('Payment sent:', paymentResult.txHash);

    // Send RLUSD token payment (when available)
    /*
    const tokenResult = await sdk.sendToken({
      destination: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
      amount: '10',
      currency: 'RLUSD',
      issuer: 'rRLUSDIssuerAddress...'
    });
    console.log('RLUSD sent:', tokenResult.txHash);
    */

    // ========== EXAMPLE 5: NFT Inventory ==========
    console.log('\n📦 Example 5: Check Inventory');
    
    const inventory = await sdk.getNFTInventory(wallet.address);
    console.log('NFTs owned:', inventory.length);
    inventory.forEach(nft => {
      console.log(`- ${nft.name || nft.sku} (${nft.tokenId})`);
    });

    // ========== EXAMPLE 6: Subscribe to Events ==========
    console.log('\n🔔 Example 6: Real-time Updates');
    
    await sdk.subscribeToAccount(wallet.address, (tx) => {
      console.log('New transaction:', tx.transaction.TransactionType);
    });

    // ========== EXAMPLE 7: DID Management ==========
    console.log('\n🆔 Example 7: Decentralized Identity');
    
    const didResult = await sdk.setDID({
      '@context': 'https://www.w3.org/ns/did/v1',
      id: `did:xrpl:${wallet.address}`,
      verificationMethod: [{
        id: `did:xrpl:${wallet.address}#key-1`,
        type: 'EcdsaSecp256k1VerificationKey2019',
        controller: `did:xrpl:${wallet.address}`,
        publicKeyHex: wallet.publicKey
      }],
      authentication: [`did:xrpl:${wallet.address}#key-1`]
    });
    
    console.log('DID set:', didResult.success);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await sdk.disconnect();
    console.log('\n👋 Disconnected from XRPL');
  }
}

// ========== QUICK START EXAMPLES ==========

async function quickStartNFT() {
  const sdk = new XRPLGameSDK();
  await sdk.connect();
  
  // Simple NFT mint
  const result = await sdk.mintNFT({
    sku: 'item_001',
    buyerAddress: 'rBuyerAddress...',
    metadata: {
      name: 'Cool Item',
      description: 'A cool game item'
    }
  });
  
  console.log('Minted:', result.tokenId);
  await sdk.disconnect();
}

async function quickStartPayment() {
  const sdk = new XRPLGameSDK();
  sdk.setWallet('sYourSeedHere');
  await sdk.connect();
  
  // Send payment
  const result = await sdk.sendPayment({
    destination: 'rRecipientAddress...',
    amount: '10'
  });
  
  console.log('Sent:', result.txHash);
  await sdk.disconnect();
}

// Run examples if called directly
if (require.main === module) {
  console.log('🚀 XRPL Game SDK Examples\n');
  console.log('Choose an example:');
  console.log('1. Full examples (npm run examples:full)');
  console.log('2. Quick NFT (npm run examples:nft)');
  console.log('3. Quick Payment (npm run examples:payment)');
  
  // Uncomment to run:
  // examples();
  // quickStartNFT();
  // quickStartPayment();
}

module.exports = { examples, quickStartNFT, quickStartPayment };