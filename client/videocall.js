// ====== СИСТЕМА ВИДЕОЗВОНКОВ CosmosChat ======

class VideoCallSystem {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.ws = null;
        this.isInCall = false;
        this.isMuted = false;
        this.isCameraOff = false;
        this.currentRoom = null;
        this.callStartTime = null;
        
        this.ICE_CONFIG = {
            iceServers: [
                // Мощный TURN сервер для России
                {
                    urls: [
                        'turn:94.198.218.189:3478?transport=udp',
                        'turn:94.198.218.189:3478?transport=tcp',
                        'turns:94.198.218.189:5349?transport=tcp'
                    ],
                    username: 'webrtc',
                    credential: 'pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN'
                },
                
                // Российские STUN серверы
                { urls: 'stun:stun.sipnet.ru:3478' },
                { urls: 'stun:stun.comtube.ru:3478' },
                { urls: 'stun:stun.voipbuster.com:3478' },
                
                // Резервные STUN
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 20,
            rtcpMuxPolicy: 'require',
            bundlePolicy: 'max-bundle'
        };
        
        this.MEDIA_CONSTRAINTS = {
            video: {
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 },
                frameRate: { ideal: 30, max: 30 },
                facingMode: 'user'
            },
            audio: {
                sampleRate: 44100,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        };
        
        this.init();
    }

    init() {
        this.setupWebSocket();
        this.setupEventListeners();
    }

    setupWebSocket() {
        // Используем тот же WebSocket, что и для чатов
        if (window.chatSystem && window.chatSystem.ws) {
            this.ws = window.chatSystem.ws;
        } else {
            // Создаем собственный WebSocket, если чат-система не инициализирована
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            this.ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
            
            this.ws.onopen = () => {
                console.log('🎥 VideoCall WebSocket подключен');
            };
        }
    }

