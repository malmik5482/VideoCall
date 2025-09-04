// ---- VLESS-WebRTC Integration for Russian Networks ----
// Automatically routes WebRTC traffic through VLESS tunnel
// Version: 1.0.0-VLESS

// ========== VLESS CONFIGURATION ==========
const VLESS_CONFIG = {
  server: '95.181.173.120',
  port: 8443,
  uuid: '89462a65-fafa-4f9a-9efd-2be01a001778',
  type: 'tcp',
  security: 'reality',
  publicKey: 'sYRQrrHz53_pV3JTotREtRsdsc71UmUQflWPbe3M3CE',
  fingerprint: 'chrome',
  sni: 'google.com',
  shortId: 'fd9f991d',
  spiderX: '/',
  flow: 'xtls-rprx-vision'
};

// ========== VLESS TUNNEL MANAGER ==========
class VLESSWebRTCTunnel {
  constructor() {
    this.isConnected = false;
    this.websocket = null;
    this.originalRTCPeerConnection = null;
    this.tunneledConnections = new Map();
  }

  // Парсинг VLESS URL
  static parseVlessUrl(url) {
    try {
      const decoded = decodeURIComponent(url);
      const match = decoded.match(/vless:\/\/([^@]+)@([^:]+):(\d+)\?(.+)#?(.*)$/);
      
      if (!match) throw new Error('Invalid VLESS URL format');
      
      const [, uuid, host, port, params, name] = match;
      const paramObj = {};
      
      params.split('&').forEach(param => {
        const [key, value] = param.split('=');
        paramObj[key] = decodeURIComponent(value);
      });
      
      return {
        uuid,
        host,
        port: parseInt(port),
        type: paramObj.type || 'tcp',
        security: paramObj.security || 'none',
        publicKey: paramObj.pbk,
        fingerprint: paramObj.fp,
        sni: paramObj.sni,
        shortId: paramObj.sid,
        spiderX: paramObj.spx,
        flow: paramObj.flow,
        name: name || 'VLESS Tunnel'
      };
    } catch (error) {
      console.error('VLESS URL parsing error:', error);
      return null;
    }
  }

  // Установка VLESS туннеля
  async establishTunnel() {
    try {
      console.log('🔄 Устанавливаем VLESS туннель...');
      
      // Создаем WebSocket соединение к VLESS серверу
      const wsUrl = `wss://${VLESS_CONFIG.server}:${VLESS_CONFIG.port}`;
      
      return new Promise((resolve, reject) => {
        this.websocket = new WebSocket(wsUrl);
        
        this.websocket.onopen = () => {
          console.log('✅ VLESS туннель установлен');
          this.isConnected = true;
          this.setupWebRTCInterception();
          resolve(true);
        };
        
        this.websocket.onerror = (error) => {
          console.error('❌ Ошибка VLESS туннеля:', error);
          this.isConnected = false;
          reject(error);
        };
        
        this.websocket.onclose = () => {
          console.log('🔌 VLESS туннель закрыт');
          this.isConnected = false;
        };
        
        this.websocket.onmessage = (event) => {
          // Обработка данных от VLESS сервера
          this.handleVLESSMessage(event.data);
        };
        
        // Таймаут подключения
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('VLESS connection timeout'));
          }
        }, 10000);
      });
    } catch (error) {
      console.error('VLESS tunnel setup failed:', error);
      throw error;
    }
  }

  // Перехват WebRTC соединений
  setupWebRTCInterception() {
    if (this.originalRTCPeerConnection) return; // Уже перехвачено
    
    this.originalRTCPeerConnection = window.RTCPeerConnection;
    
    const vlessTunnel = this;
    
    // Заменяем RTCPeerConnection на проксированную версию
    window.RTCPeerConnection = function(config) {
      console.log('🔄 Создаем WebRTC соединение через VLESS туннель');
      
      // Модифицируем ICE серверы для работы через туннель
      if (config && config.iceServers) {
        config.iceServers = vlessTunnel.modifyIceServers(config.iceServers);
      }
      
      const pc = new vlessTunnel.originalRTCPeerConnection(config);
      const connectionId = Math.random().toString(36).substr(2, 9);
      
      // Сохраняем соединение для управления
      vlessTunnel.tunneledConnections.set(connectionId, pc);
      
      // Перехватываем ICE кандидатов
      pc.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
          vlessTunnel.handleIceCandidate(event.candidate, connectionId);
        }
      });
      
      return pc;
    };
    
    console.log('🔧 WebRTC перехват настроен для VLESS туннеля');
  }

  // Модификация ICE серверов для туннелирования
  modifyIceServers(iceServers) {
    const tunnelledServers = [];
    
    // Добавляем наш VLESS сервер как TURN сервер
    tunnelledServers.push({
      urls: [`turn:${VLESS_CONFIG.server}:${VLESS_CONFIG.port}`],
      username: 'vless-tunnel',
      credential: VLESS_CONFIG.uuid,
      credentialType: 'password'
    });
    
    // Сохраняем оригинальные серверы как резерв
    iceServers.forEach(server => {
      if (server.urls) {
        const modifiedServer = { ...server };
        
        // Маршрутизуем через VLESS
        if (Array.isArray(server.urls)) {
          modifiedServer.urls = server.urls.map(url => 
            this.routeUrlThroughVLESS(url)
          );
        } else {
          modifiedServer.urls = this.routeUrlThroughVLESS(server.urls);
        }
        
        tunnelledServers.push(modifiedServer);
      }
    });
    
    return tunnelledServers;
  }

  // Маршрутизация URL через VLESS
  routeUrlThroughVLESS(originalUrl) {
    try {
      // Заменяем адрес на VLESS сервер, сохраняя протокол
      if (originalUrl.includes('stun:') || originalUrl.includes('turn:')) {
        const urlObj = new URL(originalUrl.replace(/^(stun|turn):/, 'http:'));
        return originalUrl.replace(urlObj.hostname, VLESS_CONFIG.server);
      }
      return originalUrl;
    } catch (error) {
      console.error('URL routing error:', error);
      return originalUrl;
    }
  }

  // Обработка ICE кандидатов через туннель
  handleIceCandidate(candidate, connectionId) {
    if (!this.isConnected) return;
    
    try {
      const message = {
        type: 'ice-candidate',
        connectionId: connectionId,
        candidate: candidate,
        timestamp: Date.now()
      };
      
      // Отправляем через VLESS туннель
      this.websocket.send(JSON.stringify(message));
      
      console.log('📡 ICE кандидат отправлен через VLESS:', candidate.candidate);
    } catch (error) {
      console.error('ICE candidate tunneling error:', error);
    }
  }

  // Обработка сообщений от VLESS сервера
  handleVLESSMessage(data) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'ice-candidate-response':
          this.handleRemoteIceCandidate(message);
          break;
        case 'connection-status':
          this.handleConnectionStatus(message);
          break;
        default:
          console.log('Unknown VLESS message:', message);
      }
    } catch (error) {
      console.error('VLESS message handling error:', error);
    }
  }

  // Обработка удаленных ICE кандидатов
  handleRemoteIceCandidate(message) {
    const connection = this.tunneledConnections.get(message.connectionId);
    if (connection && message.candidate) {
      connection.addIceCandidate(new RTCIceCandidate(message.candidate));
      console.log('📡 Получен удаленный ICE кандидат через VLESS');
    }
  }

  // Обработка статуса соединения
  handleConnectionStatus(message) {
    console.log('🔗 Статус VLESS соединения:', message.status);
    
    if (message.status === 'connected') {
      this.showStatus('✅ VLESS туннель активен', 'success');
    } else if (message.status === 'disconnected') {
      this.showStatus('❌ VLESS туннель отключен', 'error');
    }
  }

  // Закрытие туннеля
  async closeTunnel() {
    try {
      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }
      
      // Восстанавливаем оригинальный RTCPeerConnection
      if (this.originalRTCPeerConnection) {
        window.RTCPeerConnection = this.originalRTCPeerConnection;
        this.originalRTCPeerConnection = null;
      }
      
      this.tunneledConnections.clear();
      this.isConnected = false;
      
      console.log('🔌 VLESS туннель закрыт');
    } catch (error) {
      console.error('Error closing VLESS tunnel:', error);
    }
  }

  // Отображение статуса
  showStatus(message, type = 'info') {
    console.log(message);
    
    const statusElement = document.getElementById('vless-status');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `vless-status ${type}`;
    }
  }

  // Диагностика туннеля
  async runDiagnostics() {
    const results = {
      vlessConfig: !!VLESS_CONFIG.server,
      serverReachable: false,
      tunnelEstablished: this.isConnected,
      webrtcIntercepted: !!this.originalRTCPeerConnection
    };

    // Проверка доступности сервера
    try {
      const response = await fetch(`https://${VLESS_CONFIG.server}:${VLESS_CONFIG.port}`, {
        method: 'HEAD',
        mode: 'no-cors'
      });
      results.serverReachable = true;
    } catch (error) {
      console.log('Server ping failed (expected for VLESS)');
    }

    return results;
  }
}

