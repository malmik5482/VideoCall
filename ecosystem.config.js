module.exports = {
  apps: [{
    // Основное приложение VideoCall
    name: 'videocall-server',
    script: './server/index.js',
    instances: 1,
    exec_mode: 'fork',
    
    // Автоматический перезапуск
    watch: false,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 5000,
    
    // Переменные окружения для продакшена
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      
      // TURN сервер для WebRTC (VPS 94.198.218.189)
      TURN_SERVER: '94.198.218.189:3478',
      TURN_USERNAME: 'webrtc',
      TURN_PASSWORD: 'pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN',
      TURN_REALM: 'videocall',
      
      // VLESS сервер (VPS 95.181.173.120) - экспериментальный
      VLESS_SERVER: '95.181.173.120',
      VLESS_PORT: 8443,
      VLESS_UUID: '550e8400-e29b-41d4-a716-446655440000',
      VLESS_FLOW: 'xtls-rprx-vision',
      
      // Reality конфигурация для VLESS
      REALITY_PUBLIC_KEY: 'z9hX8rKsHn_W-F5nKw1H7TLvzKzMhRvJ3YcE4XrZ8kI',
      REALITY_SHORT_ID: '6ba85179e30d4fc2',
      REALITY_SNI: 'google.com',
      
      // WebSocket настройки
      WS_PATH: '/ws',
      WS_HEARTBEAT: 30000,
      
      // Логирование
      LOG_LEVEL: 'info',
      LOG_FILE: './logs/cosmoschat.log',
      
      // ICE серверы для Timeweb Apps
      ICE_URLS: 'turn:94.198.218.189:3478?transport=udp,turn:94.198.218.189:3478?transport=tcp,stun:94.198.218.189:3478,stun:stun.l.google.com:19302',
      TURN_USER: 'webrtc',
      TURN_PASS: 'pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN',
      
      // Дополнительные настройки
      MAX_MEMORY_RESTART: '500M'
    },
    
    // Переменные окружения для разработки
    env_development: {
      NODE_ENV: 'development',
      PORT: 3001,
      TURN_SERVER: '94.198.218.189:3478',
      TURN_USERNAME: 'webrtc',
      TURN_PASSWORD: 'pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN',
      LOG_LEVEL: 'debug'
    },
    
    // Timeweb production environment
    env_timeweb: {
      NODE_ENV: 'production',
      PORT: 3001,
      DOMAIN: 'malmik5482-videocall-fc69.twc1.net',
      APP_URL: 'https://malmik5482-videocall-fc69.twc1.net',
      
      // TURN Server
      TURN_SERVER: '94.198.218.189:3478',
      TURN_USERNAME: 'webrtc', 
      TURN_PASSWORD: 'pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN',
      TURN_REALM: 'videocall',
      
      // ICE Servers
      ICE_URLS: 'turn:94.198.218.189:3478?transport=udp,turn:94.198.218.189:3478?transport=tcp,stun:stun.l.google.com:19302',
      TURN_USER: 'webrtc',
      TURN_PASS: 'pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN',
      
      // Timeweb Settings
      TIMEWEB_PROJECT_ID: 'malmik5482-videocall-fc69',
      LOG_LEVEL: 'info',
      MAX_LOG_SIZE: '50m'
    },
    
    // Логирование
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
    time: true,
    
    // Мониторинг производительности
    max_memory_restart: '500M',
    
    // Обработка сигналов завершения
    kill_timeout: 5000,
    shutdown_with_message: true,
    
    // Дополнительные опции Node.js
    node_args: '--max-old-space-size=512',
    
    // Интеграция с системами мониторинга
    instance_var: 'INSTANCE_ID',
    
    // Post-deploy хук для автоматических действий после деплоя
    post_deploy: 'npm install --production && pm2 reload ecosystem.config.js --env production',
    
    // Pre-setup хук для подготовки окружения
    pre_setup: 'mkdir -p logs'
  }],
  
  // Конфигурация для деплоя (опционально)
  deploy: {
    production: {
      user: 'deploy',
      host: ['94.198.218.189'], // Ваш основной VPS
      ref: 'origin/main',
      repo: 'https://github.com/malmik5482/VideoCall.git',
      path: '/var/www/cosmoschat',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': 'echo "Deploying CosmosChat to production server"'
    }
  }
};