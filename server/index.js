
const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Build ICE from ENV:
// Priority: ICE_JSON (full JSON array) -> ICE_URLS (comma list) + optional TURN_USER/TURN_PASS -> default STUN
function buildIceServers() {
  const j = process.env.ICE_JSON;
  if (j) {
    try { 
      const arr = JSON.parse(j);
      if (Array.isArray(arr)) return arr;
    } catch {}
  }
  const urlsRaw = (process.env.ICE_URLS || '').trim();
  if (urlsRaw) {
    const urls = urlsRaw.split(',').map(s => s.trim()).filter(Boolean);
    const user = process.env.TURN_USER || '';
    const pass = process.env.TURN_PASS || '';
    // If TURN creds provided, include one TURN object with both URLs that include 'turn:'
    const stunServers = urls.filter(u => u.startsWith('stun:')).map(u => ({ urls: u }));
    const turnUrls = urls.filter(u => u.startsWith('turn:'));
    const res = [...stunServers];
    if (turnUrls.length) {
      const turnObj = { urls: turnUrls };
      if (user) turnObj.username = user;
      if (pass) turnObj.credential = pass;
      res.push(turnObj);
    }
    return res.length ? res : [{ urls: 'stun:stun.l.google.com:19302' }];
  }
  return [{ urls: 'stun:stun.l.google.com:19302' }];
}

// In-memory history
const history = []; // {room, startedAt, endedAt, durationSec, participantsMax}
const rooms = new Map(); // roomId -> Set<WebSocket>

function ensureRoom(room) {
  if (!rooms.has(room)) rooms.set(room, new Set());
  return rooms.get(room);
}
function updateHistory(room) {
  const set = rooms.get(room);
  let rec = history.find(r => r.room === room && !r.endedAt);
  if (!rec) {
    rec = { room, startedAt: Date.now(), participantsMax: 0, endedAt: null, durationSec: null };
    history.push(rec);
  }
  rec.participantsMax = Math.max(rec.participantsMax, set ? set.size : 0);
  if (!set || set.size === 0) {
    rec.endedAt = Date.now();
    rec.durationSec = Math.round((rec.endedAt - rec.startedAt)/1000);
  }
}

app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.get('/config', (_req, res) => res.json({ iceServers: buildIceServers() }));
app.get('/history', (_req, res) => res.json(history.slice(-50)));

// Serve client
app.use(express.static(path.join(__dirname, '..', 'client')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'client', 'index.html')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function heartbeat() { this.isAlive = true; }
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', heartbeat);
  ws.room = null;

  ws.sendJSON = (o) => { try { ws.send(JSON.stringify(o)); } catch {} };

  ws.on('message', (buf) => {
    let msg = null;
    try { msg = JSON.parse(buf.toString()); } catch { return; }

    if (msg.type === 'join') {
      const room = String(msg.room || 'demo');
      const set = ensureRoom(room);
      if (set.size >= 2) { ws.sendJSON({ type:'full' }); return; }
      set.add(ws);
      ws.room = room;
      updateHistory(room);
      if (set.size === 2) {
        for (const peer of set) peer.sendJSON({ type:'ready' });
      }
      return;
    }

    if (!ws.room) return;
    const set = rooms.get(ws.room);
    if (!set) return;

    if (msg.type === 'leave') {
      set.delete(ws);
      for (const peer of set) peer.sendJSON({ type:'peer-left' });
      if (set.size === 0) rooms.delete(ws.room);
      updateHistory(ws.room);
      ws.room = null;
      return;
    }

    if (['description','candidate','chat'].includes(msg.type)) {
      for (const peer of set) {
        if (peer !== ws) peer.sendJSON(msg);
      }
    }
  });

  ws.on('close', () => {
    if (ws.room) {
      const set = rooms.get(ws.room);
      if (set) {
        set.delete(ws);
        for (const peer of set) peer.sendJSON({ type:'peer-left' });
        if (set.size === 0) rooms.delete(ws.room);
      }
      updateHistory(ws.room);
    }
  });
});

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  });
}, 30000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Server listening on :' + PORT);
});
