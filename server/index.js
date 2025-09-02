require("dotenv").config();
const path = require("path");
const express = require("express");
const { WebSocketServer } = require("ws");

const app = express();
const PORT = process.env.PORT || 3000;

const clientDir = path.join(__dirname, "..", "client");
app.use(express.static(clientDir, { extensions: ["html"] }));
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/config", (_req, res) => {
  res.json({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
});

const server = app.listen(PORT, () => console.log("Listening on port " + PORT));
const wss = new WebSocketServer({ server, path: "/ws" });

const rooms = new Map();
const socketRoom = new WeakMap();

function joinRoom(ws, room) {
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);
  socketRoom.set(ws, room);
  const size = rooms.get(room).size;
  ws.send(JSON.stringify({ type: "joined", room, peers: size - 1 }));
  broadcast(room, JSON.stringify({ type: "peer-joined" }), ws);
}

function leaveRoom(ws) {
  const room = socketRoom.get(ws);
  if (!room) return;
  const set = rooms.get(room);
  if (set) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(room);
    else broadcast(room, JSON.stringify({ type: "peer-left" }), ws);
  }
  socketRoom.delete(ws);
}

function broadcast(room, message, except) {
  const set = rooms.get(room);
  if (!set) return;
  for (const peer of set) if (peer !== except && peer.readyState === 1) peer.send(message);
}

wss.on("connection", (ws) => {
  ws.on("message", (buf) => {
    let msg;
    try { msg = JSON.parse(buf.toString()); } catch { return; }
    if (msg.type === "join" && msg.room) return joinRoom(ws, msg.room);
    const room = socketRoom.get(ws);
    if (!room) return;
    if (["offer","answer","candidate","chat"].includes(msg.type))
      broadcast(room, JSON.stringify(msg), ws);
    if (msg.type === "leave") leaveRoom(ws);
  });
  ws.on("close", () => leaveRoom(ws));
});
