// ---- VideoChat Pro: Ultimate Edition for Russian Networks ----
// Version: 5.0.0-ULTIMATE
// Optimized for 1Gbps connections with full error prevention

// ========== POLYFILLS AND COMPATIBILITY ==========
if (!navigator.mediaDevices) navigator.mediaDevices = {};
if (!navigator.mediaDevices.getUserMedia) {
  navigator.mediaDevices.getUserMedia = function (constraints) {
    const gum = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
    if (!gum) return Promise.reject(new Error('getUserMedia not supported'));
    return new Promise((resolve, reject) => gum.call(navigator, constraints, resolve, reject));
  };
}

// ========== CONSTANTS AND CONFIGURATION ==========
const APP_VERSION = '5.0.0-ULTIMATE';
const TURN_SERVER_IP = '94.198.218.189';
const TURN_SERVER_PORT = 3478;
const TURN_USERNAME = 'webrtc';
const TURN_PASSWORD = 'pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN';

// Enhanced video constraints optimized for 1Gbps
const VIDEO_CONSTRAINTS = {
  ultra: { 
    width: { ideal: 3840, min: 1920 }, 
    height: { ideal: 2160, min: 1080 }, 
    frameRate: { ideal: 60, min: 30 },
    aspectRatio: { ideal: 16/9 }
  },
  hd: { 
    width: { ideal: 1920, min: 1280 }, 
    height: { ideal: 1080, min: 720 }, 
    frameRate: { ideal: 30, min: 24 },
    aspectRatio: { ideal: 16/9 }
  },
  sd: { 
    width: { ideal: 1280, min: 640 }, 
    height: { ideal: 720, min: 480 }, 
    frameRate: { ideal: 24, min: 20 },
    aspectRatio: { ideal: 16/9 }
  },
  mobile: { 
    width: { ideal: 640, min: 480 }, 
    height: { ideal: 480, min: 360 }, 
    frameRate: { ideal: 20, min: 15 }
  },
  minimal: { 
    width: { ideal: 480, min: 320 }, 
    height: { ideal: 360, min: 240 }, 
    frameRate: { ideal: 15, min: 10 }
  }
};

const AUDIO_CONSTRAINTS = {
  premium: { 
    echoCancellation: true, 
    noiseSuppression: true, 
    autoGainControl: true, 
    sampleRate: 48000,
    channelCount: 2,
    sampleSize: 16
  },
  standard: { 
    echoCancellation: true, 
    noiseSuppression: true, 
    autoGainControl: true, 
    sampleRate: 44100,
    channelCount: 1
  },
  minimal: { 
    echoCancellation: true, 
    noiseSuppression: true, 
    autoGainControl: true, 
    sampleRate: 16000,
    channelCount: 1
  }
};

// Optimized bitrates for 1Gbps connection
const BITRATE_PRESETS = {
  ultra: { video: 50000000, audio: 256000 }, // 50 Mbps video, 256 kbps audio
  high: { video: 20000000, audio: 192000 },  // 20 Mbps video, 192 kbps audio
  medium: { video: 8000000, audio: 128000 },  // 8 Mbps video, 128 kbps audio
  low: { video: 2000000, audio: 96000 },      // 2 Mbps video, 96 kbps audio
  minimal: { video: 500000, audio: 64000 }    // 500 kbps video, 64 kbps audio
};

// ========== UTILITY FUNCTIONS ==========
function detectRussianEnvironment() {
  // Always return true since all users are from Russia
  return true;
}

