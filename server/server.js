const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Настройки из переменных окружения или дефолтные
const PORT = process.env.PORT || 3002;
const HOST = '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// WebSocket сервер для чатов и сигналинга
const wss = new WebSocket.Server({ 
  server,
  path: '/ws',
  perMessageDeflate: false,
  clientTracking: true
});

// Хранилище данных
const users = new Map(); // userId -> userData
const rooms = new Map(); // roomId -> Set of ws connections
const connections = new Map(); // ws -> connectionData

// Обработка WebSocket соединений
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`🌐 Новое WebSocket соединение от ${clientIp}`);
  
  // Инициализация соединения
  const connectionData = {
    id: generateId(),
    connectedAt: Date.now(),
    ip: clientIp,
    userId: null,
    roomId: null,
    isAlive: true
  };
  
  connections.set(ws, connectionData);
  
  // Heartbeat для проверки соединения
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
  // Обработка сообщений
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch (error) {
      console.error('❌ Ошибка парсинга сообщения:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });
  
  // Обработка закрытия соединения
  ws.on('close', () => {
    handleDisconnect(ws);
  });
  
  // Обработка ошибок
  ws.on('error', (error) => {
    console.error('❌ WebSocket ошибка:', error);
  });
  
  // Отправляем приветственное сообщение
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Добро пожаловать в CosmosChat!',
    connectionId: connectionData.id
  }));
});

// Обработчик сообщений
function handleMessage(ws, data) {
  const connection = connections.get(ws);
  
  switch(data.type) {
    case 'register':
      handleRegister(ws, data);
      break;
      
    case 'login':
      handleLogin(ws, data);
      break;
      
    case 'search_user':
      handleUserSearch(ws, data);
      break;
      
    case 'join_room':
      handleJoinRoom(ws, data);
      break;
      
    case 'leave_room':
      handleLeaveRoom(ws);
      break;
      
    case 'chat_message':
      handleChatMessage(ws, data);
      break;
      
    case 'offer':
    case 'answer':
    case 'ice_candidate':
      handleWebRTCSignaling(ws, data);
      break;
      
    case 'call_request':
      handleCallRequest(ws, data);
      break;
      
    case 'call_response':
      handleCallResponse(ws, data);
      break;
      
    case 'end_call':
      handleEndCall(ws, data);
      break;
      
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
      
    default:
      console.log('⚠️ Неизвестный тип сообщения:', data.type);
  }
}

// Регистрация пользователя
function handleRegister(ws, data) {
  const { name, phone } = data;
  
  if (!name || !phone) {
    ws.send(JSON.stringify({
      type: 'register_error',
      message: 'Имя и телефон обязательны'
    }));
    return;
  }
  
  // Проверяем, не занят ли номер
  const existingUser = Array.from(users.values()).find(u => u.phone === phone);
  if (existingUser) {
    ws.send(JSON.stringify({
      type: 'register_error',
      message: 'Этот номер уже зарегистрирован'
    }));
    return;
  }
  
  // Создаем нового пользователя
  const userId = generateId();
  const userData = {
    id: userId,
    name,
    phone,
    avatar: generateAvatar(name),
    status: 'online',
    registeredAt: Date.now()
  };
  
  users.set(userId, userData);
  
  // Обновляем данные соединения
  const connection = connections.get(ws);
  connection.userId = userId;
  
  // Отправляем успешный ответ
  ws.send(JSON.stringify({
    type: 'register_success',
    user: userData
  }));
  
  console.log(`✅ Пользователь зарегистрирован: ${name} (${phone})`);
}

// Авторизация пользователя
function handleLogin(ws, data) {
  const { phone } = data;
  
  // Ищем пользователя по телефону
  const user = Array.from(users.values()).find(u => u.phone === phone);
  
  if (!user) {
    ws.send(JSON.stringify({
      type: 'login_error',
      message: 'Пользователь не найден'
    }));
    return;
  }
  
  // Обновляем статус и соединение
  user.status = 'online';
  const connection = connections.get(ws);
  connection.userId = user.id;
  
  ws.send(JSON.stringify({
    type: 'login_success',
    user
  }));
  
  console.log(`✅ Пользователь авторизован: ${user.name}`);
}

