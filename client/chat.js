// ====== СИСТЕМА ЧАТОВ CosmosChat ======

class ChatSystem {
    constructor() {
        this.chats = new Map();
        this.currentChat = null;
        this.messages = new Map();
        this.ws = null;
        this.user = null;
        this.isConnected = false;
        
        this.init();
    }

    init() {
        this.setupWebSocket();
        this.loadChatsFromStorage();
        this.createDemoChats();
        this.renderChatsList();
        
        // Слушаем авторизацию пользователя
        document.addEventListener('userAuthenticated', (e) => {
            this.user = e.detail.user;
            this.updateUserPresence();
        });
    }

    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log('🌐 Подключаемся к WebSocket:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.isConnected = true;
            console.log('🌐 WebSocket подключен');
            NotificationSystem.show('🌐 Подключение к космической сети установлено', 'success');
            this.updateConnectionStatus(true);
            
            // Если есть пользователь, аутентифицируемся
            if (this.user) {
                this.authenticateUser();
            }
        };
        
        this.ws.onmessage = (event) => {
            this.handleMessage(JSON.parse(event.data));
        };
        
        this.ws.onclose = () => {
            this.isConnected = false;
            console.log('🔌 WebSocket отключен');
            this.updateConnectionStatus(false);
            
            // Переподключение через 3 секунды
            setTimeout(() => this.setupWebSocket(), 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('❌ WebSocket ошибка:', error);
            NotificationSystem.show('❌ Ошибка подключения к серверу', 'error');
        };
    }
    