function detectDeviceEnvironment() {
  const userAgent = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isTablet = /iPad|Android(?!.*Mobile)|tablet/i.test(userAgent);
  const isDesktop = !isMobile && !isTablet;
  
  let connectionType = 'unknown';
  let effectiveSpeed = 0;
  
  if ('connection' in navigator) {
    const conn = navigator.connection;
    effectiveSpeed = conn.downlink || 10;
    const effectiveType = conn.effectiveType || '4g';
    
    if (effectiveType === 'slow-2g' || effectiveSpeed < 0.25) connectionType = 'poor';
    else if (effectiveType === '2g' || effectiveSpeed < 0.5) connectionType = 'fair';
    else if (effectiveType === '3g' || effectiveSpeed < 2) connectionType = 'good';
    else if (effectiveType === '4g' || effectiveSpeed < 100) connectionType = 'excellent';
    else connectionType = 'ultra';
  } else {
    // Assume good connection if API not available
    connectionType = 'excellent';
    effectiveSpeed = 10;
  }

  return { isMobile, isTablet, isDesktop, connectionType, effectiveSpeed };
}

// ========== MAIN APPLICATION CLASS ==========
class VideoCallApp {
  constructor() {
    console.log(`🚀 VideoChat Pro ${APP_VERSION} initializing...`);
    
    // Core WebRTC components
    this.ws = null;
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.dataChannel = null;
    
    // Call state
    this.role = null;
    this.currentRoom = null;
    this.callStartTime = null;
    
    // Configuration
    this.iceServers = [];
    this.deviceCache = { video: [], audio: [], audioOutput: [] };
    this.settings = {
      videoQuality: 'hd',
      audioQuality: 'premium',
      videoEnabled: true,
      audioEnabled: true,
      selectedVideoDevice: null,
      selectedAudioDevice: null,
      selectedAudioOutput: null
    };
    
    // UI state
    this.chatMessages = [];
    this.isScreenSharing = false;
    this.panels = { chat: false, settings: false, history: false };
    
    // Connection management
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.connectionIssues = 0;
    this.lastSuccessfulConnection = null;
    
    // Russian network optimization
    this.isRussianUser = true;
    this.turnForced = true;
    this.turnConfirmed = false;
    
    // Performance tracking
    this.lastFramesDecoded = 0;
    this.staleFrameCount = 0;
    
    // Intervals
    this.intervals = {
      callTimer: null,
      qualityMonitor: null,
      connectionMonitor: null,
      heartbeat: null
    };

    // Initialize
    this.init();
  }

  async init() {
    try {
      this.detectEnvironment();
      if (!this.initializeElements()) {
        throw new Error('Failed to initialize DOM elements');
      }
      this.attachEventListeners();
      await this.initializeApp();
    } catch (error) {
      console.error('Initialization error:', error);
      this.handleCriticalError(error);
    }
  }

  detectEnvironment() {
    this.isRussianUser = true; // All users are from Russia
    this.environment = detectDeviceEnvironment();
    this.turnForced = true; // Always use TURN for Russia
    
    // Auto-select quality based on connection
    if (this.environment.connectionType === 'ultra') {
      this.settings.videoQuality = 'ultra';
      this.settings.audioQuality = 'premium';
    } else if (this.environment.connectionType === 'excellent') {
      this.settings.videoQuality = 'hd';
      this.settings.audioQuality = 'premium';
    } else if (this.environment.connectionType === 'good') {
      this.settings.videoQuality = 'sd';
      this.settings.audioQuality = 'standard';
    } else {
      this.settings.videoQuality = 'mobile';
      this.settings.audioQuality = 'minimal';
    }
    
    console.log('🌍 Environment:', this.environment);
  }

  initializeElements() {
    const elementIds = [
      'loadingScreen', 'app', 'joinScreen', 'callScreen',
      'roomInput', 'generateRoomBtn', 'previewVideo', 'joinBtn', 'toggleVideoBtn', 'toggleAudioBtn',
      'localVideo', 'remoteVideo', 'connectionIndicator',
      'videoToggle', 'audioToggle', 'screenShareToggle', 'chatToggle', 'hangupBtn', 'switchCameraBtn',
      'callDuration', 'roomCode', 'connectionStatus', 'remoteUserName',
      'chatPanel', 'settingsPanel', 'historyPanel',
      'settingsBtn', 'historyBtn', 'closeChatBtn', 'closeSettingsBtn', 'closeHistoryBtn',
      'chatMessages', 'chatInput', 'sendMessageBtn',
      'audioInputSelect', 'audioOutputSelect', 'videoInputSelect',
      'historyList', 'toastContainer'
    ];

    this.elements = {};
    for (const id of elementIds) {
      const element = document.getElementById(id);
      if (!element) {
        console.warn(`Element not found: ${id}`);
      }
      this.elements[id] = element;
    }
    
    return true;
  }

