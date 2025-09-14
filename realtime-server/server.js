require("dotenv").config();
const { createServer } = require("http");
const { Server } = require("socket.io");
const express = require("express");
const cors = require("cors");
const nftRoutes = require("./src/routes/nft.routes");
const userRoutes = require("./src/routes/user.routes");
const assetsRoutes = require("./src/routes/assets.routes");
const xrplService = require("./src/services/xrpl.service");
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
// Structure: roomId -> Map(socketId -> { id, name, position, rotationY, health, score, textureSrc })
const roomPlayers = new Map();

io.on("connection", (socket) => {
  // Join a room first
  socket.on("room:join", ({ roomId }) => {
    if (!roomId || typeof roomId !== "string") return;
    socket.join(roomId);
    socket.data.roomId = roomId;
    if (!roomPlayers.has(roomId)) roomPlayers.set(roomId, new Map());
    // Send existing players in this room only
    const players = Array.from(roomPlayers.get(roomId).values());
    socket.emit("players:state", players);
    socket.emit("room:joined", { roomId });
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


