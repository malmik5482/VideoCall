require('dotenv').config();
const path = require('path');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Enhanced security headers
app.disable('x-powered-by');
app.use(helmet({ 
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      workerSrc: ["'self'", "blob:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

app.use(cors({
  origin: NODE_ENV === 'production' ? 
    [process.env.ALLOWED_ORIGINS?.split(',') || 'https://malmik5482-videocall-fc69.twc1.net'].flat() :
    true,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting middleware
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per window

const rateLimitMiddleware = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimit.has(clientIP)) {
    rateLimit.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  const clientData = rateLimit.get(clientIP);
  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + RATE_LIMIT_WINDOW;
    return next();
  }
  
  if (clientData.count >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  
  clientData.count++;
  next();
};

app.use(rateLimitMiddleware);

// Serve static files with caching
const clientDir = path.join(__dirname, '..', 'client');
app.use(express.static(clientDir, { 
  extensions: ['html'],
  maxAge: NODE_ENV === 'production' ? '1d' : '0',
  etag: true,
  lastModified: true
}));

// ---- Enhanced Call History and Analytics ----
const history = [];
const analytics = {
  totalCalls: 0,
  totalDuration: 0,
  activeRooms: 0,
  peakConcurrentCalls: 0,
  averageCallDuration: 0,
  callsToday: 0,
  startTime: Date.now()
};

// History management functions
function addHistoryStart(room, userAgent = '', ip = '') {
  const now = Date.now();
  const item = { 
    id: `call_${now}_${Math.random().toString(36).substr(2, 9)}`,
    room, 
    startedAt: now, 
    endedAt: null, 
    durationSec: null, 
    participantsMax: 1,
    userAgent: userAgent.substring(0, 200), // Limit length
    ip: ip.replace(/[^0-9.:/]/g, ''), // Sanitize IP
    quality: 'hd',
    messages: 0,
    disconnections: 0
  };
  
  history.push(item);
  analytics.totalCalls++;
  analytics.activeRooms++;
  
  // Update daily counter
  const today = new Date().toDateString();
  const todayStart = new Date(today).getTime();
  analytics.callsToday = history.filter(h => h.startedAt >= todayStart).length;
  
  // Cleanup old history (keep last 1000 calls)
  if (history.length > 1000) {
    history.splice(0, history.length - 1000);
  }
  
  return item;
}

function addHistoryEnd(room) {
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item.room === room && item.endedAt === null) {
      item.endedAt = Date.now();
      item.durationSec = Math.max(1, Math.round((item.endedAt - item.startedAt) / 1000));
      
      analytics.totalDuration += item.durationSec;
      analytics.activeRooms = Math.max(0, analytics.activeRooms - 1);
      
      // Calculate average duration
      const completedCalls = history.filter(h => h.endedAt !== null);
      analytics.averageCallDuration = completedCalls.length > 0 ? 
        Math.round(completedCalls.reduce((sum, call) => sum + call.durationSec, 0) / completedCalls.length) : 0;
      
      return item;
    }
  }
  return null;
}

function updateCallStats(room, stats) {
  const item = history.findLast(i => i.room === room && i.endedAt === null);
  if (item) {
    Object.assign(item, stats);
  }
}

// ---- Enhanced ICE Server Configuration ----
function getICEConfig() {
  let iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];
  
  try {
    // Support for ICE_JSON environment variable (full JSON config)
    if (process.env.ICE_JSON) {
      const parsed = JSON.parse(process.env.ICE_JSON);
      if (Array.isArray(parsed)) {
        iceServers = parsed;
      }
    } 
    // Support for ICE_URLS with TURN credentials
    else if (process.env.ICE_URLS) {
      const urls = process.env.ICE_URLS.split(',').map(url => url.trim());
      const turnUrls = urls.filter(url => url.startsWith('turn:'));
      const stunUrls = urls.filter(url => url.startsWith('stun:'));
      
      // Add STUN servers
      stunUrls.forEach(url => {
        iceServers.push({ urls: url });
      });
      
      // Add TURN servers with credentials
      if (turnUrls.length > 0 && process.env.TURN_USER && process.env.TURN_PASS) {
        iceServers.push({
          urls: turnUrls,
          username: process.env.TURN_USER,
          credential: process.env.TURN_PASS,
          credentialType: 'password'
        });
      }
    }
    // Legacy TURN_URL support
    else if (process.env.TURN_URL && process.env.TURN_USER && process.env.TURN_PASS) {
      iceServers.push({
        urls: process.env.TURN_URL.split(',').map(url => url.trim()),
        username: process.env.TURN_USER,
        credential: process.env.TURN_PASS,
        credentialType: 'password'
      });
    }
  } catch (error) {
    console.error('Failed to parse ICE configuration:', error.message);
  }
  
  return { iceServers };
}

// ---- API Routes ----

// Health check with detailed info
app.get('/healthz', (req, res) => {
  const uptime = Date.now() - analytics.startTime;
  const memUsage = process.memoryUsage();
  
  res.json({ 
    ok: true,
    uptime: Math.round(uptime / 1000),
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(memUsage.heapTotal / 1024 / 1024)
    },
    activeRooms: analytics.activeRooms,
    version: '3.0.0',
    nodeVersion: process.version
  });
});

// ICE configuration endpoint
app.get('/config', (req, res) => {
  res.json(getICEConfig());
});

// Enhanced history endpoint with filtering and pagination
app.get('/history', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const room = req.query.room;
  
  let filteredHistory = [...history];
  
  // Filter by room if specified
  if (room) {
    filteredHistory = filteredHistory.filter(item => 
      item.room.toLowerCase().includes(room.toLowerCase())
    );
  }
  
  // Sort by start time (newest first)
  filteredHistory.sort((a, b) => b.startedAt - a.startedAt);
  
  // Paginate
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedHistory = filteredHistory.slice(startIndex, endIndex);
  
  // Return sanitized data
  const result = paginatedHistory.map(item => ({
    id: item.id,
    room: item.room,
    startedAt: item.startedAt,
    endedAt: item.endedAt,
    durationSec: item.durationSec,
    participantsMax: item.participantsMax,
    messages: item.messages || 0,
    quality: item.quality || 'hd'
  }));
  
  res.json({
    data: result,
    pagination: {
      page,
      limit,
      total: filteredHistory.length,
      pages: Math.ceil(filteredHistory.length / limit)
    }
  });
});

// Analytics endpoint
app.get('/analytics', (req, res) => {
  const uptime = Date.now() - analytics.startTime;
  
  res.json({
    ...analytics,
    uptime: Math.round(uptime / 1000),
    uptimeDays: Math.round(uptime / (1000 * 60 * 60 * 24) * 100) / 100
  });
});

// Clear history (admin endpoint)
app.delete('/history', (req, res) => {
  const authHeader = req.headers.authorization;
  const adminToken = process.env.ADMIN_TOKEN;
  
  if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const clearedCount = history.length;
  history.length = 0;
  
  // Reset relevant analytics
  analytics.totalCalls = 0;
  analytics.totalDuration = 0;
  analytics.averageCallDuration = 0;
  analytics.callsToday = 0;
  
  res.json({ 
    ok: true, 
    message: `Cleared ${clearedCount} history entries` 
  });
});

// Room validation endpoint
app.post('/validate-room', (req, res) => {
  const { room } = req.body;
  
  if (!room || typeof room !== 'string') {
    return res.status(400).json({ error: 'Invalid room code' });
  }
  
  const sanitizedRoom = room.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  if (sanitizedRoom.length < 3 || sanitizedRoom.length > 20) {
    return res.status(400).json({ 
      error: 'Room code must be 3-20 characters (letters and numbers only)' 
    });
  }
  
  const roomCount = rooms.has(sanitizedRoom) ? rooms.get(sanitizedRoom).size : 0;
  
  res.json({
    valid: true,
    room: sanitizedRoom,
    participants: roomCount,
    available: roomCount < 2
  });
});

// Server info endpoint
app.get('/info', (req, res) => {
  res.json({
    name: 'VideoChat Pro Server',
    version: '3.0.0',
    features: [
      'WebRTC Video Calling',
      'Screen Sharing',
      'Text Chat',
      'Call History',
      'Device Management',
      'Quality Control',
      'Mobile Support'
    ],
    limits: {
      maxRoomSize: 2,
      maxRoomNameLength: 20,
      maxMessageLength: 500
    }
  });
});

// Start HTTP server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 VideoChat Pro Server started`);
  console.log(`📡 HTTP server: http://0.0.0.0:${PORT}`);
  console.log(`🔒 Environment: ${NODE_ENV}`);
  console.log(`🧊 ICE servers: ${getICEConfig().iceServers.length} configured`);
  
  if (NODE_ENV === 'production') {
    console.log(`🌐 Public URL: https://malmik5482-videocall-fc69.twc1.net`);
  }
});