  attachEventListeners() {
    // Join screen
    this.safeAddEventListener(this.elements.generateRoomBtn, 'click', () => this.generateRoomCode());
    this.safeAddEventListener(this.elements.joinBtn, 'click', () => this.joinRoom());
    this.safeAddEventListener(this.elements.toggleVideoBtn, 'click', () => this.togglePreviewVideo());
    this.safeAddEventListener(this.elements.toggleAudioBtn, 'click', () => this.togglePreviewAudio());
    
    // Call controls
    this.safeAddEventListener(this.elements.videoToggle, 'click', () => this.toggleVideo());
    this.safeAddEventListener(this.elements.audioToggle, 'click', () => this.toggleAudio());
    this.safeAddEventListener(this.elements.screenShareToggle, 'click', () => this.toggleScreenShare());
    this.safeAddEventListener(this.elements.chatToggle, 'click', () => this.toggleChat());
    this.safeAddEventListener(this.elements.hangupBtn, 'click', () => this.hangup());
    this.safeAddEventListener(this.elements.switchCameraBtn, 'click', () => this.switchCamera());
    
    // Panels
    this.safeAddEventListener(this.elements.settingsBtn, 'click', () => this.openPanel('settings'));
    this.safeAddEventListener(this.elements.historyBtn, 'click', () => this.openPanel('history'));
    this.safeAddEventListener(this.elements.closeChatBtn, 'click', () => this.closePanel('chat'));
    this.safeAddEventListener(this.elements.closeSettingsBtn, 'click', () => this.closePanel('settings'));
    this.safeAddEventListener(this.elements.closeHistoryBtn, 'click', () => this.closePanel('history'));
    
    // Chat
    this.safeAddEventListener(this.elements.sendMessageBtn, 'click', () => this.sendChatMessage());
    this.safeAddEventListener(this.elements.chatInput, 'keypress', (e) => {
      if (e.key === 'Enter') this.sendChatMessage();
    });
    
    // Settings
    document.querySelectorAll('input[name="quality"]').forEach(radio => {
      this.safeAddEventListener(radio, 'change', (e) => this.changeVideoQuality(e.target.value));
    });
    
    this.safeAddEventListener(this.elements.audioInputSelect, 'change', (e) => this.changeAudioInput(e.target.value));
    this.safeAddEventListener(this.elements.audioOutputSelect, 'change', (e) => this.changeAudioOutput(e.target.value));
    this.safeAddEventListener(this.elements.videoInputSelect, 'change', (e) => this.changeVideoInput(e.target.value));
    
    // Room input enter key
    this.safeAddEventListener(this.elements.roomInput, 'keypress', (e) => {
      if (e.key === 'Enter') this.joinRoom();
    });
    
    // Window events
    this.safeAddEventListener(window, 'beforeunload', () => this.cleanup());
    this.safeAddEventListener(window, 'online', () => this.handleOnline());
    this.safeAddEventListener(window, 'offline', () => this.handleOffline());
  }

  safeAddEventListener(element, event, handler) {
    if (element && typeof handler === 'function') {
      try {
        element.addEventListener(event, handler);
      } catch (error) {
        console.warn(`Failed to add ${event} listener:`, error);
      }
    }
  }

  async initializeApp() {
    try {
      await this.loadConfig();
      await this.enumerateDevices();
      this.startMonitoring();
      setTimeout(() => this.hideLoading(), 1000);
    } catch (error) {
      console.error('App initialization failed:', error);
      this.handleCriticalError(error);
    }
  }

