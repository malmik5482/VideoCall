// 🎥 CosmosCall - Приложение для видеозвонков
console.log('🎥 CosmosCall загружается...');

// Состояние приложения
const app = {
    currentUser: null,
    socket: null,
    peerConnection: null,
    localStream: null,
    remoteStream: null,
    currentCall: null,
    isInCall: false,
    callTimer: null,
    callStartTime: null,
    onlineUsers: new Map()
};

// Элементы DOM
const elements = {
    // Экраны
    loginScreen: document.getElementById('loginScreen'),
    mainScreen: document.getElementById('mainScreen'),
    videoScreen: document.getElementById('videoScreen'),
    incomingCallScreen: document.getElementById('incomingCallScreen'),
    
    // Форма входа
    userName: document.getElementById('userName'),
    userPhone: document.getElementById('userPhone'),
    loginBtn: document.getElementById('loginBtn'),
    
    // Главный экран
    currentUserName: document.getElementById('currentUserName'),
    userAvatar: document.getElementById('userAvatar'),
    logoutBtn: document.getElementById('logoutBtn'),
    usersList: document.getElementById('usersList'),
    onlineCount: document.getElementById('onlineCount'),
    
    // Входящий звонок
    callerName: document.getElementById('callerName'),
    acceptCall: document.getElementById('acceptCall'),
    rejectCall: document.getElementById('rejectCall'),
    
    // Видеозвонок
    localVideo: document.getElementById('localVideo'),
    remoteVideo: document.getElementById('remoteVideo'),
    callDuration: document.getElementById('callDuration'),
    calleeName: document.getElementById('calleeName'),
    toggleMic: document.getElementById('toggleMic'),
    toggleCamera: document.getElementById('toggleCamera'),
    toggleScreen: document.getElementById('toggleScreen'),
    endCall: document.getElementById('endCall')
};

// === Функции управления экранами ===

function showScreen(screenName) {
    console.log(`📱 Переключение на экран: ${screenName}`);
    
    // Скрываем все экраны
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Показываем нужный экран
    switch(screenName) {
        case 'login':
            elements.loginScreen.classList.add('active');
            break;
        case 'main':
            elements.mainScreen.classList.add('active');
            break;
        case 'video':
            elements.videoScreen.classList.add('active');
            break;
    }
}

function showIncomingCall(callerName) {
    elements.callerName.textContent = callerName;
    elements.incomingCallScreen.classList.add('active');
}

function hideIncomingCall() {
    elements.incomingCallScreen.classList.remove('active');
}

// === Авторизация ===

function login() {
    const name = elements.userName.value.trim();
    const phone = elements.userPhone.value.trim();
    
    if (!name || !phone) {
        showNotification('Пожалуйста, заполните все поля', 'error');
        return;
    }
    
    console.log(`✅ Вход: ${name} (${phone})`);
    
    // Сохраняем пользователя
    app.currentUser = {
        id: Date.now().toString(),
        name: name,
        phone: phone,
        avatar: name.charAt(0).toUpperCase()
    };
    
    // Сохраняем в localStorage
    localStorage.setItem('cosmosCallUser', JSON.stringify(app.currentUser));
    
    // Обновляем UI
    elements.currentUserName.textContent = name;
    elements.userAvatar.textContent = app.currentUser.avatar;
    
    // Подключаемся к WebSocket
    connectWebSocket();
    
    // Показываем главный экран
    showScreen('main');
}

function logout() {
    console.log('👋 Выход из системы');
    
    // Завершаем звонок если есть
    if (app.isInCall) {
        endCall();
    }
    
    // Отключаем WebSocket
    if (app.socket) {
        app.socket.close();
    }
    
    // Очищаем данные
    app.currentUser = null;
    app.onlineUsers.clear();
    localStorage.removeItem('cosmosCallUser');
    
    // Очищаем формы
    elements.userName.value = '';
    elements.userPhone.value = '';
    
    // Возвращаемся к логину
    showScreen('login');
}

// === WebSocket соединение ===

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`🌐 Подключение к WebSocket: ${wsUrl}`);
    
    try {
        app.socket = new WebSocket(wsUrl);
        
        app.socket.onopen = () => {
            console.log('✅ WebSocket подключен');
            
            // Регистрируем пользователя
            sendWebSocketMessage({
                type: 'register',
                user: app.currentUser
            });
            
            // Запрашиваем список пользователей
            sendWebSocketMessage({
                type: 'get-users'
            });
        };
        
        app.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        };
        
        app.socket.onerror = (error) => {
            console.error('❌ Ошибка WebSocket:', error);
            showNotification('Ошибка соединения', 'error');
        };
        
        app.socket.onclose = () => {
            console.log('🔌 WebSocket отключен');
            // Переподключение через 3 секунды
            if (app.currentUser) {
                setTimeout(connectWebSocket, 3000);
            }
        };
    } catch (error) {
        console.error('❌ Не удалось создать WebSocket:', error);
    }
}