// ========== GLOBAL VLESS TUNNEL INSTANCE ==========
let globalVLESSTunnel = null;

// Функции для интеграции с основным приложением
window.VLESSWebRTC = {
  // Инициализация VLESS туннеля
  async init() {
    if (globalVLESSTunnel) return globalVLESSTunnel;
    
    globalVLESSTunnel = new VLESSWebRTCTunnel();
    return globalVLESSTunnel;
  },
  
  // Подключение туннеля
  async connect() {
    if (!globalVLESSTunnel) {
      globalVLESSTunnel = new VLESSWebRTCTunnel();
    }
    
    return await globalVLESSTunnel.establishTunnel();
  },
  
  // Отключение туннеля
  async disconnect() {
    if (globalVLESSTunnel) {
      await globalVLESSTunnel.closeTunnel();
    }
  },
  
  // Статус туннеля
  isConnected() {
    return globalVLESSTunnel ? globalVLESSTunnel.isConnected : false;
  },
  
  // Диагностика
  async diagnose() {
    if (!globalVLESSTunnel) {
      globalVLESSTunnel = new VLESSWebRTCTunnel();
    }
    
    return await globalVLESSTunnel.runDiagnostics();
  }
};

console.log('🚀 VLESS-WebRTC модуль загружен');
console.log('📡 Сервер:', VLESS_CONFIG.server + ':' + VLESS_CONFIG.port);
console.log('🔑 UUID:', VLESS_CONFIG.uuid.substr(0, 8) + '...');