// Поиск пользователей
function handleUserSearch(ws, data) {
  const { query } = data;
  
  // Демо-пользователи для тестирования
  const demoUsers = [
    {
      id: 'demo_1',
      phone: '79001234567',
      name: 'Анна Смирнова',
      avatar: { initials: 'АС', color: '#6366f1' },
      status: 'online'
    },
    {
      id: 'demo_2',
      phone: '79009876543',
      name: 'Максим Петров',
      avatar: { initials: 'МП', color: '#3b82f6' },
      status: 'online'
    },
    {
      id: 'demo_3',
      phone: '79005556677',
      name: 'Елена Иванова',
      avatar: { initials: 'ЕИ', color: '#06b6d4' },
      status: 'offline'
    }
  ];
  
  // Очищаем запрос от всех символов кроме цифр
  const cleanQuery = query.replace(/\D/g, '');
  
  // Ищем среди реальных пользователей
  const realUsers = Array.from(users.values()).filter(user => {
    const cleanPhone = user.phone.replace(/\D/g, '');
    return cleanPhone.includes(cleanQuery) || user.name.toLowerCase().includes(query.toLowerCase());
  });
  
  // Ищем среди демо-пользователей
  const foundDemoUsers = demoUsers.filter(user => {
    const cleanPhone = user.phone.replace(/\D/g, '');
    return cleanPhone.includes(cleanQuery) || user.name.toLowerCase().includes(query.toLowerCase());
  });
  
  // Объединяем результаты
  const results = [...realUsers, ...foundDemoUsers];
  
  ws.send(JSON.stringify({
    type: 'search_results',
    users: results
  }));
}

// Присоединение к комнате
function handleJoinRoom(ws, data) {
  const { roomId } = data;
  const connection = connections.get(ws);
  
  // Покидаем предыдущую комнату, если есть
  if (connection.roomId) {
    handleLeaveRoom(ws);
  }
  
  // Создаем комнату, если её нет
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  
  // Добавляем в комнату
  const room = rooms.get(roomId);
  room.add(ws);
  connection.roomId = roomId;
  
  // Уведомляем всех в комнате
  broadcastToRoom(roomId, {
    type: 'user_joined',
    userId: connection.userId,
    roomId
  }, ws);
  
  // Отправляем текущий список участников
  const participants = Array.from(room).map(socket => {
    const conn = connections.get(socket);
    const user = users.get(conn.userId);
    return user;
  }).filter(Boolean);
  
  ws.send(JSON.stringify({
    type: 'room_joined',
    roomId,
    participants
  }));
}

// Покидание комнаты
function handleLeaveRoom(ws) {
  const connection = connections.get(ws);
  
  if (!connection.roomId) return;
  
  const room = rooms.get(connection.roomId);
  if (room) {
    room.delete(ws);
    
    if (room.size === 0) {
      rooms.delete(connection.roomId);
    } else {
      broadcastToRoom(connection.roomId, {
        type: 'user_left',
        userId: connection.userId
      }, ws);
    }
  }
  
  connection.roomId = null;
}

// Обработка сообщений чата
function handleChatMessage(ws, data) {
  const connection = connections.get(ws);
  const user = users.get(connection.userId);
  
  if (!user || !connection.roomId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Вы не в комнате'
    }));
    return;
  }
  
  const message = {
    id: generateId(),
    type: 'chat_message',
    userId: user.id,
    userName: user.name,
    userAvatar: user.avatar,
    text: data.text,
    timestamp: Date.now()
  };
  
  broadcastToRoom(connection.roomId, message);
}

// WebRTC сигналинг
function handleWebRTCSignaling(ws, data) {
  const connection = connections.get(ws);
  
  if (!connection.roomId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Вы не в комнате для звонка'
    }));
    return;
  }
  
  // Пересылаем сигналы другим участникам комнаты
  broadcastToRoom(connection.roomId, {
    ...data,
    from: connection.userId
  }, ws);
}

