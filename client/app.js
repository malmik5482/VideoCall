// ====== ОСНОВНОЕ ПРИЛОЖЕНИЕ CosmosChat ======

class CosmosApp {
    constructor() {
        this.isInitialized = false;
        this.modules = {};
        this.user = null;
        this.theme = 'cosmic';
        
        this.init();
    }

    async init() {
        console.log('🚀 Инициализация CosmosChat...');
        
        // Показываем загрузочный экран с анимацией
        await this.showLoadingScreen();
        
        // Инициализируем модули
        this.initializeModules();
        
        // Настраиваем обработчики событий
        this.setupEventListeners();
        
        // Проверяем авторизацию
        this.checkAuthentication();
        
        console.log('✨ CosmosChat готов к использованию!');
    }

    async showLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.remove('hidden');
            
            // Анимация прогресса загрузки
            const progressBar = document.querySelector('.loading-progress');
            if (progressBar) {
                progressBar.style.animation = 'loading-progress 3s ease-in-out forwards';
            }
            
            await this.delay(3000); // Показываем красивую анимацию
        }
    }

    initializeModules() {
        // Регистрируем все модули приложения
        this.modules = {
            auth: window.authSystem,
            chat: window.chatSystem,
            videoCall: window.videoCallSystem,
            animations: window.cosmicAnimations,
            notifications: window.NotificationSystem
        };
        
        console.log('📦 Модули зарегистрированы:', Object.keys(this.modules));
    }

    setupEventListeners() {
        // Слушаем успешную авторизацию
        document.addEventListener('userAuthenticated', (e) => {
            this.onUserAuthenticated(e.detail);
        });
        
        // Обработка изменения размера окна
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        // Обработка фокуса/потери фокуса
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
        
        // Глобальные сочетания клавиш
        document.addEventListener('keydown', (e) => {
            this.handleGlobalKeyboard(e);
        });
        
        // Обработка ошибок
        window.addEventListener('error', (e) => {
            this.handleGlobalError(e);
        });
        
        // Обработка потери соединения
        window.addEventListener('offline', () => {
            NotificationSystem.show('🌐 Соединение потеряно. Переходим в офлайн режим.', 'warning');
        });
        
        window.addEventListener('online', () => {
            NotificationSystem.show('🌐 Соединение восстановлено!', 'success');
        });
    }

    checkAuthentication() {
        // Проверяем, есть ли сохраненный пользователь
        const savedUser = localStorage.getItem('cosmosChat_user');
        
        if (savedUser && window.authSystem) {
            // Пользователь уже авторизован, система авторизации сама обработает это
            console.log('👤 Найден авторизованный пользователь');
        } else {
            // Показываем экран авторизации
            this.showAuthScreen();
        }
    }

    async showAuthScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        const authScreen = document.getElementById('authScreen');
        
        if (loadingScreen && authScreen) {
            await ScreenTransitions.morphTransition(loadingScreen, authScreen);
        }
    }

    onUserAuthenticated(details) {
        this.user = details.user;
        console.log('🎉 Пользователь авторизован:', this.user.name);
        
        // Инициализируем персонализированные функции
        this.initializePersonalizedFeatures();
        
        // Устанавливаем статус онлайн
        this.setUserStatus('online');
        
        // Запускаем периодические задачи
        this.startPeriodicTasks();
        
        this.isInitialized = true;
    }

    initializePersonalizedFeatures() {
        // Загружаем настройки пользователя
        this.loadUserSettings();
        
        // Настраиваем тему
        this.applyTheme();
        
        // Инициализируем уведомления
        this.setupNotifications();
        
        // Создаем быстрые действия
        this.createQuickActions();
    }

    loadUserSettings() {
        const settings = localStorage.getItem(`cosmosChat_settings_${this.user.id}`);
        if (settings) {
            try {
                this.userSettings = JSON.parse(settings);
            } catch (error) {
                console.error('❌ Ошибка загрузки настроек:', error);
                this.userSettings = this.getDefaultSettings();
            }
        } else {
            this.userSettings = this.getDefaultSettings();
        }
    }

    getDefaultSettings() {
        return {
            theme: 'cosmic',
            notifications: true,
            soundEnabled: true,
            autoPlayVideo: true,
            highQualityVideo: true,
            language: 'ru',
            chatBackground: 'cosmic',
            animationsEnabled: true
        };
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.userSettings.theme);
        
        // Применяем космические эффекты
        if (this.userSettings.animationsEnabled) {
            document.body.classList.add('cosmic-effects');
        }
    }

    setupNotifications() {
        if ('Notification' in window && this.userSettings.notifications) {
            if (Notification.permission === 'default') {
                Notification.requestPermission().then(permission => {
                    console.log('🔔 Разрешение на уведомления:', permission);
                });
            }
        }
    }

    createQuickActions() {
        // Быстрые действия в интерфейсе
        const quickActions = [
            {
                name: 'Новый чат',
                icon: 'fas fa-plus',
                action: () => this.modules.chat?.createNewChat(),
                shortcut: 'Ctrl+N'
            },
            {
                name: 'Видеозвонок',
                icon: 'fas fa-video',
                action: () => this.modules.videoCall?.startVideoCall(),
                shortcut: 'Ctrl+V'
            },
            {
                name: 'Поиск',
                icon: 'fas fa-search',
                action: () => document.getElementById('searchInput')?.focus(),
                shortcut: 'Ctrl+F'
            }
        ];
        
        this.quickActions = quickActions;
    }

    startPeriodicTasks() {
        // Автосохранение данных каждые 30 секунд
        this.saveInterval = setInterval(() => {
            this.saveUserData();
        }, 30000);
        
        // Обновление времени "был в сети" каждую минуту
        this.presenceInterval = setInterval(() => {
            this.updatePresence();
        }, 60000);
        
        // Проверка качества соединения каждые 10 секунд
        this.connectionCheckInterval = setInterval(() => {
            this.checkConnectionQuality();
        }, 10000);
    }

    saveUserData() {
        if (this.user && this.modules.chat) {
            try {
                this.modules.chat.saveChatsToStorage();
                localStorage.setItem(`cosmosChat_settings_${this.user.id}`, JSON.stringify(this.userSettings));
            } catch (error) {
                console.error('❌ Ошибка сохранения данных:', error);
            }
        }
    }

    updatePresence() {
        if (this.modules.chat && this.modules.chat.isConnected) {
            this.modules.chat.updateUserPresence();
        }
    }

    async checkConnectionQuality() {
        if (this.modules.videoCall && this.modules.videoCall.isInCall) {
            const stats = await this.modules.videoCall.getConnectionStats();
            if (stats) {
                this.displayConnectionStats(stats);
            }
        }
    }

    displayConnectionStats(stats) {
        // Показываем статистику качества соединения
        const qualityIndicators = document.querySelectorAll('.quality-indicator');
        qualityIndicators.forEach(indicator => {
            const quality = this.calculateQuality(stats);
            indicator.className = `quality-indicator quality-${quality}`;
        });
    }

    calculateQuality(stats) {
        const videoLoss = stats.video.packetsLost || 0;
        const audioLoss = stats.audio.packetsLost || 0;
        
        if (videoLoss < 1 && audioLoss < 1) return 'excellent';
        if (videoLoss < 5 && audioLoss < 5) return 'good';
        return 'poor';
    }

    handleResize() {
        // Адаптивная обработка изменения размера
        const isMobile = window.innerWidth < 768;
        document.body.classList.toggle('mobile-layout', isMobile);
        
        // Пересчитываем размеры canvas для анимаций
        if (this.modules.animations) {
            this.modules.animations.resizeCanvas();
        }
    }

    handleVisibilityChange() {
        if (document.hidden) {
            // Приложение скрыто - снижаем активность
            this.setUserStatus('away');
            this.pauseNonEssentialAnimations();
        } else {
            // Приложение активно
            this.setUserStatus('online');
            this.resumeAnimations();
        }
    }

    pauseNonEssentialAnimations() {
        document.body.classList.add('reduced-animations');
    }

    resumeAnimations() {
        document.body.classList.remove('reduced-animations');
    }

    handleGlobalKeyboard(e) {
        // Глобальные горячие клавиши
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'n':
                    e.preventDefault();
                    this.modules.chat?.createNewChat();
                    break;
                case 'f':
                    e.preventDefault();
                    document.getElementById('searchInput')?.focus();
                    break;
                case 'v':
                    e.preventDefault();
                    this.modules.videoCall?.startVideoCall();
                    break;
                case 'k':
                    e.preventDefault();
                    this.showShortcuts();
                    break;
            }
        }
        
        // ESC для закрытия модальных окон
        if (e.key === 'Escape') {
            this.closeModals();
        }
    }

    showShortcuts() {
        const shortcuts = [
            'Ctrl+N - Новый чат',
            'Ctrl+F - Поиск',
            'Ctrl+V - Видеозвонок',
            'Ctrl+K - Показать горячие клавиши',
            'ESC - Закрыть модальные окна'
        ];
        
        NotificationSystem.show(
            '⌨️ Горячие клавиши:\n' + shortcuts.join('\n'), 
            'info', 
            8000
        );
    }

    closeModals() {
        // Закрываем все открытые модальные окна
        document.querySelectorAll('.modal-overlay.show').forEach(modal => {
            modal.classList.remove('show');
        });
        
        // Закрываем правую панель
        const rightPanel = document.getElementById('rightPanel');
        if (rightPanel && rightPanel.classList.contains('show')) {
            rightPanel.classList.remove('show');
        }
    }

    handleGlobalError(error) {
        console.error('🚨 Глобальная ошибка:', error);
        
        // Показываем пользователю дружественное сообщение
        NotificationSystem.show(
            '⚠️ Произошла неожиданная ошибка. Приложение продолжает работать.',
            'warning'
        );
        
        // В продакшене здесь бы отправлялся отчет об ошибке
        this.reportError(error);
    }

    reportError(error) {
        // В реальном приложении здесь была бы отправка ошибки на сервер
        const errorReport = {
            message: error.message,
            stack: error.stack,
            timestamp: Date.now(),
            user: this.user?.id,
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        
        console.log('📊 Отчет об ошибке:', errorReport);
    }

    setUserStatus(status) {
        if (this.user) {
            this.user.status = status;
            localStorage.setItem('cosmosChat_user', JSON.stringify(this.user));
            
            // Обновляем UI
            const statusElement = document.getElementById('userStatus');
            if (statusElement) {
                statusElement.textContent = this.getStatusText(status);
                statusElement.className = `status ${status}`;
            }
        }
    }

    getStatusText(status) {
        const statusTexts = {
            online: 'В сети',
            away: 'Отошел',
            busy: 'Занят',
            offline: 'Не в сети'
        };
        return statusTexts[status] || 'Неизвестно';
    }

    // Управление правой панелью
    showRightPanel(content) {
        const rightPanel = document.getElementById('rightPanel');
        const panelContent = document.getElementById('panelContent');
        
        if (rightPanel && panelContent) {
            panelContent.innerHTML = content;
            rightPanel.classList.add('show');
        }
    }

    closeRightPanel() {
        const rightPanel = document.getElementById('rightPanel');
        if (rightPanel) {
            rightPanel.classList.remove('show');
        }
    }

    // Показ профиля пользователя
    showProfile() {
        if (!this.user) return;
        
        const profileContent = `
            <div class="user-profile-panel">
                <div class="profile-avatar liquid-shape" style="background: ${this.user.avatar.color}">
                    <span>${this.user.avatar.initials}</span>
                </div>
                <h2 class="glow">${this.user.name}</h2>
                <p class="profile-phone">${this.user.phone}</p>
                
                <div class="profile-stats">
                    <div class="stat">
                        <div class="stat-value">42</div>
                        <div class="stat-label">Чатов</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">1337</div>
                        <div class="stat-label">Сообщений</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">23</div>
                        <div class="stat-label">Звонков</div>
                    </div>
                </div>
                
                <div class="profile-actions">
                    <button class="cosmic-button secondary" onclick="cosmosApp.editProfile()">
                        <span class="button-text">✏️ Редактировать</span>
                    </button>
                    <button class="cosmic-button danger" onclick="cosmosApp.logout()">
                        <span class="button-text">🚪 Выйти</span>
                    </button>
                </div>
            </div>
        `;
        
        this.showRightPanel(profileContent);
    }

    editProfile() {
        NotificationSystem.show('✏️ Редактирование профиля будет добавлено в следующем обновлении!', 'info');
    }

    logout() {
        if (confirm('Вы действительно хотите выйти из CosmosChat?')) {
            // Останавливаем все периодические задачи
            if (this.saveInterval) clearInterval(this.saveInterval);
            if (this.presenceInterval) clearInterval(this.presenceInterval);
            if (this.connectionCheckInterval) clearInterval(this.connectionCheckInterval);
            
            // Завершаем видеозвонок, если он активен
            if (this.modules.videoCall?.isInCall) {
                this.modules.videoCall.endCall();
            }
            
            // Выходим из системы
            if (this.modules.auth) {
                this.modules.auth.logout();
            }
        }
    }

    // Утилита для задержки
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Получение информации о приложении
    getAppInfo() {
        return {
            name: 'CosmosChat',
            version: '2.0.0',
            build: Date.now(),
            user: this.user,
            modules: Object.keys(this.modules),
            isInitialized: this.isInitialized
        };
    }
}

// Глобальные функции для HTML
function showProfile() { window.cosmosApp?.showProfile(); }
function closeRightPanel() { window.cosmosApp?.closeRightPanel(); }
function searchInChat() { NotificationSystem?.show('🔍 Поиск в чате будет добавлен скоро!', 'info'); }
function showChatMenu() { NotificationSystem?.show('📋 Меню чата будет добавлено скоро!', 'info'); }
function showAttachMenu() { NotificationSystem?.show('📎 Вложения будут добавлены скоро!', 'info'); }
function showEmojiPicker() { NotificationSystem?.show('😊 Эмодзи-панель будет добавлена скоро!', 'info'); }
function startVoiceRecord() { NotificationSystem?.show('🎤 Голосовые сообщения будут добавлены скоро!', 'info'); }
function stopVoiceRecord() { /* Пустая функция для остановки записи */ }

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    window.cosmosApp = new CosmosApp();
    
    // Добавляем в глобальную область видимости для отладки
    window.CosmosApp = window.cosmosApp;
    
    console.log('🌌 CosmosChat v2.0.0 - Космический мессенджер запущен!');
    console.log('🚀 Готов к межгалактическому общению!');
});

// Экспорт
window.CosmosApp = CosmosApp;