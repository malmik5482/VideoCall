# 🔧 Настройка TURN сервера для российских мобильных сетей

## 🚨 Диагностированная проблема

**Судя по описанию**: плохое качество, зависания, квадратики - это **классические симптомы неработающего TURN сервера** при соединении двух мобильных устройств через российских операторов.

## 📋 Пошаговая диагностика и исправление

### 1. 🔍 Подключитесь к VPS и проверьте статус

```bash
# Подключаемся к VPS
ssh root@94.198.218.189

# Проверяем статус coturn
systemctl status coturn

# Проверяем что сервис слушает порты
netstat -tuln | grep 3478

# Проверяем логи на ошибки
journalctl -u coturn --no-pager -l | tail -50
```

### 2. 🛠️ Правильная конфигурация `/etc/turnserver.conf`

Создайте/обновите файл конфигурации:

```bash
sudo nano /etc/turnserver.conf
```

**Оптимальная конфигурация для российских мобильных сетей:**

```ini
# Основные настройки
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
relay-ip=94.198.218.189
external-ip=94.198.218.189

# Включаем оба протокола (критично для мобильных сетей РФ)
listening-device=eth0
relay-device=eth0

# Пользователи и аутентификация
lt-cred-mech
use-auth-secret
static-auth-secret=your-very-secret-key
realm=malmik5482-videocall-fc69.twc1.net

# Пользователь для WebRTC
user=webrtc:pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN

# Диапазон портов для relay (важно для российских NAT)
min-port=10000
max-port=20000

# Оптимизация для мобильных сетей России
no-stun
no-cli
no-tlsv1
no-tlsv1_1
no-dtls

# Логирование для диагностики
verbose
log-file=/var/log/turnserver.log
pidfile=/var/run/turnserver.pid

# Безопасность
no-multicast-peers
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255

# Лимиты для стабильности
max-bps=1000000
bps-capacity=0
stale-nonce=600

# Специальные настройки для российских операторов
cipher-list="ECDH+AESGCM:DH+AESGCM:ECDH+AES256:DH+AES256:ECDH+AES128:DH+AES:ECDH+3DES:DH+3DES:RSA+AESGCM:RSA+AES:RSA+3DES:!aNULL:!MD5:!DSS"
no-sslv2
no-sslv3
```

### 3. 🔥 Настройка Firewall

```bash
# Проверяем текущее состояние
ufw status verbose

# Открываем необходимые порты для TURN
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 5349/tcp
ufw allow 10000:20000/udp

# Если firewall не активен, активируем
ufw --force enable

# Проверяем результат
ufw status numbered
```

### 4. 🚀 Запуск и проверка сервиса

```bash
# Останавливаем сервис
systemctl stop coturn

# Применяем новую конфигурацию
systemctl daemon-reload

# Запускаем
systemctl start coturn

# Включаем автозапуск
systemctl enable coturn

# Проверяем статус
systemctl status coturn

# Проверяем что слушает порты
ss -tuln | grep 3478
```

### 5. 🔍 Проверка логов

```bash
# Мониторим логи в реальном времени
tail -f /var/log/turnserver.log

# Или через journalctl
journalctl -u coturn -f
```

**Хорошие логи должны показывать:**
```
Session 001000000000000001: new TURN session requested
Session 001000000000000001: realm <malmik5482-videocall-fc69.twc1.net> user <webrtc>: incoming packet ALLOCATE processed, success
```

### 6. 🧪 Тестирование из приложения

После настройки откройте приложение и нажмите кнопку **🔍** рядом с "TURN Сервер" для запуска диагностики.

**Ожидаемые результаты:**
- ✅ TURN connectivity: success
- ✅ STUN functionality: working
- ✅ **TURN relay: success** ← САМОЕ ВАЖНОЕ
- ✅ Latency: < 200ms
- ✅ Transport methods: UDP и TCP работают

## 🚨 Критические проблемы и решения

### Проблема 1: "TURN relay не функционирует"
```bash
# Проверьте права доступа
chown turnserver:turnserver /etc/turnserver.conf
chmod 640 /etc/turnserver.conf

# Проверьте что процесс запущен от правильного пользователя
ps aux | grep turnserver
```

### Проблема 2: "Connection timeout"
```bash
# Проверьте что сервис слушает на всех интерфейсах
netstat -tuln | grep 3478
# Должно быть: 0.0.0.0:3478, НЕ 127.0.0.1:3478

# Если слушает только localhost, исправьте в конфигурации:
listening-ip=0.0.0.0
```

### Проблема 3: "Authentication failed"
```bash
# Проверьте пользователя в /etc/turnserver.conf
# Должно быть точно:
user=webrtc:pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN

# И убедитесь что включена аутентификация:
lt-cred-mech
```

## 🇷🇺 Специальные настройки для российских операторов

### МТС - сложный NAT
```ini
# Добавьте в turnserver.conf для МТС
no-stun-backward-compatibility
mobility
```

### Tele2/Yota - проблемы с UDP
```ini
# Приоритизируем TCP для Tele2
tcp-proxy-port=3478
```

### Всем операторам - расширенный диапазон портов
```ini
# Больше портов для российского NAT
min-port=10000
max-port=30000
```

## 📊 Мониторинг производительности

### Команды для проверки нагрузки

```bash
# Активные соединения
netstat -an | grep :3478 | wc -l

# Использование портов relay
netstat -an | grep ":1[0-9][0-9][0-9][0-9]" | wc -l

# Загрузка CPU и памяти
top -p $(pgrep turnserver)

# Статистика сетевого трафика
iftop -i eth0
```

### Логирование статистики

Добавьте в `/etc/turnserver.conf`:
```ini
# Подробная статистика
new-log-timestamp
log-binding
simple-log
```

## 🎯 Финальная проверка

После всех настроек выполните:

1. **Перезапустите VPS** (если возможно):
   ```bash
   reboot
   ```

2. **Проверьте автозапуск**:
   ```bash
   systemctl is-enabled coturn
   systemctl is-active coturn
   ```

3. **Запустите диагностику из приложения** - должны получить оценку **A** или **B**

4. **Протестируйте реальный звонок** между двумя мобильными устройствами

## ⚡ Быстрое исправление (если ничего не помогает)

Если проблемы продолжаются, выполните полную переустановку:

```bash
# Удаляем coturn
apt remove --purge coturn

# Устанавливаем заново
apt update
apt install coturn

# Создаем конфигурацию заново с настройками выше
nano /etc/turnserver.conf

# Запускаем
systemctl enable coturn
systemctl start coturn
```

## 📞 Ожидаемый результат

После правильной настройки:
- ✅ **Стабильные видеозвонки** между мобильными устройствами
- ✅ **Качество HD** даже на 3G/4G
- ✅ **Быстрое соединение** (5-10 секунд)
- ✅ **Без зависаний** и артефактов

---

## 🆘 Если ничего не помогает

1. **Отправьте вывод команд**:
   ```bash
   systemctl status coturn
   cat /etc/turnserver.conf
   netstat -tuln | grep 3478
   journalctl -u coturn --no-pager -l | tail -20
   ```

2. **Проверьте приложение** - диагностика должна показать конкретные ошибки

3. **Рассмотрите альтернативы**:
   - Используйте публичные TURN серверы как backup
   - Переместите TURN на другой порт (например, 443)
   - Используйте TURN через TLS (port 5349)