function sendWebSocketMessage(data) {
    if (app.socket && app.socket.readyState === WebSocket.OPEN) {
        app.socket.send(JSON.stringify(data));
    } else {
        console.warn('⚠️ WebSocket не подключен');
    }
}

function handleWebSocketMessage(data) {
    console.log('📨 Получено сообщение:', data.type);
    
    switch(data.type) {
        case 'users-list':
            updateUsersList(data.users || []);
            break;
            
        case 'user-joined':
            if (data.user && data.user.id !== app.currentUser.id) {
                app.onlineUsers.set(data.user.id, data.user);
                updateUsersDisplay();
                showNotification(`${data.user.name} теперь онлайн`, 'success');
            }
            break;
            
        case 'user-left':
            if (data.userId) {
                const user = app.onlineUsers.get(data.userId);
                if (user) {
                    app.onlineUsers.delete(data.userId);
                    updateUsersDisplay();
                    showNotification(`${user.name} вышел из сети`, 'info');
                }
            }
            break;
            
        case 'incoming-call':
            handleIncomingCall(data);
            break;
            
        case 'call-accepted':
            console.log('✅ Звонок принят');
            break;
            
        case 'call-rejected':
            console.log('❌ Звонок отклонен');
            showNotification('Звонок отклонен', 'error');
            endCall();
            break;
            
        case 'webrtc-offer':
            handleWebRTCOffer(data);
            break;
            
        case 'webrtc-answer':
            handleWebRTCAnswer(data);
            break;
            
        case 'webrtc-ice':
            handleWebRTCIce(data);
            break;
            
        case 'call-ended':
            handleCallEnded();
            break;
    }
}

// === Управление списком пользователей ===

function updateUsersList(users) {
    app.onlineUsers.clear();
    
    users.forEach(user => {
        if (user.id !== app.currentUser?.id) {
            app.onlineUsers.set(user.id, user);
        }
    });
    
    updateUsersDisplay();
}

