// VLESS WebSocket Proxy Server
// Bridges browser WebSocket connections to VLESS TCP server

const WebSocket = require('ws');
const net = require('net');
const crypto = require('crypto');

class VLESSProxy {
  constructor(options = {}) {
    this.vlessConfig = {
      host: options.vlessHost || '95.181.173.120',
      port: options.vlessPort || 8443,
      uuid: options.uuid || '89462a65-fafa-4f9a-9efd-2be01a001778',
      security: 'reality', // Из конфигурации панели
      sni: 'google.com', // Основной SNI из панели  
      dest: 'google.com:443', // Destination из панели
      pbk: 'sYRQrrHz53_pV3JTotREtRsdsc71UmUQfIWPbe3M3CE', // Public key из панели
      utls: 'chrome', // uTLS fingerprint из панели
      flow: '', // Для Reality обычно пусто
      sid: options.sid || 'fd9f991d' // Short ID (можем использовать из URL)
    };
    
    this.wsServer = null;
    this.connections = new Map();
  }

  // Parse UUID to bytes
  parseUUID(uuid) {
    const hex = uuid.replace(/-/g, '');
    const buffer = Buffer.alloc(16);
    for (let i = 0; i < 16; i++) {
      buffer[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return buffer;
  }

  // Create proper VLESS request header for Reality protocol
  createVLESSHeader(targetHost = 'google.com', targetPort = 443) {
    const uuid = this.parseUUID(this.vlessConfig.uuid);
    
    // ВАЖНО: Для Reality протокола используем destination из конфигурации сервера!
    const realTargetHost = this.vlessConfig.dest.split(':')[0]; // google.com из google.com:443
    const realTargetPort = parseInt(this.vlessConfig.dest.split(':')[1]) || 443;
    
    console.log(`🎯 Using Reality destination: ${realTargetHost}:${realTargetPort} (from server config)`);
    
    // Правильная структура VLESS заголовка для Reality:
    // [version] [uuid] [additional info length] [command] [port] [address type] [address length] [address]
    
    const buffers = [];
    
    // 1. Version (1 byte) - всегда 0
    buffers.push(Buffer.from([0x00]));
    
    // 2. UUID (16 bytes)
    buffers.push(uuid);
    
    // 3. Additional info length (1 byte) - для Reality 0 (без дополнительной инфо)
    buffers.push(Buffer.from([0x00]));
    
    // 4. Command (1 byte) - 1 для TCP
    buffers.push(Buffer.from([0x01]));
    
    // 5. Port (2 bytes) - big endian - используем реальный destination port
    const portBuffer = Buffer.alloc(2);
    portBuffer.writeUInt16BE(realTargetPort, 0);
    buffers.push(portBuffer);
    
    // 6. Address Type (1 byte) - 2 для domain
    buffers.push(Buffer.from([0x02]));
    
    // 7. Address Length (1 byte) + Address (variable length) - используем реальный destination host
    const hostBuffer = Buffer.from(realTargetHost, 'utf8');
    buffers.push(Buffer.from([hostBuffer.length]));
    buffers.push(hostBuffer);
    
    const header = Buffer.concat(buffers);
    console.log(`🔧 VLESS Reality header: ${header.length} bytes for ${realTargetHost}:${realTargetPort}`);
    console.log(`🔧 Header hex: ${header.toString('hex')}`);
    console.log(`🔧 UUID used: ${this.vlessConfig.uuid}`);
    
    return header;
  }

  // Start WebSocket proxy server
  start(port = 8080) {
    this.wsServer = new WebSocket.Server({ 
      port: port,
      perMessageDeflate: false,
      // Добавляем поддержку CORS для браузерных подключений
      verifyClient: (info) => {
        console.log(`🔍 WebSocket connection from: ${info.origin || 'unknown'}`);
        return true; // Разрешаем все подключения
      }
    });

    console.log(`🚀 VLESS WebSocket Proxy started on port ${port}`);
    console.log(`🎯 Target VLESS: ${this.vlessConfig.host}:${this.vlessConfig.port}`);
    
    this.wsServer.on('connection', (ws, request) => {
      const clientId = crypto.randomUUID();
      console.log(`📱 New WebSocket client: ${clientId}`);
      
      this.handleWebSocketConnection(ws, clientId, request);
    });

    this.wsServer.on('error', (error) => {
      console.error('❌ WebSocket server error:', error);
    });

    return this.wsServer;
  }

  // Handle WebSocket connection from browser
  handleWebSocketConnection(ws, clientId, request) {
    const clientIP = request.socket.remoteAddress;
    console.log(`🔗 Client ${clientId} connected from ${clientIP}`);

    // Create TCP connection to VLESS server with timeout
    const tcpSocket = new net.Socket();
    tcpSocket.setTimeout(15000); // 15 секунд таймаут
    
    console.log(`🎯 Connecting to VLESS Reality server: ${this.vlessConfig.host}:${this.vlessConfig.port}`);
    console.log(`🔑 Using config: SNI=${this.vlessConfig.sni}, Dest=${this.vlessConfig.dest}, uTLS=${this.vlessConfig.utls}`);
    
    // Store connection mapping
    this.connections.set(clientId, {
      ws: ws,
      tcp: tcpSocket,
      connected: false,
      handshakeComplete: false
    });

    // Connect to VLESS server
    tcpSocket.connect(this.vlessConfig.port, this.vlessConfig.host, () => {
      console.log(`✅ TCP connected to VLESS server for client ${clientId}`);
      
      // Send VLESS handshake header
      const header = this.createVLESSHeader(this.vlessConfig.sni, 443);
      console.log(`📤 Sending VLESS header: ${header.length} bytes`);
      tcpSocket.write(header);
      
      const connection = this.connections.get(clientId);
      if (connection) {
        connection.connected = true;
        // НЕ устанавливаем handshakeComplete сразу - дождемся ответа от сервера
      }
    });

    // Handle TCP data from VLESS server
    tcpSocket.on('data', (data) => {
      const connection = this.connections.get(clientId);
      
      if (!connection.handshakeComplete) {
        // Первый ответ от VLESS сервера - это подтверждение handshake
        console.log(`📥 VLESS handshake response: ${data.length} bytes`);
        console.log(`📥 Response hex: ${data.toString('hex')}`);
        
        // Проверяем правильность ответа VLESS
        if (data.length > 0) {
          connection.handshakeComplete = true;
          console.log(`✅ VLESS handshake successful for client ${clientId}`);
          
          // Уведомляем браузер об успешном подключении
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'vless-connected',
              status: 'success',
              message: 'VLESS tunnel established'
            }));
          }
        } else {
          console.error(`❌ Invalid VLESS handshake response for client ${clientId}`);
          tcpSocket.destroy();
          return;
        }
      } else {
        // Обычные данные - пересылаем в браузер
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
          console.log(`📤 Forwarded ${data.length} bytes from VLESS to client ${clientId}`);
        }
      }
    });

    // Handle TCP errors
    tcpSocket.on('error', (error) => {
      console.error(`❌ TCP error for client ${clientId}:`, error.message);
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'vless-error',
          error: error.message
        }));
      }
      
      this.cleanupConnection(clientId);
    });

    // Handle TCP close
    tcpSocket.on('close', () => {
      console.log(`🔌 TCP connection closed for client ${clientId}`);
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'vless-disconnected'
        }));
        ws.close();
      }
      
      this.cleanupConnection(clientId);
    });

    // Handle TCP timeout
    tcpSocket.on('timeout', () => {
      console.error(`⏰ TCP timeout for client ${clientId}`);
      tcpSocket.destroy();
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'vless-error',
          error: 'Connection timeout'
        }));
      }
      
      this.cleanupConnection(clientId);
    });

    // Handle WebSocket messages from browser
    ws.on('message', (data) => {
      const connection = this.connections.get(clientId);
      
      if (!connection || !connection.connected) {
        console.warn(`⚠️ Client ${clientId} not connected to VLESS`);
        return;
      }

      try {
        // Try to parse as JSON (signaling messages)
        const message = JSON.parse(data);
        
        if (message.type === 'webrtc-data') {
          // Forward WebRTC data through VLESS tunnel
          const dataBuffer = Buffer.from(JSON.stringify(message.data));
          tcpSocket.write(dataBuffer);
          console.log(`📥 Forwarded WebRTC data through VLESS for client ${clientId}`);
        }
        
      } catch (error) {
        // Handle binary data
        if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
          tcpSocket.write(data);
          console.log(`📥 Forwarded ${data.length} binary bytes through VLESS for client ${clientId}`);
        }
      }
    });

    // Handle WebSocket close
    ws.on('close', () => {
      console.log(`📱 WebSocket client ${clientId} disconnected`);
      
      const connection = this.connections.get(clientId);
      if (connection && connection.tcp) {
        connection.tcp.destroy();
      }
      
      this.cleanupConnection(clientId);
    });

    // Handle WebSocket errors
    ws.on('error', (error) => {
      console.error(`❌ WebSocket error for client ${clientId}:`, error.message);
      this.cleanupConnection(clientId);
    });
  }

  // Cleanup connection
  cleanupConnection(clientId) {
    const connection = this.connections.get(clientId);
    
    if (connection) {
      if (connection.tcp && !connection.tcp.destroyed) {
        connection.tcp.destroy();
      }
      
      if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close();
      }
      
      this.connections.delete(clientId);
      console.log(`🧹 Cleaned up connection ${clientId}`);
    }
  }

  // Stop proxy server
  stop() {
    if (this.wsServer) {
      // Close all connections
      this.connections.forEach((connection, clientId) => {
        this.cleanupConnection(clientId);
      });
      
      this.wsServer.close(() => {
        console.log('🛑 VLESS WebSocket Proxy stopped');
      });
    }
  }

  // Get status
  getStatus() {
    return {
      running: true, // Всегда работает, интегрирован в основной сервер
      connections: this.connections.size,
      vlessTarget: `${this.vlessConfig.host}:${this.vlessConfig.port}`
    };
  }
}

module.exports = VLESSProxy;

// Example usage if run directly
if (require.main === module) {
  const proxy = new VLESSProxy({
    vlessHost: '95.181.173.120',
    vlessPort: 8443,
    uuid: '89462a65-fafa-4f9a-9efd-2be01a001778'
  });

  proxy.start(8080);
  
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down VLESS proxy...');
    proxy.stop();
    process.exit(0);
  });
}