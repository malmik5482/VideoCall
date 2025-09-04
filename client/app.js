// Простое приложение CosmosChat
console.log('🚀 CosmosChat загружается...');

// Состояние приложения
const app = {
    currentUser: null,
    socket: null,
    peerConnection: null,
    localStream: null,
    remoteStream: null,
    isInCall: false
};

// Элементы DOM
const elements = {
    // Экраны
    loginScreen: document.getElementById('loginScreen'),
    chatScreen: document.getElementById('chatScreen'),
    videoScreen: document.getElementById('videoScreen'),
    
    // Формы входа
    userName: document.getElementById('userName'),
    userPhone: document.getElementById('userPhone'),
    loginBtn: document.getElementById('loginBtn'),
    
    // Чат
    currentUserName: document.getElementById('currentUserName'),
    logoutBtn: document.getElementById('logoutBtn'),
    usersList: document.getElementById('usersList'),
    messagesArea: document.getElementById('messagesArea'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    callBtn: document.getElementById('callBtn'),
    
    // Видео
    localVideo: document.getElementById('localVideo'),
    remoteVideo: document.getElementById('remoteVideo'),
    toggleMic: document.getElementById('toggleMic'),
    toggleCamera: document.getElementById('toggleCamera'),
    endCall: document.getElementById('endCall')
};

// Функция переключения экранов
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
        case 'chat':
            elements.chatScreen.classList.add('active');
            break;
        case 'video':
            elements.videoScreen.classList.add('active');
            break;
    }
}

// Функция входа
function login() {
    const name = elements.userName.value.trim();
    const phone = elements.userPhone.value.trim();
    
    if (!name || !phone) {
        alert('Пожалуйста, введите имя и телефон');
        return;
    }
    
    console.log(`✅ Вход: ${name} (${phone})`);
    
    // Сохраняем пользователя
    app.currentUser = {
        name: name,
        phone: phone,
        id: Date.now().toString()
    };
    
    // Сохраняем в localStorage
    localStorage.setItem('cosmosUser', JSON.stringify(app.currentUser));
    
    // Обновляем UI
    elements.currentUserName.textContent = name;
    
    // Подключаемся к WebSocket
    connectWebSocket();
    
    // Показываем чат
    showScreen('chat');
    
    // Добавляем приветственное сообщение
    addMessage({
        author: 'Система',
        text: `${name}, добро пожаловать в CosmosChat! 🌌`,
        time: new Date().toLocaleTimeString()
    });
}

// Функция выхода
function logout() {
    console.log('👋 Выход из системы');
    
    // Очищаем данные
    app.currentUser = null;
    localStorage.removeItem('cosmosUser');
    
    // Отключаем WebSocket
    if (app.socket) {
        app.socket.close();
    }
    
    // Очищаем формы
    elements.userName.value = '';
    elements.userPhone.value = '';
    elements.messagesArea.innerHTML = '<div class="welcome-message">Добро пожаловать в CosmosChat! 🌌</div>';
    
    // Возвращаемся к логину
    showScreen('login');
}

// Подключение к WebSocket
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`🌐 Подключение к WebSocket: ${wsUrl}`);
    
    try {
        app.socket = new WebSocket(wsUrl);
        
        app.socket.onopen = () => {
            console.log('✅ WebSocket подключен');
            
            // Отправляем информацию о пользователе
            sendWebSocketMessage({
                type: 'join',
                user: app.currentUser
            });
            
            // Запрашиваем список пользователей
            sendWebSocketMessage({
                type: 'get-users'
            });
        };
        
        app.socket.onmessage = (event) => {
            handleWebSocketMessage(JSON.parse(event.data));
        };
        
        app.socket.onerror = (error) => {
            console.error('❌ Ошибка WebSocket:', error);
        };
        
        app.socket.onclose = () => {
            console.log('🔌 WebSocket отключен');
            setTimeout(connectWebSocket, 3000); // Переподключение через 3 секунды
        };
    } catch (error) {
        console.error('❌ Не удалось создать WebSocket:', error);
    }
}

// Отправка сообщения через WebSocket
function sendWebSocketMessage(data) {
    if (app.socket && app.socket.readyState === WebSocket.OPEN) {
        app.socket.send(JSON.stringify(data));
    } else {
        console.warn('⚠️ WebSocket не подключен');
    }
}

// Обработка входящих сообщений WebSocket
function handleWebSocketMessage(data) {
    console.log('📨 Получено сообщение:', data.type);
    
    switch(data.type) {
        case 'users-list':
            updateUsersList(data.users);
            break;
        case 'message':
            addMessage(data.message);
            break;
        case 'user-joined':
            addSystemMessage(`${data.user.name} присоединился к чату`);
            break;
        case 'user-left':
            addSystemMessage(`${data.user.name} покинул чат`);
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
    }
}

// Обновление списка пользователей
function updateUsersList(users) {
    elements.usersList.innerHTML = '';
    
    users.forEach(user => {
        if (user.id !== app.currentUser.id) {
            const userDiv = document.createElement('div');
            userDiv.className = 'user-item';
            userDiv.textContent = user.name;
            userDiv.onclick = () => startCall(user);
            elements.usersList.appendChild(userDiv);
        }
    });
}

