const express = require("express");
const { WebSocketServer } = require("ws");
const path = require("path");

const PORT = process.env.PORT || 3000;
const app = express();

// Выдаём статические файлы клиента
app.use(express.static(path.join(__dirname, "../client")));

// Health-check
app.get("/healthz", (req, res) => res.send("ok"));

// ICE config
app.get("/config", (req, res) => {
  try {
    const ice = process.env.ICE_SERVERS ? JSON.parse(process.env.ICE_SERVERS) : [];
    res.json({ iceServers: ice });
  } catch (e) {
    res.json({ iceServers: [] });
  }
});

const server = app.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});

// WebSocket сервер
const wss = new WebSocketServer({ server, path: "/ws" });

let rooms = {};

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === "join") {
        ws.room = data.room;
        if (!rooms[data.room]) rooms[data.room] = [];
        rooms[data.room].push(ws);
        console.log("User joined room", data.room);
      }
      rooms[ws.room]?.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (err) {
      console.error("WS error", err);
    }
  });

  ws.on("close", () => {
    if (ws.room && rooms[ws.room]) {
      rooms[ws.room] = rooms[ws.room].filter((c) => c !== ws);
    }
  });
});
