# 🔐 CosmosChat - Учетные данные и демо-информация

## ⚠️ ВАЖНО: Конфиденциальная информация
**Этот файл содержит реальные пароли и конфигурации. Не публикуйте в открытом доступе!**

---

## 🌐 Серверы и доступы

### **TURN Сервер (WebRTC)**
```bash
# Основной TURN сервер для видеозвонков
HOST: 94.198.218.189
UDP_PORT: 3478
TCP_PORT: 3478 (fallback)

# Аутентификация
USERNAME: webrtc
PASSWORD: pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN
REALM: videocall

# Тестовые команды
nc -u 94.198.218.189 3478
telnet 94.198.218.189 3478
```

### **VLESS + Reality Сервер**
```bash
# Прокси-сервер (экспериментальный)
HOST: 95.181.173.120
PORT: 8443
PROTOCOL: VLESS + Reality

# UUID и ключи
UUID: 550e8400-e29b-41d4-a716-446655440000
FLOW: xtls-rprx-vision

# Reality конфигурация
PUBLIC_KEY: z9hX8rKsHn_W-F5nKw1H7TLvzKzMhRvJ3YcE4XrZ8kI
PRIVATE_KEY: AKmqtKML3BvTsNVdpFbWjgUHIDY8ZsQk6W7F9r-E1dY
SHORT_ID: 6ba85179e30d4fc2
SNI: google.com
DEST: google.com:443
```

### **GitHub репозиторий**
```bash
# Репозиторий проекта
URL: https://github.com/malmik5482/VideoCall
USER: malmik5482
ACCESS: Публичный репозиторий

# Для клонирования
git clone https://github.com/malmik5482/VideoCall.git
```

---

## 🎮 Демо-пользователи для тестирования

### **Встроенные тестовые аккаунты:**
```javascript
// Демо-пользователи в системе поиска (chat.js)
const demoUsers = [
    {
        phone: '79001234567',
        name: 'Анна Смирнова',
        avatar: { initials: 'АС', color: '#6366f1' },
        status: 'В сети'
    },
    {
        phone: '79009876543', 
        name: 'Максим Петров',
        avatar: { initials: 'МП', color: '#3b82f6' },
        status: 'В сети'
    },
    {
        phone: '79005556677',
        name: 'Елена Иванова', 
        avatar: { initials: 'ЕИ', color: '#06b6d4' },
        status: 'Был(а) недавно'
    },
    {
        phone: '79003334455',
        name: 'Дмитрий Козлов',
        avatar: { initials: 'ДК', color: '#ec4899' },
        status: 'В сети'
    },
    {
        phone: '79007778899',
        name: 'София Николаева',
        avatar: { initials: 'СН', color: '#8b5cf6' },
        status: 'В сети'
    }
];
```

### **Как тестировать с двумя аккаунтами:**

#### **Сценарий 1: Создание двух реальных аккаунтов**
```bash
# Аккаунт 1:
Имя: Тестер 1
Телефон: +7 (901) 111-11-11

# Аккаунт 2:
Имя: Тестер 2  
Телефон: +7 (902) 222-22-22

# Поиск:
Аккаунт 1 ищет: +7 (902) 222-22-22
Аккаунт 2 ищет: +7 (901) 111-11-11
```

#### **Сценарий 2: Использование демо-аккаунтов**
```bash
# Создайте аккаунт с любыми данными, затем ищите:
+7 (900) 123-45-67 → найдет "Анна Смирнова"
+7 (900) 987-65-43 → найдет "Максим Петров"
+7 (900) 555-66-77 → найдет "Елена Иванова"
```

---

## 🔧 Переменные окружения

### **Локальная разработка (.env)**
```bash
# Основные настройки
NODE_ENV=development
PORT=3002
HOST=0.0.0.0

# TURN сервер
TURN_SERVER=94.198.218.189:3478
TURN_USERNAME=webrtc
TURN_PASSWORD=pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN
TURN_REALM=videocall

# VLESS (опционально)
VLESS_SERVER=95.181.173.120
VLESS_PORT=8443
VLESS_UUID=550e8400-e29b-41d4-a716-446655440000

# WebSocket
WS_PATH=/ws
WS_HEARTBEAT=30000

# Логи
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

### **Продакшн настройки**
```bash
# Для PM2 ecosystem.config.js
NODE_ENV=production
PORT=3002
MAX_MEMORY_RESTART=500M
INSTANCES=1
EXEC_MODE=fork

# SSL (если используется)
SSL_CERT=/path/to/cert.pem
SSL_KEY=/path/to/key.pem

# Домен
DOMAIN=cosmoschat.example.com
PUBLIC_URL=https://cosmoschat.example.com
```

---

## 🎨 Настройки дизайна

### **CSS переменные (космическая тема)**
```css
:root {
    /* Основные цвета */
    --cosmic-purple: #6366f1;
    --cosmic-blue: #3b82f6;
    --cosmic-cyan: #06b6d4;
    --cosmic-pink: #ec4899;
    
    /* Фоны */
    --bg-primary: #0a0a1a;
    --bg-secondary: #1a1a2e;
    --bg-tertiary: #16213e;
    
    /* Текст */
    --text-primary: #ffffff;
    --text-secondary: #a1a1aa;
    
    /* Эффекты */
    --glow-purple: 0 0 20px rgba(99, 102, 241, 0.5);
    --glow-blue: 0 0 20px rgba(59, 130, 246, 0.5);
    --blur-glass: blur(20px);
}
```

### **Анимации и эффекты**
```css
/* Основные анимации */
@keyframes cosmic-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
}

@keyframes particle-float {
    0% { transform: translateY(0px); }
    100% { transform: translateY(-1000px); }
}

