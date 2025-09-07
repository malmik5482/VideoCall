// Глобальные переменные и настройки
class VideoCallApp {
    constructor() {
        this.websocket = null;
        this.peerConnection = null;
        this.localStream = null;
        this.currentRoom = null;
        this.userRole = null;
        this.iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
        
        // Настройки медиа
        this.videoConstraints = {
            width: { ideal: 1280, min: 640, max: 1920 },
            height: { ideal: 720, min: 360, max: 1080 },
            frameRate: { ideal: 30, max: 60 }
        };
        
        this.audioConstraints = {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        };
        
        // Флаги состояния
        this.isVideoEnabled = true;
        this.isAudioEnabled = true;
        this.isScreenSharing = false;
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadIceConfiguration();
        this.loadCallHistory();
        this.checkMediaDevices();
    }
    
    initializeElements() {
        // DOM элементы
        this.elements = {
            // Управление подключением
            roomInput: document.getElementById('roomInput'),
            joinButton: document.getElementById('joinButton'),
            leaveButton: document.getElementById('leaveButton'),
            
            // Статус подключения
            statusDot: document.getElementById('statusDot'),
            statusText: document.getElementById('statusText'),
            connectionInfo: document.getElementById('connectionInfo'),
            
            // Видео элементы
            localVideo: document.getElementById('localVideo'),
            remoteVideo: document.getElementById('remoteVideo'),
            
            // Управление медиа
            toggleVideo: document.getElementById('toggleVideo'),
            toggleAudio: document.getElementById('toggleAudio'),
            shareScreen: document.getElementById('shareScreen'),
            localVideoToggle: document.getElementById('localVideoToggle'),
            localAudioToggle: document.getElementById('localAudioToggle'),
            
            // Чат
            chatMessages: document.getElementById('chatMessages'),
            chatInput: document.getElementById('chatInput'),
            sendMessage: document.getElementById('sendMessage'),
            toggleChat: document.getElementById('toggleChat'),
            chatContainer: document.getElementById('chatContainer'),
            
            // История
            historyList: document.getElementById('historyList'),
            refreshHistory: document.getElementById('refreshHistory'),
            clearHistory: document.getElementById('clearHistory'),
            
            // Модальные окна
            errorModal: document.getElementById('errorModal'),
            errorMessage: document.getElementById('errorMessage'),
            closeError: document.getElementById('closeError'),
            
            // Уведомления
            notifications: document.getElementById('notifications')
        };
        
        // Настройка видео элементов
        this.elements.localVideo.muted = true;
        this.elements.localVideo.playsInline = true;
        this.elements.remoteVideo.playsInline = true;
    }
    
