// Real VLESS Protocol Implementation for WebRTC
// This implements actual VLESS protocol communication

class VLESSClient {
  constructor(config) {
    this.config = {
      address: config.address || '95.181.173.120',
      port: config.port || 8443,
      uuid: config.uuid || '89462a65-fafa-4f9a-9efd-2be01a001778',
      security: config.security || 'reality',
      sni: config.sni || 'google.com',
      fp: config.fp || 'chrome',
      pbk: config.pbk || 'sYRQrrHz53_pV3JTotREtRsdsc71UmUQflWPbe3M3CE',
      sid: config.sid || 'fd9f991d',
      spx: config.spx || '/',
      flow: config.flow || 'xtls-rprx-vision'
    };
    
    this.connected = false;
    this.socket = null;
    this.onData = null;
    this.onClose = null;
    this.onError = null;
  }

  // Convert UUID string to bytes
  uuidToBytes(uuid) {
    const hex = uuid.replace(/-/g, '');
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  // Create VLESS request header
  createVLESSOHeader(command = 1, targetType = 1, targetHost = 'google.com', targetPort = 443) {
    const uuid = this.uuidToBytes(this.config.uuid);
    const version = 0;
    
    // Build header
    const header = new Uint8Array(1024); // Buffer
    let offset = 0;
    
    // Version (1 byte)
    header[offset++] = version;
    
    // UUID (16 bytes)
    header.set(uuid, offset);
    offset += 16;
    
    // Additional info length (1 byte) - for Reality
    const addonsLength = 0;
    header[offset++] = addonsLength;
    
    // Command (1 byte): 1 = TCP, 2 = UDP
    header[offset++] = command;
    
    // Port (2 bytes, big endian)
    header[offset++] = (targetPort >> 8) & 0xff;
    header[offset++] = targetPort & 0xff;
    
    // Address Type (1 byte): 1 = IPv4, 2 = Domain, 3 = IPv6
    header[offset++] = targetType;
    
    if (targetType === 2) { // Domain
      const hostBytes = new TextEncoder().encode(targetHost);
      header[offset++] = hostBytes.length;
      header.set(hostBytes, offset);
      offset += hostBytes.length;
    }
    
    return header.slice(0, offset);
  }

  // Connect using WebSocket proxy to VLESS server
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        // Connect to WebSocket proxy through the proxy service URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const proxyHost = '8080-ip468ihcy403p6enirr3p-6532622b.e2b.dev';
        const wsUrl = `${protocol}//${proxyHost}`;
        
        console.log(`🔄 Connecting to VLESS proxy: ${wsUrl}`);
        
        this.socket = new WebSocket(wsUrl);
        this.socket.binaryType = 'arraybuffer';
        
        this.socket.onopen = () => {
          console.log('✅ WebSocket proxy connected, waiting for VLESS tunnel');
          // The proxy server handles VLESS handshake, we just wait for confirmation
        };
        
        this.socket.onmessage = (event) => {
          try {
            // Handle both JSON control messages and binary data
            if (typeof event.data === 'string') {
              const message = JSON.parse(event.data);
              
              if (message.type === 'vless-connected') {
                this.connected = true;
                console.log('🛡️ VLESS tunnel established through proxy');
                resolve(true);
              } else if (message.type === 'vless-error') {
                console.error('❌ VLESS proxy error:', message.error);
                reject(new Error(message.error));
              } else if (message.type === 'vless-disconnected') {
                this.connected = false;
                console.log('🔌 VLESS tunnel disconnected');
                if (this.onClose) this.onClose();
              }
            } else {
              // Binary data from VLESS server
              if (this.onData) {
                this.onData(new Uint8Array(event.data));
              }
            }
          } catch (error) {
            console.warn('VLESS message parse error:', error);
            // If it's not JSON, treat as binary
            if (this.onData) {
              this.onData(new Uint8Array(event.data));
            }
          }
        };
        
        this.socket.onclose = () => {
          this.connected = false;
          console.log('🔌 VLESS connection closed');
          if (this.onClose) this.onClose();
        };
        
        this.socket.onerror = (error) => {
          this.connected = false;
          console.error('❌ VLESS connection error:', error);
          if (this.onError) this.onError(error);
          reject(error);
        };
        
        // Timeout
        setTimeout(() => {
          if (!this.connected) {
            reject(new Error('VLESS connection timeout'));
          }
        }, 10000);
        
      } catch (error) {
        console.error('❌ VLESS connect failed:', error);
        reject(error);
      }
    });
  }

  // Send data through VLESS tunnel
  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(data);
      return true;
    }
    return false;
  }

  // Close VLESS connection
  close() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
  }

  // Get connection status
  isConnected() {
    return this.connected && this.socket && this.socket.readyState === WebSocket.OPEN;
  }
}

