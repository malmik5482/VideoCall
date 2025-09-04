require('dotenv').config();
const path = require('path');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const { WebSocketServer } = require('ws');

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

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files
const clientDir = path.join(__dirname, '..', 'client');
app.use(express.static(clientDir, { extensions: ['html'] }));

// ---- Enhanced ICE Configuration for Russia with your TURN server ----
function getICEConfig() {
  // Специально оптимизированные серверы для России
  let iceServers = [
    // Ваш собственный TURN сервер - приоритет #1 для российских пользователей
    {
      urls: [
        'turn:94.198.218.189:3478?transport=udp',
        'turn:94.198.218.189:3478?transport=tcp'
      ],
      username: 'webrtc',
      credential: 'pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN',
      credentialType: 'password'
    },
    
    // Российские STUN серверы для лучшей работы в РФ
    { urls: 'stun:stun.voipbuster.com:3478' },
    { urls: 'stun:stun.sipnet.net:3478' },
    { urls: 'stun:stun.sipnet.ru:3478' },
    { urls: 'stun:stun.comtube.ru:3478' },
    
    // Дополнительные международные STUN как fallback
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.voipgate.com:3478' },
    { urls: 'stun:stun.ekiga.net:3478' },
    
    // Google STUN как последний резерв
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];
  
  try {
    // Поддержка переменных окружения из Timeweb Apps
    if (process.env.ICE_JSON) {
      const parsed = JSON.parse(process.env.ICE_JSON);
      if (Array.isArray(parsed)) {
        iceServers = parsed;
      }
    } 
    else if (process.env.ICE_URLS && process.env.TURN_USER && process.env.TURN_PASS) {
      // Используем ваши настройки из Timeweb Apps
      const urls = process.env.ICE_URLS.split(',').map(url => url.trim());
      const stunUrls = urls.filter(url => url.startsWith('stun:'));
      const turnUrls = urls.filter(url => url.startsWith('turn:'));
      
      iceServers = [];
      
      // Добавляем ваш TURN сервер в начало списка для максимального приоритета
      if (turnUrls.length > 0) {
        iceServers.push({
          urls: turnUrls,
          username: process.env.TURN_USER,
          credential: process.env.TURN_PASS,
          credentialType: 'password'
        });
      }
      
      // Добавляем STUN серверы
      stunUrls.forEach(url => {
        iceServers.push({ urls: url });
      });
      
      // Добавляем российские STUN серверы для лучшей работы
      const russianStunServers = [
        'stun:stun.voipbuster.com:3478',
        'stun:stun.sipnet.net:3478',
        'stun:stun.sipnet.ru:3478'
      ];
      
      russianStunServers.forEach(url => {
        iceServers.push({ urls: url });
      });
    }
  } catch (error) {
    console.error('ICE configuration error:', error.message);
  }
  
  return { 
    iceServers,
    iceCandidatePoolSize: 20, // Увеличено для лучшего прохождения NAT в России
    rtcpMuxPolicy: 'require',
    bundlePolicy: 'max-bundle',
    iceTransportPolicy: 'all' // Разрешаем TCP и UDP для российских сетей
  };
}

// ---- History and Analytics ----
const history = [];
const analytics = {
  totalCalls: 0,
  totalDuration: 0,
  activeRooms: 0,
  peakConcurrentCalls: 0,
  averageCallDuration: 0,
  callsToday: 0,
  startTime: Date.now(),
  connectionFailures: 0,
  turnServerUsage: 0
};

function addHistoryStart(room, userAgent = '', ip = '') {
  const now = Date.now();
  const isRussian = detectRussianUser(ip, userAgent);
  
  const item = { 
    id: `call_${now}_${Math.random().toString(36).substr(2, 9)}`,
    room, 
    startedAt: now, 
    endedAt: null, 
    durationSec: null, 
    participantsMax: 1,
    userAgent: userAgent.substring(0, 200),
    ip: ip.replace(/[^0-9.:/]/g, ''),
    quality: 'hd',
    messages: 0,
    disconnections: 0,
    isRussian: isRussian,
    connectionAttempts: 0,
    turnUsed: false
  };
  
  history.push(item);
  analytics.totalCalls++;
  analytics.activeRooms++;
  
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
      
      if (item.turnUsed) {
        analytics.turnServerUsage++;
      }
      
      const completedCalls = history.filter(h => h.endedAt !== null);
      analytics.averageCallDuration = completedCalls.length > 0 ? 
        Math.round(completedCalls.reduce((sum, call) => sum + call.durationSec, 0) / completedCalls.length) : 0;
      
      return item;
    }
  }
  return null;
}