// ---- Enhanced WebSocket Signaling ----
const wss = new WebSocketServer({ 
  server, 
  path: '/ws',
  clientTracking: true,
  maxPayload: 16 * 1024 // 16KB max message size
});

// Active rooms and connections
const rooms = new Map(); // room -> Set<WebSocket>
const socketRoom = new WeakMap(); // WebSocket -> room
const socketInfo = new WeakMap(); // WebSocket -> user info
const roomCreationTime = new Map(); // room -> timestamp

// Message rate limiting per socket
const messageRateLimit = new WeakMap();
const MESSAGE_RATE_LIMIT = 50; // messages per minute
const MESSAGE_RATE_WINDOW = 60000;

function checkMessageRateLimit(ws) {
  const now = Date.now();
  let rateLimitInfo = messageRateLimit.get(ws);
  
  if (!rateLimitInfo) {
    rateLimitInfo = { count: 0, resetTime: now + MESSAGE_RATE_WINDOW };
    messageRateLimit.set(ws, rateLimitInfo);
  }
  
  if (now > rateLimitInfo.resetTime) {
    rateLimitInfo.count = 0;
    rateLimitInfo.resetTime = now + MESSAGE_RATE_WINDOW;
  }
  
  rateLimitInfo.count++;
  return rateLimitInfo.count <= MESSAGE_RATE_LIMIT;
}

