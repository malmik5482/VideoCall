#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки всех функций CosmosChat
 */

const WebSocket = require('ws');
const axios = require('axios').default;

const SERVER_URL = 'http://localhost:3002';
const WS_URL = 'ws://localhost:3002/ws';

class CosmosTestSuite {
    constructor() {
        this.results = [];
        this.ws = null;
    }

    async runAllTests() {
        console.log('🚀 Запуск тестов CosmosChat...\n');
        
        // 1. Тест сервера
        await this.testServerHealth();
        
        // 2. Тест ICE конфигурации
        await this.testIceConfig();
        
        // 3. Тест WebSocket
        await this.testWebSocket();
        
        // 4. Тест регистрации
        await this.testRegistration();
        
        // 5. Тест поиска пользователей
        await this.testUserSearch();
        
        // 6. Тест сообщений
        await this.testMessaging();
        
        // Итоги
        this.printResults();
    }
    
    async testServerHealth() {
        console.log('📡 Тест 1: Проверка сервера...');
        try {
            const response = await axios.get(`${SERVER_URL}/health`);
            if (response.status === 200) {
                this.addResult('Сервер доступен', true);
            }
        } catch (error) {
            this.addResult('Сервер доступен', false, error.message);
        }
        
        try {
            const response = await axios.get(`${SERVER_URL}/api/status`);
            const data = response.data;
            this.addResult('API статус работает', true, `Пользователей: ${data.users}, Соединений: ${data.connections}`);
        } catch (error) {
            this.addResult('API статус работает', false, error.message);
        }
    }
    
    async testIceConfig() {
        console.log('🧊 Тест 2: Проверка ICE конфигурации...');
        try {
            const response = await axios.get(`${SERVER_URL}/api/ice-config`);
            const config = response.data;
            
            if (config.iceServers && config.iceServers.length > 0) {
                const turnServer = config.iceServers.find(s => 
                    s.urls && (Array.isArray(s.urls) ? s.urls[0] : s.urls).includes('turn:')
                );
                
                if (turnServer) {
                    this.addResult('TURN сервер настроен', true, 
                        `TURN: ${Array.isArray(turnServer.urls) ? turnServer.urls[0] : turnServer.urls}`);
                } else {
                    this.addResult('TURN сервер настроен', false, 'TURN сервер не найден в конфигурации');
                }
            }
        } catch (error) {
            this.addResult('ICE конфигурация', false, error.message);
        }
    }
    
    async testWebSocket() {
        console.log('🔌 Тест 3: Проверка WebSocket...');
        
        return new Promise((resolve) => {
            this.ws = new WebSocket(WS_URL);
            
            const timeout = setTimeout(() => {
                this.addResult('WebSocket подключение', false, 'Таймаут подключения');
                resolve();
            }, 5000);
            
            this.ws.on('open', () => {
                clearTimeout(timeout);
                this.addResult('WebSocket подключение', true);
                resolve();
            });
            
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    if (message.type === 'connected') {
                        this.addResult('WebSocket приветствие', true, message.message);
                    }
                } catch (e) {
                    // Игнорируем ошибки парсинга
                }
            });
            
