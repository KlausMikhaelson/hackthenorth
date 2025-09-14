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

io.on("connection", (socket) => {
  socket.on("player:update", (state) => {
    socket.broadcast.emit("player:update", { id: socket.id, ...state });
  });

  socket.on("bullet:fire", (bullet) => {
    socket.broadcast.emit("bullet:fire", { id: socket.id, ...bullet });
  });

  socket.on("disconnect", () => {
    socket.broadcast.emit("player:disconnect", { id: socket.id });
  });
});

httpServer.listen(port, () => {
  console.log(`> Realtime server ready on http://localhost:${port}`);
});