// Запрос на звонок
function handleCallRequest(ws, data) {
  const { targetUserId } = data;
  const connection = connections.get(ws);
  const caller = users.get(connection.userId);
  
  // Находим целевого пользователя
  const targetConnection = Array.from(connections.entries()).find(([_, conn]) => 
    conn.userId === targetUserId
  );
  
  if (!targetConnection) {
    ws.send(JSON.stringify({
      type: 'call_error',
      message: 'Пользователь не в сети'
    }));
    return;
  }
  
  const [targetWs] = targetConnection;
  
  // Создаем комнату для звонка
  const callRoomId = `call_${generateId()}`;
  
  // Отправляем запрос целевому пользователю
  targetWs.send(JSON.stringify({
    type: 'incoming_call',
    callRoomId,
    caller: {
      id: caller.id,
      name: caller.name,
      avatar: caller.avatar
    }
  }));
  
  // Подтверждаем отправку запроса
  ws.send(JSON.stringify({
    type: 'call_request_sent',
    callRoomId,
    targetUserId
  }));
}

// Ответ на звонок
function handleCallResponse(ws, data) {
  const { callRoomId, accepted, callerId } = data;
  
  if (accepted) {
    // Присоединяем обоих к комнате звонка
    handleJoinRoom(ws, { roomId: callRoomId });
    
    // Уведомляем звонящего
    const callerConnection = Array.from(connections.entries()).find(([_, conn]) => 
      conn.userId === callerId
    );
    
    if (callerConnection) {
      const [callerWs] = callerConnection;
      callerWs.send(JSON.stringify({
        type: 'call_accepted',
        callRoomId
      }));
    }
  } else {
    // Уведомляем об отклонении
    const callerConnection = Array.from(connections.entries()).find(([_, conn]) => 
      conn.userId === callerId
    );
    
    if (callerConnection) {
      const [callerWs] = callerConnection;
      callerWs.send(JSON.stringify({
        type: 'call_declined'
      }));
    }
  }
}

// Завершение звонка
function handleEndCall(ws, data) {
  const connection = connections.get(ws);
  
  if (connection.roomId && connection.roomId.startsWith('call_')) {
    broadcastToRoom(connection.roomId, {
      type: 'call_ended',
      userId: connection.userId
    });
    
    // Все покидают комнату звонка
    const room = rooms.get(connection.roomId);
    if (room) {
      room.forEach(socket => {
        const conn = connections.get(socket);
        conn.roomId = null;
      });
      rooms.delete(connection.roomId);
    }
  }
}

// Обработка отключения
function handleDisconnect(ws) {
  const connection = connections.get(ws);
  
  if (connection) {
    console.log(`🔌 Отключение: ${connection.id}`);
    
    // Обновляем статус пользователя
    if (connection.userId) {
      const user = users.get(connection.userId);
      if (user) {
        user.status = 'offline';
      }
    }
    
    // Покидаем комнату
    if (connection.roomId) {
      handleLeaveRoom(ws);
    }
    
    connections.delete(ws);
  }
}

// Вспомогательные функции
function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateAvatar(name) {
  const colors = ['#6366f1', '#3b82f6', '#06b6d4', '#ec4899', '#8b5cf6'];
  const initials = name.split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  
  return {
    initials,
    color: colors[Math.floor(Math.random() * colors.length)]
  };
}

function broadcastToRoom(roomId, message, exclude = null) {
  const room = rooms.get(roomId);
  
  if (!room) return;
  
  const messageStr = JSON.stringify(message);
  
  room.forEach(socket => {
    if (socket !== exclude && socket.readyState === WebSocket.OPEN) {
      socket.send(messageStr);
    }
  });
}

// Heartbeat для проверки соединений
const interval = setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) {
      handleDisconnect(ws);
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// API endpoints
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    users: users.size,
    connections: connections.size,
    rooms: rooms.size,
    uptime: process.uptime()
  });
});

app.get('/api/ice-config', (req, res) => {
  res.json({
    iceServers: [
      {
        urls: ['turn:94.198.218.189:3478?transport=udp', 'turn:94.198.218.189:3478?transport=tcp'],
        username: 'webrtc',
        credential: 'pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN'
      },
      { urls: 'stun:94.198.218.189:3478' },
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun.sipnet.ru:3478' }
    ]
  });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Обработка завершения процесса
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  clearInterval(interval);
  server.close(() => {
    console.log('HTTP server closed');
  });
});

// Запуск сервера
server.listen(PORT, HOST, () => {
  console.log(`🚀 CosmosChat сервер запущен на http://${HOST}:${PORT}`);
  console.log(`📍 Окружение: ${NODE_ENV}`);
  console.log(`🌐 WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`🔐 TURN сервер: 94.198.218.189:3478`);
});