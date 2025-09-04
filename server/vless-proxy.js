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
      security: options.security || 'reality',
      sni: options.sni || 'google.com'
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

  // Create VLESS request header
  createVLESSHeader(targetHost = 'google.com', targetPort = 443) {
    const uuid = this.parseUUID(this.vlessConfig.uuid);
    const version = Buffer.from([0x00]); // Version 0
    const command = Buffer.from([0x01]); // TCP command
    const port = Buffer.alloc(2);
    port.writeUInt16BE(targetPort, 0);
    
    const addressType = Buffer.from([0x02]); // Domain type
    const hostBuffer = Buffer.from(targetHost);
    const hostLength = Buffer.from([hostBuffer.length]);
    
    return Buffer.concat([
      version,
      uuid,
      Buffer.from([0x00]), // Additional info length = 0
      command,
      port,
      addressType,
      hostLength,
      hostBuffer
    ]);
  }

  // Start WebSocket proxy server
  start(port = 8080) {
    this.wsServer = new WebSocket.Server({ 
      port: port,
      perMessageDeflate: false 
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

    // Create TCP connection to VLESS server
    const tcpSocket = new net.Socket();
    
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
      
      // Send VLESS handshake
      const header = this.createVLESSHeader(this.vlessConfig.sni, 443);
      tcpSocket.write(header);
      
      const connection = this.connections.get(clientId);
      if (connection) {
        connection.connected = true;
        connection.handshakeComplete = true;
      }
      
      // Notify browser of successful connection
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'vless-connected',
          status: 'success',
          message: 'VLESS tunnel established'
        }));
      }
    });

    // Handle TCP data from VLESS server
    tcpSocket.on('data', (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        // Forward VLESS server data to browser
        ws.send(data);
        console.log(`📤 Forwarded ${data.length} bytes from VLESS to client ${clientId}`);
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
      running: !!this.wsServer,
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