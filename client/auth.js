// ====== СИСТЕМА АВТОРИЗАЦИИ CosmosChat ======

class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.permissions = {
            camera: false,
            microphone: false
        };
        this.init();
    }

    init() {
        // Устанавливаем таймаут на случай проблем с инициализацией
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            const authScreen = document.getElementById('authScreen');
            
            if (!loadingScreen.classList.contains('hidden') && authScreen.classList.contains('hidden')) {
                console.log('⚠️ Принудительно показываем экран авторизации');
                this.showAuthScreen();
            }
        }, 5000);
        
        this.checkExistingAuth();
        this.setupEventListeners();
    }

    checkExistingAuth() {
        const savedUser = localStorage.getItem('cosmosChat_user');
        if (savedUser) {
            try {
                this.currentUser = JSON.parse(savedUser);
                console.log('👤 Найден сохраненный пользователь:', this.currentUser);
                this.autoLogin();
            } catch (error) {
                console.error('❌ Ошибка при загрузке данных пользователя:', error);
                localStorage.removeItem('cosmosChat_user');
                this.showAuthScreen();
            }
        } else {
            // Если нет сохраненного пользователя, показываем экран авторизации
            console.log('👤 Пользователь не найден, показываем форму регистрации');
            this.showAuthScreen();
        }
    }

    showAuthScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        const authScreen = document.getElementById('authScreen');
        
        loadingScreen.classList.add('hidden');
        authScreen.classList.remove('hidden');
        
        console.log('🔓 Показываем экран авторизации');
    }

    async autoLogin() {
        if (!this.currentUser) return;

        // Показываем экран загрузки с анимацией
        this.showLoadingScreen();

        // Имитируем проверку на сервере
        await this.delay(2000);

        // Проверяем разрешения
        await this.checkPermissions();

        if (this.permissions.camera && this.permissions.microphone) {
            // Если все разрешения есть, входим в приложение
            await this.enterApp();
        } else {
            // Показываем экран разрешений
            this.showPermissionsScreen();
        }
    }

    showLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        const authScreen = document.getElementById('authScreen');
        
        authScreen.classList.add('hidden');
        loadingScreen.classList.remove('hidden');
        
        // Обновляем текст загрузки
        const tagline = loadingScreen.querySelector('.tagline');
        if (tagline) {
            tagline.textContent = `Добро пожаловать обратно, ${this.currentUser.name}!`;
        }
    }

    setupEventListeners() {
        // Форматирование номера телефона
        document.addEventListener('input', (e) => {
            if (e.target.type === 'tel') {
                this.formatPhoneNumber(e.target);
            }
        });

        // Enter для отправки форм
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const activeForm = document.querySelector('.auth-form:not(.hidden)');
                if (activeForm) {
                    const button = activeForm.querySelector('.cosmic-button');
                    if (button) button.click();
                }
            }
        });

        // Обработчики кнопок регистрации и входа
        document.addEventListener('click', (e) => {
            if (e.target.matches('#registerBtn, #registerBtn *')) {
                e.preventDefault();
                this.registerUser();
            } else if (e.target.matches('#loginBtn, #loginBtn *')) {
                e.preventDefault();
                this.loginUser();
            } else if (e.target.matches('#requestPermissionsBtn, #requestPermissionsBtn *')) {
                e.preventDefault();
                this.requestPermissions();
            } else if (e.target.matches('.switch-to-login')) {
                e.preventDefault();
                this.switchToLogin();
            } else if (e.target.matches('.switch-to-register')) {
                e.preventDefault();
                this.switchToRegister();
            }
        });
    }

    formatPhoneNumber(input) {
        let value = input.value.replace(/\D/g, '');
        
        // Автоматически добавляем +7 для российских номеров
        if (value.length === 0) {
            input.value = '';
            return;
        }
        
        if (value.startsWith('8')) {
            value = '7' + value.substring(1);
        }
        
        if (!value.startsWith('7') && value.length <= 10) {
            value = '7' + value;
        }
        
        // Форматируем номер
        if (value.length >= 1) {
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
    }

    async registerUser() {
        console.log('🚀 Попытка регистрации пользователя...');
        
        const nameInput = document.getElementById('userName');
        const phoneInput = document.getElementById('userPhone');
        
        if (!nameInput || !phoneInput) {
            console.error('❌ Поля ввода не найдены');
            alert('Ошибка: Поля ввода не найдены');
            return;
        }
        
        const name = nameInput.value.trim();
        const phone = this.cleanPhoneNumber(phoneInput.value);
        
        console.log('📝 Данные для регистрации:', { name, phone });
        
        if (!this.validateRegistrationData(name, phone)) {
            return;
        }

        // Анимация загрузки
        const button = document.querySelector('#registrationForm .cosmic-button');
        this.setButtonLoading(button, true);

        try {
            // Имитируем регистрацию на сервере
            await this.delay(1500);

            // Создаем пользователя
            const user = {
                id: this.generateUserId(),
                name: name,
                phone: phone,
                avatar: this.generateAvatar(name),
                createdAt: new Date().toISOString(),
                status: 'online'
            };

            // Сохраняем локально
            localStorage.setItem('cosmosChat_user', JSON.stringify(user));
            this.currentUser = user;

            this.showMessage('🚀 Регистрация успешна! Добро пожаловать в CosmosChat!', 'success');

            // Переходим к разрешениям
            await ScreenTransitions.fadeOut(document.getElementById('registrationForm'));
            this.showPermissionsScreen();

        } catch (error) {
            console.error('❌ Ошибка регистрации:', error);
            this.showMessage('❌ Ошибка регистрации. Попробуйте еще раз.', 'error');
        } finally {
            this.setButtonLoading(button, false);
        }
    }

    async loginUser() {
        const phoneInput = document.getElementById('loginPhone');
        const phone = this.cleanPhoneNumber(phoneInput.value);
        
        if (!this.validatePhone(phone)) {
            this.showMessage('📱 Введите корректный номер телефона', 'warning');
            return;
        }

        const button = document.querySelector('#loginForm .cosmic-button');
        this.setButtonLoading(button, true);

        try {
            // Имитируем проверку на сервере
            await this.delay(1200);

            // Проверяем существование пользователя
            const savedUser = localStorage.getItem('cosmosChat_user');
            if (savedUser) {
                const user = JSON.parse(savedUser);
                if (user.phone === phone) {
                    this.currentUser = user;
                    this.showMessage(`👋 С возвращением, ${user.name}!`, 'success');
                    
                    // Переходим к разрешениям
                    await ScreenTransitions.fadeOut(document.getElementById('loginForm'));
                    this.showPermissionsScreen();
                } else {
                    this.showMessage('❌ Пользователь с таким номером не найден', 'error');
                }
            } else {
                this.showMessage('❌ Пользователь не найден. Пожалуйста, зарегистрируйтесь.', 'warning');
            }

        } catch (error) {
            console.error('❌ Ошибка входа:', error);
            this.showMessage('❌ Ошибка входа. Попробуйте еще раз.', 'error');
        } finally {
            this.setButtonLoading(button, false);
        }
    }

    validateRegistrationData(name, phone) {
        if (!name || name.length < 2) {
            this.showMessage('👤 Введите ваше имя (минимум 2 символа)');
            return false;
        }

        if (name.length > 50) {
            this.showMessage('👤 Имя слишком длинное (максимум 50 символов)');
            return false;
        }

        if (!this.validatePhone(phone)) {
            this.showMessage('📱 Введите корректный номер телефона');
            return false;
        }

        return true;
    }

    showMessage(message, type = 'warning') {
        // Пробуем показать через систему уведомлений
        if (this.showMessage) {
            window.cosmosApp.modules.notifications.show(message, type);
        } else {
            // Резервный вариант - alert
            alert(message);
            console.log(message);
        }
    }

    validatePhone(phone) {
        // Проверяем российский номер: +7XXXXXXXXXX (11 цифр)
        const phoneRegex = /^7\d{10}$/;
        return phoneRegex.test(phone);
    }

    cleanPhoneNumber(phone) {
        return phone.replace(/\D/g, '');
    }

    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateAvatar(name) {
        const initials = name.split(' ').map(word => word[0]).join('').toUpperCase().substr(0, 2);
        return {
            initials: initials,
            color: this.getAvatarColor(name)
        };
    }

    getAvatarColor(name) {
        const colors = [
            'linear-gradient(135deg, #6366f1, #8b5cf6)',
            'linear-gradient(135deg, #3b82f6, #06b6d4)',
            'linear-gradient(135deg, #06b6d4, #10b981)',
            'linear-gradient(135deg, #10b981, #84cc16)',
            'linear-gradient(135deg, #f59e0b, #ef4444)',
            'linear-gradient(135deg, #ef4444, #ec4899)',
            'linear-gradient(135deg, #ec4899, #8b5cf6)'
        ];
        
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = ((hash << 5) - hash + name.charCodeAt(i)) & 0xffffffff;
        }
        
        return colors[Math.abs(hash) % colors.length];
    }

    async showPermissionsScreen() {
        const authScreen = document.getElementById('authScreen');
        const permissionsScreen = document.getElementById('permissionsScreen');
        
        // Скрываем форму авторизации
        const forms = authScreen.querySelectorAll('.auth-form');
        forms.forEach(form => form.classList.add('hidden'));
        
        // Показываем экран разрешений
        await ScreenTransitions.fadeIn(permissionsScreen);
    }

    async requestPermissions() {
        const button = document.querySelector('#permissionsScreen .cosmic-button');
        this.setButtonLoading(button, true);
        
        try {
            // Запрашиваем разрешения на камеру и микрофон
            const cameraStatus = document.getElementById('cameraStatus');
            const micStatus = document.getElementById('micStatus');
            
            cameraStatus.textContent = '🔄';
            micStatus.textContent = '🔄';
            
            // Запрос разрешений
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                },
                audio: {
                    sampleRate: 44100,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Останавливаем поток (мы только проверяли разрешения)
            stream.getTracks().forEach(track => track.stop());
            
            // Обновляем статус
            this.permissions.camera = true;
            this.permissions.microphone = true;
            
            cameraStatus.textContent = '✅';
            micStatus.textContent = '✅';
            
            this.showMessage('🎉 Разрешения предоставлены! Добро пожаловать в CosmosChat!', 'success');
            
            // Сохраняем разрешения
            localStorage.setItem('cosmosChat_permissions', JSON.stringify(this.permissions));
            
            // Входим в приложение
            await this.delay(1000);
            await this.enterApp();
            
        } catch (error) {
            console.error('❌ Ошибка получения разрешений:', error);
            
            const cameraStatus = document.getElementById('cameraStatus');
            const micStatus = document.getElementById('micStatus');
            
            cameraStatus.textContent = '❌';
            micStatus.textContent = '❌';
            
            this.showMessage('⚠️ Для полноценной работы приложения необходимы разрешения на камеру и микрофон', 'warning');
            
            // Даем возможность войти без разрешений (ограниченный функционал)
            setTimeout(() => {
                const skipButton = document.createElement('button');
                skipButton.className = 'cosmic-button secondary';
                skipButton.innerHTML = '<span class="button-text">⏩ Продолжить без разрешений</span>';
                skipButton.onclick = () => this.enterApp(false);
                
                button.parentElement.appendChild(skipButton);
            }, 2000);
            
        } finally {
            this.setButtonLoading(button, false);
        }
    }

    async checkPermissions() {
        try {
            const permissions = await navigator.permissions.query({ name: 'camera' });
            this.permissions.camera = permissions.state === 'granted';
            
            const micPermissions = await navigator.permissions.query({ name: 'microphone' });
            this.permissions.microphone = micPermissions.state === 'granted';
            
        } catch (error) {
            console.log('Permissions API не поддерживается, будем запрашивать напрямую');
        }
    }

    async enterApp(hasPermissions = true) {
        // Скрываем экраны авторизации
        const loadingScreen = document.getElementById('loadingScreen');
        const authScreen = document.getElementById('authScreen');
        const appContainer = document.getElementById('appContainer');
        
        // Анимируем переход
        await ScreenTransitions.morphTransition(
            authScreen.classList.contains('hidden') ? loadingScreen : authScreen,
            appContainer
        );
        
        // Инициализируем приложение
        this.initializeApp(hasPermissions);
        
        // Отправляем событие успешной авторизации
        document.dispatchEvent(new CustomEvent('userAuthenticated', {
            detail: {
                user: this.currentUser,
                permissions: this.permissions
            }
        }));
    }

    initializeApp(hasPermissions) {
        // Обновляем информацию о пользователе в UI
        this.updateUserProfile();
        
        // Инициализируем чаты
        if (window.ChatSystem) {
            window.ChatSystem.init();
        }
        
        // Показываем уведомление о статусе разрешений
        if (!hasPermissions) {
            this.showMessage(
                '⚠️ Некоторые функции недоступны без разрешений на камеру и микрофон. Вы можете предоставить их позже в настройках.',
                'warning',
                8000
            );
        }
        
        console.log('🚀 CosmosChat инициализирован для пользователя:', this.currentUser);
    }

    updateUserProfile() {
        if (!this.currentUser) return;
        
        // Обновляем имя пользователя
        const displayName = document.getElementById('displayName');
        if (displayName) {
            displayName.textContent = this.currentUser.name;
        }
        
        // Обновляем аватар
        const userInitials = document.getElementById('userInitials');
        if (userInitials) {
            userInitials.textContent = this.currentUser.avatar.initials;
        }
        
        const userAvatar = document.getElementById('userAvatar');
        if (userAvatar) {
            userAvatar.style.background = this.currentUser.avatar.color;
        }
    }

    setButtonLoading(button, loading) {
        if (loading) {
            button.disabled = true;
            const originalText = button.querySelector('.button-text').textContent;
            button.querySelector('.button-text').textContent = '⏳ Загрузка...';
            button.dataset.originalText = originalText;
        } else {
            button.disabled = false;
            if (button.dataset.originalText) {
                button.querySelector('.button-text').textContent = button.dataset.originalText;
            }
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Методы переключения форм
    switchToLogin() {
        console.log('🔄 Переключение на форму входа');
        this.showLoginForm();
    }

    switchToRegister() {
        console.log('🔄 Переключение на форму регистрации');  
        this.showRegistrationForm();
    }

    showLoginForm() {
        const registrationForm = document.getElementById('registrationForm');
        const loginForm = document.getElementById('loginForm');
        
        registrationForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    }

    showRegistrationForm() {
        const registrationForm = document.getElementById('registrationForm');
        const loginForm = document.getElementById('loginForm');
        
        loginForm.classList.add('hidden');
        registrationForm.classList.remove('hidden');
    }

    showOldLoginForm() {
        const registrationForm = document.getElementById('registrationForm');
        const loginForm = document.getElementById('loginForm');
        
        ScreenTransitions.fadeOut(registrationForm).then(() => {
            ScreenTransitions.fadeIn(loginForm);
        });
    }

    showRegistrationForm() {
        const loginForm = document.getElementById('loginForm');
        const registrationForm = document.getElementById('registrationForm');
        
        ScreenTransitions.fadeOut(loginForm).then(() => {
            ScreenTransitions.fadeIn(registrationForm);
        });
    }

    // Выход из системы
    logout() {
        localStorage.removeItem('cosmosChat_user');
        localStorage.removeItem('cosmosChat_permissions');
        location.reload();
    }

    // Получение текущего пользователя
    getCurrentUser() {
        return this.currentUser;
    }

    // Проверка авторизации
    isAuthenticated() {
        return !!this.currentUser;
    }
}

// Глобальные функции для использования в HTML
function registerUser() {
    window.authSystem.registerUser();
}

function loginUser() {
    window.authSystem.loginUser();
}

function requestPermissions() {
    window.authSystem.requestPermissions();
}

function showLoginForm() {
    window.authSystem.showLoginForm();
}

function showRegistrationForm() {
    window.authSystem.showRegistrationForm();
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    window.authSystem = new AuthSystem();
});

// Экспорт для других модулей
window.AuthSystem = AuthSystem;