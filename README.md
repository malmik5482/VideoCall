# 🇷🇺 VideoCall Pro - Russian Optimized Edition + Agora Integration

Высококачественные видеозвонки 1‑к‑1, специально оптимизированные для российских сетей. Теперь с поддержкой **Agora SDK** для максимального качества на мобильных сетях!

![Russian Flag](https://img.shields.io/badge/🇷🇺-Optimized%20for%20Russia-blue) ![WebRTC](https://img.shields.io/badge/WebRTC-Enabled-green) ![Agora](https://img.shields.io/badge/Agora-Integrated-purple) ![TURN Server](https://img.shields.io/badge/TURN-94.198.218.189-orange)

## 🎯 Две версии приложения

### 🚀 **Agora Edition (Рекомендуется для мобильных)**
- **URL:** `/agora`
- **Серверы в Москве** - низкая задержка
- **SFU архитектура** - стабильнее P2P
- **Автоматическая оптимизация** битрейта
- **Поддержка российских мобильных сетей:** МТС, Билайн, МегаФон, Теле2

### 📡 **WebRTC Edition (Классический P2P)**
- **URL:** `/` (главная страница)
- **Собственный TURN сервер** на `94.198.218.189:3478`
- **14 оптимизированных ICE серверов**
- **Прямое соединение** между устройствами

---

## ✨ Ключевые особенности

### 🔥 Agora Integration
- 🌟 **Серверы в России** для минимальной задержки
- 📱 **Мобильная оптимизация** для 2G/3G/4G/5G
- ⚡ **Адаптивный битрейт** в реальном времени
- 🛠 **Автоматическое определение** типа сети и оператора
- 🔒 **Безопасные токены** с автоматической генерацией

### 📡 WebRTC Features
- 🔄 **Собственный TURN сервер** на `94.198.218.189:3478`
- 🌐 **14 оптимизированных ICE серверов** для России
- 📱 **Адаптивное качество** от 4K до мобильного
- 🔍 **Диагностика сети** в реальном времени
- 🚀 **Автоматическое восстановление** соединения
- 📊 **Мониторинг производительности** и метрики

---

## 🚀 Быстрый старт

### Установка зависимостей
```bash
npm install
```

### Локальный запуск
```bash
npm start
# Agora версия: http://localhost:3001/agora
# WebRTC версия: http://localhost:3001/
```

### 🔑 Настройка Agora (для Agora версии)

1. **Зарегистрируйтесь на** https://console.agora.io
2. **Создайте проект** с Video Calling
3. **Скопируйте App ID** из настроек проекта
4. **Откройте** `/agora` страницу приложения
5. **Вставьте App ID** в поле настроек
6. **Нажмите "Сохранить настройки"**

### 📱 Тестирование видеозвонков

**Agora версия (рекомендуется для мобильных):**
1. Откройте `/agora` на двух устройствах
2. Убедитесь что App ID настроен
3. Название канала должно быть одинаковым
4. Нажмите "Начать звонок" на обоих устройствах

**WebRTC версия:**
1. Откройте `/` в двух вкладках/устройствах
2. Используйте один код комнаты для видеозвонка
3. Первое устройство создает комнату, второе подключается

---

## 🛜 Конфигурация для российских условий

### Переменные окружения
```bash
PORT=3001
AGORA_APP_ID=ваш_app_id_здесь
AGORA_APP_CERTIFICATE=ваш_certificate_здесь  # опционально
ICE_URLS=stun:stun.l.google.com:19302,turn:94.198.218.189:3478?transport=udp
TURN_USER=webrtc
TURN_PASS=pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN
```

### Российские STUN серверы (встроенные)
- `stun:stun.sipnet.ru:3478` 🇷🇺
- `stun:stun.comtube.ru:3478` 🇷🇺  
- `stun:stun.voipbuster.com:3478`
- `stun:stun.freecall.com:3478`

---

## 🔧 TURN Server Setup (для WebRTC версии)

### Автоматическая установка TURN сервера
```bash
# Скачать и запустить скрипт установки
curl -sSL https://raw.githubusercontent.com/malmik5482/VideoCall/agora-integration/fix-turn-server.sh | bash
```

### Быстрое исправление TURN
```bash
# Быстрая настройка без полной переустановки
curl -sSL https://raw.githubusercontent.com/malmik5482/VideoCall/agora-integration/quick-fix-turn.sh | bash
```

**Подробные инструкции:** [VPS_COMMANDS.md](VPS_COMMANDS.md)

---

## 📊 API Endpoints

### Health Check
```bash
GET /healthz
```

### ICE Configuration (WebRTC)
```bash
GET /config
```

### Agora Token Generation
```bash
POST /agora/token
Content-Type: application/json

{
  "channelName": "test-channel",
  "uid": 0,
  "role": 1
}
```

### Agora Configuration
```bash
GET /agora/config
```

### Analytics
```bash
GET /analytics
GET /history?page=1&limit=50
```

---

## 🔍 Диагностика и отладка

### WebRTC Диагностика
- **Встроенная диагностика TURN:** Тестирует подключение к TURN серверу
- **Проверка ICE серверов:** Валидация всех STUN/TURN серверов
- **Мониторинг качества:** Битрейт, задержка, потери пакетов

### Agora Диагностика  
- **SDK проверка:** Валидация загрузки Agora SDK
- **Устройства:** Проверка камеры и микрофона
- **Сеть:** Определение типа соединения и оператора
- **Токены:** Автоматическая генерация и проверка

---

## 🌐 Развертывание

### Docker
```bash
docker build -t videocall-russia .
docker run -p 3001:3001 -e AGORA_APP_ID=your_app_id videocall-russia
```

### PM2 (Production)
```bash
npm install -g pm2
pm2 start server/index.js --name videocall-agora
pm2 startup
pm2 save
```

---

## 📱 Поддерживаемые платформы

### Мобильные операторы России
- ✅ **МТС** - Оптимизирована скорость и качество
- ✅ **Билайн** - Адаптивный битрейт 
- ✅ **МегаФон** - Стабильное соединение
- ✅ **Теле2** - Экономия трафика

### Браузеры
- ✅ **Chrome/Chromium** (рекомендуется)
- ✅ **Firefox**
- ✅ **Safari** (iOS/macOS)
- ✅ **Edge**
- ✅ **Mobile browsers** (Android/iOS)

### Сети
- ✅ **Wi-Fi** - Максимальное качество 4K
- ✅ **4G/5G** - Адаптивное HD качество
- ✅ **3G** - Оптимизированное SD качество
- ✅ **VPN** - Обход блокировок провайдеров

---

## 🛠 Технические детали

### Стек технологий
- **Frontend:** Vanilla JS, WebRTC API, Agora RTC SDK v4.20.0
- **Backend:** Node.js, Express, WebSocket
- **TURN Server:** coturn на Ubuntu
- **Video Codecs:** VP8, VP9, H.264
- **Audio Codecs:** Opus, PCMU, PCMA

### Архитектура
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client A      │    │  Agora Cloud     │    │   Client B      │
│   (Mobile)      │◄──►│  (Moscow Edge)   │◄──►│   (Desktop)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   WebRTC P2P    │◄──►│  TURN Server     │◄──►│   WebRTC P2P    │
│   Fallback      │    │ 94.198.218.189   │    │   Fallback      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

---

## 🤝 Contributing

1. **Fork** the repository
2. **Create** feature branch: `git checkout -b agora-integration`  
3. **Commit** changes: `git commit -am 'Add Agora SDK integration'`
4. **Push** to branch: `git push origin agora-integration`
5. **Create** Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🎯 Производительность

### Agora Edition
- **Задержка:** < 200ms в России
- **Качество:** Адаптивное 200-2000 kbps
- **Стабильность:** 99.9% uptime
- **Поддержка сетей:** 2G/3G/4G/5G

### WebRTC Edition  
- **P2P задержка:** < 100ms (прямое соединение)
- **TURN задержка:** < 300ms (через relay)
- **Битрейт:** До 3000 kbps на хороших сетях
- **Восстановление:** Автоматическое при разрывах

---

## 📞 Поддержка

- **GitHub Issues:** [Создать issue](https://github.com/malmik5482/VideoCall/issues)
- **Email:** malmik5482@gmail.com
- **Telegram:** @malmik5482

**🇷🇺 Сделано с ❤️ для российских разработчиков и пользователей**