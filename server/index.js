const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Маршруты
app.get('/', (req, res) => {
  res.json({ message: 'Signal Server для видеозвонков работает!' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// WebSocket обработка для signal обмена
io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  // Присоединение к комнате
  socket.on('join-room', (roomId, userId) => {
    console.log(`Пользователь ${userId} присоединился к комнате ${roomId}`);
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', userId);
  });

  // Обработка WebRTC offer
  socket.on('offer', (offer, roomId) => {
    console.log('Получен offer для комнаты:', roomId);
    socket.to(roomId).emit('offer', offer);
  });

  // Обработка WebRTC answer
  socket.on('answer', (answer, roomId) => {
    console.log('Получен answer для комнаты:', roomId);
    socket.to(roomId).emit('answer', answer);
  });

  // Обработка ICE кандидатов
  socket.on('ice-candidate', (candidate, roomId) => {
    console.log('Получен ICE кандидат для комнаты:', roomId);
    socket.to(roomId).emit('ice-candidate', candidate);
  });

  // Отключение
  socket.on('disconnect', () => {
    console.log('Пользователь отключился:', socket.id);
  });

  // Покидание комнаты
  socket.on('leave-room', (roomId, userId) => {
    console.log(`Пользователь ${userId} покинул комнату ${roomId}`);
    socket.leave(roomId);
    socket.to(roomId).emit('user-disconnected', userId);
  });
});

server.listen(PORT, () => {
  console.log(`Signal сервер запущен на порту ${PORT}`);
  console.log(`Проверить работу: http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = { app, server, io };