// Отправка сообщения в чат
function sendMessage() {
    const text = elements.messageInput.value.trim();
    
    if (!text) return;
    
    const message = {
        author: app.currentUser.name,
        text: text,
        time: new Date().toLocaleTimeString(),
        userId: app.currentUser.id
    };
    
    // Отправляем через WebSocket
    sendWebSocketMessage({
        type: 'message',
        message: message
    });
    
    // Добавляем в свой чат
    addMessage(message, true);
    
    // Очищаем поле ввода
    elements.messageInput.value = '';
}

// Добавление сообщения в чат
function addMessage(message, isOwn = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn || message.userId === app.currentUser?.id ? 'own' : ''}`;
    
    messageDiv.innerHTML = `
        <div class="message-author">${message.author}</div>
        <div class="message-text">${message.text}</div>
        <div class="message-time">${message.time}</div>
    `;
    
    // Удаляем приветственное сообщение если оно есть
    const welcome = elements.messagesArea.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    
    elements.messagesArea.appendChild(messageDiv);
    elements.messagesArea.scrollTop = elements.messagesArea.scrollHeight;
}

// Добавление системного сообщения
function addSystemMessage(text) {
    addMessage({
        author: 'Система',
        text: text,
        time: new Date().toLocaleTimeString()
    });
}

// === WebRTC функции для видеозвонков ===

// Начать звонок
async function startCall(targetUser) {
    console.log(`📞 Начинаем звонок с ${targetUser?.name || 'пользователем'}`);
    
    try {
        // Получаем локальное видео
        app.localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        elements.localVideo.srcObject = app.localStream;
        showScreen('video');
        
        // Создаем WebRTC соединение
        createPeerConnection();
        
        // Создаем offer
        const offer = await app.peerConnection.createOffer();
        await app.peerConnection.setLocalDescription(offer);
        
        // Отправляем offer
        sendWebSocketMessage({
            type: 'webrtc-offer',
            offer: offer,
            to: targetUser?.id
        });
        
    } catch (error) {
        console.error('❌ Ошибка при начале звонка:', error);
        alert('Не удалось получить доступ к камере и микрофону');
    }
}

// Создание WebRTC соединения
function createPeerConnection() {
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
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
    };
    
    // Обработка ICE кандидатов
    app.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            sendWebSocketMessage({
                type: 'webrtc-ice',
                candidate: event.candidate
            });
        }
    };
}

// Обработка входящего offer
async function handleWebRTCOffer(data) {
    console.log('📥 Получен offer');
    
    // Автоматически принимаем звонок
    if (confirm('Входящий видеозвонок. Принять?')) {
        try {
            // Получаем локальное видео
            app.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            elements.localVideo.srcObject = app.localStream;
            showScreen('video');
            
            // Создаем соединение
            createPeerConnection();
            
            // Устанавливаем удаленное описание
            await app.peerConnection.setRemoteDescription(data.offer);
            
            // Создаем answer
            const answer = await app.peerConnection.createAnswer();
            await app.peerConnection.setLocalDescription(answer);
            
            // Отправляем answer
            sendWebSocketMessage({
                type: 'webrtc-answer',
                answer: answer,
                to: data.from
            });
            
        } catch (error) {
            console.error('❌ Ошибка при приеме звонка:', error);
        }
    }
}

// Обработка answer
async function handleWebRTCAnswer(data) {
    console.log('📥 Получен answer');
    try {
        await app.peerConnection.setRemoteDescription(data.answer);
    } catch (error) {
        console.error('❌ Ошибка при обработке answer:', error);
    }
}

// Обработка ICE кандидатов
async function handleWebRTCIce(data) {
    console.log('🧊 Получен ICE кандидат');
    try {
        await app.peerConnection.addIceCandidate(data.candidate);
    } catch (error) {
        console.error('❌ Ошибка при добавлении ICE кандидата:', error);
    }
}

// Завершение звонка
function endCall() {
    console.log('📞 Завершение звонка');
    
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
    
    // Очищаем видео
    elements.localVideo.srcObject = null;
    elements.remoteVideo.srcObject = null;
    
    // Возвращаемся в чат
    showScreen('chat');
}

// Переключение микрофона
function toggleMicrophone() {
    if (app.localStream) {
        const audioTrack = app.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            elements.toggleMic.style.opacity = audioTrack.enabled ? '1' : '0.5';
        }
    }
}

// Переключение камеры
function toggleCamera() {
    if (app.localStream) {
        const videoTrack = app.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            elements.toggleCamera.style.opacity = videoTrack.enabled ? '1' : '0.5';
        }
    }
}

// === Обработчики событий ===

// Вход
elements.loginBtn.addEventListener('click', login);
elements.userName.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
});
elements.userPhone.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
});

// Выход
elements.logoutBtn.addEventListener('click', logout);

// Отправка сообщений
elements.sendBtn.addEventListener('click', sendMessage);
elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Видеозвонок
elements.callBtn.addEventListener('click', () => startCall());
elements.endCall.addEventListener('click', endCall);
elements.toggleMic.addEventListener('click', toggleMicrophone);
elements.toggleCamera.addEventListener('click', toggleCamera);

// === Инициализация приложения ===

// Проверяем сохраненного пользователя
window.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 CosmosChat готов к работе!');
    
    const savedUser = localStorage.getItem('cosmosUser');
    if (savedUser) {
        try {
            app.currentUser = JSON.parse(savedUser);
            elements.currentUserName.textContent = app.currentUser.name;
            connectWebSocket();
            showScreen('chat');
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
    if (app.socket) {
        app.socket.close();
    }
    if (app.peerConnection) {
        app.peerConnection.close();
    }
});

console.log('✅ CosmosChat загружен и готов к работе!');