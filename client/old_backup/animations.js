// ====== КОСМИЧЕСКИЕ АНИМАЦИИ CosmosChat ======

// Класс для переходов между экранами
class ScreenTransitions {
    static async morphTransition(fromElement, toElement) {
        if (!fromElement || !toElement) {
            console.warn('⚠️ Элементы для перехода не найдены');
            return;
        }
        
        // Скрываем исходный элемент
        if (fromElement) {
            fromElement.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
            fromElement.style.opacity = '0';
            fromElement.style.transform = 'scale(0.95)';
            
            await new Promise(resolve => setTimeout(resolve, 300));
            fromElement.classList.add('hidden');
        }
        
        // Показываем целевой элемент
        if (toElement) {
            toElement.classList.remove('hidden');
            toElement.style.opacity = '0';
            toElement.style.transform = 'scale(0.95)';
            
            // Форсируем перерисовку
            toElement.offsetHeight;
            
            toElement.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
            toElement.style.opacity = '1';
            toElement.style.transform = 'scale(1)';
            
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
    
    static async fadeTransition(fromElement, toElement) {
        if (fromElement) {
            fromElement.style.transition = 'opacity 0.3s ease-out';
            fromElement.style.opacity = '0';
            await new Promise(resolve => setTimeout(resolve, 300));
            fromElement.classList.add('hidden');
        }
        
        if (toElement) {
            toElement.classList.remove('hidden');
            toElement.style.opacity = '0';
            toElement.offsetHeight;
            toElement.style.transition = 'opacity 0.3s ease-out';
            toElement.style.opacity = '1';
        }
    }
}

// Делаем класс доступным глобально
window.ScreenTransitions = ScreenTransitions;

class CosmicAnimations {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.stars = [];
        this.particles = [];
        this.animationId = null;
        
        this.init();
    }

    init() {
        this.setupCanvas();
        this.createStars();
        this.createParticles();
        this.animate();
        this.addEventListeners();
    }

    setupCanvas() {
        this.canvas = document.getElementById('starsCanvas');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
    }

    resizeCanvas() {
        if (!this.canvas) return;
        
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createStars() {
        this.stars = [];
        const numStars = Math.min(200, window.innerWidth / 4); // Адаптивное количество звезд
        
        for (let i = 0; i < numStars; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 3 + 1,
                brightness: Math.random(),
                twinkleSpeed: Math.random() * 0.02 + 0.005,
                color: this.getRandomStarColor()
            });
        }
    }

    getRandomStarColor() {
        const colors = [
            'rgba(255, 255, 255, ',
            'rgba(99, 102, 241, ',
            'rgba(59, 130, 246, ',
            'rgba(6, 182, 212, ',
            'rgba(236, 72, 153, '
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    createParticles() {
        // Создаем энергетические частицы
        const particlesContainer = document.querySelector('.particles');
        if (!particlesContainer) return;

        // Создаем 20 энергетических частиц
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'energy-particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = -Math.random() * 4 + 's';
            particle.style.animationDuration = (3 + Math.random() * 2) + 's';
            particlesContainer.appendChild(particle);
        }
    }

    animate() {
        if (!this.ctx) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Рисуем звезды с мерцанием
        this.stars.forEach(star => {
            star.brightness += star.twinkleSpeed;
            if (star.brightness > 1 || star.brightness < 0) {
                star.twinkleSpeed = -star.twinkleSpeed;
            }
            star.brightness = Math.max(0, Math.min(1, star.brightness));
            
            this.ctx.save();
            this.ctx.globalAlpha = star.brightness;
            this.ctx.fillStyle = star.color + star.brightness + ')';
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Добавляем эффект свечения для ярких звезд
            if (star.brightness > 0.7) {
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = star.color + '0.5)';
                this.ctx.fill();
                this.ctx.shadowBlur = 0;
            }
            
            this.ctx.restore();
        });
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    addEventListeners() {
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.createStars();
        });

        // Добавляем интерактивность к звездам
        if (this.canvas) {
            this.canvas.addEventListener('mousemove', (e) => {
                const rect = this.canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                this.stars.forEach(star => {
                    const distance = Math.sqrt(
                        Math.pow(mouseX - star.x, 2) + Math.pow(mouseY - star.y, 2)
                    );
                    
                    if (distance < 100) {
                        star.twinkleSpeed = 0.05;
                        star.size = Math.min(star.size * 1.1, 6);
                    } else {
                        star.twinkleSpeed = Math.random() * 0.02 + 0.005;
                        star.size = Math.max(star.size * 0.99, 1);
                    }
                });
            });
        }
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
}

// Дополнительные методы для ScreenTransitions
ScreenTransitions.fadeIn = function(element, duration = 600) {
        return new Promise(resolve => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(30px) scale(0.95)';
            element.classList.remove('hidden');
            
            const animation = element.animate([
                { 
                    opacity: '0', 
                    transform: 'translateY(30px) scale(0.95)' 
                },
                { 
                    opacity: '1', 
                    transform: 'translateY(0) scale(1)' 
                }
            ], {
                duration,
                easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
                fill: 'forwards'
            });
            
            animation.onfinish = () => resolve();
        });
    };

