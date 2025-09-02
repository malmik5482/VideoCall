require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json());

// ---------- Simple JSON "DB" with safe FS fallback ----------
const dataDir = path.join(__dirname, '..', 'data');
const usersFile = path.join(dataDir, 'users.json');
let memUsers = []; // fallback in-memory

function safeMkdir(dir){
  try { fs.mkdirSync(dir, { recursive: true }); return true; }
  catch (e) { console.error('mkdir failed:', e.message); return false; }
}
function safeRead(file){
  try { return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null; }
  catch (e) { console.error('read failed:', e.message); return null; }
}
function safeWrite(file, data){
  try { fs.writeFileSync(file, data); return true; }
  catch (e) { console.error('write failed:', e.message); return false; }
}

function loadUsers() {
  const txt = safeRead(usersFile);
  if (txt) {
    try { return JSON.parse(txt).users || []; }
    catch { return memUsers; }
  }
  return memUsers;
}
function saveUsers(users) {
  memUsers = users;
  if (!safeMkdir(dataDir)) return;
  safeWrite(usersFile, JSON.stringify({ users }, null, 2));
}
function normalizePhone(phone) {
  return String(phone || '').replace(/\D+/g, '');
}

// ---------- Static client ----------
const clientDir = path.join(__dirname, '..', 'client');
app.use(express.static(clientDir, { extensions: ['html'] }));

// ---------- Health & Config ----------
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

// ---------- Users API ----------
app.post('/api/register', (req, res) => {
  let { phone, name } = req.body || {};
  phone = normalizePhone(phone);
  name = String(name || '').trim().slice(0, 64);
  if (!phone || !name) return res.status(400).json({ error: 'phone and name required' });

  const users = loadUsers();
  let user = users.find(u => u.phone === phone);
  if (!user) {
    user = { id: nanoid(10), phone, name, createdAt: Date.now(), updatedAt: Date.now() };
    users.push(user);
  } else {
    user.name = name;
    user.updatedAt = Date.now();
  }
  saveUsers(users);
  res.json({ ok: true, user });
});

app.get('/api/users', (req, res) => {
  const q = normalizePhone(req.query.phone || '');
  const users = loadUsers();
  const list = users
    .filter(u => q ? u.phone.includes(q) : true)
    .map(u => ({ id: u.id, phone: u.phone, name: u.name }))
    .slice(0, 50);
  res.json(list);
});

app.post('/api/call/start', (req, res) => {
  const me = normalizePhone(req.body.me);
  const target = normalizePhone(req.body.target);
  if (!me || !target) return res.status(400).json({ error: 'me and target required' });
  if (me === target) return res.status(400).json({ error: 'cannot call yourself' });
  const roomId = ['call', me, target].sort().join('-');
  return res.json({ roomId });
});

// ---------- History ----------
const history = [];
function addHistoryStart(room) {
  const now = Date.now();
  const item = { room, startedAt: now, endedAt: null, durationSec: null, participantsMax: 1 };
  history.push(item);
  return item;
}
function addHistoryEnd(room) {
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
app.get('/history', (_req, res) => {
  const last = history.slice(-100).map(i => ({
    room: i.room, startedAt: i.startedAt, endedAt: i.endedAt,
    durationSec: i.durationSec, participantsMax: i.participantsMax
  }));
  res.json(last);
});
app.delete('/history', (_req, res) => { history.length = 0; res.json({ ok: true }); });

// ---------- WebSocket signaling ----------
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`VideoCall: HTTP server http://0.0.0.0:${PORT}`);
});
const wss = new WebSocketServer({ server, path: '/ws' });

const rooms = new Map();
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
  if (!rooms.has(room)) { rooms.set(room, new Set()); addHistoryStart(room); }
  const set = rooms.get(room);
  set.add(ws);
  socketRoom.set(ws, room);

  const item = history.findLast?.(i => i.room === room && i.endedAt === null) ||
               history.slice().reverse().find(i => i.room === room && i.endedAt === null);
  if (item) item.participantsMax = Math.max(item.participantsMax, set.size);

  const count = set.size;
  if (count === 1) setRole(ws, 'caller');
  else if (count === 2) {
    setRole(ws, 'callee');
    for (const peer of set) { try { peer.send(JSON.stringify({ type: 'ready' })); } catch {} }
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
    if (set.size === 0) { rooms.delete(room); addHistoryEnd(room); }
    else broadcast(room, JSON.stringify({ type: 'peer-left' }), ws);
  }
  socketRoom.delete(ws);
}

wss.on('connection', (ws) => {
  ws.on('message', (buf) => {
    let msg = null;
    try { msg = JSON.parse(buf.toString()); } catch { return; }

    if (msg.type === 'join' && msg.room) { joinRoom(ws, msg.room); return; }
    const room = socketRoom.get(ws); if (!room) return;

    if (msg.type === 'description' || msg.type === 'candidate' || msg.type === 'chat') {
      broadcast(room, JSON.stringify(msg), ws);
    }
    if (msg.type === 'leave') {
      try { ws.send(JSON.stringify({ type: 'bye' })); } catch {}
      leaveRoom(ws);
      try { ws.close(); } catch {}
    }
  });
  ws.on('close', () => leaveRoom(ws));
  ws.on('error', () => leaveRoom(ws));
});
