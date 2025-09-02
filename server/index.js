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
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json());

// Serve static client
const clientDir = path.join(__dirname, '..', 'client');
app.use(express.static(clientDir, { extensions: ['html'] }));

// ---- In-memory call history ----
// Every item: { room, startedAt, endedAt, durationSec, participantsMax }
const history = [];

function addHistoryStart(room) {
  const now = Date.now();
  const item = { room, startedAt: now, endedAt: null, durationSec: null, participantsMax: 1 };
  history.push(item);
  return item;
}
function addHistoryEnd(room) {
  // find last entry of this room without endedAt
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item.room === room && item.endedAt === null) {
      item.endedAt = Date.now();
      item.durationSec = Math.max(1, Math.round((item.endedAt - item.startedAt)/1000));
      return item;
    }
  }
  return null;
}

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

// History endpoints
app.get('/history', (_req, res) => {
  // Return last 100 items
  const last = history.slice(-100).map(i => ({
    room: i.room,
    startedAt: i.startedAt,
    endedAt: i.endedAt,
    durationSec: i.durationSec,
    participantsMax: i.participantsMax,
  }));
  res.json(last);
});
app.delete('/history', (_req, res) => {
  history.length = 0;
  res.json({ ok: true });
});

const server = app.listen(PORT, () => {
  console.log(`VideoCall: HTTP server on http://0.0.0.0:${PORT}`);
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
  if (!rooms.has(room)) {
    rooms.set(room, new Set());
    // new room -> history start
    addHistoryStart(room);
  }
  const set = rooms.get(room);
  set.add(ws);
  socketRoom.set(ws, room);
  // Track max participants
  const item = history.findLast(i => i.room === room && i.endedAt === null);
  if (item) item.participantsMax = Math.max(item.participantsMax, set.size);

  const count = set.size;
  if (count === 1) setRole(ws, 'caller');
  else if (count === 2) {
    setRole(ws, 'callee');
    // Notify both peers ready
    for (const peer of set) {
      try { peer.send(JSON.stringify({ type: 'ready' })); } catch {}
    }
  } else {
    try { ws.send(JSON.stringify({ type: 'full' })); } catch {}
  }
}

function leaveRoom(ws) {
  const room = socketRoom.get(ws);
  if (!room) return;
  const set = rooms.get(room);
  if (set) {
    set.delete(ws);
    if (set.size === 0) {
      rooms.delete(room);
      addHistoryEnd(room);
    } else {
      broadcast(room, JSON.stringify({ type: 'peer-left' }), ws);
    }
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
      broadcast(room, JSON.stringify(msg), ws);
    }
    if (msg.type === 'leave') {
      // Graceful leave by user
      try { ws.send(JSON.stringify({ type: 'bye' })); } catch {}
      leaveRoom(ws);
      try { ws.close(); } catch {}
    }
  });

  ws.on('close', () => leaveRoom(ws));
  ws.on('error', () => leaveRoom(ws));
});