@keyframes star-twinkle {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
}
```

---

## 📱 Мобильная оптимизация

### **Viewport и адаптивность**
```html
<!-- Оптимальные мета-теги -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

### **PWA манифест**
```json
{
    "name": "CosmosChat - Космический мессенджер",
    "short_name": "CosmosChat",
    "description": "Современный мессенджер с видеозвонками",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#0a0a1a", 
    "theme_color": "#6366f1",
    "icons": [
        {
            "src": "/icon-192x192.png",
            "sizes": "192x192",
            "type": "image/png"
        },
        {
            "src": "/icon-512x512.png", 
            "sizes": "512x512",
            "type": "image/png"
        }
    ]
}
```

---

## 🎯 WebRTC конфигурация

### **Полная ICE конфигурация**
```javascript
const ICE_CONFIG = {
    iceServers: [
        // Основной TURN UDP (лучший для мобильных)
        {
            urls: ['turn:94.198.218.189:3478?transport=udp'],
            username: 'webrtc',
            credential: 'pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN'
        },
        // TURN TCP (fallback для ограниченных сетей)
        {
            urls: ['turn:94.198.218.189:3478?transport=tcp'], 
            username: 'webrtc',
            credential: 'pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN'
        },
        // STUN серверы
        { urls: 'stun:94.198.218.189:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ],
    
    // Оптимизация соединения
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    
    // Таймауты для российских сетей
    iceTransportPolicy: 'all',
    iceGatheringTimeout: 15000,
    iceConnectionTimeout: 30000
};
```

### **Медиа настройки**
```javascript
const mediaConstraints = {
    video: {
        width: { min: 320, ideal: 640, max: 1280 },
        height: { min: 240, ideal: 480, max: 720 },
        frameRate: { min: 15, ideal: 24, max: 30 },
        facingMode: 'user' // Фронтальная камера
    },
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1
    }
};
```

---

## 🚀 Команды развертывания

### **Быстрый запуск**
```bash
# Полная установка за 2 минуты
git clone https://github.com/malmik5482/VideoCall.git
cd VideoCall
npm install
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### **Docker развертывание**
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 3002

USER node
CMD ["node", "server/server.js"]
```

```bash
# Команды Docker
docker build -t cosmoschat .
docker run -d -p 3002:3002 --name cosmoschat \
  -e TURN_SERVER=94.198.218.189:3478 \
  -e TURN_USERNAME=webrtc \
  -e TURN_PASSWORD=pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN \
  cosmoschat
```

---

## 🔍 Диагностика и отладка

### **Проверка TURN сервера**
```javascript
// Встроенная диагностика в приложении
async function testTurnServer() {
    const config = {
        iceServers: [{
            urls: ['turn:94.198.218.189:3478?transport=udp'],
            username: 'webrtc',
            credential: 'pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN'
        }]
    };
    
    const pc = new RTCPeerConnection(config);
    
    return new Promise((resolve) => {
        pc.onicecandidate = (event) => {
            if (event.candidate && event.candidate.candidate.includes('relay')) {
                console.log('✅ TURN сервер работает!');
                resolve(true);
            }
        };
        
        pc.createDataChannel('test');
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
        
        setTimeout(() => resolve(false), 10000);
    });
}
```

### **Логи для отладки**
```javascript
// Включить подробные WebRTC логи
const pc = new RTCPeerConnection(config);

pc.addEventListener('iceconnectionstatechange', () => {
    console.log('ICE Connection State:', pc.iceConnectionState);
});

pc.addEventListener('icegatheringstatechange', () => {
    console.log('ICE Gathering State:', pc.iceGatheringState);
});

pc.addEventListener('icecandidate', (event) => {
    if (event.candidate) {
        console.log('ICE Candidate:', event.candidate.candidate);
    }
});
```

---

## 📊 Мониторинг и статистика

### **Ключевые метрики**
```bash
# Проверка производительности
curl -w "@curl-format.txt" -s -o /dev/null https://3002-ip468ihcy403p6enirr3p-6532622b.e2b.dev/

# Мониторинг WebSocket соединений
ss -tuln | grep 3002
netstat -an | grep 3002

# PM2 статистика
pm2 monit
pm2 logs vless-videocall --nostream --lines 50
```

### **Пользовательская аналитика**
```javascript
// Встроенная статистика (в разработке)
const analytics = {
    sessions: 0,
    videoCalls: 0,
    messages: 0,
    users: 0
};

// Отправка статистики (заглушка)
function trackEvent(event, data) {
    console.log('Analytics:', event, data);
    // В будущем: отправка на сервер аналитики
}
```

---

## 📞 Контакты и поддержка

### **Разработчик**
- **GitHub**: malmik5482
- **Репозиторий**: https://github.com/malmik5482/VideoCall
- **Демо**: https://3002-ip468ihcy403p6enirr3p-6532622b.e2b.dev/

### **Техническая поддержка**
- **Issues**: https://github.com/malmik5482/VideoCall/issues
- **Wiki**: https://github.com/malmik5482/VideoCall/wiki
- **Документация**: См. SERVER_ARCHITECTURE.md + DEVELOPMENT_HISTORY.md

---

## ⚠️ Безопасность

### **Важные замечания:**
1. **Пароли в этом файле реальные** - не публикуйте открыто
2. **TURN credentials** действительны и используются в продакшене
3. **VLESS ключи** настоящие - для экспериментальной среды
4. **UUID** уникальный для данного проекта
5. **Демо-пользователи** не содержат реальных данных

### **Рекомендации:**
- Регулярно меняйте пароли TURN сервера
- Используйте HTTPS для всех соединений
- Логируйте подозрительную активность
- Ограничивайте доступ к серверным логам

---

**🔐 Этот файл содержит конфиденциальную информацию. Передавайте только доверенным разработчикам проекта.**