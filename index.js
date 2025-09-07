require('dotenv').config();

const path = require('path');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// Настройки безопасности
app.disable('x-powered-by');
app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false 
}));
app.use(compression());
app.use(cors());
app.use(express.json());

// Статические файлы клиента
const clientDir = path.join(__dirname, 'client');
app.use(express.static(clientDir, { extensions: ['html'] }));

// История звонков в памяти
const callHistory = [];

function addCallStart(room) {
  const now = Date.now();
  const call = { 
    room, 
    startedAt: now, 
    endedAt: null, 
    durationSec: null, 
    participantsMax: 1 
  };
  callHistory.push(call);
  return call;
}

function addCallEnd(room) {
  for (let i = callHistory.length - 1; i >= 0; i--) {
    const call = callHistory[i];
    if (call.room === room && call.endedAt === null) {
      call.endedAt = Date.now();
      call.durationSec = Math.max(1, Math.round((call.endedAt - call.startedAt) / 1000));
      return call;
    }
  }
  return null;
}

// Настройка ICE серверов
function getIceServers() {
  let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
  
  try {
    // Новый формат через ICE_URLS
    if (process.env.ICE_URLS) {
      const urls = process.env.ICE_URLS.split(',').map(url => url.trim());
      iceServers = [];
      
      for (const url of urls) {
        if (url.startsWith('stun:')) {
          iceServers.push({ urls: url });
        } else if (url.startsWith('turn:') && process.env.TURN_USER && process.env.TURN_PASS) {
          iceServers.push({
            urls: url,
            username: process.env.TURN_USER,
            credential: process.env.TURN_PASS
          });
        }
      }
    }
    // Альтернативный формат через отдельные переменные
    else if (process.env.TURN_USER && process.env.TURN_PASS) {
      iceServers.push({
        urls: [
          'turn:94.198.218.189:3478?transport=udp',
          'turn:94.198.218.189:3478?transport=tcp'
        ],
        username: process.env.TURN_USER,
        credential: process.env.TURN_PASS
      });
    }
  } catch (error) {
    console.error('Ошибка настройки ICE серверов:', error.message);
  }
  
  console.log('ICE серверы настроены:', iceServers.length);
  return iceServers;
}

// API эндпоинты
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/config', (req, res) => {
  const iceServers = getIceServers();
  res.json({ iceServers });
});

app.get('/history', (req, res) => {
  const last100 = callHistory.slice(-100).map(call => ({
    room: call.room,
    startedAt: call.startedAt,
    endedAt: call.endedAt,
    durationSec: call.durationSec,
    participantsMax: call.participantsMax
  }));
  res.json(last100);
});

app.delete('/history', (req, res) => {
  callHistory.length = 0;
  res.json({ status: 'cleared', timestamp: new Date().toISOString() });
});

// Запуск сервера
const server = app.listen(PORT, () => {
  console.log(`🚀 VideoCall сервер запущен на http://0.0.0.0:${PORT}`);
  console.log(`📺 Клиент доступен по адресу: http://localhost:${PORT}`);
  console.log(`🔧 Здоровье сервера: http://localhost:${PORT}/healthz`);
});

// WebSocket сигналинг
const wss = new WebSocketServer({ server, path: '/ws' });

// Комнаты: room -> Set<WebSocket>
const rooms = new Map();
// Связь сокет -> комната
const socketToRoom = new WeakMap();

function broadcastToRoom(room, message, excludeSocket = null) {
  const sockets = rooms.get(room);
  if (!sockets) return;
  
  const payload = JSON.stringify(message);
  for (const socket of sockets) {
    if (socket !== excludeSocket && socket.readyState === 1) {
      try {
        socket.send(payload);
      } catch (error) {
        console.warn('Ошибка отправки сообщения:', error.message);
      }
    }
  }
}

function setUserRole(socket, role) {
  try {
    socket.send(JSON.stringify({ type: 'role', role }));
  } catch (error) {
    console.warn('Ошибка отправки роли:', error.message);
  }
}

function joinRoom(socket, roomName) {
  // Создаем комнату если её нет
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
    addCallStart(roomName);
  }
  
  const roomSockets = rooms.get(roomName);
  roomSockets.add(socket);
  socketToRoom.set(socket, roomName);
  
  // Обновляем максимальное количество участников
  const activeCall = callHistory.findLast(call => 
    call.room === roomName && call.endedAt === null
  );
  if (activeCall) {
    activeCall.participantsMax = Math.max(activeCall.participantsMax, roomSockets.size);
  }
  
  const participantCount = roomSockets.size;
  console.log(`👤 Пользователь присоединился к комнате "${roomName}" (${participantCount} участников)`);
  
  if (participantCount === 1) {
    setUserRole(socket, 'caller');
  } else if (participantCount === 2) {
    setUserRole(socket, 'callee');
    // Уведомляем обоих участников о готовности к звонку
    broadcastToRoom(roomName, { type: 'ready' });
  } else {
    // Комната переполнена (более 2 участников)
    try {
      socket.send(JSON.stringify({ type: 'room-full' }));
    } catch (error) {
      console.warn('Ошибка отправки уведомления о переполненной комнате:', error.message);
    }
  }
}

function leaveRoom(socket) {
  const roomName = socketToRoom.get(socket);
  if (!roomName) return;
  
  const roomSockets = rooms.get(roomName);
  if (roomSockets) {
    roomSockets.delete(socket);
    console.log(`👋 Пользователь покинул комнату "${roomName}"`);
    
    if (roomSockets.size === 0) {
      // Комната пуста, удаляем её
      rooms.delete(roomName);
      addCallEnd(roomName);
      console.log(`🏠 Комната "${roomName}" закрыта`);
    } else {
      // Уведомляем оставшихся участников
      broadcastToRoom(roomName, { type: 'peer-left' }, socket);
    }
  }
  
  socketToRoom.delete(socket);
}

wss.on('connection', (socket, request) => {
  console.log('🔌 Новое WebSocket соединение от', request.socket.remoteAddress);
  
  socket.on('message', (buffer) => {
    let message;
    try {
      message = JSON.parse(buffer.toString());
    } catch (error) {
      console.warn('Получено некорректное сообщение:', error.message);
      return;
    }
    
    // Обработка присоединения к комнате
    if (message.type === 'join' && message.room) {
      joinRoom(socket, message.room);
      return;
    }
    
    const roomName = socketToRoom.get(socket);
    if (!roomName) {
      console.warn('Сообщение от пользователя не в комнате:', message.type);
      return;
    }
    
    // Пересылаем сигналинговые сообщения
    if (['offer', 'answer', 'ice-candidate', 'chat'].includes(message.type)) {
      broadcastToRoom(roomName, message, socket);
    }
    
    // Обработка добровольного выхода
    if (message.type === 'leave') {
      try {
        socket.send(JSON.stringify({ type: 'goodbye' }));
      } catch (error) {
        console.warn('Ошибка отправки прощания:', error.message);
      }
      leaveRoom(socket);
      try {
        socket.close();
      } catch (error) {
        console.warn('Ошибка закрытия сокета:', error.message);
      }
    }
  });
  
  socket.on('close', () => {
    console.log('🔌 WebSocket соединение закрыто');
    leaveRoom(socket);
  });
  
  socket.on('error', (error) => {
    console.error('❌ Ошибка WebSocket:', error.message);
    leaveRoom(socket);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Получен SIGTERM, завершаем работу...');
  server.close(() => {
    console.log('✅ Сервер остановлен');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Получен SIGINT, завершаем работу...');
  server.close(() => {
    console.log('✅ Сервер остановлен');
    process.exit(0);
  });
});