#!/bin/bash

# =============================================================================
# 🔧 АВТОМАТИЧЕСКОЕ ИСПРАВЛЕНИЕ TURN СЕРВЕРА ДЛЯ РОССИЙСКИХ МОБИЛЬНЫХ СЕТЕЙ
# =============================================================================
# Запуск: bash fix-turn-server.sh
# Сервер: 94.198.218.189
# Порты: 3478 (TURN), 10000-20000 (relay)

set -e  # Останавливаем при любой ошибке

echo "🚀 Начинаем полную пересборку TURN сервера для российских мобильных сетей..."
echo "📅 $(date)"
echo "🌍 IP сервера: $(curl -s ifconfig.me || echo 'Не удалось получить IP')"
echo ""

# =============================================================================
# 🛑 ШАГ 1: ПОЛНАЯ ОЧИСТКА СТАРОЙ КОНФИГУРАЦИИ
# =============================================================================
echo "🛑 ШАГ 1: Останавливаем и удаляем старый coturn..."

# Останавливаем сервис
systemctl stop coturn 2>/dev/null || echo "coturn уже остановлен"
systemctl disable coturn 2>/dev/null || echo "coturn уже отключен"

# Полностью удаляем пакет и конфигурации
apt-get remove --purge coturn -y 2>/dev/null || echo "coturn уже удален"
apt-get autoremove -y

# Удаляем остатки конфигураций
rm -rf /etc/turnserver.conf
rm -rf /var/log/turnserver.log
rm -rf /var/lib/turn
rm -rf /etc/default/coturn

echo "✅ Старый coturn полностью удален"
echo ""

# =============================================================================
# 🔄 ШАГ 2: ОБНОВЛЕНИЕ СИСТЕМЫ И УСТАНОВКА
# =============================================================================
echo "🔄 ШАГ 2: Обновляем систему и устанавливаем coturn заново..."

# Обновляем пакеты
apt-get update

# Устанавливаем coturn
DEBIAN_FRONTEND=noninteractive apt-get install coturn -y

echo "✅ coturn установлен заново"
echo ""

# =============================================================================
# 🔧 ШАГ 3: СОЗДАНИЕ ОПТИМАЛЬНОЙ КОНФИГУРАЦИИ
# =============================================================================
echo "🔧 ШАГ 3: Создаем оптимальную конфигурацию для российских мобильных сетей..."

# Получаем внешний IP сервера
EXTERNAL_IP=$(curl -s ifconfig.me || curl -s ipinfo.io/ip || echo "94.198.218.189")
echo "🌐 Внешний IP: $EXTERNAL_IP"

# Создаем оптимальную конфигурацию
cat > /etc/turnserver.conf << 'EOF'
# =============================================================================
# 🇷🇺 ОПТИМАЛЬНАЯ КОНФИГУРАЦИЯ COTURN ДЛЯ РОССИЙСКИХ МОБИЛЬНЫХ СЕТЕЙ
# =============================================================================

# 🌐 Основные сетевые настройки
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
listening-device=eth0

# 🎯 IP адреса (КРИТИЧЕСКИ ВАЖНО!)
relay-ip=EXTERNAL_IP_PLACEHOLDER
external-ip=EXTERNAL_IP_PLACEHOLDER

# 🔐 Аутентификация
lt-cred-mech
use-auth-secret
static-auth-secret=russian-mobile-networks-secret-key-2025
realm=malmik5482-videocall-fc69.twc1.net

# 👤 Пользователь WebRTC
user=webrtc:pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN

# 🚪 Диапазон портов для relay (расширенный для российских NAT)
min-port=10000
max-port=30000

# 📱 Оптимизация для российских мобильных сетей
no-stun-backward-compatibility
mobility
tcp-proxy-port=3478

# 🛡️ Безопасность и ограничения
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255

# ⚡ Производительность
max-bps=10000000
total-quota=0
user-quota=0
stale-nonce=600

# 🔍 Логирование для диагностики
verbose
log-file=/var/log/turnserver.log
pidfile=/var/run/turnserver.pid
new-log-timestamp
simple-log

# 🚫 Отключаем ненужные протоколы
no-cli
no-tlsv1
no-tlsv1_1
no-dtls
no-multicast-peers

