require('dotenv').config();
const path = require('path');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(compression());
app.use(cors());

// Serve static client (index.html at /)
const clientDir = path.join(__dirname, '..', 'client');
app.use(express.static(clientDir, { extensions: ['html'] }));

// Health and ICE endpoints
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
    console.error('Failed to parse ICE_SERVERS:', e?.message);
  }
  res.json({ iceServers });
});

const server = app.listen(PORT, () => {
  console.log(`VideoCall: HTTP server listening on http://0.0.0.0:${PORT}`);
});

// ---- WebSocket signaling (path /ws) ----
const wss = new WebSocketServer({ server, path: '/ws' });

// room -> Set<ws>
const rooms = new Map();
// ws -> room
const socketRoom = new WeakMap();

function broadcast(room, payload, except) {
  const set = rooms.get(room);
  if (!set) return;
  for (const peer of set) {
    if (peer !== except && peer.readyState === 1) {
      try { peer.send(payload); } catch {}
    }
  }
}

function setRole(ws, role) {
  try { ws.send(JSON.stringify({ type: 'role', role })); } catch {}
}

function joinRoom(ws, room) {
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);
  socketRoom.set(ws, room);

  const count = rooms.get(room).size;
  // First peer becomes caller, second becomes callee
  if (count === 1) setRole(ws, 'caller');
  else if (count === 2) {
    setRole(ws, 'callee');
    // Tell both peers to start (caller will create offer)
    for (const peer of rooms.get(room)) {
      try { peer.send(JSON.stringify({ type: 'ready' })); } catch {}
    }
  } else {
    // More than 2: reject (one‑to‑one room)
    try { ws.send(JSON.stringify({ type: 'full' })); } catch {}
  }
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

    if (msg.type === 'description' || msg.type === 'candidate' || msg.type === 'chat') {
      // Relay to the other peer
      broadcast(room, JSON.stringify(msg), ws);
    }

    if (msg.type === 'leave') leaveRoom(ws);
  });

  ws.on('close', () => leaveRoom(ws));
  ws.on('error', () => leaveRoom(ws));
});