function broadcastToRoom(room, message, except = null) {
  const roomSockets = rooms.get(room);
  if (!roomSockets) return 0;
  
  let sentCount = 0;
  const messageStr = JSON.stringify(message);
  
  for (const socket of roomSockets) {
    if (socket !== except && socket.readyState === 1) {
      try {
        socket.send(messageStr);
        sentCount++;
      } catch (error) {
        console.warn('Broadcast error:', error.message);
        // Remove broken socket
        roomSockets.delete(socket);
      }
    }
  }
  
  return sentCount;
}

function assignRole(ws, role) {
  try {
    ws.send(JSON.stringify({ type: 'role', role }));
    
    // Store role in socket info
    const info = socketInfo.get(ws) || {};
    info.role = role;
    socketInfo.set(ws, info);
  } catch (error) {
    console.warn('Role assignment error:', error.message);
  }
}

function joinRoom(ws, room, userInfo = {}) {
  const sanitizedRoom = room.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  if (sanitizedRoom.length < 3 || sanitizedRoom.length > 20) {
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Invalid room code' 
    }));
    return;
  }
  
  // Initialize room if doesn't exist
  if (!rooms.has(sanitizedRoom)) {
    rooms.set(sanitizedRoom, new Set());
    roomCreationTime.set(sanitizedRoom, Date.now());
    
    // Add to history
    const req = ws.upgradeReq || {};
    addHistoryStart(
      sanitizedRoom, 
      req.headers?.['user-agent'] || '', 
      req.connection?.remoteAddress || ''
    );
  }
  
  const roomSockets = rooms.get(sanitizedRoom);
  const currentSize = roomSockets.size;
  
  // Check room capacity
  if (currentSize >= 2) {
    ws.send(JSON.stringify({ 
      type: 'full', 
      message: 'Room is full (maximum 2 participants)' 
    }));
    return;
  }
  
  // Add socket to room
  roomSockets.add(ws);
  socketRoom.set(ws, sanitizedRoom);
  
  // Store user info
  socketInfo.set(ws, {
    joinedAt: Date.now(),
    room: sanitizedRoom,
    ...userInfo
  });
  
  // Update peak concurrent calls
  analytics.peakConcurrentCalls = Math.max(
    analytics.peakConcurrentCalls, 
    Array.from(rooms.values()).reduce((sum, set) => sum + Math.min(set.size, 2), 0) / 2
  );
  
  // Update history with max participants
  const historyItem = history.findLast(h => h.room === sanitizedRoom && h.endedAt === null);
  if (historyItem) {
    historyItem.participantsMax = Math.max(historyItem.participantsMax, roomSockets.size);
  }
  
  // Assign roles
  if (currentSize === 0) {
    assignRole(ws, 'caller');
  } else if (currentSize === 1) {
    assignRole(ws, 'callee');
    
    // Notify all participants that room is ready
    broadcastToRoom(sanitizedRoom, { 
      type: 'ready',
      participants: roomSockets.size
    });
  }
  
  console.log(`👤 User joined room ${sanitizedRoom} (${roomSockets.size}/2 participants)`);
}