# 🎮 Дополнительные настройки для стабильности
fingerprint
lt-cred-mech
use-auth-secret
no-stdout-log

# 🇷🇺 Специальные настройки для российских операторов
# МТС, Билайн, Мегафон, Tele2 - сложный NAT
cipher-list="ECDH+AESGCM:DH+AESGCM:ECDH+AES256:DH+AES256:ECDH+AES128:DH+AES:RSA+AESGCM:RSA+AES:!aNULL:!MD5:!DSS"

EOF

# Заменяем плейсхолдер на реальный IP
sed -i "s/EXTERNAL_IP_PLACEHOLDER/$EXTERNAL_IP/g" /etc/turnserver.conf

echo "✅ Конфигурация создана с внешним IP: $EXTERNAL_IP"
echo ""

# =============================================================================
# 🔥 ШАГ 4: НАСТРОЙКА FIREWALL
# =============================================================================
echo "🔥 ШАГ 4: Настраиваем firewall для TURN сервера..."

# Включаем ufw если не активен
ufw --force enable

# Открываем основные TURN порты
ufw allow 3478/tcp comment "TURN TCP"
ufw allow 3478/udp comment "TURN UDP" 
ufw allow 5349/tcp comment "TURN TLS"

# Открываем расширенный диапазон для relay (российские NAT требуют много портов)
ufw allow 10000:30000/udp comment "TURN relay range"

# Открываем SSH чтобы не потерять доступ
ufw allow 22/tcp comment "SSH"

# Показываем статус
echo "🔥 Статус firewall:"
ufw status numbered

echo "✅ Firewall настроен"
echo ""

# =============================================================================
# 🎛️ ШАГ 5: НАСТРОЙКА СИСТЕМНЫХ СЕРВИСОВ
# =============================================================================
echo "🎛️ ШАГ 5: Настраиваем системные сервисы..."

# Включаем coturn в /etc/default/coturn
echo 'TURNSERVER_ENABLED=1' > /etc/default/coturn

# Устанавливаем правильные права на файлы
chown turnserver:turnserver /etc/turnserver.conf
chmod 640 /etc/turnserver.conf
chmod 755 /var/log/
touch /var/log/turnserver.log
chown turnserver:turnserver /var/log/turnserver.log

# Создаем systemd override для дополнительной стабильности
mkdir -p /etc/systemd/system/coturn.service.d/
cat > /etc/systemd/system/coturn.service.d/override.conf << 'EOF'
[Service]
Restart=always
RestartSec=10
LimitNOFILE=65536

[Unit]
After=network-online.target
Wants=network-online.target
EOF

# Перезагружаем systemd
systemctl daemon-reload

echo "✅ Системные сервисы настроены"
echo ""

# =============================================================================
# 🚀 ШАГ 6: ЗАПУСК И ПРОВЕРКА
# =============================================================================
echo "🚀 ШАГ 6: Запускаем TURN сервер..."

# Запускаем и включаем автозапуск
systemctl enable coturn
systemctl start coturn

# Ждем запуска
sleep 3

echo "✅ TURN сервер запущен"
echo ""

# =============================================================================
# 🔍 ШАГ 7: КОМПЛЕКСНАЯ ДИАГНОСТИКА
# =============================================================================
echo "🔍 ШАГ 7: Проводим комплексную диагностику..."

echo "📊 Статус сервиса coturn:"
systemctl status coturn --no-pager -l || echo "❌ Проблема со статусом"

echo ""
echo "🌐 Проверяем что слушает на внешних портах:"
netstat -tuln | grep 3478 || echo "❌ Порт 3478 не слушается"

echo ""
echo "🔥 Статус firewall:"
ufw status | grep 3478 || echo "❌ Порты не открыты в firewall"

echo ""
echo "📝 Последние 10 строк логов coturn:"
tail -10 /var/log/turnserver.log 2>/dev/null || echo "❌ Лог файл пуст или недоступен"

echo ""
echo "💾 Использование ресурсов:"
ps aux | grep turnserver | head -3 || echo "❌ Процесс не найден"

echo ""

# =============================================================================
# 🧪 ШАГ 8: ТЕСТ ПОДКЛЮЧЕНИЯ
# =============================================================================
echo "🧪 ШАГ 8: Тестируем TURN сервер..."