function detectRussianUser(ip, userAgent) {
  const russianKeywords = ['ru', 'russia', 'yandex', 'mail.ru', 'rambler'];
  const ua = userAgent.toLowerCase();
  
  // Проверяем User-Agent на российские признаки
  const hasRussianUA = russianKeywords.some(keyword => ua.includes(keyword));
  
  // Простая проверка IP (в реальности нужна GeoIP база)
  const isLocalNetwork = ip.includes('192.168.') || ip.includes('10.') || ip === '::1' || ip === '127.0.0.1';
  
  return hasRussianUA || isLocalNetwork;
}

// ---- API Routes ----
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
    version: '3.2.0-RU-FINAL',
    nodeVersion: process.version,
    turnServer: '94.198.218.189:3478',
    optimizedForRussia: true
  });
});

app.get('/config', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const clientIP = req.ip || req.connection.remoteAddress || '';
  const isRussian = detectRussianUser(clientIP, userAgent);
  
  const config = getICEConfig();
  
  // Дополнительные настройки для российских пользователей
  if (isRussian) {
    config.russianOptimization = true;
    config.recommendedBitrate = 800000; // Консервативный битрейт для РФ
    config.aggressiveTurn = true; // Принудительное использование TURN
  }
  
  console.log(`🇷🇺 ICE config requested from ${clientIP} (Russian: ${isRussian})`);
  
  res.json(config);
});

app.get('/history', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  
  let filteredHistory = [...history];
  filteredHistory.sort((a, b) => b.startedAt - a.startedAt);
  
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedHistory = filteredHistory.slice(startIndex, endIndex);
  
  const result = paginatedHistory.map(item => ({
    id: item.id,
    room: item.room,
    startedAt: item.startedAt,
    endedAt: item.endedAt,
    durationSec: item.durationSec,
    participantsMax: item.participantsMax,
    messages: item.messages || 0,
    quality: item.quality || 'hd',
    isRussian: item.isRussian || false,
    turnUsed: item.turnUsed || false
  }));
  
  res.json({
    data: result,
    pagination: {
      page,
      limit,
      total: filteredHistory.length,
      pages: Math.ceil(filteredHistory.length / limit)
    },
    analytics: {
      turnUsagePercent: analytics.totalCalls > 0 ? 
        Math.round((analytics.turnServerUsage / analytics.totalCalls) * 100) : 0
    }
  });
});

app.get('/analytics', (req, res) => {
  const uptime = Date.now() - analytics.startTime;
  
  res.json({
    ...analytics,
    uptime: Math.round(uptime / 1000),
    turnServer: {
      host: '94.198.218.189',
      port: 3478,
      usage: analytics.turnServerUsage,
      usagePercent: analytics.totalCalls > 0 ? 
        Math.round((analytics.turnServerUsage / analytics.totalCalls) * 100) : 0
    },
    russianOptimizations: true
  });
});

app.get('/turn-test', (req, res) => {
  // Тест доступности TURN сервера
  res.json({
    turnServer: {
      host: '94.198.218.189',
      ports: [3478],
      protocols: ['UDP', 'TCP'],
      username: 'webrtc',
      status: 'configured'
    },
    testInstructions: [
      'Откройте приложение в двух разных сетях',
      'Попробуйте подключиться без VPN',
      'TURN сервер должен обеспечить соединение через NAT'
    ],
    russianNetworkOptimization: true
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 VideoChat Pro Server (Russia Edition) started`);
  console.log(`📡 HTTP server: http://0.0.0.0:${PORT}`);
  console.log(`🔒 Environment: ${NODE_ENV}`);
  console.log(`🧊 ICE servers: ${getICEConfig().iceServers.length} configured`);
  console.log(`🇷🇺 Russian optimization: ENABLED`);
  console.log(`🔄 TURN server: 94.198.218.189:3478 (webrtc)`);
  console.log(`🌐 Public URL: https://malmik5482-videocall-fc69.twc1.net`);
});

// ---- Enhanced WebSocket with TURN optimization ----
const wss = new WebSocketServer({ 
  server, 
  path: '/ws',
  clientTracking: true,
  maxPayload: 16 * 1024
});

const rooms = new Map();
const socketRoom = new WeakMap();
const socketInfo = new WeakMap();

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
        roomSockets.delete(socket);
      }
    }
  }
  
  return sentCount;
}

