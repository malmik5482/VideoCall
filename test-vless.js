// Тест VLESS подключения
const WebSocket = require('ws');

console.log('🧪 Тестируем VLESS WebSocket proxy...');

// Подключаемся к прокси
const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
    console.log('✅ WebSocket подключен к прокси');
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        console.log('📨 Получено сообщение:', message);
        
        if (message.type === 'vless-connected') {
            console.log('🎉 VLESS туннель успешно установлен!');
            
            // Отправим тестовые данные
            setTimeout(() => {
                console.log('📤 Отправляем тестовые данные...');
                ws.send(JSON.stringify({
                    type: 'webrtc-data',
                    data: 'test-payload'
                }));
            }, 1000);
            
            // Закроем через 5 секунд
            setTimeout(() => {
                console.log('🔚 Закрываем соединение');
                ws.close();
            }, 5000);
        }
    } catch (error) {
        console.log('📦 Получены бинарные данные:', data.length, 'байт');
    }
});

ws.on('close', () => {
    console.log('🔌 WebSocket соединение закрыто');
    process.exit(0);
});

ws.on('error', (error) => {
    console.error('❌ WebSocket ошибка:', error.message);
    process.exit(1);
});

// Таймаут для теста
setTimeout(() => {
    console.log('⏰ Тест завершен по таймауту');
    ws.close();
    process.exit(0);
}, 15000);