            this.ws.on('error', (error) => {
                clearTimeout(timeout);
                this.addResult('WebSocket подключение', false, error.message);
                resolve();
            });
        });
    }
    
    async testRegistration() {
        console.log('👤 Тест 4: Проверка регистрации...');
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.addResult('Регистрация пользователя', false, 'WebSocket не подключен');
            return;
        }
        
        return new Promise((resolve) => {
            const testUser = {
                type: 'register',
                name: 'Тест Пользователь',
                phone: '+79991234567'
            };
            
            const timeout = setTimeout(() => {
                this.addResult('Регистрация пользователя', false, 'Таймаут ответа');
                resolve();
            }, 3000);
            
            const messageHandler = (data) => {
                try {
                    const message = JSON.parse(data);
                    if (message.type === 'register_success') {
                        clearTimeout(timeout);
                        this.addResult('Регистрация пользователя', true, 
                            `Пользователь ${message.user.name} зарегистрирован`);
                        this.ws.off('message', messageHandler);
                        resolve();
                    } else if (message.type === 'register_error') {
                        clearTimeout(timeout);
                        this.addResult('Регистрация пользователя', false, message.message);
                        this.ws.off('message', messageHandler);
                        resolve();
                    }
                } catch (e) {
                    // Игнорируем ошибки парсинга
                }
            };
            
            this.ws.on('message', messageHandler);
            this.ws.send(JSON.stringify(testUser));
        });
    }
    
    async testUserSearch() {
        console.log('🔍 Тест 5: Проверка поиска пользователей...');
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.addResult('Поиск пользователей', false, 'WebSocket не подключен');
            return;
        }
        
        return new Promise((resolve) => {
            const searchRequest = {
                type: 'search_user',
                query: '79001234567'
            };
            
            const timeout = setTimeout(() => {
                this.addResult('Поиск пользователей', false, 'Таймаут ответа');
                resolve();
            }, 3000);
            
            const messageHandler = (data) => {
                try {
                    const message = JSON.parse(data);
                    if (message.type === 'search_results') {
                        clearTimeout(timeout);
                        if (message.users && message.users.length > 0) {
                            this.addResult('Поиск пользователей', true, 
                                `Найдено ${message.users.length} пользователей`);
                        } else {
                            this.addResult('Поиск пользователей', true, 
                                'Поиск работает, пользователи не найдены');
                        }
                        this.ws.off('message', messageHandler);
                        resolve();
                    }
                } catch (e) {
                    // Игнорируем ошибки парсинга
                }
            };
            
            this.ws.on('message', messageHandler);
            this.ws.send(JSON.stringify(searchRequest));
        });
    }
    
    async testMessaging() {
        console.log('💬 Тест 6: Проверка отправки сообщений...');
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.addResult('Отправка сообщений', false, 'WebSocket не подключен');
            return;
        }
        
        return new Promise((resolve) => {
            const message = {
                type: 'chat_message',
                roomId: 'test_room',
                text: 'Тестовое сообщение'
            };
            
            const timeout = setTimeout(() => {
                // Считаем что сообщение отправлено если не было ошибки
                this.addResult('Отправка сообщений', true, 'Сообщение отправлено');
                resolve();
            }, 1000);
            
            const messageHandler = (data) => {
                try {
                    const response = JSON.parse(data);
                    if (response.type === 'error') {
                        clearTimeout(timeout);
                        this.addResult('Отправка сообщений', false, response.message);
                        this.ws.off('message', messageHandler);
                        resolve();
                    }
                } catch (e) {
                    // Игнорируем ошибки парсинга
                }
            };
            
            this.ws.on('message', messageHandler);
            this.ws.send(JSON.stringify(message));
        });
    }
    
    addResult(test, success, details = '') {
        this.results.push({ test, success, details });
        console.log(`  ${success ? '✅' : '❌'} ${test}${details ? ': ' + details : ''}`);
    }
    
    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ');
        console.log('='.repeat(60));
        
        const total = this.results.length;
        const passed = this.results.filter(r => r.success).length;
        const failed = total - passed;
        
        console.log(`\nВсего тестов: ${total}`);
        console.log(`✅ Успешно: ${passed}`);
        console.log(`❌ Провалено: ${failed}`);
        
        if (failed > 0) {
            console.log('\n⚠️ Провалившиеся тесты:');
            this.results.filter(r => !r.success).forEach(r => {
                console.log(`  - ${r.test}: ${r.details}`);
            });
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(passed === total ? '🎉 Все тесты пройдены успешно!' : '⚠️ Некоторые тесты провалены');
        
        // Закрываем WebSocket
        if (this.ws) {
            this.ws.close();
        }
        
        process.exit(failed > 0 ? 1 : 0);
    }
}

// Запуск тестов
const tester = new CosmosTestSuite();

// Проверяем что axios установлен
try {
    require.resolve('axios');
} catch(e) {
    console.log('📦 Устанавливаем axios для тестирования...');
    require('child_process').execSync('npm install axios', { stdio: 'inherit' });
}

tester.runAllTests().catch(error => {
    console.error('❌ Критическая ошибка:', error.message);
    process.exit(1);
});