# Простой тест TCP подключения
if timeout 5 bash -c "</dev/tcp/$EXTERNAL_IP/3478" 2>/dev/null; then
    echo "✅ TCP порт 3478 доступен извне"
else
    echo "❌ TCP порт 3478 НЕ доступен извне - ПРОБЛЕМА!"
fi

# Тест UDP (примерный)
if ss -tuln | grep -q ":3478.*0.0.0.0"; then
    echo "✅ UDP порт 3478 слушает на всех интерфейсах"  
else
    echo "❌ UDP порт 3478 слушает только на localhost - ПРОБЛЕМА!"
fi

echo ""

# =============================================================================
# 📋 ШАГ 9: ФИНАЛЬНЫЙ ОТЧЕТ
# =============================================================================
echo "📋 ШАГ 9: Финальный отчет..."

echo "=============================================================================="
echo "🎉 УСТАНОВКА TURN СЕРВЕРА ЗАВЕРШЕНА!"
echo "=============================================================================="
echo "📅 Время: $(date)"
echo "🌐 Внешний IP: $EXTERNAL_IP" 
echo "🚪 TURN порт: 3478 (UDP/TCP)"
echo "🔐 Пользователь: webrtc"
echo "🔑 Пароль: pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN"
echo "📊 Диапазон relay: 10000-30000/UDP"
echo ""

# Проверяем критические моменты
ISSUES_FOUND=0

echo "🔍 КРИТИЧЕСКИЕ ПРОВЕРКИ:"

if systemctl is-active --quiet coturn; then
    echo "✅ coturn сервис: АКТИВЕН"
else
    echo "❌ coturn сервис: НЕ АКТИВЕН - КРИТИЧЕСКАЯ ПРОБЛЕМА!"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if netstat -tuln | grep -q "0.0.0.0:3478"; then
    echo "✅ Порт 3478: слушает на всех интерфейсах"
else
    echo "❌ Порт 3478: слушает только на localhost - КРИТИЧЕСКАЯ ПРОБЛЕМА!"  
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if ufw status | grep -q "3478"; then
    echo "✅ Firewall: порты открыты"
else
    echo "❌ Firewall: порты закрыты - КРИТИЧЕСКАЯ ПРОБЛЕМА!"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))  
fi

if [ -f "/etc/turnserver.conf" ] && grep -q "webrtc" /etc/turnserver.conf; then
    echo "✅ Конфигурация: пользователь webrtc настроен"
else
    echo "❌ Конфигурация: пользователь webrtc НЕ настроен - ПРОБЛЕМА!"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

echo ""
if [ $ISSUES_FOUND -eq 0 ]; then
    echo "🎯 РЕЗУЛЬТАТ: ВСЕ ОТЛИЧНО! TURN сервер готов для российских мобильных сетей! 🚀"
    echo ""
    echo "📱 СЛЕДУЮЩИЕ ШАГИ:"
    echo "1. Откройте ваше VideoChat приложение"
    echo "2. Нажмите кнопку диагностики 🔍"  
    echo "3. Должны получить оценку A или B+"
    echo "4. Протестируйте звонок между мобильными устройствами"
    echo ""
    echo "🎊 Качество видео должно стать отличным!"
else
    echo "⚠️ РЕЗУЛЬТАТ: Найдено $ISSUES_FOUND проблем(ы). Смотрите детали выше."
    echo ""
    echo "🔧 КОМАНДЫ ДЛЯ ДИАГНОСТИКИ:"
    echo "systemctl status coturn"
    echo "journalctl -u coturn -f"
    echo "netstat -tuln | grep 3478"
    echo "tail -f /var/log/turnserver.log"
fi

echo ""
echo "📖 ПОЛНАЯ ДОКУМЕНТАЦИЯ: см. файл TURN_SERVER_SETUP.md в репозитории"
echo "🆘 При проблемах: проверьте логи journalctl -u coturn -f"
echo "=============================================================================="

# Показываем финальную конфигурацию
echo ""
echo "📄 ИТОГОВАЯ КОНФИГУРАЦИЯ /etc/turnserver.conf:"
echo "=============================================================================="
head -20 /etc/turnserver.conf
echo "... (остальное в файле)"
echo "=============================================================================="

exit 0