# XRPL Game SDK 🎮

A developer-friendly SDK for integrating XRP Ledger features into games and applications. Perfect for hackathons and rapid prototyping!

## Features ✨

- **NFT Management** - Mint, transfer, and manage NFTs on XRPL
- **Escrow Trading** - Secure peer-to-peer trading with escrows
- **RLUSD Support** - Ready for Ripple's stablecoin integration
- **DID Integration** - Decentralized identity management
- **Simple API** - Clean, promise-based interface
- **TypeScript Ready** - Full type support (coming soon)

## Quick Start 🚀

```bash
npm install xrpl-game-sdk
```

```javascript
const XRPLGameSDK = require('xrpl-game-sdk');

// Initialize
const sdk = new XRPLGameSDK({
  serverUrl: 'http://localhost:3002',
  networkUrl: 'wss://s.altnet.rippletest.net:51233'
});

// Connect and use
await sdk.connect();
const wallet = XRPLGameSDK.generateWallet();
sdk.setWallet(wallet);

// Mint an NFT
const nft = await sdk.mintNFT({
  sku: 'legendary_sword',
  metadata: {
    name: 'Legendary Sword',
    description: 'A powerful weapon',
    attributes: [
      { trait_type: 'Damage', value: '100' }
    ]
  }
});
```

## Core Functions 📚

### Wallet Management
```javascript
// Generate new wallet
const wallet = XRPLGameSDK.generateWallet();

// Set wallet from seed
sdk.setWallet('sEd7ySC1kC8mncTPDTxet5zBJEB8RVn');

// Fund from testnet faucet
await sdk.fundWallet();

// Check balance
const balance = await sdk.getBalance();
```

### NFT Operations
```javascript
// Mint NFT (server-side)
const result = await sdk.mintNFT({
  sku: 'item_001',
  buyerAddress: 'rAddress...',
  metadata: { name: 'Item', description: 'Description' }
});

// Accept NFT offer (client-side)
await sdk.acceptNFTOffer(offerId);

// Transfer NFT
await sdk.transferNFT(tokenId, destinationAddress, price);

// Get inventory
const nfts = await sdk.getNFTInventory(address);
```

### Escrow Trading
```javascript
// Create escrow
const escrow = await sdk.createEscrow({
  destination: 'rAddress...',
  amount: '1000000', // drops
  condition: 'A025...',
  finishAfter: timestamp
});

// Finish escrow
await sdk.finishEscrow({
  owner: escrow.owner,
  offerSequence: escrow.sequence,
  fulfillment: 'A025...'
});
```

### Payments
```javascript
// Send XRP
await sdk.sendPayment({
  destination: 'rAddress...',
  amount: '10', // XRP
  memo: 'Payment for item'
});

// Send RLUSD (when available)
await sdk.sendToken({
  destination: 'rAddress...',
  amount: '10',
  currency: 'RLUSD',
  issuer: 'rIssuerAddress...'
});
```

### Decentralized Identity (DID)
```javascript
// Set DID document
await sdk.setDID({
  '@context': 'https://www.w3.org/ns/did/v1',
  id: `did:xrpl:${wallet.address}`,
  verificationMethod: [{
    id: `did:xrpl:${wallet.address}#key-1`,
    type: 'EcdsaSecp256k1VerificationKey2019',
    controller: `did:xrpl:${wallet.address}`,
    publicKeyHex: wallet.publicKey
  }]
});

// Delete DID
await sdk.deleteDID();
```

### Real-time Updates
```javascript
// Subscribe to account transactions
await sdk.subscribeToAccount(address, (tx) => {
  console.log('New transaction:', tx);
});
```

## Examples 💡

Run the included examples:

```bash
# Full demo
npm run examples:full

# Quick NFT example
npm run examples:nft

# Quick payment example
npm run examples:payment
```

## Use Cases 🎯

### Gaming
- In-game item NFTs
- Player-to-player trading
- Tournament prize pools
- Character ownership

### DeFi
- NFT collateralized loans
- Escrow-based swaps
- RLUSD integration
- Micropayments

### Identity
- KYC/AML compliance
- Player profiles
- Achievement verification
- Cross-game identity

## Architecture 🏗️

```
Your Game/App
     ↓
XRPL Game SDK  ←→  Your Server (NFT API)
     ↓
XRP Ledger
```

## Requirements 📋

- Node.js 16+
- XRPL testnet account (free from faucet)
- Server running NFT API (optional)

## Configuration ⚙️

```javascript
const sdk = new XRPLGameSDK({
  serverUrl: 'http://localhost:3002',  // Your NFT server
  networkUrl: 'wss://s.altnet.rippletest.net:51233'  // XRPL node
});
```

## Testing 🧪

1. Get testnet credentials: https://xrpl.org/xrp-testnet-faucet.html
2. Run your NFT server
3. Execute examples

## Contributing 🤝

PRs welcome! Please follow existing code style.

## License 📄

MIT

## Support 💬

- GitHub Issues: [Report bugs](https://github.com/yourusername/xrpl-game-sdk/issues)
- Discord: [Join community](https://discord.gg/xrpl)
- Docs: [XRPL Documentation](https://xrpl.org)

## Hackathon Ready! 🏆

This SDK is designed for the Ripple "Best in Ledger" award, showcasing:
- Easy XRPL integration
- RLUSD support (ready when launched)
- DID implementation
- Escrow functionality
- Developer-friendly API

Build your DeFi MVP in hours, not days!