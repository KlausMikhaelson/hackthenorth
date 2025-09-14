# NFT Server Testing Guide

This guide provides comprehensive steps to test the realtime NFT server with XRPL integration.

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ installed
- PostgreSQL database running
- XRPL testnet wallet (get from https://xrpl.org/xrp-testnet-faucet.html)

### 2. Environment Setup

Create a `.env` file in the `realtime-server` directory:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/htn_nft_db"

# XRPL Configuration (Testnet)
XRPL_RPC_WSS_URL="wss://s.altnet.rippletest.net:51233"
NFT_ISSUER_ADDRESS="rYourTestnetAddressHere"
NFT_ISSUER_SEED="sYourTestnetSeedHere"
NFT_COLLECTION_TAXON_BASE="1000"

# Server
PORT=3002
```

### 3. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Optional: View database in Prisma Studio
npx prisma studio
```

### 4. Start the Server

```bash
npm start
```

The server should output:
```
> Realtime server ready on http://localhost:3002
> XRPL service connected
```

### Manual API Testing

#### 1. Health Check
```bash
curl http://localhost:3002/health
# Expected: "ok"
```

#### 2. Mint NFT
```bash
curl -X POST http://localhost:3002/api/nft/mint \
  -H "Content-Type: application/json" \
  -d '{
    "idempotencyKey": "test-mint-001",
    "xrplAddress": "rDestinationAddressHere",
    "sku": "GAME_ITEM_001",
    "metadata": {
      "name": "Epic Sword",
      "description": "A legendary weapon forged in the fires of Mount Doom",
      "image": "https://example.com/sword.png",
      "attributes": [
        {"trait_type": "Rarity", "value": "Epic"},
        {"trait_type": "Attack", "value": 100}
      ]
    }
  }'
```

Expected response:
```json
{
  "tokenId": "000827...",
  "offerId": "ABC123...",
  "offerStatus": "CREATED",
  "mintTx": "DEF456...",
  "offerTx": "GHI789...",
  "acceptBy": 1694876543
}
```

#### 3. Check Offer Status
```bash
curl http://localhost:3002/api/nft/offers/YOUR_OFFER_ID
```
D0A2976E067915C1D360D39E10FC15A88966E24
  F54125AFF0D2B93E92B706D4B
curl http://localhost:3002/api/nft/offers/D0A2976E067915C1D360D39E10FC15A88966E24F54125AFF0D2B93E92B706D4B

#### 4. Get NFT Inventory
```bash
curl "http://localhost:3002/api/nft/inventory?address=rYourAddressHere&issuerOnly=true"
```
r3TiV7uMR4YT5rmqeEBBmenPQSPqi5V7Hm
curl "http://localhost:3002/api/nft/inventory?address=r3TiV7uMR4YT5rmqeEBBmenPQSPqi5V7Hm&issuerOnly=true"

#### 5. Get NFT Metadata
```bash
curl http://localhost:3002/api/nft/metadata/YOUR_TOKEN_ID
```

#### 6. Create Re-offer
```bash
curl -X POST http://localhost:3002/api/nft/reoffer \
  -H "Content-Type: application/json" \
  -d '{
    "tokenId": "YOUR_TOKEN_ID",
    "destination": "rNewDestinationAddress"
  }'
```

### WebSocket Testing

Use a WebSocket client or the browser console:

```javascript
// Connect to WebSocket
const socket = io('http://localhost:3002');

// Join as a player
socket.emit('player:join', {
  name: 'TestPlayer',
  position: { x: 0, y: 1, z: 0 },
  rotationY: 0
});

// Listen for NFT events
socket.on('nft.offerReady', (data) => {
  console.log('NFT offer ready:', data);
});

socket.on('nft.offerAccepted', (data) => {
  console.log('NFT offer accepted:', data);
});

socket.on('nft.error', (data) => {
  console.log('NFT error:', data);
});

// Listen for player events
socket.on('players:state', (players) => {
  console.log('Current players:', players);
});

socket.on('player:join', (player) => {
  console.log('Player joined:', player);
});
```

## 🔧 XRPL Integration Testing

### 1. Testnet Wallet Setup
1. Visit https://xrpl.org/xrp-testnet-faucet.html
2. Generate a new wallet
3. Fund it with testnet XRP
4. Update your `.env` with the address and seed

### 2. Verify XRPL Connection
The server logs should show:
```
> XRPL service connected
```

### 3. Monitor Transactions
- View transactions on XRPL testnet explorer
- Check NFT creation and offers
- Verify ownership transfers

## 🎮 Game Integration Testing

### Multiplayer Features
1. Open multiple browser tabs to `http://localhost:3002`
2. Connect WebSocket clients
3. Test player movement synchronization
4. Test bullet firing events

### NFT Integration in Game
1. Mint NFTs for players
2. Create offers for in-game items
3. Test real-time notifications when offers are accepted

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Verify PostgreSQL is running
   - Check DATABASE_URL format
   - Ensure database exists

2. **XRPL Connection Failed**
   - Verify testnet wallet has XRP balance
   - Check NFT_ISSUER_ADDRESS and NFT_ISSUER_SEED
   - Ensure testnet is accessible

3. **Mint Fails**
   - Check XRPL account has sufficient XRP for fees
   - Verify account has NFT permissions
   - Check transaction logs

4. **WebSocket Issues**
   - Verify CORS settings
   - Check client-side socket.io version compatibility
   - Monitor server logs for connection errors

### Debug Mode
Set environment variable for verbose logging:
```bash
DEBUG=* npm start
```

## 📊 Monitoring

### Database Queries
```sql
-- Check minted NFTs
SELECT * FROM nfts ORDER BY created_at DESC;

-- Check pending offers
SELECT * FROM nft_offers WHERE status = 'CREATED';

-- Check mint jobs
SELECT * FROM nft_mint_jobs ORDER BY created_at DESC;
```

### XRPL Queries
The server provides methods to query XRPL directly through the service layer.

## 🎯 Production Considerations

Before deploying to production:

1. **Security**
   - Use environment variables for all secrets
   - Implement rate limiting
   - Add authentication/authorization
   - Validate all inputs

2. **Performance**
   - Add database indexing
   - Implement caching
   - Monitor WebSocket connections
   - Add connection pooling

3. **Reliability**
   - Add error handling and retry logic
   - Implement health checks
   - Add monitoring and alerting
   - Use mainnet XRPL endpoints

4. **Scalability**
   - Consider horizontal scaling
   - Implement Redis for session storage
   - Add load balancing for WebSocket connections
