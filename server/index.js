// Express + ws signaling server (WebSocket path: /ws)
require('dotenv').config();
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static client
const clientDir = path.join(__dirname, '..', 'client');
app.use(express.static(clientDir, { extensions: ['html'] }));

// Health and ICE config
app.get('/', (_req, res) => res.send('VideoCall server is running ✅'));
app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/config', (_req, res) => {
  let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
  try {
    if (process.env.ICE_SERVERS) {
      const parsed = JSON.parse(process.env.ICE_SERVERS);
      if (Array.isArray(parsed)) iceServers = parsed;
    } else if (process.env.TURN_URL && process.env.TURN_USER && process.env.TURN_PASS) {
      iceServers.push({
        urls: process.env.TURN_URL.split(','),
        username: process.env.TURN_USER,
        credential: process.env.TURN_PASS,
      });
    }
  } catch (e) {
    console.error('Failed to parse ICE_SERVERS:', e);
  }
  res.json({ iceServers });
});

const server = app.listen(PORT, () => {
  console.log(`HTTP server on http://localhost:${PORT}`);
});

// WebSocket signaling on /ws
const wss = new WebSocketServer({ server, path: '/ws' });

const rooms = new Map();         // room -> Set<ws>
const socketRoom = new WeakMap(); // ws -> room

function joinRoom(ws, room) {
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);
  socketRoom.set(ws, room);
  const size = rooms.get(room).size;
  try { ws.send(JSON.stringify({ type: 'joined', room, peers: size - 1 })); } catch {}
  broadcast(room, JSON.stringify({ type: 'peer-joined' }), ws);
}
function leaveRoom(ws) {
  const room = socketRoom.get(ws);
  if (!room) return;
  const set = rooms.get(room);
  if (set) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(room);
    else broadcast(room, JSON.stringify({ type: 'peer-left' }), ws);
  }
  socketRoom.delete(ws);
}
function broadcast(room, message, except) {
  const set = rooms.get(room);
  if (!set) return;
  for (const peer of set) {
    if (peer !== except && peer.readyState === 1) {
      try { peer.send(message); } catch {}
    }
  }
}

wss.on('connection', (ws) => {
  ws.on('message', (buf) => {
    let msg = null;
    try { msg = JSON.parse(buf.toString()); } catch { return; }

    if (msg.type === 'join' && msg.room) {
      joinRoom(ws, msg.room);
      return;
    }
    const room = socketRoom.get(ws);
    if (!room) return;

    if (['offer','answer','candidate','chat'].includes(msg.type)) {
      broadcast(room, JSON.stringify(msg), ws);
    }
    if (msg.type === 'leave') leaveRoom(ws);
  });
  ws.on('close', () => leaveRoom(ws));
  ws.on('error', () => leaveRoom(ws));
});