ScreenTransitions.fadeOut = function(element, duration = 400) {
        return new Promise(resolve => {
            const animation = element.animate([
                { 
                    opacity: '1', 
                    transform: 'translateY(0) scale(1)' 
                },
                { 
                    opacity: '0', 
                    transform: 'translateY(-30px) scale(1.05)' 
                }
            ], {
                duration,
                easing: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
                fill: 'forwards'
            });
            
            animation.onfinish = () => {
                element.classList.add('hidden');
                resolve();
            };
        });
    };

ScreenTransitions.morphTransition2 = function(fromElement, toElement, duration = 800) {
        return new Promise(resolve => {
            // Эффект морфинга между элементами
            const morphContainer = document.createElement('div');
            morphContainer.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, 
                    rgba(99, 102, 241, 0.1) 0%, 
                    rgba(59, 130, 246, 0.1) 100%
                );
                backdrop-filter: blur(20px);
                z-index: 9999;
                opacity: 0;
            `;
            
            document.body.appendChild(morphContainer);
            
            // Анимация появления морфинга
            const morphIn = morphContainer.animate([
                { opacity: '0', transform: 'scale(0.8)' },
                { opacity: '1', transform: 'scale(1.1)' },
                { opacity: '1', transform: 'scale(1)' }
            ], {
                duration: duration / 2,
                easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            });
            
            morphIn.onfinish = () => {
                // Переключаем элементы
                fromElement.classList.add('hidden');
                toElement.classList.remove('hidden');
                
                // Анимация исчезновения морфинга
                const morphOut = morphContainer.animate([
                    { opacity: '1', transform: 'scale(1)' },
                    { opacity: '0', transform: 'scale(1.2)' }
                ], {
                    duration: duration / 2,
                    easing: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)'
                });
                
                morphOut.onfinish = () => {
                    document.body.removeChild(morphContainer);
                    resolve();
                };
            };
        });
    };

// Система уведомлений
class NotificationSystem {
    constructor() {
        this.container = document.getElementById('notificationsContainer');
        this.notifications = [];
    }

    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">${this.getIcon(type)}</div>
                <div class="notification-message">${message}</div>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Стили уведомления
        notification.style.cssText = `
            background: linear-gradient(135deg, 
                rgba(26, 26, 46, 0.95) 0%, 
                rgba(22, 33, 62, 0.95) 100%
            );
            backdrop-filter: blur(20px);
            border: 1px solid rgba(99, 102, 241, 0.3);
            border-radius: 12px;
            padding: 15px;
            margin-bottom: 10px;
            min-width: 300px;
            max-width: 400px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            transform: translateX(400px);
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        `;
        
        this.container.appendChild(notification);
        
        // Анимация появления
        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
            notification.style.opacity = '1';
        });
        
        // Автоудаление
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.parentElement.removeChild(notification);
                }
            }, 400);
        }, duration);
        
        return notification;
    }

    getIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            cosmic: '🚀'
        };
        return icons[type] || icons.info;
    }
}

// Система частиц для кнопок
class ButtonParticles {
    static createExplosion(button, color = '#6366f1') {
        const rect = button.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        for (let i = 0; i < 12; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: fixed;
                width: 4px;
                height: 4px;
                background: ${color};
                border-radius: 50%;
                pointer-events: none;
                z-index: 10000;
                left: ${centerX}px;
                top: ${centerY}px;
            `;
            
            document.body.appendChild(particle);
            
            const angle = (i / 12) * Math.PI * 2;
            const distance = 50 + Math.random() * 30;
            const duration = 600 + Math.random() * 200;
            
            const animation = particle.animate([
                {
                    transform: 'translate(0, 0) scale(1)',
                    opacity: 1
                },
                {
                    transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(0)`,
                    opacity: 0
                }
            ], {
                duration,
                easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            });
            
            animation.onfinish = () => {
                document.body.removeChild(particle);
            };
        }
    }
}

// Инициализация анимаций
let cosmicAnimations;
let notificationSystem;

document.addEventListener('DOMContentLoaded', () => {
    cosmicAnimations = new CosmicAnimations();
    notificationSystem = new NotificationSystem();
    
    // Добавляем эффекты к кнопкам
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('cosmic-button')) {
            ButtonParticles.createExplosion(e.target);
        }
    });
});

// Экспортируем для использования в других модулях
window.ScreenTransitions = ScreenTransitions;
window.NotificationSystem = notificationSystem;
window.CosmicAnimations = cosmicAnimations;