function leaveRoom(ws, reason = 'disconnect') {
  const room = socketRoom.get(ws);
  if (!room) return;
  
  const roomSockets = rooms.get(room);
  if (roomSockets) {
    roomSockets.delete(ws);
    
    console.log(`👋 User left room ${room} (${roomSockets.size}/2 remaining, reason: ${reason})`);
    
    // Notify remaining participants
    if (roomSockets.size > 0) {
      broadcastToRoom(room, { 
        type: 'peer-left',
        reason,
        participants: roomSockets.size
      }, ws);
    }
    
    // Clean up empty room
    if (roomSockets.size === 0) {
      rooms.delete(room);
      roomCreationTime.delete(room);
      addHistoryEnd(room);
      console.log(`🗑️ Room ${room} cleaned up`);
    }
  }
  
  socketRoom.delete(ws);
  socketInfo.delete(ws);
  messageRateLimit.delete(ws);
}

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log(`🔌 New WebSocket connection from ${req.connection.remoteAddress}`);
  
  // Store upgrade request for later use
  ws.upgradeReq = req;
  
  // Set up ping/pong for connection health
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
  // Message handler
  ws.on('message', (data) => {
    // Rate limiting
    if (!checkMessageRateLimit(ws)) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Rate limit exceeded'
      }));
      return;
    }
    
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid JSON'
      }));
      return;
    }
    
    // Validate message structure
    if (!message.type || typeof message.type !== 'string') {
      return;
    }
    
    // Handle different message types
    switch (message.type) {
      case 'join':
        if (message.room && typeof message.room === 'string') {
          joinRoom(ws, message.room, {
            userAgent: req.headers['user-agent'],
            ip: req.connection.remoteAddress
          });
        }
        break;
        
      case 'leave':
        leaveRoom(ws, 'user_initiated');
        ws.send(JSON.stringify({ type: 'bye' }));
        setTimeout(() => ws.close(), 100);
        break;
        
      case 'description':
      case 'candidate':
        const room = socketRoom.get(ws);
        if (room && message.sdp || message.candidate) {
          broadcastToRoom(room, message, ws);
        }
        break;
        
      case 'chat':
        const chatRoom = socketRoom.get(ws);
        if (chatRoom && message.text && typeof message.text === 'string') {
          // Sanitize and limit message length
          const sanitizedText = message.text.trim().substring(0, 500);
          if (sanitizedText.length > 0) {
            broadcastToRoom(chatRoom, {
              type: 'chat',
              text: sanitizedText,
              timestamp: Date.now()
            }, ws);
            
            // Update message count in history
            updateCallStats(chatRoom, { 
              messages: (history.findLast(h => h.room === chatRoom && h.endedAt === null)?.messages || 0) + 1 
            });
          }
        }
        break;
        
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
        
      default:
        // Forward other message types (for extensibility)
        const forwardRoom = socketRoom.get(ws);
        if (forwardRoom) {
          broadcastToRoom(forwardRoom, message, ws);
        }
    }
  });
  
  // Connection close handler
  ws.on('close', (code, reason) => {
    console.log(`🔌 WebSocket disconnected: ${code} ${reason}`);
    leaveRoom(ws, `close_${code}`);
  });
  
  // Error handler
  ws.on('error', (error) => {
    console.warn(`❌ WebSocket error: ${error.message}`);
    leaveRoom(ws, 'error');
  });
});

// Connection health monitoring
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      console.log('🔍 Terminating unresponsive connection');
      leaveRoom(ws, 'timeout');
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  });
}, 30000); // Check every 30 seconds

// Cleanup on server shutdown
wss.on('close', () => {
  clearInterval(pingInterval);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  
  wss.clients.forEach(ws => {
    ws.send(JSON.stringify({ 
      type: 'server-shutdown',
      message: 'Server is shutting down' 
    }));
    ws.close();
  });
  
  server.close(() => {
    console.log('✅ Server shut down complete');
    process.exit(0);
  });
  
  // Force exit after 30 seconds
  setTimeout(() => {
    console.log('⚠️ Forced shutdown');
    process.exit(1);
  }, 30000);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully');
  process.emit('SIGTERM');
});

// Log server statistics periodically
setInterval(() => {
  const activeConnections = wss.clients.size;
  const activeRooms = rooms.size;
  const totalParticipants = Array.from(rooms.values()).reduce((sum, set) => sum + set.size, 0);
  
  if (activeConnections > 0 || activeRooms > 0) {
    console.log(`📊 Status: ${activeConnections} connections, ${activeRooms} rooms, ${totalParticipants} participants`);
  }
}, 300000); // Every 5 minutes

console.log('🎥 VideoChat Pro Server ready for connections!');