  async loadConfig() {
    try {
      const response = await fetch('/config');
      if (!response.ok) throw new Error('Config fetch failed');
      const config = await response.json();
      
      this.iceServers = config.iceServers || [];
      console.log(`📡 Loaded ${this.iceServers.length} ICE servers`);
    } catch (error) {
      console.warn('Using fallback ICE config');
      this.iceServers = [{
        urls: [
          `turn:${TURN_SERVER_IP}:${TURN_SERVER_PORT}?transport=udp`,
          `turn:${TURN_SERVER_IP}:${TURN_SERVER_PORT}?transport=tcp`
        ],
        username: TURN_USERNAME,
        credential: TURN_PASSWORD
      }];
    }
  }

  async enumerateDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      this.deviceCache.video = devices.filter(d => d.kind === 'videoinput');
      this.deviceCache.audio = devices.filter(d => d.kind === 'audioinput');
      this.deviceCache.audioOutput = devices.filter(d => d.kind === 'audiooutput');
      
      this.populateDeviceSelects();
    } catch (error) {
      console.warn('Device enumeration failed:', error);
    }
  }

  populateDeviceSelects() {
    if (this.elements.videoInputSelect) {
      this.elements.videoInputSelect.innerHTML = '<option value="">Авто</option>';
      this.deviceCache.video.forEach((device, i) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Камера ${i + 1}`;
        this.elements.videoInputSelect.appendChild(option);
      });
    }

    if (this.elements.audioInputSelect) {
      this.elements.audioInputSelect.innerHTML = '<option value="">Авто</option>';
      this.deviceCache.audio.forEach((device, i) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Микрофон ${i + 1}`;
        this.elements.audioInputSelect.appendChild(option);
      });
    }

    if (this.elements.audioOutputSelect) {
      this.elements.audioOutputSelect.innerHTML = '<option value="">По умолчанию</option>';
      this.deviceCache.audioOutput.forEach((device, i) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Динамики ${i + 1}`;
        this.elements.audioOutputSelect.appendChild(option);
      });
    }
  }

  hideLoading() {
    if (this.elements.loadingScreen) {
      this.elements.loadingScreen.classList.add('hidden');
    }
    if (this.elements.app) {
      this.elements.app.classList.remove('hidden');
    }
    this.startPreviewMedia();
  }

  async startPreviewMedia() {
    try {
      const constraints = {
        video: VIDEO_CONSTRAINTS[this.settings.videoQuality] || VIDEO_CONSTRAINTS.hd,
        audio: AUDIO_CONSTRAINTS[this.settings.audioQuality] || AUDIO_CONSTRAINTS.standard
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (this.elements.previewVideo) {
        this.elements.previewVideo.srcObject = this.localStream;
      }
      
      this.updateConnectionStatus('ready', 'Готов');
      console.log('✅ Preview started');
    } catch (error) {
      console.error('Media error:', error);
      this.handleMediaError(error);
    }
  }

  handleMediaError(error) {
    let message = 'Ошибка доступа к камере/микрофону';
    
    if (error.name === 'NotAllowedError') {
      message = 'Разрешите доступ к камере и микрофону';
    } else if (error.name === 'NotFoundError') {
      message = 'Камера или микрофон не найдены';
    } else if (error.name === 'NotReadableError') {
      message = 'Устройства заняты другим приложением';
    }
    
    this.showToast('error', message);
    this.updateConnectionStatus('error', 'Ошибка');
  }

  togglePreviewVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        if (this.elements.toggleVideoBtn) {
          this.elements.toggleVideoBtn.classList.toggle('active');
        }
      }
    }
  }

  togglePreviewAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        if (this.elements.toggleAudioBtn) {
          this.elements.toggleAudioBtn.classList.toggle('active');
        }
      }
    }
  }

  generateRoomCode() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    if (this.elements.roomInput) {
      this.elements.roomInput.value = code;
    }
    console.log(`Generated room: ${code}`);
  }

  async joinRoom() {
    const room = this.elements.roomInput?.value?.trim()?.toUpperCase();
    if (!room) {
      this.showToast('warning', 'Введите код комнаты');
      return;
    }

    try {
      if (this.elements.joinBtn) this.elements.joinBtn.disabled = true;
      
      this.currentRoom = room;
      if (this.elements.roomCode) {
        this.elements.roomCode.textContent = `Комната: ${room}`;
      }
      
      if (!this.localStream) {
        await this.startPreviewMedia();
      }
      
      await this.createPeerConnection();
      await this.connectWebSocket(room);
      
      // Switch screens
      if (this.elements.joinScreen) this.elements.joinScreen.style.display = 'none';
      if (this.elements.callScreen) this.elements.callScreen.classList.remove('hidden');
      if (this.elements.localVideo) this.elements.localVideo.srcObject = this.localStream;
      
      this.showToast('info', `Подключение к комнате ${room}...`);
    } catch (error) {
      console.error('Join error:', error);
      this.showToast('error', 'Ошибка подключения');
      if (this.elements.joinBtn) this.elements.joinBtn.disabled = false;
    }
  }

  async createPeerConnection() {
    const config = {
      iceServers: this.iceServers,
      iceCandidatePoolSize: 30,
      rtcpMuxPolicy: 'require',
      bundlePolicy: 'max-bundle',
      iceTransportPolicy: 'relay' // Force TURN for Russia
    };
    
    this.pc = new RTCPeerConnection(config);
    
    // Add tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.pc.addTrack(track, this.localStream);
      });
    }
    
    // Create data channel
    this.dataChannel = this.pc.createDataChannel('chat', {
      ordered: true,
      maxRetransmits: 3
    });
    
    this.setupPeerConnectionHandlers();
    this.optimizePeerConnection();
    
    console.log('✅ Peer connection created');
  }

  setupPeerConnectionHandlers() {
    this.pc.ontrack = (event) => {
      console.log('📺 Remote track received');
      this.remoteStream = event.streams[0];
      if (this.elements.remoteVideo) {
        this.elements.remoteVideo.srcObject = this.remoteStream;
      }
      this.updateConnectionStatus('connected', 'Подключен');
      this.startCallTimer();
      this.showToast('success', '✅ Соединение установлено');
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalMessage({
          type: 'candidate',
          candidate: event.candidate
        });
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      console.log(`Connection state: ${state}`);
      this.handleConnectionStateChange(state);
    };

    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc.iceConnectionState;
      console.log(`ICE state: ${state}`);
    };

    this.pc.ondatachannel = (event) => {
      const channel = event.channel;
      channel.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'chat') {
            this.receiveChatMessage(data.text, false);
          }
        } catch (err) {
          console.warn('Data channel message error:', err);
        }
      };
    };
  }

  optimizePeerConnection() {
    if (!this.pc) return;
    
    const bitrates = BITRATE_PRESETS[
      this.environment.connectionType === 'ultra' ? 'ultra' :
      this.environment.connectionType === 'excellent' ? 'high' :
      this.environment.connectionType === 'good' ? 'medium' :
      this.environment.connectionType === 'fair' ? 'low' : 'minimal'
    ];
    
    this.pc.getSenders().forEach(sender => {
      if (!sender.track) return;
      
      const params = sender.getParameters();
      if (!params.encodings) params.encodings = [{}];
      
      if (sender.track.kind === 'video') {
        params.encodings[0].maxBitrate = bitrates.video;
        params.encodings[0].maxFramerate = 30;
      } else if (sender.track.kind === 'audio') {
        params.encodings[0].maxBitrate = bitrates.audio;
      }
      
      sender.setParameters(params).catch(e => console.warn('Parameter setting failed:', e));
    });
    
    console.log(`⚙️ Optimized: ${bitrates.video / 1000000} Mbps video, ${bitrates.audio / 1000} kbps audio`);
  }

  async connectWebSocket(room) {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${location.host}/ws`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('✅ WebSocket connected');
      this.sendSignalMessage({
        type: 'join',
        room
      });
    };
    
    this.ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        await this.handleSignalMessage(message);
      } catch (error) {
        console.error('Message handling error:', error);
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.showToast('error', 'Ошибка соединения');
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket closed');
      if (this.currentRoom) {
        setTimeout(() => this.reconnectWebSocket(), 2000);
      }
    };
  }

  async reconnectWebSocket() {
    if (this.currentRoom && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
      console.log('Reconnecting WebSocket...');
      await this.connectWebSocket(this.currentRoom);
    }
  }

  async handleSignalMessage(message) {
    switch (message.type) {
      case 'role':
        this.role = message.role;
        console.log(`Assigned role: ${this.role}`);
        break;
        
      case 'ready':
        console.log('Room ready');
        if (this.role === 'caller') {
          await this.createOffer();
        }
        break;
        
      case 'description':
        await this.handleDescription(message.sdp);
        break;
        
      case 'candidate':
        await this.pc.addIceCandidate(message.candidate);
        break;
        
      case 'chat':
        this.receiveChatMessage(message.text, false);
        break;
        
      case 'peer-left':
        this.handlePeerLeft();
        break;
        
      case 'full':
        this.showToast('error', 'Комната заполнена');
        this.hangup();
        break;
    }
  }

  async createOffer() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.sendSignalMessage({
      type: 'description',
      sdp: this.pc.localDescription
    });
    console.log('📞 Offer created');
  }

  async handleDescription(sdp) {
    if (sdp.type === 'offer') {
      await this.pc.setRemoteDescription(sdp);
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.sendSignalMessage({
        type: 'description',
        sdp: this.pc.localDescription
      });
      console.log('📞 Answer created');
    } else if (sdp.type === 'answer') {
      await this.pc.setRemoteDescription(sdp);
      console.log('📞 Answer received');
    }
  }

  sendSignalMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  handleConnectionStateChange(state) {
    if (state === 'failed') {
      console.error('Connection failed');
      this.showToast('error', 'Соединение потеряно');
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.reconnect(), 2000);
      }
    } else if (state === 'connected') {
      this.reconnectAttempts = 0;
      this.updateConnectionIndicator();
    }
  }

  async reconnect() {
    console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    if (this.pc) {
      this.pc.close();
    }
    await this.createPeerConnection();
    if (this.role === 'caller') {
      await this.createOffer();
    }
  }

  handlePeerLeft() {
    console.log('Peer left');
    this.showToast('info', 'Собеседник покинул звонок');
    if (this.elements.remoteVideo) {
      this.elements.remoteVideo.srcObject = null;
    }
  }

  toggleVideo() {
    this.settings.videoEnabled = !this.settings.videoEnabled;
    if (this.localStream) {
      const track = this.localStream.getVideoTracks()[0];
      if (track) track.enabled = this.settings.videoEnabled;
    }
    this.updateVideoButton();
  }

  toggleAudio() {
    this.settings.audioEnabled = !this.settings.audioEnabled;
    if (this.localStream) {
      const track = this.localStream.getAudioTracks()[0];
      if (track) track.enabled = this.settings.audioEnabled;
    }
    this.updateAudioButton();
  }

  async toggleScreenShare() {
    try {
      if (!this.isScreenSharing) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1920, height: 1080 },
          audio: false
        });
        
        const videoTrack = stream.getVideoTracks()[0];
        const sender = this.pc.getSenders().find(s => s.track?.kind === 'video');
        
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
        
        videoTrack.onended = () => {
          this.stopScreenShare();
        };
        
        this.isScreenSharing = true;
        if (this.elements.screenShareToggle) {
          this.elements.screenShareToggle.classList.add('active');
        }
        this.showToast('success', 'Демонстрация экрана включена');
      } else {
        this.stopScreenShare();
      }
    } catch (error) {
      console.error('Screen share error:', error);
      this.showToast('error', 'Не удалось включить демонстрацию экрана');
    }
  }

  async stopScreenShare() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      const sender = this.pc.getSenders().find(s => s.track?.kind === 'video');
      
      if (sender && videoTrack) {
        await sender.replaceTrack(videoTrack);
      }
    }
    
    this.isScreenSharing = false;
    if (this.elements.screenShareToggle) {
      this.elements.screenShareToggle.classList.remove('active');
    }
    this.showToast('info', 'Демонстрация экрана выключена');
  }

  async switchCamera() {
    if (!this.environment.isMobile) {
      this.showToast('info', 'Переключение камеры доступно только на мобильных');
      return;
    }
    
    try {
      const constraints = {
        video: { facingMode: this.currentFacingMode === 'user' ? 'environment' : 'user' },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = stream.getVideoTracks()[0];
      
      const sender = this.pc?.getSenders()?.find(s => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(videoTrack);
      }
      
      // Update local stream
      if (this.localStream) {
        const oldTrack = this.localStream.getVideoTracks()[0];
        if (oldTrack) oldTrack.stop();
        this.localStream.removeTrack(oldTrack);
        this.localStream.addTrack(videoTrack);
      }
      
      this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
      this.showToast('success', 'Камера переключена');
    } catch (error) {
      console.error('Switch camera error:', error);
      this.showToast('error', 'Не удалось переключить камеру');
    }
  }

  hangup() {
    console.log('Hanging up...');
    
    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    
    // Close connections
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    
    if (this.ws) {
      this.sendSignalMessage({ type: 'leave' });
      this.ws.close();
      this.ws = null;
    }
    
    // Clear intervals
    Object.values(this.intervals).forEach(interval => {
      if (interval) clearInterval(interval);
    });
    
    // Reset state
    this.currentRoom = null;
    this.role = null;
    
    // Switch screens
    if (this.elements.callScreen) this.elements.callScreen.classList.add('hidden');
    if (this.elements.joinScreen) this.elements.joinScreen.style.display = '';
    if (this.elements.joinBtn) this.elements.joinBtn.disabled = false;
    
    this.showToast('info', 'Звонок завершен');
  }

  toggleChat() {
    const isOpen = this.elements.chatPanel?.classList.contains('open');
    if (isOpen) {
      this.closePanel('chat');
    } else {
      this.openPanel('chat');
    }
  }

  sendChatMessage() {
    const input = this.elements.chatInput;
    if (!input) return;
    
    const text = input.value.trim();
    if (!text) return;
    
    this.sendSignalMessage({ type: 'chat', text });
    
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({ type: 'chat', text }));
    }
    
    this.receiveChatMessage(text, true);
    input.value = '';
  }

  receiveChatMessage(text, isOwn) {
    const container = this.elements.chatMessages;
    if (!container) return;
    
    const message = document.createElement('div');
    message.className = `chat-message ${isOwn ? 'own' : 'other'}`;
    message.textContent = text;
    
    container.appendChild(message);
    container.scrollTop = container.scrollHeight;
    
    if (!isOwn && !this.elements.chatPanel?.classList.contains('open')) {
      this.showToast('info', `💬 ${text.substring(0, 30)}...`);
    }
  }

  openPanel(name) {
    ['chat', 'settings', 'history'].forEach(panel => {
      const el = this.elements[`${panel}Panel`];
      if (el) {
        if (panel === name) {
          el.classList.add('open');
        } else {
          el.classList.remove('open');
        }
      }
    });
    
    if (name === 'history') {
      this.loadHistory();
    }
  }

  closePanel(name) {
    const panel = this.elements[`${name}Panel`];
    if (panel) {
      panel.classList.remove('open');
    }
  }

  changeVideoQuality(quality) {
    this.settings.videoQuality = quality;
    this.showToast('info', `Качество видео: ${quality}`);
    // Apply quality change if in call
    if (this.pc) {
      this.optimizePeerConnection();
    }
  }

  changeAudioInput(deviceId) {
    this.settings.selectedAudioDevice = deviceId;
  }

  changeVideoInput(deviceId) {
    this.settings.selectedVideoDevice = deviceId;
  }

  changeAudioOutput(deviceId) {
    this.settings.selectedAudioOutput = deviceId;
    if (this.elements.remoteVideo && this.elements.remoteVideo.setSinkId) {
      this.elements.remoteVideo.setSinkId(deviceId).catch(console.error);
    }
  }

  async loadHistory() {
    try {
      const response = await fetch('/history');
      const data = await response.json();
      
      const container = this.elements.historyList;
      if (!container) return;
      
      container.innerHTML = '';
      
      if (!data.data || data.data.length === 0) {
        container.innerHTML = '<p>История пуста</p>';
        return;
      }
      
      data.data.forEach(item => {
        const el = document.createElement('div');
        el.className = 'history-item';
        const duration = item.durationSec ? 
          `${Math.floor(item.durationSec / 60)}:${(item.durationSec % 60).toString().padStart(2, '0')}` : 
          'В процессе';
        el.innerHTML = `
          <h5>Комната: ${item.room}</h5>
          <p>Длительность: ${duration}</p>
          <p>Участников: ${item.participantsMax}</p>
        `;
        container.appendChild(el);
      });
    } catch (error) {
      console.error('History loading error:', error);
    }
  }

  updateVideoButton() {
    if (this.elements.videoToggle) {
      this.elements.videoToggle.className = this.settings.videoEnabled ? 
        'control-btn video-on' : 'control-btn video-off';
    }
  }

  updateAudioButton() {
    if (this.elements.audioToggle) {
      this.elements.audioToggle.className = this.settings.audioEnabled ? 
        'control-btn audio-on' : 'control-btn audio-off';
    }
  }

  updateConnectionStatus(status, text) {
    const statusEl = this.elements.connectionStatus;
    if (!statusEl) return;
    
    const dot = statusEl.querySelector('.status-dot');
    const span = statusEl.querySelector('span');
    
    if (dot) dot.className = `status-dot ${status}`;
    if (span) span.textContent = text;
  }

  updateConnectionIndicator() {
    const indicator = this.elements.connectionIndicator;
    if (!indicator || !this.pc) return;
    
    const bars = indicator.querySelectorAll('.bar');
    const state = this.pc.connectionState;
    
    bars.forEach((bar, i) => {
      bar.style.opacity = state === 'connected' ? '1' : '0.3';
      bar.style.backgroundColor = state === 'connected' ? '#4CAF50' : '#f44336';
    });
  }

  startCallTimer() {
    this.callStartTime = Date.now();
    
    if (this.intervals.callTimer) {
      clearInterval(this.intervals.callTimer);
    }
    
    this.intervals.callTimer = setInterval(() => {
      const elapsed = Date.now() - this.callStartTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      
      if (this.elements.callDuration) {
        this.elements.callDuration.textContent = 
          `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }

  showToast(type, message, duration = 3000) {
    const container = this.elements.toastContainer;
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => {
        if (toast.parentNode) {
          container.removeChild(toast);
        }
      }, 300);
    }, duration);
  }

  startMonitoring() {
    // Connection monitoring
    this.intervals.connectionMonitor = setInterval(() => {
      if (this.pc && this.pc.connectionState === 'connected') {
        this.updateConnectionIndicator();
      }
    }, 5000);
    
    // Heartbeat
    this.intervals.heartbeat = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendSignalMessage({ type: 'ping' });
      }
    }, 30000);
  }

  cleanup() {
    console.log('Cleaning up...');
    this.hangup();
  }

  handleOnline() {
    console.log('Connection restored');
    this.showToast('success', 'Соединение восстановлено');
    if (this.currentRoom && !this.ws) {
      this.reconnectWebSocket();
    }
  }

  handleOffline() {
    console.log('Connection lost');
    this.showToast('error', 'Потеряно соединение с интернетом');
  }

  handleCriticalError(error) {
    console.error('CRITICAL ERROR:', error);
    this.showToast('error', 'Критическая ошибка. Перезагрузите страницу.', 10000);
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.app = new VideoCallApp();
  });
} else {
  window.app = new VideoCallApp();
}