function updateUsersDisplay() {
    elements.usersList.innerHTML = '';
    elements.onlineCount.textContent = app.onlineUsers.size;
    
    if (app.onlineUsers.size === 0) {
        elements.usersList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #999;">
                <p>😴 Пока никого нет онлайн</p>
                <p style="font-size: 14px; margin-top: 10px;">Ожидайте других пользователей</p>
            </div>
        `;
        return;
    }
    
    app.onlineUsers.forEach(user => {
        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        userCard.innerHTML = `
            <div class="user-card-avatar">${user.avatar || user.name.charAt(0).toUpperCase()}</div>
            <div class="user-card-info">
                <div class="user-card-name">${user.name}</div>
                <div class="user-card-status">
                    <span style="color: #00d26a;">● Онлайн</span>
                </div>
            </div>
            <div class="user-card-call">📞</div>
        `;
        
        userCard.addEventListener('click', () => startCall(user));
        elements.usersList.appendChild(userCard);
    });
}

// === WebRTC Видеозвонки ===

async function startCall(targetUser) {
    if (!targetUser) {
        showNotification('Выберите пользователя для звонка', 'error');
        return;
    }
    
    if (app.isInCall) {
        showNotification('Вы уже в звонке', 'warning');
        return;
    }
    
    console.log(`📞 Начинаем звонок с ${targetUser.name}`);
    
    app.currentCall = targetUser;
    app.isInCall = true;
    
    try {
        // Получаем доступ к камере и микрофону
        app.localStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: true
        });
        
        elements.localVideo.srcObject = app.localStream;
        elements.calleeName.textContent = targetUser.name;
        
        // Показываем экран звонка
        showScreen('video');
        
        // Создаем WebRTC соединение
        createPeerConnection();
        
        // Создаем offer
        const offer = await app.peerConnection.createOffer();
        await app.peerConnection.setLocalDescription(offer);
        
        // Отправляем предложение о звонке
        sendWebSocketMessage({
            type: 'call-offer',
            offer: offer,
            to: targetUser.id,
            from: app.currentUser
        });
        
        showNotification(`Звоним ${targetUser.name}...`, 'info');
        
    } catch (error) {
        console.error('❌ Ошибка при начале звонка:', error);
        showNotification('Не удалось получить доступ к камере и микрофону', 'error');
        app.isInCall = false;
    }
}

function createPeerConnection() {
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
                urls: 'turn:94.198.218.189:3478',
                username: 'webrtc',
                credential: 'pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN'
            }
        ]
    };
    
    app.peerConnection = new RTCPeerConnection(configuration);
    
    // Добавляем локальный поток
    if (app.localStream) {
        app.localStream.getTracks().forEach(track => {
            app.peerConnection.addTrack(track, app.localStream);
        });
    }
    
    // Обработка входящего потока
    app.peerConnection.ontrack = (event) => {
        console.log('📹 Получен удаленный поток');
        elements.remoteVideo.srcObject = event.streams[0];
        app.remoteStream = event.streams[0];
        startCallTimer();
    };
    
    // Обработка ICE кандидатов
    app.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            sendWebSocketMessage({
                type: 'webrtc-ice',
                candidate: event.candidate,
                to: app.currentCall?.id
            });
        }
    };
    
    // Обработка изменения состояния соединения
    app.peerConnection.onconnectionstatechange = () => {
        console.log('📡 Состояние соединения:', app.peerConnection.connectionState);
        
        if (app.peerConnection.connectionState === 'disconnected' || 
            app.peerConnection.connectionState === 'failed') {
            endCall();
        }
    };
}

function handleIncomingCall(data) {
    if (app.isInCall) {
        // Автоматически отклоняем если уже в звонке
        sendWebSocketMessage({
            type: 'call-rejected',
            to: data.from.id
        });
        return;
    }
    
    app.currentCall = data.from;
    showIncomingCall(data.from.name);
}

async function acceptIncomingCall() {
    console.log('✅ Принимаем звонок');
    hideIncomingCall();
    
    app.isInCall = true;
    
    try {
        // Получаем доступ к медиа
        app.localStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: true
        });
        
        elements.localVideo.srcObject = app.localStream;
        elements.calleeName.textContent = app.currentCall.name;
        
        // Показываем экран звонка
        showScreen('video');
        
        // Отправляем подтверждение
        sendWebSocketMessage({
            type: 'call-accepted',
            to: app.currentCall.id
        });
        
    } catch (error) {
        console.error('❌ Ошибка при приеме звонка:', error);
        showNotification('Не удалось получить доступ к камере и микрофону', 'error');
        rejectIncomingCall();
    }
}

function rejectIncomingCall() {
    console.log('❌ Отклоняем звонок');
    hideIncomingCall();
    
    if (app.currentCall) {
        sendWebSocketMessage({
            type: 'call-rejected',
            to: app.currentCall.id
        });
        app.currentCall = null;
    }
}

async function handleWebRTCOffer(data) {
    console.log('📥 Получен WebRTC offer');
    
    if (!app.isInCall) {
        return;
    }
    
    // Создаем соединение
    createPeerConnection();
    
    try {
        // Устанавливаем удаленное описание
        await app.peerConnection.setRemoteDescription(data.offer);
        
        // Создаем answer
        const answer = await app.peerConnection.createAnswer();
        await app.peerConnection.setLocalDescription(answer);
        
        // Отправляем answer
        sendWebSocketMessage({
            type: 'webrtc-answer',
            answer: answer,
            to: app.currentCall.id
        });
        
    } catch (error) {
        console.error('❌ Ошибка при обработке offer:', error);
    }
}

async function handleWebRTCAnswer(data) {
    console.log('📥 Получен WebRTC answer');
    
    try {
        await app.peerConnection.setRemoteDescription(data.answer);
    } catch (error) {
        console.error('❌ Ошибка при обработке answer:', error);
    }
}

async function handleWebRTCIce(data) {
    console.log('🧊 Получен ICE кандидат');
    
    if (app.peerConnection) {
        try {
            await app.peerConnection.addIceCandidate(data.candidate);
        } catch (error) {
            console.error('❌ Ошибка при добавлении ICE кандидата:', error);
        }
    }
}

function endCall() {
    console.log('📞 Завершение звонка');
    
    // Останавливаем таймер
    stopCallTimer();
    
    // Останавливаем локальный поток
    if (app.localStream) {
        app.localStream.getTracks().forEach(track => track.stop());
        app.localStream = null;
    }
    
    // Закрываем соединение
    if (app.peerConnection) {
        app.peerConnection.close();
        app.peerConnection = null;
    }
    
    // Очищаем видео элементы
    elements.localVideo.srcObject = null;
    elements.remoteVideo.srcObject = null;
    
    // Отправляем уведомление о завершении
    if (app.currentCall) {
        sendWebSocketMessage({
            type: 'call-ended',
            to: app.currentCall.id
        });
    }
    
    // Сбрасываем состояние
    app.isInCall = false;
    app.currentCall = null;
    app.remoteStream = null;
    
    // Возвращаемся на главный экран
    showScreen('main');
}

function handleCallEnded() {
    console.log('📞 Собеседник завершил звонок');
    showNotification('Звонок завершен', 'info');
    endCall();
}

// === Управление медиа ===

function toggleMicrophone() {
    if (app.localStream) {
        const audioTrack = app.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            elements.toggleMic.classList.toggle('muted', !audioTrack.enabled);
            console.log(`🎤 Микрофон: ${audioTrack.enabled ? 'включен' : 'выключен'}`);
        }
    }
}

function toggleCamera() {
    if (app.localStream) {
        const videoTrack = app.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            elements.toggleCamera.classList.toggle('muted', !videoTrack.enabled);
            console.log(`📹 Камера: ${videoTrack.enabled ? 'включена' : 'выключена'}`);
        }
    }
}

async function toggleScreenShare() {
    try {
        if (!app.isScreenSharing) {
            // Начинаем демонстрацию экрана
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false
            });
            
            const videoTrack = screenStream.getVideoTracks()[0];
            const sender = app.peerConnection.getSenders().find(
                s => s.track && s.track.kind === 'video'
            );
            
            if (sender) {
                sender.replaceTrack(videoTrack);
            }
            
            videoTrack.onended = () => {
                toggleScreenShare();
            };
            
            app.isScreenSharing = true;
            elements.toggleScreen.classList.add('active');
            console.log('🖥️ Демонстрация экрана начата');
            
        } else {
            // Возвращаемся к камере
            const videoTrack = app.localStream.getVideoTracks()[0];
            const sender = app.peerConnection.getSenders().find(
                s => s.track && s.track.kind === 'video'
            );
            
            if (sender && videoTrack) {
                sender.replaceTrack(videoTrack);
            }
            
            app.isScreenSharing = false;
            elements.toggleScreen.classList.remove('active');
            console.log('📹 Вернулись к камере');
        }
    } catch (error) {
        console.error('❌ Ошибка демонстрации экрана:', error);
        showNotification('Не удалось начать демонстрацию экрана', 'error');
    }
}

// === Таймер звонка ===

function startCallTimer() {
    app.callStartTime = Date.now();
    app.callTimer = setInterval(updateCallDuration, 1000);
}

function stopCallTimer() {
    if (app.callTimer) {
        clearInterval(app.callTimer);
        app.callTimer = null;
    }
    app.callStartTime = null;
    elements.callDuration.textContent = '00:00';
}

function updateCallDuration() {
    if (!app.callStartTime) return;
    
    const duration = Math.floor((Date.now() - app.callStartTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    
    elements.callDuration.textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// === Уведомления ===

function showNotification(message, type = 'info') {
    console.log(`💬 ${type.toUpperCase()}: ${message}`);
    
    // Можно добавить визуальные уведомления
    const colors = {
        success: '#00d26a',
        error: '#f5576c',
        warning: '#ffc107',
        info: '#667eea'
    };
    
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${colors[type] || colors.info};
        color: white;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-size: 14px;
        font-weight: 500;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// === Обработчики событий ===

// Вход
elements.loginBtn.addEventListener('click', login);
elements.userName.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') elements.userPhone.focus();
});
elements.userPhone.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
});

// Выход
elements.logoutBtn.addEventListener('click', logout);

// Входящий звонок
elements.acceptCall.addEventListener('click', acceptIncomingCall);
elements.rejectCall.addEventListener('click', rejectIncomingCall);

// Управление звонком
elements.endCall.addEventListener('click', endCall);
elements.toggleMic.addEventListener('click', toggleMicrophone);
elements.toggleCamera.addEventListener('click', toggleCamera);
elements.toggleScreen.addEventListener('click', toggleScreenShare);

// === Инициализация приложения ===

window.addEventListener('DOMContentLoaded', () => {
    console.log('🎥 CosmosCall готов к работе!');
    
    // Добавляем стили для анимаций
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    // Проверяем сохраненного пользователя
    const savedUser = localStorage.getItem('cosmosCallUser');
    if (savedUser) {
        try {
            app.currentUser = JSON.parse(savedUser);
            elements.currentUserName.textContent = app.currentUser.name;
            elements.userAvatar.textContent = app.currentUser.avatar;
            connectWebSocket();
            showScreen('main');
            console.log(`✅ Автовход: ${app.currentUser.name}`);
        } catch (error) {
            console.error('❌ Ошибка автовхода:', error);
            showScreen('login');
        }
    } else {
        showScreen('login');
    }
});

// Обработка закрытия страницы
window.addEventListener('beforeunload', () => {
    if (app.isInCall) {
        endCall();
    }
    if (app.socket) {
        sendWebSocketMessage({
            type: 'user-leaving',
            userId: app.currentUser?.id
        });
        app.socket.close();
    }
});

console.log('✅ CosmosCall загружен и готов к видеозвонкам!');