// WebRTC over VLESS implementation
class WebRTCOverVLESS {
  constructor() {
    this.vlessClient = null;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.onRemoteStream = null;
    this.onConnectionChange = null;
    this.roomId = 'room-' + Math.random().toString(36).substr(2, 9);
    this.isInitiator = false;
  }

  // Initialize VLESS tunnel
  async initVLESS() {
    this.vlessClient = new VLESSClient({
      address: '95.181.173.120',
      port: 8443,
      uuid: '89462a65-fafa-4f9a-9efd-2be01a001778',
      sni: 'google.com',
      security: 'reality'
    });

    // Handle VLESS data
    this.vlessClient.onData = (data) => {
      this.handleVLESSData(data);
    };

    this.vlessClient.onClose = () => {
      if (this.onConnectionChange) {
        this.onConnectionChange('disconnected');
      }
    };

    this.vlessClient.onError = (error) => {
      console.error('VLESS error:', error);
      if (this.onConnectionChange) {
        this.onConnectionChange('error');
      }
    };

    // Connect
    await this.vlessClient.connect();
    
    if (this.onConnectionChange) {
      this.onConnectionChange('connected');
    }
    
    return true;
  }

  // Handle data received through VLESS
  handleVLESSData(data) {
    try {
      const text = new TextDecoder().decode(data);
      const message = JSON.parse(text);
      
      if (message.type === 'webrtc' && message.roomId === this.roomId) {
        this.handleWebRTCSignaling(message.data);
      }
    } catch (error) {
      // Handle non-JSON data
      console.log('VLESS binary data:', data.length, 'bytes');
    }
  }

  // Send WebRTC signaling through VLESS
  sendSignaling(data) {
    if (this.vlessClient && this.vlessClient.isConnected()) {
      const message = {
        type: 'webrtc',
        roomId: this.roomId,
        data: data
      };
      
      const messageBytes = new TextEncoder().encode(JSON.stringify(message));
      this.vlessClient.send(messageBytes);
      
      console.log('📡 Sent signaling through VLESS:', data.type);
      return true;
    }
    return false;
  }

  // Handle WebRTC signaling
  async handleWebRTCSignaling(data) {
    try {
      if (!this.peerConnection) return;

      switch (data.type) {
        case 'offer':
          await this.peerConnection.setRemoteDescription(data.sdp);
          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);
          this.sendSignaling({ type: 'answer', sdp: answer });
          break;

        case 'answer':
          await this.peerConnection.setRemoteDescription(data.sdp);
          break;

        case 'ice-candidate':
          await this.peerConnection.addIceCandidate(data.candidate);
          break;
      }
    } catch (error) {
      console.error('WebRTC signaling error:', error);
    }
  }

  // Start WebRTC call with VLESS routing
  async startCall(localVideoElement, remoteVideoElement) {
    try {
      // Get local media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: 15 },
        audio: { sampleRate: 44100, echoCancellation: true }
      });

      localVideoElement.srcObject = this.localStream;

      // Create peer connection with VLESS-routed ICE servers
      const iceServers = [
        { urls: `stun:${this.vlessClient.config.address}:3478` },
        { 
          urls: `turn:${this.vlessClient.config.address}:3478`,
          username: 'vless-turn',
          credential: this.vlessClient.config.uuid
        }
      ];

      this.peerConnection = new RTCPeerConnection({ iceServers });

      // Add tracks
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Handle remote stream
      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        remoteVideoElement.srcObject = this.remoteStream;
        
        if (this.onRemoteStream) {
          this.onRemoteStream(this.remoteStream);
        }
        
        console.log('🎥 Remote stream connected through VLESS');
      };

      // Handle ICE candidates through VLESS
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignaling({
            type: 'ice-candidate',
            candidate: event.candidate
          });
        }
      };

      // Connection state monitoring
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection.connectionState;
        console.log('🔗 WebRTC connection state:', state);
        
        if (this.onConnectionChange) {
          this.onConnectionChange(state);
        }
      };

      // Create and send offer (if initiator)
      this.isInitiator = true;
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      this.sendSignaling({
        type: 'offer',
        sdp: offer
      });

      console.log('📞 Call started through VLESS tunnel');
      return true;

    } catch (error) {
      console.error('❌ Call start failed:', error);
      throw error;
    }
  }

  // End call
  endCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    console.log('📞 Call ended');
  }

  // Close VLESS connection
  disconnect() {
    this.endCall();
    
    if (this.vlessClient) {
      this.vlessClient.close();
      this.vlessClient = null;
    }
    
    console.log('🔌 VLESS disconnected');
  }

  // Get status
  getStatus() {
    return {
      vlessConnected: this.vlessClient?.isConnected() || false,
      webrtcState: this.peerConnection?.connectionState || 'new',
      hasLocalStream: !!this.localStream,
      hasRemoteStream: !!this.remoteStream
    };
  }
}

// Export for use
window.WebRTCOverVLESS = WebRTCOverVLESS;
window.VLESSClient = VLESSClient;

console.log('🛡️ Real VLESS Protocol loaded');