    setupEventListeners() {
        // Слушаем сообщения WebSocket для видеозвонков
        document.addEventListener('DOMContentLoaded', () => {
            if (this.ws) {
                this.ws.addEventListener('message', (event) => {
                    const message = JSON.parse(event.data);
                    this.handleWebSocketMessage(message);
                });
            }
        });
    }

    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'video-call-offer':
                this.handleCallOffer(message);
                break;
            case 'video-call-answer':
                this.handleCallAnswer(message);
                break;
            case 'video-call-ice-candidate':
                this.handleIceCandidate(message);
                break;
            case 'video-call-end':
                this.handleCallEnd(message);
                break;
            case 'description':
                this.handleDescription(message);
                break;
            case 'candidate':
                this.handleCandidate(message);
                break;
            case 'ready':
                this.handleReady(message);
                break;
        }
    }

    async startVideoCall(targetUser = null) {
        try {
            // Проверяем разрешения
            const permissions = window.authSystem?.permissions;
            if (!permissions?.camera || !permissions?.microphone) {
                NotificationSystem.show('🎥 Для видеозвонков нужны разрешения на камеру и микрофон', 'warning');
                await this.requestPermissions();
                return;
            }

            NotificationSystem.show('🚀 Инициализация видеозвонка...', 'info');
            
            // Генерируем ID комнаты
            this.currentRoom = 'video_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // Получаем медиа поток
            await this.getLocalMedia();
            
            // Создаем peer connection
            await this.createPeerConnection();
            
            // Показываем интерфейс видеозвонка
            this.showVideoCallInterface();
            
            // Подключаемся к комнате
            this.joinVideoRoom();
            
            NotificationSystem.show('📞 Ожидаем подключения собеседника...', 'success');
            
        } catch (error) {
            console.error('❌ Ошибка запуска видеозвонка:', error);
            NotificationSystem.show('❌ Не удалось запустить видеозвонок: ' + error.message, 'error');
            this.endCall();
        }
    }

    async getLocalMedia() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia(this.MEDIA_CONSTRAINTS);
            
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = this.localStream;
            }
            
            console.log('📹 Локальное видео получено');
            
        } catch (error) {
            console.error('❌ Ошибка получения медиа:', error);
            throw new Error('Нет доступа к камере или микрофону');
        }
    }

    async createPeerConnection() {
        this.peerConnection = new RTCPeerConnection(this.ICE_CONFIG);
        
        // Добавляем локальные треки
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
        }
        
        // Обработка входящих треков
        this.peerConnection.ontrack = (event) => {
            console.log('📡 Получен удаленный поток');
            this.remoteStream = event.streams[0];
            
            const remoteVideo = document.getElementById('remoteVideo');
            if (remoteVideo) {
                remoteVideo.srcObject = this.remoteStream;
            }
            
            NotificationSystem.show('🎉 Видеозвонок подключен!', 'success');
            this.callStartTime = Date.now();
            this.startCallTimer();
        };
        
        // Обработка ICE кандидатов
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'candidate',
                    candidate: event.candidate
                }));
            }
        };
        
        // Мониторинг состояния соединения
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log('🔗 Состояние соединения:', state);
            
            switch (state) {
                case 'connected':
                    NotificationSystem.show('✅ Отличное качество связи!', 'success');
                    break;
                case 'connecting':
                    NotificationSystem.show('🔄 Устанавливаем соединение...', 'info');
                    break;
                case 'disconnected':
                case 'failed':
                    NotificationSystem.show('❌ Соединение потеряно', 'error');
                    this.endCall();
                    break;
            }
        };
        
        // Мониторинг ICE состояния
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('🧊 ICE состояние:', this.peerConnection.iceConnectionState);
        };
        
        console.log('🤝 Peer connection создан');
    }

    joinVideoRoom() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'join',
                room: this.currentRoom
            }));
        }
    }

    async handleReady(message) {
        if (!this.peerConnection) return;
        
        try {
            // Создаем предложение
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            // Отправляем предложение
            this.ws.send(JSON.stringify({
                type: 'description',
                sdp: offer
            }));
            
            console.log('📤 Предложение отправлено');
            
        } catch (error) {
            console.error('❌ Ошибка создания предложения:', error);
        }
    }

    async handleDescription(message) {
        if (!this.peerConnection) return;
        
        try {
            await this.peerConnection.setRemoteDescription(message.sdp);
            
            // Если это предложение, создаем ответ
            if (message.sdp.type === 'offer') {
                const answer = await this.peerConnection.createAnswer();
                await this.peerConnection.setLocalDescription(answer);
                
                this.ws.send(JSON.stringify({
                    type: 'description',
                    sdp: answer
                }));
                
                console.log('📤 Ответ отправлен');
            }
            
        } catch (error) {
            console.error('❌ Ошибка обработки описания:', error);
        }
    }

    async handleCandidate(message) {
        if (!this.peerConnection) return;
        
        try {
            if (message.candidate) {
                await this.peerConnection.addIceCandidate(message.candidate);
                console.log('🧊 ICE кандидат добавлен');
            }
        } catch (error) {
            console.error('❌ Ошибка добавления ICE кандидата:', error);
        }
    }

    showVideoCallInterface() {
        const videoCallOverlay = document.getElementById('videoCallOverlay');
        if (videoCallOverlay) {
            videoCallOverlay.classList.remove('hidden');
            videoCallOverlay.style.display = 'flex';
            
            // Добавляем космические эффекты
            videoCallOverlay.classList.add('portal-effect');
            
            this.isInCall = true;
            
            // Скрываем основное приложение
            const appContainer = document.getElementById('appContainer');
            if (appContainer) {
                appContainer.style.filter = 'blur(10px)';
            }
        }
    }

    hideVideoCallInterface() {
        const videoCallOverlay = document.getElementById('videoCallOverlay');
        if (videoCallOverlay) {
            videoCallOverlay.classList.add('hidden');
            videoCallOverlay.style.display = 'none';
            
            this.isInCall = false;
            
            // Возвращаем основное приложение
            const appContainer = document.getElementById('appContainer');
            if (appContainer) {
                appContainer.style.filter = 'none';
            }
        }
    }

    toggleMute() {
        if (!this.localStream) return;
        
        this.isMuted = !this.isMuted;
        
        this.localStream.getAudioTracks().forEach(track => {
            track.enabled = !this.isMuted;
        });
        
        const muteButton = document.getElementById('muteButton');
        if (muteButton) {
            muteButton.innerHTML = this.isMuted 
                ? '<i class="fas fa-microphone-slash"></i>' 
                : '<i class="fas fa-microphone"></i>';
            muteButton.style.opacity = this.isMuted ? '0.5' : '1';
        }
        
        NotificationSystem.show(
            this.isMuted ? '🔇 Микрофон выключен' : '🎤 Микрофон включен', 
            'info'
        );
    }

    toggleCamera() {
        if (!this.localStream) return;
        
        this.isCameraOff = !this.isCameraOff;
        
        this.localStream.getVideoTracks().forEach(track => {
            track.enabled = !this.isCameraOff;
        });
        
        const cameraButton = document.getElementById('cameraButton');
        if (cameraButton) {
            cameraButton.innerHTML = this.isCameraOff 
                ? '<i class="fas fa-video-slash"></i>' 
                : '<i class="fas fa-video"></i>';
            cameraButton.style.opacity = this.isCameraOff ? '0.5' : '1';
        }
        
        NotificationSystem.show(
            this.isCameraOff ? '📷 Камера выключена' : '📹 Камера включена', 
            'info'
        );
    }

    toggleSpeaker() {
        // Эта функция больше актуальна для мобильных устройств
        NotificationSystem.show('🔊 Управление динамиком', 'info');
    }

    endCall() {
        // Останавливаем локальный поток
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        // Закрываем peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        // Отправляем сигнал о завершении звонка
        if (this.ws && this.ws.readyState === WebSocket.OPEN && this.currentRoom) {
            this.ws.send(JSON.stringify({
                type: 'leave'
            }));
        }
        
        // Скрываем интерфейс видеозвонка
        this.hideVideoCallInterface();
        
        // Очищаем видео элементы
        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        
        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;
        
        // Сбрасываем состояние
        this.isInCall = false;
        this.isMuted = false;
        this.isCameraOff = false;
        this.currentRoom = null;
        this.callStartTime = null;
        this.remoteStream = null;
        
        // Останавливаем таймер
        this.stopCallTimer();
        
        NotificationSystem.show('📞 Видеозвонок завершен', 'info');
        
        console.log('📞 Видеозвонок завершен');
    }

    startCallTimer() {
        this.callTimer = setInterval(() => {
            if (this.callStartTime) {
                const duration = Date.now() - this.callStartTime;
                const minutes = Math.floor(duration / 60000);
                const seconds = Math.floor((duration % 60000) / 1000);
                
                const timerDisplay = document.querySelector('.call-timer');
                if (timerDisplay) {
                    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
            }
        }, 1000);
    }

    stopCallTimer() {
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
    }

    async startVoiceCall() {
        // Голосовой звонок - упрощенная версия видеозвонка
        try {
            this.MEDIA_CONSTRAINTS.video = false; // Только аудио
            await this.startVideoCall();
            
            NotificationSystem.show('📞 Голосовой звонок начат', 'success');
            
        } catch (error) {
            console.error('❌ Ошибка голосового звонка:', error);
            NotificationSystem.show('❌ Не удалось начать голосовой звонок', 'error');
        }
    }

    async requestPermissions() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            // Останавливаем поток после получения разрешений
            stream.getTracks().forEach(track => track.stop());
            
            // Обновляем разрешения в системе авторизации
            if (window.authSystem) {
                window.authSystem.permissions.camera = true;
                window.authSystem.permissions.microphone = true;
                
                localStorage.setItem('cosmosChat_permissions', JSON.stringify(window.authSystem.permissions));
            }
            
            NotificationSystem.show('✅ Разрешения получены!', 'success');
            
        } catch (error) {
            console.error('❌ Ошибка получения разрешений:', error);
            NotificationSystem.show('❌ Разрешения не предоставлены', 'error');
            throw error;
        }
    }

    // Статусы соединения для UI
    getConnectionStatus() {
        if (!this.peerConnection) return 'disconnected';
        return this.peerConnection.connectionState;
    }

    // Качество соединения
    async getConnectionStats() {
        if (!this.peerConnection) return null;
        
        try {
            const stats = await this.peerConnection.getStats();
            const result = {
                video: { bitrate: 0, packetsLost: 0 },
                audio: { bitrate: 0, packetsLost: 0 }
            };
            
            stats.forEach(report => {
                if (report.type === 'inbound-rtp') {
                    if (report.mediaType === 'video') {
                        result.video.bitrate = report.bytesReceived * 8;
                        result.video.packetsLost = report.packetsLost;
                    } else if (report.mediaType === 'audio') {
                        result.audio.bitrate = report.bytesReceived * 8;
                        result.audio.packetsLost = report.packetsLost;
                    }
                }
            });
            
            return result;
            
        } catch (error) {
            console.error('❌ Ошибка получения статистики:', error);
            return null;
        }
    }
}

// Глобальные функции для HTML
function startVideoCall() { window.videoCallSystem?.startVideoCall(); }
function startVoiceCall() { window.videoCallSystem?.startVoiceCall(); }
function toggleMute() { window.videoCallSystem?.toggleMute(); }
function toggleCamera() { window.videoCallSystem?.toggleCamera(); }
function toggleSpeaker() { window.videoCallSystem?.toggleSpeaker(); }
function endCall() { window.videoCallSystem?.endCall(); }

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    window.videoCallSystem = new VideoCallSystem();
});

// Экспорт
window.VideoCallSystem = VideoCallSystem;