    // Аутентификация пользователя на сервере
    authenticateUser() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        const savedUser = localStorage.getItem('cosmosChat_user');
        if (savedUser) {
            const userData = JSON.parse(savedUser);
            
            this.ws.send(JSON.stringify({
                type: 'login',
                phone: userData.phone,
                name: userData.name
            }));
            
            console.log('🔑 Отправлена аутентификация');
        }
    }
    
    // Отправка сообщения через WebSocket
    sendWebSocketMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('⚠️ WebSocket не подключен');
        }
    }
    
    // Поиск пользователя через сервер
    searchUserOnServer(phone) {
        this.sendWebSocketMessage({
            type: 'search_user',
            query: phone
        });
    }
    
    // Обработка результатов поиска
    handleSearchResults(message) {
        const { users } = message;
        if (users && users.length > 0) {
            // Показываем первого пользователя
            const searchModal = window.searchModal || window.userSearchModal;
            if (searchModal && searchModal.showUserResult) {
                searchModal.showUserResult(users[0]);
            }
        } else {
            // Пользователь не найден
            const searchModal = window.searchModal || window.userSearchModal;
            if (searchModal && searchModal.showEmptyResult) {
                searchModal.showEmptyResult();
            }
        }
    }

    handleMessage(message) {
        switch (message.type) {
            case 'connected':
                console.log('✅ Получено подтверждение подключения');
                if (this.user) {
                    this.authenticateUser();
                }
                break;
            case 'chat_message':
            case 'chat-message':
                this.receiveMessage(message);
                break;
            case 'user_joined':
            case 'user-joined':
                this.handleUserJoined(message);
                break;
            case 'user_left':
            case 'user-left':
                this.handleUserLeft(message);
                break;
            case 'typing':
                this.handleTyping(message);
                break;
            case 'incoming_call':
            case 'video-call-request':
                this.handleVideoCallRequest(message);
                break;
            case 'search_results':
                this.handleSearchResults(message);
                break;
            case 'error':
                NotificationSystem.show(`❌ ${message.message}`, 'error');
                break;
        }
    }

    createDemoChats() {
        // Создаем демо-чаты для показа функционала
        const demoChats = [
            {
                id: 'demo-support',
                name: '🚀 Поддержка CosmosChat',
                type: 'support',
                avatar: { initials: 'СП', color: 'linear-gradient(135deg, #6366f1, #8b5cf6)' },
                lastMessage: 'Добро пожаловать в CosmosChat! Как дела?',
                lastMessageTime: Date.now() - 300000,
                unreadCount: 1,
                isOnline: true
            },
            {
                id: 'demo-updates',
                name: '📡 Новости космоса',
                type: 'channel',
                avatar: { initials: 'НК', color: 'linear-gradient(135deg, #3b82f6, #06b6d4)' },
                lastMessage: 'Обновление системы завершено! Новые функции уже доступны ✨',
                lastMessageTime: Date.now() - 3600000,
                unreadCount: 0,
                isOnline: true
            },
            {
                id: 'demo-group',
                name: '👥 Космические путешественники',
                type: 'group',
                avatar: { initials: 'КП', color: 'linear-gradient(135deg, #10b981, #84cc16)' },
                lastMessage: 'Алекс: Кто готов к следующему полету? 🚀',
                lastMessageTime: Date.now() - 7200000,
                unreadCount: 3,
                isOnline: false,
                memberCount: 42
            }
        ];

        demoChats.forEach(chat => {
            this.chats.set(chat.id, chat);
            
            // Создаем демо-сообщения для каждого чата
            this.createDemoMessages(chat.id);
        });
    }

    createDemoMessages(chatId) {
        const demoMessages = {
            'demo-support': [
                {
                    id: 'msg1',
                    chatId: chatId,
                    senderId: 'support',
                    senderName: 'Поддержка',
                    text: 'Добро пожаловать в CosmosChat! 🚀',
                    timestamp: Date.now() - 900000,
                    type: 'text'
                },
                {
                    id: 'msg2',
                    chatId: chatId,
                    senderId: 'support',
                    senderName: 'Поддержка',
                    text: 'Здесь вы можете общаться с друзьями, совершать видеозвонки и делиться космическими эмоциями! ✨',
                    timestamp: Date.now() - 600000,
                    type: 'text'
                },
                {
                    id: 'msg3',
                    chatId: chatId,
                    senderId: 'support',
                    senderName: 'Поддержка',
                    text: 'Попробуйте начать видеозвонок, нажав на кнопку камеры! 📹',
                    timestamp: Date.now() - 300000,
                    type: 'text'
                }
            ],
            'demo-updates': [
                {
                    id: 'upd1',
                    chatId: chatId,
                    senderId: 'system',
                    senderName: 'Система',
                    text: '🌟 Обновление v2.0: Добавлены космические эффекты и улучшенное качество видео!',
                    timestamp: Date.now() - 3600000,
                    type: 'system'
                }
            ],
            'demo-group': [
                {
                    id: 'grp1',
                    chatId: chatId,
                    senderId: 'alex',
                    senderName: 'Алекс',
                    text: 'Привет всем! Как дела в нашей космической команде? 👋',
                    timestamp: Date.now() - 14400000,
                    type: 'text'
                },
                {
                    id: 'grp2',
                    chatId: chatId,
                    senderId: 'maria',
                    senderName: 'Мария',
                    text: 'Отлично! Готовлюсь к новому проекту 🚀',
                    timestamp: Date.now() - 10800000,
                    type: 'text'
                },
                {
                    id: 'grp3',
                    chatId: chatId,
                    senderId: 'alex',
                    senderName: 'Алекс',
                    text: 'Кто готов к следующему полету? 🚀',
                    timestamp: Date.now() - 7200000,
                    type: 'text'
                }
            ]
        };

        if (demoMessages[chatId]) {
            if (!this.messages.has(chatId)) {
                this.messages.set(chatId, []);
            }
            this.messages.get(chatId).push(...demoMessages[chatId]);
        }
    }

    renderChatsList() {
        const chatsList = document.getElementById('chatsList');
        if (!chatsList) return;

        chatsList.innerHTML = '';

        // Сортируем чаты по времени последнего сообщения
        const sortedChats = Array.from(this.chats.values())
            .sort((a, b) => b.lastMessageTime - a.lastMessageTime);

        sortedChats.forEach(chat => {
            const chatElement = this.createChatElement(chat);
            chatsList.appendChild(chatElement);
        });
    }

    createChatElement(chat) {
        const chatEl = document.createElement('div');
        chatEl.className = 'chat-item quantum-hover';
        chatEl.dataset.chatId = chat.id;
        chatEl.onclick = () => this.openChat(chat.id);

        const timeAgo = this.formatTimeAgo(chat.lastMessageTime);
        const unreadBadge = chat.unreadCount > 0 ? 
            `<div class="unread-badge">${chat.unreadCount}</div>` : '';
        
        const onlineIndicator = chat.isOnline ? 
            '<div class="online-indicator"></div>' : '';

        const memberInfo = chat.type === 'group' ? 
            `<div class="member-count">${chat.memberCount} участников</div>` : '';

        chatEl.innerHTML = `
            <div class="chat-avatar character-aura" style="background: ${chat.avatar.color}">
                <span>${chat.avatar.initials}</span>
                ${onlineIndicator}
            </div>
            <div class="chat-info">
                <div class="chat-header">
                    <h4 class="chat-name">${chat.name}</h4>
                    <span class="chat-time">${timeAgo}</span>
                </div>
                <div class="chat-preview">
                    <p class="last-message">${chat.lastMessage}</p>
                    ${memberInfo}
                </div>
            </div>
            ${unreadBadge}
        `;

        // Добавляем стили
        chatEl.style.cssText = `
            display: flex;
            align-items: center;
            padding: 15px 20px;
            cursor: pointer;
            border-radius: 12px;
            margin: 5px 0;
            transition: all 0.3s ease;
            position: relative;
            background: rgba(22, 33, 62, 0.3);
        `;

        return chatEl;
    }

    openChat(chatId) {
        const chat = this.chats.get(chatId);
        if (!chat) return;

        this.currentChat = chat;
        
        // Обновляем заголовок чата
        this.updateChatHeader(chat);
        
        // Показываем сообщения
        this.renderMessages(chatId);
        
        // Показываем область ввода
        document.getElementById('messageInputArea').style.display = 'block';
        
        // Скрываем экран приветствия
        const welcomeScreen = document.querySelector('.welcome-screen');
        if (welcomeScreen) {
            welcomeScreen.style.display = 'none';
        }
        
        // Помечаем как прочитанные
        chat.unreadCount = 0;
        this.renderChatsList();
        
        // Добавляем эффект выбора
        this.highlightSelectedChat(chatId);
    }

    updateChatHeader(chat) {
        const chatTitle = document.getElementById('chatTitle');
        const chatStatus = document.getElementById('chatStatus');
        const chatAvatar = document.querySelector('.chat-avatar span');

        if (chatTitle) chatTitle.textContent = chat.name;
        if (chatStatus) {
            if (chat.type === 'group') {
                chatStatus.textContent = `${chat.memberCount} участников`;
            } else {
                chatStatus.textContent = chat.isOnline ? 'в сети' : 'был недавно';
            }
        }
        if (chatAvatar) chatAvatar.textContent = chat.avatar.initials;
    }

    renderMessages(chatId) {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) return;

        const messages = this.messages.get(chatId) || [];
        
        messagesContainer.innerHTML = '';
        
        messages.forEach(message => {
            const messageEl = this.createMessageElement(message);
            messagesContainer.appendChild(messageEl);
        });
        
        // Прокручиваем вниз
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    createMessageElement(message) {
        const messageEl = document.createElement('div');
        const isOwn = message.senderId === this.user?.id;
        
        messageEl.className = `message ${isOwn ? 'own' : 'other'} teleport-in`;
        
        const time = new Date(message.timestamp).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageEl.innerHTML = `
            <div class="message-content crystal-surface">
                ${!isOwn ? `<div class="sender-name">${message.senderName}</div>` : ''}
                <div class="message-text">${this.formatMessageText(message.text)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;

        // Добавляем стили
        messageEl.style.cssText = `
            margin: 10px 0;
            display: flex;
            ${isOwn ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}
        `;

        const content = messageEl.querySelector('.message-content');
        content.style.cssText = `
            max-width: 70%;
            padding: 12px 16px;
            border-radius: 18px;
            position: relative;
            ${isOwn ? 
                'background: linear-gradient(135deg, var(--cosmic-purple), var(--cosmic-blue)); color: white;' : 
                'background: rgba(22, 33, 62, 0.8); color: var(--text-primary);'
            }
            backdrop-filter: blur(10px);
            border: 1px solid rgba(99, 102, 241, 0.2);
        `;

        return messageEl;
    }

    formatMessageText(text) {
        // Простая обработка эмодзи и ссылок
        return text
            .replace(/:\)/g, '😊')
            .replace(/:\(/g, '😢')
            .replace(/:D/g, '😃')
            .replace(/:\*/g, '😘')
            .replace(/<3/g, '❤️')
            .replace(/\^_\^/g, '😄');
    }

    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const text = messageInput.value.trim();
        
        if (!text || !this.currentChat) return;

        const message = {
            id: 'msg_' + Date.now(),
            chatId: this.currentChat.id,
            senderId: this.user?.id || 'user',
            senderName: this.user?.name || 'Вы',
            text: text,
            timestamp: Date.now(),
            type: 'text'
        };

        // Добавляем сообщение локально
        if (!this.messages.has(this.currentChat.id)) {
            this.messages.set(this.currentChat.id, []);
        }
        this.messages.get(this.currentChat.id).push(message);

        // Обновляем последнее сообщение в чате
        this.currentChat.lastMessage = text;
        this.currentChat.lastMessageTime = Date.now();

        // Отправляем через WebSocket
        if (this.isConnected && this.ws) {
            // Отправляем в формате нового сервера
            this.ws.send(JSON.stringify({
                type: 'chat_message',
                roomId: this.currentChat.id,
                text: text
            }));
        }

        // Обновляем UI
        this.renderMessages(this.currentChat.id);
        this.renderChatsList();
        
        // Очищаем ввод
        messageInput.value = '';
        this.autoResize(messageInput);
        
        // Добавляем эффект отправки
        ButtonParticles.createExplosion(document.getElementById('sendButton'));
    }

    receiveMessage(message) {
        // Получение сообщения от другого пользователя
        const chatId = message.chatId;
        
        if (!this.messages.has(chatId)) {
            this.messages.set(chatId, []);
        }
        
        this.messages.get(chatId).push(message);
        
        // Обновляем чат
        const chat = this.chats.get(chatId);
        if (chat) {
            chat.lastMessage = message.text;
            chat.lastMessageTime = message.timestamp;
            
            // Увеличиваем счетчик непрочитанных, если чат не открыт
            if (this.currentChat?.id !== chatId) {
                chat.unreadCount++;
            }
        }
        
        // Обновляем UI
        if (this.currentChat?.id === chatId) {
            this.renderMessages(chatId);
        }
        this.renderChatsList();
        
        // Показываем уведомление
        if (this.currentChat?.id !== chatId) {
            NotificationSystem.show(
                `💬 ${message.senderName}: ${message.text.substr(0, 50)}${message.text.length > 50 ? '...' : ''}`,
                'info'
            );
        }
    }

    formatTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'только что';
        if (minutes < 60) return `${minutes} мин`;
        if (hours < 24) return `${hours} ч`;
        if (days < 7) return `${days} д`;
        
        return new Date(timestamp).toLocaleDateString('ru-RU');
    }

    highlightSelectedChat(chatId) {
        // Убираем выделение с других чатов
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Выделяем текущий чат
        const selectedChat = document.querySelector(`[data-chat-id="${chatId}"]`);
        if (selectedChat) {
            selectedChat.classList.add('selected');
        }
    }

    updateConnectionStatus(connected) {
        const status = document.getElementById('userStatus');
        if (status) {
            status.textContent = connected ? 'В сети' : 'Подключаемся...';
            status.className = connected ? 'status online' : 'status offline';
        }
    }

    // Автоизменение размера текстового поля
    autoResize(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    // Обработка нажатий клавиш
    handleMessageInput(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    }

    // Создание нового чата
    createNewChat() {
        NotificationSystem.show('🚀 Функция создания чатов будет добавлена в следующем обновлении!', 'info');
    }

    // Поиск в чатах
    searchChats() {
        const searchInput = document.getElementById('searchInput');
        const query = searchInput.value.toLowerCase();
        
        const chatItems = document.querySelectorAll('.chat-item');
        chatItems.forEach(item => {
            const chatName = item.querySelector('.chat-name').textContent.toLowerCase();
            const lastMessage = item.querySelector('.last-message').textContent.toLowerCase();
            
            if (chatName.includes(query) || lastMessage.includes(query)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    // Фильтрация чатов по категориям
    filterChats(category) {
        // Обновляем активную категорию
        document.querySelectorAll('.category').forEach(cat => {
            cat.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        // Фильтруем чаты
        const chatItems = document.querySelectorAll('.chat-item');
        chatItems.forEach(item => {
            const chatId = item.dataset.chatId;
            const chat = this.chats.get(chatId);
            
            if (category === 'all' || 
                (category === 'personal' && chat.type === 'personal') ||
                (category === 'groups' && chat.type === 'group') ||
                (category === 'video' && chat.hasVideo)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    // Сохранение в localStorage
    saveChatsToStorage() {
        const chatsData = {
            chats: Array.from(this.chats.entries()),
            messages: Array.from(this.messages.entries())
        };
        localStorage.setItem('cosmosChat_data', JSON.stringify(chatsData));
    }

    // Загрузка из localStorage
    loadChatsFromStorage() {
        const saved = localStorage.getItem('cosmosChat_data');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.chats = new Map(data.chats || []);
                this.messages = new Map(data.messages || []);
            } catch (error) {
                console.error('❌ Ошибка загрузки данных чатов:', error);
            }
        }
    }

    updateUserPresence() {
        if (this.isConnected && this.user && this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify({
                    type: 'user-presence',
                    userId: this.user.id,
                    status: 'online'
                }));
            } catch (error) {
                console.log('⚠️ Не удалось обновить статус присутствия:', error);
            }
        }
    }
}

// Глобальные функции для HTML
function sendMessage() { window.chatSystem?.sendMessage(); }
function autoResize(textarea) { window.chatSystem?.autoResize(textarea); }
function handleMessageInput(event) { window.chatSystem?.handleMessageInput(event); }
function createNewChat() { window.chatSystem?.createNewChat(); }
function searchChats() { window.chatSystem?.searchChats(); }
function filterChats(category) { window.chatSystem?.filterChats(category); }

// Новые функции поиска пользователей
function openUserSearch() { window.userSearchSystem?.openSearch(); }
function closeUserSearch() { window.userSearchSystem?.closeSearch(); }
function searchUserByPhone() { window.userSearchSystem?.searchByPhone(); }
function createChatWithUser() { window.userSearchSystem?.createChat(); }
function callUser() { window.userSearchSystem?.callUser(); }

// ====== СИСТЕМА ПОИСКА ПОЛЬЗОВАТЕЛЕЙ ======
class UserSearchSystem {
    constructor() {
        this.modal = null;
        this.searchInput = null;
        this.searchResults = null;
        this.searchEmpty = null;
        this.foundUser = null;
        this.init();
    }

    init() {
        this.modal = document.getElementById('userSearchModal');
        this.searchInput = document.getElementById('searchPhone');
        this.searchResults = document.getElementById('searchResults');
        this.searchEmpty = document.getElementById('searchEmpty');
        
        // Форматирование номера телефона в поиске
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.formatPhoneNumber(e.target);
            });
        }
    }

    formatPhoneNumber(input) {
        let value = input.value.replace(/\D/g, '');
        
        if (value.length === 0) {
            input.value = '';
            return;
        }
        
        if (value.startsWith('8')) {
            value = '7' + value.substring(1);
        }
        
        if (!value.startsWith('7')) {
            value = '7' + value;
        }
        
        let formatted = '+7';
        if (value.length > 1) {
            formatted += ' (' + value.substring(1, 4);
            if (value.length >= 5) {
                formatted += ') ' + value.substring(4, 7);
                if (value.length >= 8) {
                    formatted += '-' + value.substring(7, 9);
                    if (value.length >= 10) {
                        formatted += '-' + value.substring(9, 11);
                    }
                }
            }
        }
        input.value = formatted;
    }

    openSearch() {
        console.log('🔍 Открываем поиск пользователей');
        this.modal.classList.remove('hidden');
        this.searchInput.focus();
        this.clearResults();
    }

    closeSearch() {
        console.log('❌ Закрываем поиск пользователей');
        this.modal.classList.add('hidden');
        this.clearResults();
        this.searchInput.value = '';
    }

    clearResults() {
        this.searchResults.classList.add('hidden');
        this.searchEmpty.classList.add('hidden');
        this.foundUser = null;
    }

    async searchByPhone() {
        const phoneInput = this.searchInput.value;
        const cleanPhone = phoneInput.replace(/\D/g, '');
        
        console.log('🔍 Поиск пользователя по номеру:', cleanPhone);
        
        if (!this.validatePhone(cleanPhone)) {
            window.cosmosApp?.modules?.notifications?.show('📱 Введите корректный номер телефона', 'warning') || 
            alert('📱 Введите корректный номер телефона');
            return;
        }

        // Показываем индикатор загрузки
        const searchBtn = document.getElementById('searchUserBtn');
        const originalText = searchBtn.querySelector('.button-text').textContent;
        searchBtn.querySelector('.button-text').textContent = '🔍 Поиск...';
        searchBtn.disabled = true;

        try {
            // Ищем пользователя в локальном хранилище
            const user = this.findUserByPhone(cleanPhone);
            
            // Имитируем задержку поиска
            await this.delay(1000);
            
            if (user) {
                this.showUserResult(user);
            } else {
                this.showEmptyResult();
            }

        } catch (error) {
            console.error('❌ Ошибка поиска:', error);
            window.cosmosApp?.modules?.notifications?.show('❌ Ошибка при поиске пользователя', 'error') || 
            alert('❌ Ошибка при поиске пользователя');
        } finally {
            // Восстанавливаем кнопку
            searchBtn.querySelector('.button-text').textContent = originalText;
            searchBtn.disabled = false;
        }
    }

    findUserByPhone(phone) {
        // Ищем в локальном хранилище
        const savedUser = localStorage.getItem('cosmosChat_user');
        if (savedUser) {
            const currentUser = JSON.parse(savedUser);
            if (currentUser.phone === phone) {
                return null; // Это тот же пользователь
            }
        }

        // Генерируем демо-пользователя для тестирования
        // В реальном приложении здесь был бы запрос к серверу
        const demoUsers = [
            { phone: '79001234567', name: 'Анна Смирнова' },
            { phone: '79009876543', name: 'Максим Петров' },
            { phone: '79005556677', name: 'Елена Иванова' },
            { phone: '79003334455', name: 'Дмитрий Козлов' },
            { phone: '79007778899', name: 'София Николаева' }
        ];

        const foundUser = demoUsers.find(user => user.phone === phone);
        if (foundUser) {
            return {
                ...foundUser,
                id: `user_${phone}`,
                avatar: this.generateAvatar(foundUser.name),
                status: 'В сети'
            };
        }

        return null;
    }

    generateAvatar(name) {
        const initials = name.split(' ').map(word => word[0]).join('').toUpperCase().substr(0, 2);
        const colors = ['#6366f1', '#3b82f6', '#06b6d4', '#ec4899', '#8b5cf6'];
        const color = colors[name.length % colors.length];
        
        return {
            initials: initials,
            color: color
        };
    }

    showUserResult(user) {
        console.log('✅ Пользователь найден:', user);
        this.foundUser = user;
        
        // Заполняем данные пользователя
        document.getElementById('userInitials').textContent = user.avatar.initials;
        document.getElementById('userName').textContent = user.name;
        document.getElementById('userPhone').textContent = this.formatPhoneDisplay(user.phone);
        
        // Устанавливаем цвет аватара
        const avatarElement = document.querySelector('#userResult .user-avatar');
        avatarElement.style.background = `linear-gradient(135deg, ${user.avatar.color}, #3b82f6)`;
        
        // Показываем результат
        this.searchResults.classList.remove('hidden');
        this.searchEmpty.classList.add('hidden');
    }

    showEmptyResult() {
        console.log('❌ Пользователь не найден');
        this.searchResults.classList.add('hidden');
        this.searchEmpty.classList.remove('hidden');
    }

    formatPhoneDisplay(phone) {
        if (phone.length === 11) {
            return `+7 (${phone.substring(1, 4)}) ${phone.substring(4, 7)}-${phone.substring(7, 9)}-${phone.substring(9, 11)}`;
        }
        return '+' + phone;
    }

    async createChat() {
        if (!this.foundUser) return;
        
        console.log('💬 Создаем чат с пользователем:', this.foundUser.name);
        
        // Создаем новый чат с найденным пользователем
        const newChat = {
            id: `chat_${this.foundUser.id}`,
            name: this.foundUser.name,
            avatar: this.foundUser.avatar,
            type: 'personal',
            lastMessage: '',
            lastTime: new Date().toISOString(),
            unread: 0,
            status: this.foundUser.status,
            phone: this.foundUser.phone,
            messages: []
        };

        // Добавляем чат в систему
        if (window.chatSystem) {
            window.chatSystem.chats.push(newChat);
            window.chatSystem.renderChats();
            window.chatSystem.openChat(newChat.id);
            
            // Сохраняем в локальное хранилище
            localStorage.setItem('cosmosChat_chats', JSON.stringify(window.chatSystem.chats));
        }

        // Закрываем модальное окно
        this.closeSearch();
        
        // Показываем уведомление
        window.cosmosApp?.modules?.notifications?.show(`💬 Чат с ${this.foundUser.name} создан!`, 'success') || 
        alert(`💬 Чат с ${this.foundUser.name} создан!`);
    }

    async callUser() {
        if (!this.foundUser) return;
        
        console.log('📞 Звоним пользователю:', this.foundUser.name);
        
        // Закрываем модальное окно
        this.closeSearch();
        
        // Инициируем видеозвонок
        if (window.videoCallSystem) {
            window.videoCallSystem.startCall({
                targetUser: this.foundUser,
                type: 'video'
            });
        }
        
        // Показываем уведомление
        window.cosmosApp?.modules?.notifications?.show(`📹 Вызываем ${this.foundUser.name}...`, 'info') || 
        alert(`📹 Вызываем ${this.foundUser.name}...`);
    }

    validatePhone(phone) {
        // Проверяем российский номер: 7XXXXXXXXXX (11 цифр)
        const phoneRegex = /^7\d{10}$/;
        return phoneRegex.test(phone);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    window.chatSystem = new ChatSystem();
    window.ChatSystem = window.chatSystem;
    window.userSearchSystem = new UserSearchSystem();
});

// Экспорт
window.ChatSystem = ChatSystem;