    attachEventListeners() {
        // Подключение к комнате
        this.elements.joinButton.addEventListener('click', () => this.joinRoom());
        this.elements.leaveButton.addEventListener('click', () => this.leaveRoom());
        this.elements.roomInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        
        // Управление медиа
        this.elements.toggleVideo.addEventListener('click', () => this.toggleVideo());
        this.elements.toggleAudio.addEventListener('click', () => this.toggleAudio());
        this.elements.shareScreen.addEventListener('click', () => this.toggleScreenShare());
        this.elements.localVideoToggle.addEventListener('click', () => this.toggleVideo());
        this.elements.localAudioToggle.addEventListener('click', () => this.toggleAudio());
        
        // Чат
        this.elements.sendMessage.addEventListener('click', () => this.sendChatMessage());
        this.elements.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });
        this.elements.toggleChat.addEventListener('click', () => this.toggleChatVisibility());
        
        // История
        this.elements.refreshHistory.addEventListener('click', () => this.loadCallHistory());
        this.elements.clearHistory.addEventListener('click', () => this.clearCallHistory());
        
        // Модальные окна
        this.elements.closeError.addEventListener('click', () => this.hideErrorModal());
        
        // Обработка ошибок медиа
        this.elements.localVideo.addEventListener('error', (e) => {
            console.warn('Ошибка локального видео:', e);
        });
        this.elements.remoteVideo.addEventListener('error', (e) => {
            console.warn('Ошибка удаленного видео:', e);
        });
    }
    
    async loadIceConfiguration() {
        try {
            const response = await fetch('/config');
            const config = await response.json();
            if (config && Array.isArray(config.iceServers)) {
                this.iceServers = config.iceServers;
                console.log('ICE серверы загружены:', this.iceServers.length);
            }
        } catch (error) {
            console.warn('Не удалось загрузить ICE конфигурацию:', error.message);
            this.showNotification('Использую базовые настройки подключения', 'warning');
        }
    }
    
    async checkMediaDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasVideo = devices.some(device => device.kind === 'videoinput');
            const hasAudio = devices.some(device => device.kind === 'audioinput');
            
            if (!hasVideo) {
                console.warn('Видеокамера не обнаружена');
                this.elements.toggleVideo.disabled = true;
            }
            if (!hasAudio) {
                console.warn('Микрофон не обнаружен');
                this.elements.toggleAudio.disabled = true;
            }
        } catch (error) {
            console.warn('Не удалось проверить медиа устройства:', error.message);
        }
    }
    
    async joinRoom() {
        const roomName = this.elements.roomInput.value.trim();
        if (!roomName) {
            this.showError('Пожалуйста, введите код комнаты');
            return;
        }
        
        try {
            this.setConnectionStatus('connecting', 'Подключение...');
            await this.startLocalMedia();
            this.connectWebSocket(roomName);
            this.currentRoom = roomName;
            
            this.elements.joinButton.disabled = true;
            this.elements.leaveButton.disabled = false;
            this.elements.roomInput.disabled = true;
            
        } catch (error) {
            console.error('Ошибка подключения к комнате:', error);
            this.showError('Не удалось подключиться к комнате: ' + error.message);
            this.setConnectionStatus('offline', 'Не подключено');
        }
    }
    
    leaveRoom() {
        if (this.websocket) {
            this.sendWebSocketMessage({ type: 'leave' });
        }
        
        this.cleanup();
        this.setConnectionStatus('offline', 'Не подключено');
        this.elements.connectionInfo.textContent = 'Ожидание подключения...';
        
        this.elements.joinButton.disabled = false;
        this.elements.leaveButton.disabled = true;
        this.elements.roomInput.disabled = false;
        
        this.currentRoom = null;
        this.userRole = null;
        
        this.showNotification('Вы покинули комнату', 'info');
        this.loadCallHistory();
    }
    
    cleanup() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
            });
            this.localStream = null;
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        
        this.elements.localVideo.srcObject = null;
        this.elements.remoteVideo.srcObject = null;
        
        this.isScreenSharing = false;
    }
    
    async startLocalMedia() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: this.videoConstraints,
                audio: this.audioConstraints
            });
            
            this.localStream = stream;
            this.elements.localVideo.srcObject = stream;
            
            // Настройка видеотрека для лучшего качества
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack && 'contentHint' in videoTrack) {
                videoTrack.contentHint = 'motion';
            }
            
            console.log('Локальный медиапоток запущен:', stream.getTracks().map(t => t.kind));
            this.showNotification('Камера и микрофон подключены', 'success');
            
        } catch (error) {
            console.error('Ошибка доступа к медиа:', error);
            throw new Error('Не удалось получить доступ к камере/микрофону. Проверьте разрешения.');
        }
    }
    
    connectWebSocket(roomName) {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${location.host}/ws`;
        
        this.websocket = new WebSocket(wsUrl);
        
        this.websocket.onopen = () => {
            console.log('WebSocket подключен');
            this.sendWebSocketMessage({ type: 'join', room: roomName });
        };
        
        this.websocket.onmessage = (event) => {
            this.handleWebSocketMessage(JSON.parse(event.data));
        };
        
        this.websocket.onerror = (error) => {
            console.error('WebSocket ошибка:', error);
            this.showError('Ошибка подключения к серверу');
        };
        
        this.websocket.onclose = () => {
            console.log('WebSocket отключен');
            if (this.currentRoom) {
                this.setConnectionStatus('offline', 'Соединение разорвано');
            }
        };
    }
    
    sendWebSocketMessage(message) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify(message));
        }
    }
    
    async handleWebSocketMessage(message) {
        console.log('Получено сообщение:', message.type);
        
        switch (message.type) {
            case 'role':
                this.userRole = message.role;
                console.log('Роль пользователя:', this.userRole);
                break;
                
            case 'ready':
                this.setConnectionStatus('online', `Подключено к комнате "${this.currentRoom}"`);
                if (this.userRole === 'caller') {
                    await this.createOffer();
                }
                break;
                
            case 'offer':
                await this.handleOffer(message.sdp);
                break;
                
            case 'answer':
                await this.handleAnswer(message.sdp);
                break;
                
            case 'ice-candidate':
                await this.handleIceCandidate(message.candidate);
                break;
                
            case 'peer-left':
                this.handlePeerLeft();
                break;
                
            case 'room-full':
                this.showError('В комнате уже максимальное количество участников');
                this.leaveRoom();
                break;
                
            case 'chat':
                this.displayChatMessage(message.text, false);
                break;
                
            case 'goodbye':
                console.log('Получено прощание от сервера');
                break;
        }
    }