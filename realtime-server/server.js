require("dotenv").config();
const { createServer } = require("http");
const { Server } = require("socket.io");
const express = require("express");
const cors = require("cors");
const nftRoutes = require("./src/routes/nft.routes");
const userRoutes = require("./src/routes/user.routes");
const assetsRoutes = require("./src/routes/assets.routes");
const xrplService = require("./src/services/xrpl.service");
const Room = require("./src/models/Room");
const mongoose = require("mongoose");
const path = require("path");
// Fallback to project root .env if local .env missing MONGO_URI
if (!process.env.MONGO_URI) {
  try {
    require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
  } catch {}
}

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3002;

const app = express();
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));
// Disable ETag to avoid 304 Not Modified on JSON APIs
app.set("etag", false);
app.use("/api/nft", nftRoutes);
app.use("/api/user", userRoutes);
app.use("/api/assets", assetsRoutes);

app.get("/health", (req, res) => {
  res.send("ok");
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
});

global.io = io;

// In-memory registry of connected players, scoped by room
// Structure: roomId -> Map(socketId -> { id, name, address, position, rotationY, health, score, textureSrc })
const roomPlayers = new Map();
// Best-effort username -> wallet address map fed by API lookups from clients
global.lastKnownAddressMap = new Map();

io.on("connection", (socket) => {
  // Join a room first
  socket.on("room:join", ({ roomId }) => {
    if (!roomId || typeof roomId !== "string") return;
    socket.join(roomId);
    socket.data.roomId = roomId;
    if (!roomPlayers.has(roomId)) roomPlayers.set(roomId, new Map());
    // If room record doesn't exist, create it and initialize escrow
    Room.findOne({ roomId }).then(async (doc) => {
      try {
        if (!doc) {
          // Generate condition/fulfillment and create escrow
          const { conditionHex, fulfillmentHex } = xrplService.generateConditionFulfillment();
          const owner = xrplService.issuerAddress;
          const dest = xrplService.issuerAddress; // placeholder; funds held by issuer until winner picked
          const amountXrp = process.env.ROOM_ESCROW_XRP || '1';
          let sequence = null;
          let amountDrops = null;
          try {
            const res = await xrplService.createConditionalEscrow({ destination: dest, amountXrp, cancelAfterSeconds: 24*3600, conditionHex });
            sequence = res.sequence;
            amountDrops = res.amountDrops;
          } catch (e) {
            console.warn("EscrowCreate failed; proceeding without on-ledger escrow in dev:", e?.message || e);
          }
          await Room.create({ roomId, escrowCondition: conditionHex, escrowFulfillment: fulfillmentHex, escrowOwner: owner, escrowSequence: sequence, amountDrops, status: 'OPEN' });
        }
      } catch (e) {
        console.error('room init error', e);
      }
    });
    // Send existing players in this room only
    const players = Array.from(roomPlayers.get(roomId).values());
    socket.emit("players:state", players);
    socket.emit("room:joined", { roomId });
  });

  // Best-effort map from username to XRPL address for winner payout mapping.
  // Also, when known, attach address onto the player's server-side record.
  socket.on('user:address', ({ username, address }) => {
    if (typeof username === 'string' && typeof address === 'string') {
      global.lastKnownAddressMap.set(username, address);
      const roomId = socket.data.roomId;
      if (roomId && roomPlayers.has(roomId)) {
        const playersMap = roomPlayers.get(roomId);
        const existing = playersMap.get(socket.id);
        if (existing) {
          existing.address = address;
          playersMap.set(socket.id, existing);
        }
      }
    }
  });

  // Handle join with initial state from client (after room join)
  socket.on("player:join", (state) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const playersMap = roomPlayers.get(roomId) || new Map();
    roomPlayers.set(roomId, playersMap);
    const player = {
      id: socket.id,
      name: state?.name || "Guest",
      address: typeof state?.address === 'string' ? state.address : undefined,
      position: state?.position || { x: 0, y: 1, z: 0 },
      rotationY: state?.rotationY || 0,
      health: 100,
      score: 0,
      textureSrc: state?.textureSrc || null,
    };
    playersMap.set(socket.id, player);
    socket.to(roomId).emit("player:join", player);
  });

  socket.on("player:update", (state) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const playersMap = roomPlayers.get(roomId);
    if (playersMap) {
      const existing = playersMap.get(socket.id);
      if (existing) {
        if (state?.position) existing.position = state.position;
        if (typeof state?.rotationY === "number") existing.rotationY = state.rotationY;
        if (state?.name) existing.name = state.name;
        if (typeof state?.health === "number") existing.health = state.health;
        if (typeof state?.score === "number") existing.score = state.score;
        if (typeof state?.textureSrc === "string") existing.textureSrc = state.textureSrc;
        playersMap.set(socket.id, existing);
      }
    }
    socket.to(roomId).emit("player:update", { id: socket.id, ...state });
  });

  socket.on("bullet:fire", (bullet) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit("bullet:fire", { id: socket.id, ...bullet });
  });

  // Client tells server a hit happened; server updates health and broadcasts
  socket.on("player:hit", ({ targetId, damage }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const playersMap = roomPlayers.get(roomId);
    if (!playersMap) return;
    const target = playersMap.get(targetId);
    if (!target) return;
    const dmg = typeof damage === "number" && damage > 0 ? damage : 10;
    target.health = Math.max(0, (target.health ?? 100) - dmg);
    playersMap.set(targetId, target);
    io.to(roomId).emit("player:health", { id: targetId, health: target.health });
    // Award score to shooter and broadcast within room
    const shooter = playersMap.get(socket.id);
    if (shooter) {
      shooter.score = (shooter.score ?? 0) + 1;
      playersMap.set(socket.id, shooter);
      io.to(roomId).emit("player:score", { id: socket.id, score: shooter.score });
    }
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const playersMap = roomPlayers.get(roomId);
    if (!playersMap) return;
    playersMap.delete(socket.id);
    socket.to(roomId).emit("player:disconnect", { id: socket.id });
    // If only one player remains and room had at least 2 earlier, mark winner
    const remaining = playersMap.size;
    if (remaining === 1) {
      const [winnerId] = playersMap.keys();
      const winner = playersMap.get(winnerId);
      // Prefer directly stored player address; fall back to username->address map
      const winnerAddress = (winner && typeof winner.address === 'string' && winner.address)
        || global.lastKnownAddressMap?.get(winner?.name)
        || null;
      Room.findOneAndUpdate({ roomId, status: 'OPEN' }, { status: 'COMPLETED', winnerAddress }, { new: true }).then(async (doc) => {
        try {
          if (doc?.escrowOwner && doc?.escrowSequence && doc?.escrowFulfillment) {
            // Finish escrow (release funds) — requires fulfillment
            await xrplService.finishConditionalEscrow({ owner: doc.escrowOwner, sequence: doc.escrowSequence, fulfillmentHex: doc.escrowFulfillment });
          }
        } catch (e) {
          console.error('escrow finish error', e);
        }
      });
    }
  });
});

httpServer.listen(port, async () => {
  console.log(`> Realtime server ready on http://localhost:${port}`);
  try {
    const uri = process.env.MONGO_URI;
    if (uri) {
      await mongoose.connect(uri, { dbName: process.env.MONGO_DB || undefined });
      console.log("> Mongo connected", mongoose.connection.host + "/" + mongoose.connection.name);
    } else {
      console.warn("MONGO_URI not set; running without DB");
    }
    await xrplService.connect();
    console.log("> XRPL service connected");
  } catch (error) {
    console.error("Failed to connect to XRPL:", error);
  }
});


