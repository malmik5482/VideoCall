#!/bin/bash

# =============================================================================
# ⚡ БЫСТРОЕ ИСПРАВЛЕНИЕ TURN СЕРВЕРА (БЕЗ ПЕРЕУСТАНОВКИ)
# =============================================================================
# Запуск: bash quick-fix-turn.sh

set -e

echo "⚡ Быстрое исправление TURN сервера для российских мобильных сетей..."
echo "📅 $(date)"

# Получаем внешний IP
EXTERNAL_IP=$(curl -s ifconfig.me || echo "94.198.218.189")
echo "🌐 Внешний IP: $EXTERNAL_IP"

# Останавливаем coturn
systemctl stop coturn

# Создаем бэкап старой конфигурации
cp /etc/turnserver.conf /etc/turnserver.conf.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || echo "Старого конфига нет"

# Создаем правильную конфигурацию
cat > /etc/turnserver.conf << EOF
# Основные настройки
listening-port=3478
listening-ip=0.0.0.0
relay-ip=$EXTERNAL_IP
external-ip=$EXTERNAL_IP

# Аутентификация  
lt-cred-mech
user=webrtc:pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN
realm=malmik5482-videocall-fc69.twc1.net

# Порты для relay
min-port=10000
max-port=20000

# Логирование
verbose
log-file=/var/log/turnserver.log

# Безопасность
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255

no-cli
fingerprint
EOF

# Устанавливаем права
chown turnserver:turnserver /etc/turnserver.conf
chmod 640 /etc/turnserver.conf

# Включаем coturn
echo 'TURNSERVER_ENABLED=1' > /etc/default/coturn

# Открываем порты в firewall
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 10000:20000/udp

# Запускаем
systemctl enable coturn
systemctl start coturn

sleep 2

echo ""
echo "🔍 ПРОВЕРКА РЕЗУЛЬТАТА:"
systemctl status coturn --no-pager -l
echo ""
echo "🌐 Проверяем порты:"
netstat -tuln | grep 3478
echo ""
echo "✅ ГОТОВО! Тестируйте приложение."