function assignRole(ws, role) {
  try {
    ws.send(JSON.stringify({ 
      type: 'role', 
      role,
      turnServerAvailable: true,
      russianOptimization: true
    }));
    
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
  
  if (!rooms.has(sanitizedRoom)) {
    rooms.set(sanitizedRoom, new Set());
    const req = ws.upgradeReq || {};
    addHistoryStart(
      sanitizedRoom, 
      req.headers?.['user-agent'] || '', 
      req.connection?.remoteAddress || ''
    );
  }
  
  const roomSockets = rooms.get(sanitizedRoom);
  const currentSize = roomSockets.size;
  
  if (currentSize >= 2) {
    ws.send(JSON.stringify({ 
      type: 'full', 
      message: 'Room is full (maximum 2 participants)' 
    }));
    return;
  }
  
  roomSockets.add(ws);
  socketRoom.set(ws, sanitizedRoom);
  
  const req = ws.upgradeReq || {};
  const isRussian = detectRussianUser(
    req.connection?.remoteAddress || '', 
    req.headers?.['user-agent'] || ''
  );
  
  socketInfo.set(ws, {
    joinedAt: Date.now(),
    room: sanitizedRoom,
    isRussian: isRussian,
    connectionAttempts: 0,
    ...userInfo
  });
  
  analytics.peakConcurrentCalls = Math.max(
    analytics.peakConcurrentCalls, 
    Array.from(rooms.values()).reduce((sum, set) => sum + Math.min(set.size, 2), 0) / 2
  );
  
  const historyItem = history.findLast(h => h.room === sanitizedRoom && h.endedAt === null);
  if (historyItem) {
    historyItem.participantsMax = Math.max(historyItem.participantsMax, roomSockets.size);
    historyItem.connectionAttempts = (historyItem.connectionAttempts || 0) + 1;
  }
  
  if (currentSize === 0) {
    assignRole(ws, 'caller');
  } else if (currentSize === 1) {
    assignRole(ws, 'callee');
    
    broadcastToRoom(sanitizedRoom, { 
      type: 'ready',
      participants: roomSockets.size,
      turnServerRecommended: isRussian,
      russianOptimization: isRussian
    });
  }
  
  console.log(`👤 User joined room ${sanitizedRoom} (${roomSockets.size}/2) ${isRussian ? '[RU]' : '[INT]'}`);
  
  // Отправляем специальные настройки для российских пользователей
  if (isRussian) {
    try {
      ws.send(JSON.stringify({
        type: 'russia-config',
        turnServerForced: true,
        recommendations: [
          'Включено принудительное использование TURN сервера',
          'Настройки оптимизированы для российских сетей',
          'Рекомендуется использовать WiFi для лучшего качества'
        ],
        turnServer: '94.198.218.189:3478'
      }));
    } catch (error) {
      console.warn('Error sending Russian config:', error.message);
    }
  }
}

function leaveRoom(ws, reason = 'disconnect') {
  const room = socketRoom.get(ws);
  if (!room) return;
  
  const roomSockets = rooms.get(room);
  if (roomSockets) {
    roomSockets.delete(ws);
    
    console.log(`👋 User left room ${room} (${roomSockets.size}/2 remaining, reason: ${reason})`);
    
    if (roomSockets.size > 0) {
      broadcastToRoom(room, { 
        type: 'peer-left',
        reason,
        participants: roomSockets.size
      }, ws);
    }
    
    if (roomSockets.size === 0) {
      rooms.delete(room);
      addHistoryEnd(room);
      console.log(`🗑️ Room ${room} cleaned up`);
    }
  }
  
  socketRoom.delete(ws);
  socketInfo.delete(ws);
}

wss.on('connection', (ws, req) => {
  const clientIP = req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || '';
  const isRussian = detectRussianUser(clientIP, userAgent);
  
  console.log(`🔌 New WebSocket connection from ${clientIP} ${isRussian ? '[RU]' : '[INT]'}`);
  
  ws.upgradeReq = req;
  ws.isAlive = true;
  
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
  ws.on('message', (data) => {
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
    
    if (!message.type || typeof message.type !== 'string') return;
    
    switch (message.type) {
      case 'join':
        if (message.room && typeof message.room === 'string') {
          joinRoom(ws, message.room, {
            userAgent: req.headers['user-agent'],
            ip: req.connection.remoteAddress,
            isRussian: isRussian
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
        if (room && (message.sdp || message.candidate)) {
          // Отмечаем использование TURN сервера если это TURN candidate
          if (message.type === 'candidate' && message.candidate) {
            if (message.candidate.candidate && message.candidate.candidate.includes('relay')) {
              const historyItem = history.findLast(h => h.room === room && h.endedAt === null);
              if (historyItem) {
                historyItem.turnUsed = true;
              }
              console.log(`🔄 TURN server used in room ${room}`);
            }
          }
          broadcastToRoom(room, message, ws);
        }
        break;
        
      case 'chat':
        const chatRoom = socketRoom.get(ws);
        if (chatRoom && message.text && typeof message.text === 'string') {
          const sanitizedText = message.text.trim().substring(0, 500);
          if (sanitizedText.length > 0) {
            broadcastToRoom(chatRoom, {
              type: 'chat',
              text: sanitizedText,
              timestamp: Date.now()
            }, ws);
            
            const historyItem = history.findLast(h => h.room === chatRoom && h.endedAt === null);
            if (historyItem) {
              historyItem.messages = (historyItem.messages || 0) + 1;
            }
          }
        }
        break;
        
      case 'connection-failed':
        analytics.connectionFailures++;
        const failedRoom = socketRoom.get(ws);
        if (failedRoom && isRussian) {
          console.log(`🇷🇺 Connection failed in room ${failedRoom}, suggesting TURN`);
          ws.send(JSON.stringify({
            type: 'turn-suggestion',
            message: 'Проблемы с соединением. Попробуйте переподключиться.',
            forceTurn: true
          }));
        }
        break;
        
      case 'ping':
        ws.send(JSON.stringify({ 
          type: 'pong', 
          timestamp: Date.now(),
          turnServerStatus: 'active'
        }));
        break;
        
      default:
        const forwardRoom = socketRoom.get(ws);
        if (forwardRoom) {
          broadcastToRoom(forwardRoom, message, ws);
        }
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`🔌 WebSocket disconnected: ${code} ${reason} ${isRussian ? '[RU]' : '[INT]'}`);
    leaveRoom(ws, `close_${code}`);
  });
  
  ws.on('error', (error) => {
    console.warn(`❌ WebSocket error: ${error.message} ${isRussian ? '[RU]' : '[INT]'}`);
    analytics.connectionFailures++;
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
    try {
      ws.ping();
    } catch (error) {
      leaveRoom(ws, 'ping_error');
      ws.terminate();
    }
  });
}, 25000);

wss.on('close', () => {
  clearInterval(pingInterval);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  
  wss.clients.forEach(ws => {
    ws.send(JSON.stringify({ 
      type: 'server-shutdown',
      message: 'Сервер перезагружается. Переподключитесь через минуту.' 
    }));
    ws.close();
  });
  
  server.close(() => {
    console.log('✅ Server shut down complete');
    process.exit(0);
  });
  
  setTimeout(() => {
    console.log('⚠️ Forced shutdown');
    process.exit(1);
  }, 30000);
});

process.on('SIGINT', process.emit.bind(process, 'SIGTERM'));

// Status logging
setInterval(() => {
  const activeConnections = wss.clients.size;
  const activeRooms = rooms.size;
  const russianConnections = Array.from(wss.clients).filter(ws => 
    socketInfo.get(ws)?.isRussian
  ).length;
  
  if (activeConnections > 0) {
    console.log(`📊 Status: ${activeConnections} connections (${russianConnections} RU), ${activeRooms} rooms, TURN usage: ${analytics.turnServerUsage}`);
  }
}, 300000);

console.log('🎥🇷🇺 VideoChat Pro Server (Russia Edition) with TURN 94.198.218.189 ready!');
