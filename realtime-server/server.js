const { createServer } = require("http");
const { Server } = require("socket.io");

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3002;

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.statusCode = 200;
    res.end("ok");
    return;
  }
  res.statusCode = 200;
  res.end("realtime-server running");
});

const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
});

// In-memory registry of connected players
// Structure: id -> { id, name, position: {x,y,z}, rotationY }
const players = new Map();

io.on("connection", (socket) => {
  // Send current players to the newly connected client
  socket.emit("players:state", Array.from(players.values()));

  // Handle join with initial state from client
  socket.on("player:join", (state) => {
    const player = {
      id: socket.id,
      name: state?.name || "Guest",
      position: state?.position || { x: 0, y: 1, z: 0 },
      rotationY: state?.rotationY || 0,
    };
    players.set(socket.id, player);
    socket.broadcast.emit("player:join", player);
  });

  socket.on("player:update", (state) => {
    const existing = players.get(socket.id);
    if (existing) {
      if (state?.position) existing.position = state.position;
      if (typeof state?.rotationY === "number") existing.rotationY = state.rotationY;
      if (state?.name) existing.name = state.name;
      players.set(socket.id, existing);
    }
    socket.broadcast.emit("player:update", { id: socket.id, ...state });
  });

  socket.on("bullet:fire", (bullet) => {
    socket.broadcast.emit("bullet:fire", { id: socket.id, ...bullet });
  });

  socket.on("disconnect", () => {
    players.delete(socket.id);
    socket.broadcast.emit("player:disconnect", { id: socket.id });
  });
});

httpServer.listen(port, () => {
  console.log(`> Realtime server ready on http://localhost:${port}`);
});


