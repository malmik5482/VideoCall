
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

// Health-check маршруты
app.get("/", (req, res) => {
  res.send("VideoCall server is running ✅");
});

app.get("/healthz", (req, res) => {
  res.json({ ok: true });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

io.on("connection", (socket) => {
  console.log("user connected");

  socket.on("join", (room) => {
    socket.join(room);
    console.log("User joined room:", room);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
