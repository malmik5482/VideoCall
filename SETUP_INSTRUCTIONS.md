# 🚀 CosmosChat - Полная инструкция по настройке и развертыванию

## 📋 Содержание
1. [Настройка VPS для TURN сервера](#настройка-vps-для-turn-сервера)
2. [Настройка Timeweb Apps](#настройка-timeweb-apps) 
3. [Переменные окружения](#переменные-окружения)
4. [Развертывание приложения](#развертывание-приложения)
5. [Проверка работоспособности](#проверка-работоспособности)
6. [Решение проблем](#решение-проблем)

---

## 🖥️ Настройка VPS для TURN сервера

### **VPS: 94.198.218.189**

#### 1. Подключение к серверу
```bash
ssh root@94.198.218.189
```

#### 2. Установка и настройка Coturn
```bash
# Обновление системы
apt update && apt upgrade -y

# Установка Coturn
apt install coturn -y

# Включение TURN сервера
echo "TURNSERVER_ENABLED=1" >> /etc/default/coturn
```

#### 3. Конфигурация Coturn
Создайте или отредактируйте файл `/etc/turnserver.conf`:

```bash
# Основные настройки
listening-port=3478
fingerprint
use-auth-secret
static-auth-secret=pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN

# Альтернативный вариант с username/password
#lt-cred-mech
#user=webrtc:pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN

# Настройки realm
realm=videocall
server-name=videocall

# Сетевые настройки
external-ip=94.198.218.189
listening-ip=0.0.0.0

# Порты для relay
min-port=49152
max-port=65535

# Логирование
log-file=/var/log/turnserver/turnserver.log
verbose

# Производительность
total-quota=100
bps-quota=0
stale-nonce=600

# Разрешенные IP (опционально)
# denied-peer-ip=0.0.0.0-0.255.255.255
# denied-peer-ip=127.0.0.0-127.255.255.255
# allowed-peer-ip=192.168.0.0-192.168.255.255

# Дополнительные опции
no-tcp
no-tls
no-dtls
no-cli
```

#### 4. Настройка файрвола
```bash
# Открываем необходимые порты
ufw allow 3478/udp
ufw allow 3478/tcp
ufw allow 49152:65535/udp
ufw allow 22/tcp
ufw --force enable

# Проверяем статус
ufw status
```

#### 5. Запуск и проверка TURN сервера
```bash
# Запускаем сервис
systemctl restart coturn
systemctl enable coturn

# Проверяем статус
systemctl status coturn

# Смотрим логи
tail -f /var/log/turnserver/turnserver.log

# Проверяем прослушивание портов
netstat -tulpn | grep 3478
ss -tulpn | grep 3478
```

#### 6. Тестирование TURN сервера
```bash
# Локальный тест
turnutils_uclient -v -u webrtc -w pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN 94.198.218.189

# Проверка из браузера
# Откройте: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
# Введите: turn:94.198.218.189:3478
# Username: webrtc
# Password: pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN
```

---

## 🌐 Настройка Timeweb Apps

### 1. Создание приложения в Timeweb Cloud

1. Войдите в панель управления Timeweb
2. Перейдите в раздел "Apps" или "Приложения"
3. Нажмите "Создать приложение"
4. Выберите:
   - **Тип**: Node.js
   - **Версия Node.js**: 18.x или выше
   - **Имя приложения**: cosmoschat

### 2. Настройка репозитория

```bash
# В настройках приложения укажите:
Repository URL: https://github.com/malmik5482/VideoCall.git
Branch: main
Build Command: npm install
Start Command: npm start
```

### 3. Переменные окружения в Timeweb

В разделе "Environment Variables" или "Переменные окружения" добавьте:

```env
# Основные настройки
NODE_ENV=production
PORT=3002

# TURN сервер (ваш VPS)
TURN_SERVER=94.198.218.189:3478
TURN_USERNAME=webrtc
TURN_PASSWORD=pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN
TURN_REALM=videocall

# ICE конфигурация
ICE_URLS=turn:94.198.218.189:3478?transport=udp,turn:94.198.218.189:3478?transport=tcp,stun:94.198.218.189:3478,stun:stun.l.google.com:19302
TURN_USER=webrtc
TURN_PASS=pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN

# VLESS настройки (опционально, если используете)
VLESS_SERVER=95.181.173.120
VLESS_PORT=8443
VLESS_UUID=550e8400-e29b-41d4-a716-446655440000

# WebSocket настройки
WS_PATH=/ws
WS_HEARTBEAT=30000

# Домен (после настройки)
PUBLIC_URL=https://your-app.timeweb.cloud
```

### 4. Настройка домена

1. В настройках приложения перейдите в "Домены"
2. Используйте предоставленный домен: `cosmoschat.timeweb.cloud`
3. Или подключите собственный домен:
   ```
   CNAME: your-domain.com → cosmoschat.timeweb.cloud
   ```

### 5. SSL сертификат

Timeweb Apps автоматически предоставляет SSL сертификат для HTTPS.

---

## 🔧 Развертывание приложения

### Вариант 1: Через Git (рекомендуется)

```bash
# На локальной машине
git clone https://github.com/malmik5482/VideoCall.git
cd VideoCall

# Внесите необходимые изменения
# ...

# Закоммитьте и запушьте
git add .
git commit -m "Update configuration"
git push origin main

# Timeweb автоматически задеплоит изменения
```

### Вариант 2: Через PM2 на VPS

```bash
# На VPS или выделенном сервере
git clone https://github.com/malmik5482/VideoCall.git
cd VideoCall
npm install

# Запуск через PM2
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# Просмотр логов
pm2 logs cosmoschat
pm2 monit
```

### Вариант 3: Docker

```bash
# Сборка образа
docker build -t cosmoschat .

# Запуск контейнера
docker run -d \
  --name cosmoschat \
  -p 3002:3002 \
  -e NODE_ENV=production \
  -e TURN_SERVER=94.198.218.189:3478 \
  -e TURN_USERNAME=webrtc \
  -e TURN_PASSWORD=pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN \
  cosmoschat

# Или через docker-compose
docker-compose up -d
```

---

## ✅ Проверка работоспособности

### 1. Проверка сервера приложения

```bash
# Проверка статуса
curl https://your-app.timeweb.cloud/health

# Проверка API
curl https://your-app.timeweb.cloud/api/status

# Проверка ICE конфигурации
curl https://your-app.timeweb.cloud/api/ice-config
```

### 2. Проверка TURN сервера

```bash
# На VPS с TURN сервером
systemctl status coturn
journalctl -u coturn -f

# Проверка портов
netstat -tulpn | grep 3478
```

### 3. Проверка WebSocket

```javascript
// В консоли браузера
const ws = new WebSocket('wss://your-app.timeweb.cloud/ws');
ws.onopen = () => console.log('WebSocket connected!');
ws.onmessage = (e) => console.log('Message:', e.data);
```

### 4. Тестирование видеозвонков

1. Откройте приложение в двух разных браузерах
2. Зарегистрируйте два аккаунта:
   - Аккаунт 1: Имя "Тест 1", Телефон "+7 (901) 111-11-11"
   - Аккаунт 2: Имя "Тест 2", Телефон "+7 (902) 222-22-22"
3. Найдите друг друга через поиск
4. Инициируйте видеозвонок
5. Проверьте в консоли браузера:
   ```javascript
   // Должны увидеть:
   // "ICE Connection State: connected"
   // "Using TURN server: 94.198.218.189"
   ```

---

## 🐛 Решение типичных проблем

### Проблема: TURN сервер не доступен

```bash
# На VPS
# 1. Проверьте, что сервис запущен
systemctl restart coturn
systemctl status coturn

# 2. Проверьте файрвол
ufw status
ufw allow 3478/udp
ufw allow 3478/tcp

# 3. Проверьте конфигурацию
cat /etc/turnserver.conf | grep -E "listening-port|external-ip|user"

# 4. Проверьте логи
tail -100 /var/log/turnserver/turnserver.log
```

### Проблема: WebSocket не подключается

```bash
# В Timeweb Apps проверьте:
# 1. Переменная WS_PATH установлена в /ws
# 2. Порт приложения правильный (3002)
# 3. SSL сертификат активен

# В консоли браузера:
new WebSocket('wss://your-app.timeweb.cloud/ws')
```

### Проблема: Видео не передается

1. Проверьте разрешения камеры/микрофона в браузере
2. Откройте chrome://webrtc-internals/ для диагностики
3. Проверьте, что используется TURN сервер:
   ```javascript
   // В консоли браузера во время звонка
   pc.getStats().then(stats => {
     stats.forEach(report => {
       if (report.type === 'candidate-pair' && report.state === 'succeeded') {
         console.log('Connection type:', report.remoteCandidateType);
         // Должно быть "relay" если используется TURN
       }
     });
   });
   ```

### Проблема: Приложение не запускается в Timeweb

```bash
# Проверьте логи в панели Timeweb
# Убедитесь, что:
# 1. Node.js версия >= 18
# 2. Все зависимости установлены
# 3. Команда запуска: npm start
# 4. Порт приложения совпадает с PORT в переменных окружения
```

---

## 📝 Чек-лист для запуска

- [ ] VPS настроен и TURN сервер запущен
- [ ] Порты 3478 (UDP/TCP) открыты на VPS
- [ ] Приложение развернуто в Timeweb Apps
- [ ] Переменные окружения настроены
- [ ] SSL сертификат активен
- [ ] WebSocket endpoint работает
- [ ] Тестовые звонки проходят успешно

---

## 🆘 Команды для экстренной диагностики

```bash
# На VPS с TURN
systemctl status coturn
netstat -tulpn | grep 3478
tail -f /var/log/turnserver/turnserver.log

# В Timeweb Apps (через консоль)
npm run logs:pm2
curl https://your-app.timeweb.cloud/health

# В браузере (консоль)
fetch('/api/ice-config').then(r => r.json()).then(console.log)
new WebSocket('wss://your-app.timeweb.cloud/ws')
```

---

## 🎉 Готово!

После выполнения всех шагов ваше приложение CosmosChat будет полностью работоспособно с:
- ✅ Регистрацией и авторизацией
- ✅ Поиском пользователей
- ✅ Текстовыми чатами через WebSocket
- ✅ Видеозвонками через WebRTC с TURN сервером
- ✅ Оптимизацией для российских мобильных сетей

**Демо-доступ для тестирования:**
- URL: https://your-app.timeweb.cloud
- Тестовые номера: +7 (900) 123-45-67, +7 (900) 987-65-43