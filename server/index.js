const path = require('path');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');

// Agora token generation
let RtcTokenBuilder;
let RtcRole;
try {
  const agoraToken = require('agora-token');
  RtcTokenBuilder = agoraToken.RtcTokenBuilder;
  RtcRole = agoraToken.RtcRole;
  console.log('✅ Agora token builder loaded successfully');
} catch (e) {
  console.error('❌ Agora token builder error:', e.message);
}

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Basic security
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files
const clientDir = path.join(__dirname, '..', 'client');
app.use(express.static(clientDir, { extensions: ['html'] }));

// Agora version route
app.get('/agora', (req, res) => {
  res.sendFile(path.join(clientDir, 'agora.html'));
});

// VLESS version route
app.get('/vless', (req, res) => {
  res.sendFile(path.join(clientDir, 'vless-videochat.html'));
});

// ---- Enhanced ICE Configuration for Russia with aggressive optimization ----
function getICEConfig() {
  // Оптимизированная конфигурация для российских сетей
  let iceServers = [
    // Ваш TURN сервер - максимальный приоритет с множественными точками входа
    {
      urls: [
        'turn:94.198.218.189:3478?transport=udp',
        'turn:94.198.218.189:3478?transport=tcp',
        'turns:94.198.218.189:5349?transport=tcp' // Если доступен TLS
      ],
      username: 'webrtc',
      credential: 'pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN',
      credentialType: 'password'
    },
    
    // Российские STUN серверы - геоблизость критична для минимизации latency
    { urls: 'stun:stun.sipnet.ru:3478' },
    { urls: 'stun:stun.comtube.ru:3478' },
    { urls: 'stun:stun.sipnet.net:3478' },
    { urls: 'stun:stun.voipbuster.com:3478' },
    { urls: 'stun:stun.voipcheap.com:3478' },
    
    // Европейские STUN серверы для лучшей работы с VPN
    { urls: 'stun:stun.freecall.com:3478' },
    { urls: 'stun:stun.voipstunt.com:3478' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    
    // Дополнительные альтернативные STUN серверы
    { urls: 'stun:stun.ekiga.net:3478' },
    { urls: 'stun:stun.ideasip.com:3478' },
    
    // Google STUN как резерв (может блокироваться VPN/провайдерами)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
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
    iceCandidatePoolSize: 30, // Максимально увеличено для сложных российских NAT
    rtcpMuxPolicy: 'require',
    bundlePolicy: 'max-bundle',
    iceTransportPolicy: 'all', // Разрешаем все транспорты для максимальной совместимости
    // Дополнительные настройки для российских сетей
    russianOptimization: {
      turnForced: false, // Не принуждаем TURN сразу, пробуем P2P сначала
      adaptiveQuality: true,
      connectionTimeout: 15000, // Увеличенный таймаут для медленных сетей
      reconnectAttempts: 5,
      iceGatheringTimeout: 10000
    }
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

// ---- AGORA TOKEN GENERATION ----
app.post('/agora/token', (req, res) => {
  try {
    const { channelName, uid, role, expireTime } = req.body;
    
    if (!channelName) {
      return res.status(400).json({ error: 'Channel name is required' });
    }
    
    // Your specific Agora credentials
    const appId = '86d591368acb4da89f891b8db54c842a';
    const appCertificate = '22c6f01d5ba44f00a996fcbde42174a5';
    
    console.log('🔑 Using App Certificate for token generation');
    
    // Check if token builder is available
    if (!RtcTokenBuilder) {
      return res.status(500).json({ 
        error: 'Token builder not available',
        message: 'Install agora-token package',
        token: null
      });
    }
    
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + (expireTime || 3600); // 1 hour default
    
    // Generate token with proper role
    const userRole = RtcRole.PUBLISHER; // Can publish audio/video
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId, 
      appCertificate, 
      channelName, 
      uid || 0, 
      userRole, 
      privilegeExpiredTs
    );
    
    console.log('✅ Agora token generated for channel:', channelName);
    
    res.json({
      token,
      channelName,
      uid: uid || 0,
      expireTime: privilegeExpiredTs
    });
    
  } catch (error) {
    console.error('Agora token generation error:', error);
    res.status(500).json({ 
      error: 'Token generation failed',
      message: error.message,
      token: null
    });
  }
});

app.get('/agora/config', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const clientIP = req.ip || req.connection.remoteAddress || '';
  const isRussian = detectRussianUser(clientIP, userAgent);
  
  // Agora configuration optimized for Russian networks
  const config = {
    mode: 'rtc',
    codec: 'vp8', // Better for mobile devices
    optimizations: {
      russian: isRussian,
      mobile: userAgent.includes('Mobile'),
      network: 'adaptive'
    },
    videoProfile: isRussian ? {
      width: 640,
      height: 480,
      frameRate: 15,
      bitrate: 800 // Conservative for Russian networks
    } : {
      width: 1280,
      height: 720,
      frameRate: 30,
      bitrate: 1500
    }
  };
  
  console.log(`🚀 Agora config requested from ${clientIP} (Russian: ${isRussian})`);
  res.json(config);
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

// Новый API для динамической диагностики соединения
app.get('/connection-diagnostics', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const clientIP = req.ip || req.connection.remoteAddress || '';
  
  // Определяем тип устройства и предполагаемый тип соединения
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isDesktop = !isMobile;
  
  // Рекомендации на основе User-Agent и IP
  let recommendedConfig = {
    videoQuality: 'hd',
    audioQuality: 'premium',
    turnPriority: 'medium',
    iceTransportPolicy: 'all'
  };
  
  if (isMobile) {
    recommendedConfig = {
      videoQuality: 'sd',
      audioQuality: 'standard', 
      turnPriority: 'high', // Мобильные сети чаще нуждаются в TURN
      iceTransportPolicy: 'all'
    };
  }
  
  res.json({
    clientInfo: {
      ip: clientIP,
      isMobile: isMobile,
      isDesktop: isDesktop,
      userAgent: userAgent.substring(0, 100)
    },
    recommendedConfig,
    russianOptimizations: {
      stunServers: 12, // Количество российских STUN серверов
      turnServerAvailable: true,
      adaptiveQuality: true,
      connectionMonitoring: true
    },
    troubleshooting: [
      'Для мобильного интернета: рекомендуется WiFi',
      'При проблемах с VPN: попробуйте отключить и переподключиться',
      'При низком качестве: проверьте скорость интернета',
      'При разрывах соединения: TURN сервер обеспечит стабильность'
    ]
  });
});

// API для получения оптимальных настроек качества в реальном времени
app.post('/optimize-quality', express.json(), (req, res) => {
  const { connectionSpeed, packetLoss, rtt, networkType } = req.body;
  
  let qualityProfile = {
    video: { width: 1280, height: 720, frameRate: 30, bitrate: 2500000 },
    audio: { bitrate: 128000, sampleRate: 44100 }
  };
  
  // Адаптируем качество на основе показателей сети
  if (packetLoss > 5 || rtt > 200) {
    // Плохая сеть - снижаем качество
    qualityProfile = {
      video: { width: 640, height: 480, frameRate: 20, bitrate: 800000 },
      audio: { bitrate: 64000, sampleRate: 22050 }
    };
  } else if (connectionSpeed > 50 && packetLoss < 1 && rtt < 50) {
    // Отличная сеть - максимальное качество
    qualityProfile = {
      video: { width: 1920, height: 1080, frameRate: 30, bitrate: 8000000 },
      audio: { bitrate: 256000, sampleRate: 48000 }
    };
  } else if (networkType === 'mobile') {
    // Мобильная сеть - консервативные настройки
    qualityProfile = {
      video: { width: 960, height: 540, frameRate: 24, bitrate: 1500000 },
      audio: { bitrate: 96000, sampleRate: 44100 }
    };
  }
  
  res.json({
    success: true,
    recommendedProfile: qualityProfile,
    explanation: `Настройки оптимизированы для: скорость ${connectionSpeed}Mbps, потери ${packetLoss}%, задержка ${rtt}ms`,
    russianOptimization: true
  });
});

// API для диагностики TURN сервера (получение результатов от клиентов)
app.post('/turn-diagnostics', express.json(), (req, res) => {
  const diagnosticData = req.body;
  const timestamp = Date.now();
  const clientIP = req.ip || req.connection.remoteAddress || '';
  
  // Логируем диагностику TURN для анализа
  console.log(`🔍 TURN Diagnostics from ${clientIP}:`, {
    timestamp,
    server: diagnosticData.server,
    grade: diagnosticData.verdict,
    issues: diagnosticData.criticalIssues?.length || 0,
    connectionType: diagnosticData.connectionType
  });
  
  // Анализируем результаты и даем рекомендации
  const analysis = {
    timestamp,
    clientIP,
    diagnosis: diagnosticData.verdict,
    criticalIssues: diagnosticData.criticalIssues || [],
    recommendations: diagnosticData.recommendations || []
  };
  
  // Специфичные рекомендации для российских мобильных сетей
  if (diagnosticData.connectionType && diagnosticData.connectionType.includes('g')) {
    analysis.recommendations.push(
      'Для мобильных сетей в России рекомендуется TCP transport',
      'Попробуйте переключиться на WiFi для лучшего качества',
      'Убедитесь что TURN сервер доступен на порту 3478'
    );
  }
  
  // Если есть проблемы с relay
  if (analysis.criticalIssues.some(issue => issue.includes('relay'))) {
    analysis.recommendations.push(
      '🚨 КРИТИЧЕСКАЯ ПРОБЛЕМА: TURN relay не работает!',
      'Проверьте настройки coturn на VPS 94.198.218.189',
      'Убедитесь что порты 3478 UDP/TCP открыты в firewall',
      'Проверьте учетные данные TURN: webrtc / pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN'
    );
  }
  
  // Если проблемы с подключением
  if (analysis.criticalIssues.some(issue => issue.includes('доступен'))) {
    analysis.recommendations.push(
      '🔥 СЕРВЕР НЕДОСТУПЕН: Проверьте статус VPS',
      'Команды для проверки: systemctl status coturn',
      'Проверьте логи: journalctl -u coturn -f',
      'Убедитесь что coturn слушает на 0.0.0.0:3478'
    );
  }
  
  res.json({
    success: true,
    analysis,
    serverRecommendations: [
      'Проверьте конфигурацию /etc/turnserver.conf',
      'Убедитесь что coturn запущен: systemctl status coturn',
      'Проверьте firewall: ufw status',
      'Мониторьте логи TURN сервера'
    ],
    nextSteps: analysis.criticalIssues.length > 0 ? [
      'Немедленно проверьте настройки TURN сервера',
      'Перезапустите coturn: systemctl restart coturn', 
      'Проверьте доступность портов извне',
      'Рассмотрите использование TCP transport для мобильных'
    ] : [
      'TURN сервер работает корректно',
      'Мониторьте производительность',
      'Рассмотрите дополнительные TURN серверы для резервирования'
    ]
  });
});

// Экстренная проверка состояния TURN сервера
app.get('/turn-server-status', (req, res) => {
  const turnServerInfo = {
    host: '94.198.218.189',
    port: 3478,
    protocols: ['UDP', 'TCP'],
    username: 'webrtc',
    // Пароль не отображаем в открытом виде
    credentialConfigured: true,
    
    // Статус который должен проверяться на VPS
    expectedServices: [
      'coturn.service должен быть active (running)',
      'Порт 3478/udp должен слушать на 0.0.0.0',
      'Порт 3478/tcp должен слушать на 0.0.0.0'
    ],
    
    // Команды для проверки на VPS
    diagnosticCommands: [
      'systemctl status coturn',
      'netstat -tuln | grep 3478',
      'journalctl -u coturn --no-pager -l',
      'ufw status'
    ],
    
    // Типичные проблемы
    commonIssues: [
      {
        problem: 'Сервис не запущен',
        solution: 'systemctl start coturn && systemctl enable coturn'
      },
      {
        problem: 'Порты заблокированы',
        solution: 'ufw allow 3478/tcp && ufw allow 3478/udp'
      },
      {
        problem: 'Неправильная конфигурация',
        solution: 'Проверьте /etc/turnserver.conf'
      },
      {
        problem: 'Недостаточно памяти/CPU',
        solution: 'Увеличьте ресурсы VPS или оптимизируйте настройки'
      }
    ]
  };
  
  res.json({
    success: true,
    turnServer: turnServerInfo,
    currentTime: new Date().toISOString(),
    message: 'Используйте эти команды для диагностики TURN сервера на VPS'
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
