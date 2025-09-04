# 🚀 КОМАНДЫ ДЛЯ ИСПРАВЛЕНИЯ TURN СЕРВЕРА

## 🎯 ВАРИАНТ 1: Полная пересборка (рекомендуется)

Скопируйте и вставьте эти команды в консоль VPS:

```bash
# Скачиваем и запускаем автоматический скрипт исправления
curl -sSL https://raw.githubusercontent.com/malmik5482/VideoCall/main/fix-turn-server.sh | bash
```

**ИЛИ создайте файл вручную:**

```bash
# 1. Создаем скрипт
cat > fix-turn-server.sh << 'SCRIPT_END'
#!/bin/bash
set -e
echo "🚀 Исправляем TURN сервер..."

# Останавливаем старый coturn
systemctl stop coturn 2>/dev/null || echo "coturn уже остановлен"

# Полностью удаляем и переустанавливаем
apt-get remove --purge coturn -y
apt-get update
apt-get install coturn -y

# Получаем внешний IP
EXTERNAL_IP=$(curl -s ifconfig.me || echo "94.198.218.189")
echo "Внешний IP: $EXTERNAL_IP"

# Создаем правильную конфигурацию
cat > /etc/turnserver.conf << 'EOF'
listening-port=3478
listening-ip=0.0.0.0
relay-ip=EXTERNAL_IP_PLACEHOLDER
external-ip=EXTERNAL_IP_PLACEHOLDER

lt-cred-mech
user=webrtc:pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN
realm=malmik5482-videocall-fc69.twc1.net

min-port=10000
max-port=20000

verbose
log-file=/var/log/turnserver.log

denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255

no-cli
fingerprint
mobility
tcp-proxy-port=3478
EOF

# Заменяем IP
sed -i "s/EXTERNAL_IP_PLACEHOLDER/$EXTERNAL_IP/g" /etc/turnserver.conf

# Права доступа
chown turnserver:turnserver /etc/turnserver.conf
chmod 640 /etc/turnserver.conf

# Включаем сервис
echo 'TURNSERVER_ENABLED=1' > /etc/default/coturn

# Firewall
ufw --force enable
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 10000:20000/udp

# Запускаем
systemctl enable coturn
systemctl start coturn

sleep 3

echo "✅ РЕЗУЛЬТАТ:"
systemctl status coturn --no-pager -l
echo ""
netstat -tuln | grep 3478
echo ""
echo "🎯 TURN сервер настроен! Тестируйте приложение."
SCRIPT_END

# 2. Запускаем скрипт
chmod +x fix-turn-server.sh
bash fix-turn-server.sh
```

---

## ⚡ ВАРИАНТ 2: Быстрое исправление (если торопитесь)

```bash
# Останавливаем coturn
systemctl stop coturn

# Получаем внешний IP
EXTERNAL_IP=$(curl -s ifconfig.me)
echo "Внешний IP: $EXTERNAL_IP"

# Создаем правильную конфигурацию
cat > /etc/turnserver.conf << EOF
listening-port=3478
listening-ip=0.0.0.0
relay-ip=$EXTERNAL_IP
external-ip=$EXTERNAL_IP

lt-cred-mech
user=webrtc:pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN
realm=malmik5482-videocall-fc69.twc1.net

min-port=10000
max-port=20000

verbose
log-file=/var/log/turnserver.log

denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255  
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255

no-cli
fingerprint
EOF

# Права и сервис
chown turnserver:turnserver /etc/turnserver.conf
chmod 640 /etc/turnserver.conf
echo 'TURNSERVER_ENABLED=1' > /etc/default/coturn

# Firewall
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 10000:20000/udp

# Запускаем
systemctl enable coturn
systemctl start coturn

# Проверяем результат
sleep 2
systemctl status coturn --no-pager
netstat -tuln | grep 3478
echo "✅ Готово!"
```

---

## 🔍 ПРОВЕРКА ПОСЛЕ ИСПРАВЛЕНИЯ:

```bash
# Проверяем что все работает
systemctl status coturn
netstat -tuln | grep 3478  
journalctl -u coturn --no-pager -l | tail -10
```

**Ожидаемый результат:**
- ✅ `Active: active (running)` 
- ✅ `tcp  0.0.0.0:3478` (НЕ 127.0.0.1!)
- ✅ `udp  0.0.0.0:3478` (НЕ 127.0.0.1!)

---

## 🎯 ПОСЛЕ ИСПРАВЛЕНИЯ:

1. **Обновите** страницу вашего VideoChat приложения
2. **Нажмите 🔍** для новой диагностики TURN
3. **Должны получить оценку A или B+**
4. **Протестируйте звонок** - качество должно стать отличным!

---

## 🆘 ЕСЛИ ПРОБЛЕМЫ ОСТАЛИСЬ:

```bash
# Смотрим логи в реальном времени
journalctl -u coturn -f

# Или файл логов
tail -f /var/log/turnserver.log

# Проверяем процессы
ps aux | grep turnserver
```

**Критические моменты:**
- TURN должен слушать на `0.0.0.0:3478`, НЕ на `127.0.0.1:3478`
- Firewall должен разрешать порты 3478 и 10000-20000
- Пользователь `webrtc` должен быть настроен с паролем `pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN`