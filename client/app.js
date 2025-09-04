// ---- VideoChat Pro: Bulletproof Edition for Russian Networks ----
// Version: 4.0.0-BULLETPROOF
// Features: Enhanced error handling, stress testing, diagnostics, future-proof design

// ========== POLYFILLS AND COMPATIBILITY ==========
if (!navigator.mediaDevices) navigator.mediaDevices = {};
if (!navigator.mediaDevices.getUserMedia) {
  navigator.mediaDevices.getUserMedia = function (constraints) {
    const gum = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    if (!gum) return Promise.reject(new Error('getUserMedia not supported'));
    return new Promise((resolve, reject) => gum.call(navigator, constraints, resolve, reject));
  };
}

// ========== CONSTANTS AND CONFIGURATION ==========
const APP_VERSION = '4.0.0-BULLETPROOF';
const TURN_SERVER_IP = '94.198.218.189';
const TURN_SERVER_PORT = 3478;
const TURN_USERNAME = 'webrtc';

// Enhanced video constraints with fallbacks
const VIDEO_CONSTRAINTS = {
  ultra: { width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 }, frameRate: { ideal: 30, max: 60 } },
  hd: { width: { ideal: 1280, min: 640 }, height: { ideal: 720, min: 360 }, frameRate: { ideal: 24, max: 30 } },
  sd: { width: { ideal: 640, min: 480 }, height: { ideal: 480, min: 360 }, frameRate: { ideal: 20, max: 24 } },
  mobile: { width: { ideal: 480, min: 320 }, height: { ideal: 360, min: 240 }, frameRate: { ideal: 15, max: 20 } },
  minimal: { width: { ideal: 320, min: 240 }, height: { ideal: 240, min: 180 }, frameRate: { ideal: 10, max: 15 } }
};

const AUDIO_CONSTRAINTS = {
  premium: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000 },
  standard: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 24000 },
  minimal: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 16000 }
};

// Connection quality thresholds
const CONNECTION_THRESHOLDS = {
  excellent: { minBitrate: 2000000, maxPacketLoss: 0.5, maxLatency: 100 },
  good: { minBitrate: 1000000, maxPacketLoss: 2, maxLatency: 200 },
  fair: { minBitrate: 500000, maxPacketLoss: 5, maxLatency: 500 },
  poor: { minBitrate: 200000, maxPacketLoss: 10, maxLatency: 1000 }
};

// ========== UTILITY FUNCTIONS ==========

// Enhanced Russian network detection with multiple fallbacks
function detectRussianEnvironment() {
  const indicators = {
    language: navigator.language || navigator.userLanguage || '',
    languages: navigator.languages || [],
    userAgent: navigator.userAgent || '',
    timezone: '',
    platform: navigator.platform || ''
  };

  try {
    indicators.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch (e) {
    console.warn('Timezone detection failed:', e);
  }

  // Multiple detection methods
  const languageCheck = indicators.language.startsWith('ru') || 
                       indicators.languages.some(lang => lang.startsWith('ru'));
  
  const userAgentCheck = /yandex|mail\.ru|rambler|vk\.com|ru_RU|россия|russian/i.test(indicators.userAgent);
  
  const timezoneCheck = indicators.timezone && (
    indicators.timezone.includes('Moscow') ||
    indicators.timezone.includes('Europe/') && [
      'Kaliningrad', 'Samara', 'Yekaterinburg', 'Omsk', 'Krasnoyarsk', 
      'Irkutsk', 'Yakutsk', 'Vladivostok', 'Magadan', 'Sakhalin', 'Kamchatka'
    ].some(city => indicators.timezone.includes(city))
  );

  const platformCheck = /cyrillic|ru-/i.test(indicators.platform);

  const isRussian = languageCheck || userAgentCheck || timezoneCheck || platformCheck;
  
  console.log('🔍 Russian detection analysis:', {
    language: languageCheck,
    userAgent: userAgentCheck, 
    timezone: timezoneCheck,
    platform: platformCheck,
    final: isRussian
  });

  return isRussian;
}

// Enhanced mobile and connection detection
function detectDeviceEnvironment() {
  const userAgent = navigator.userAgent;
  
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isTablet = /iPad|Android(?=.*Mobile)|tablet/i.test(userAgent);
  const isDesktop = !isMobile && !isTablet;
  
  let connectionType = 'unknown';
  let effectiveSpeed = 0;
  
  if ('connection' in navigator) {
    const conn = navigator.connection;
    effectiveSpeed = conn.downlink || 0;
    const effectiveType = conn.effectiveType || 'unknown';
    
    if (effectiveType === 'slow-2g' || effectiveSpeed < 0.25) connectionType = 'critical';
    else if (effectiveType === '2g' || effectiveSpeed < 0.5) connectionType = 'poor';
    else if (effectiveType === '3g' || effectiveSpeed < 1.5) connectionType = 'fair';
    else if (effectiveType === '4g' || effectiveSpeed < 10) connectionType = 'good';
    else connectionType = 'excellent';
  }

  return { isMobile, isTablet, isDesktop, connectionType, effectiveSpeed };
}

// Quality auto-adjustment based on environment
function getOptimalQuality(environment) {
  if (environment.connectionType === 'critical') return 'minimal';
  if (environment.connectionType === 'poor') return 'mobile';
  if (environment.connectionType === 'fair') return environment.isMobile ? 'mobile' : 'sd';
  if (environment.connectionType === 'good') return environment.isMobile ? 'sd' : 'hd';
  return environment.isMobile ? 'hd' : 'ultra';
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
    this.callDurationInterval = null;
    
    // Configuration
    this.iceServers = [];
    this.deviceCache = { video: [], audio: [], audioOutput: [] };
    this.settings = {
      videoQuality: 'hd',
      audioQuality: 'standard',
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
    this.maxReconnectAttempts = 8; // Increased for reliability
    this.connectionIssues = 0;
    this.maxConnectionIssues = 5;
    this.lastSuccessfulConnection = null;
    
    // Russian network optimization
    this.isRussianUser = false;
    this.turnForced = false;
    this.turnConfirmed = false;
    this.russianOptimizations = false;
    
    // Diagnostics and monitoring
    this.diagnostics = {
      connectionAttempts: 0,
      successfulConnections: 0,
      turnUsageCount: 0,
      averageConnectionTime: 0,
      lastPacketLoss: 0,
      lastLatency: 0,
      qualityDowngrades: 0
    };
    
    // Intervals and timers
    this.intervals = {
      callTimer: null,
      qualityMonitor: null,
      connectionMonitor: null,
      heartbeat: null,
      stressTest: null
    };

    // Initialize environment detection
    this.detectEnvironment();
    this.initializeElements();
    this.attachEventListeners();
    this.initializeApp();
  }

  // ========== INITIALIZATION ==========
  detectEnvironment() {
    this.isRussianUser = detectRussianEnvironment();
    this.environment = detectDeviceEnvironment();
    
    // Force TURN for Russian users immediately
    if (this.isRussianUser) {
      this.turnForced = true;
      this.russianOptimizations = true;
      console.log('🇷🇺 RUSSIAN USER DETECTED - TURN ENFORCEMENT ACTIVE');
    }
    
    // Adjust quality based on environment
    const optimalQuality = getOptimalQuality(this.environment);
    this.settings.videoQuality = optimalQuality;
    
    if (this.environment.connectionType === 'critical' || this.environment.connectionType === 'poor') {
      this.settings.audioQuality = 'minimal';
    }

    console.log('🌍 Environment Analysis:', {
      russian: this.isRussianUser,
      device: this.environment,
      turnForced: this.turnForced,
      optimalQuality: optimalQuality
    });
  }

  initializeElements() {
    // Cache all DOM elements with error handling
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
    let missingElements = [];

    elementIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        this.elements[id] = element;
      } else {
        missingElements.push(id);
      }
    });

    if (missingElements.length > 0) {
      console.error('❌ Missing DOM elements:', missingElements);
      this.showCriticalError('Ошибка загрузки интерфейса. Обновите страницу.');
      return false;
    }

    console.log('✅ All DOM elements cached successfully');
    return true;
  }

  attachEventListeners() {
    try {
      // Join screen events with error handling
      this.safeAddEventListener(this.elements.generateRoomBtn, 'click', () => this.generateRoomCode());
      this.safeAddEventListener(this.elements.joinBtn, 'click', () => this.joinRoom());
      this.safeAddEventListener(this.elements.toggleVideoBtn, 'click', () => this.togglePreviewVideo());
      this.safeAddEventListener(this.elements.toggleAudioBtn, 'click', () => this.togglePreviewAudio());
      
      // Call control events
      this.safeAddEventListener(this.elements.videoToggle, 'click', () => this.toggleVideo());
      this.safeAddEventListener(this.elements.audioToggle, 'click', () => this.toggleAudio());
      this.safeAddEventListener(this.elements.screenShareToggle, 'click', () => this.toggleScreenShare());
      this.safeAddEventListener(this.elements.chatToggle, 'click', () => this.toggleChat());
      this.safeAddEventListener(this.elements.hangupBtn, 'click', () => this.hangup());
      this.safeAddEventListener(this.elements.switchCameraBtn, 'click', () => this.switchCamera());
      
      // Panel events
      this.safeAddEventListener(this.elements.settingsBtn, 'click', () => this.openPanel('settings'));
      this.safeAddEventListener(this.elements.historyBtn, 'click', () => this.openPanel('history'));
      this.safeAddEventListener(this.elements.closeChatBtn, 'click', () => this.closePanel('chat'));
      this.safeAddEventListener(this.elements.closeSettingsBtn, 'click', () => this.closePanel('settings'));
      this.safeAddEventListener(this.elements.closeHistoryBtn, 'click', () => this.closePanel('history'));
      
      // Chat events
      this.safeAddEventListener(this.elements.sendMessageBtn, 'click', () => this.sendChatMessage());
      this.safeAddEventListener(this.elements.chatInput, 'keypress', (e) => {
        if (e.key === 'Enter') this.sendChatMessage();
      });
      
      // Settings events
      document.querySelectorAll('input[name="quality"]').forEach(radio => {
        this.safeAddEventListener(radio, 'change', (e) => this.changeVideoQuality(e.target.value));
      });
      
      this.safeAddEventListener(this.elements.audioInputSelect, 'change', (e) => this.changeAudioInput(e.target.value));
      this.safeAddEventListener(this.elements.audioOutputSelect, 'change', (e) => this.changeAudioOutput(e.target.value));
      this.safeAddEventListener(this.elements.videoInputSelect, 'change', (e) => this.changeVideoInput(e.target.value));
      
      // Global events
      this.safeAddEventListener(document, 'keydown', (e) => this.handleKeyboardShortcuts(e));
      this.safeAddEventListener(this.elements.roomInput, 'keypress', (e) => {
        if (e.key === 'Enter') this.joinRoom();
      });
      
      // Window events
      this.safeAddEventListener(window, 'beforeunload', () => this.cleanup());
      this.safeAddEventListener(window, 'resize', () => this.handleResize());
      this.safeAddEventListener(document, 'visibilitychange', () => this.handleVisibilityChange());
      this.safeAddEventListener(window, 'online', () => this.handleOnline());
      this.safeAddEventListener(window, 'offline', () => this.handleOffline());
      
      // Network change detection
      if ('connection' in navigator) {
        this.safeAddEventListener(navigator.connection, 'change', () => this.handleNetworkChange());
      }

      console.log('✅ All event listeners attached successfully');
    } catch (error) {
      console.error('❌ Event listener attachment failed:', error);
      this.showCriticalError('Ошибка инициализации событий');
    }
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
      console.log('🔧 Initializing application components...');
      
      await this.loadConfig();
      await this.enumerateDevices();
      await this.performInitialDiagnostics();
      
      if (this.isRussianUser) {
        this.showToast('success', '🇷🇺 Российские оптимизации активированы');
      }
      
      // Start monitoring systems
      this.startConnectionMonitoring();
      this.startHeartbeat();
      
      setTimeout(() => this.hideLoading(), 1500);
      
    } catch (error) {
      console.error('❌ Application initialization failed:', error);
      this.showCriticalError('Ошибка инициализации приложения');
    }
  }

  async performInitialDiagnostics() {
    console.log('🔍 Running initial diagnostics...');
    
    try {
      // Test WebRTC support
      if (!window.RTCPeerConnection) {
        throw new Error('WebRTC not supported');
      }
      
      // Test getUserMedia support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }
      
      // Test network connectivity
      const connectivityTest = await fetch('/healthz').catch(() => null);
      if (!connectivityTest || !connectivityTest.ok) {
        console.warn('⚠️ Server connectivity issues detected');
      }
      
      // Test TURN server availability
      if (this.iceServers.length === 0) {
        console.warn('⚠️ No ICE servers configured');
      } else {
        const turnServers = this.iceServers.filter(server => 
          server.urls && (
            (typeof server.urls === 'string' && server.urls.includes('turn:')) ||
            (Array.isArray(server.urls) && server.urls.some(url => url.includes('turn:')))
          )
        );
        console.log(`🔄 TURN servers available: ${turnServers.length}`);
      }
      
      console.log('✅ Initial diagnostics completed');
      
    } catch (error) {
      console.error('❌ Diagnostics failed:', error);
      throw error;
    }
  }

  // ========== CONFIGURATION LOADING ==========
  async loadConfig() {
    try {
      const response = await fetch('/config');
      const config = await response.json();
      
      if (config && Array.isArray(config.iceServers)) {
        this.iceServers = config.iceServers;
        
        // Validate TURN server configuration
        const yourTurnServer = this.iceServers.find(server => 
          server.urls && (
            (typeof server.urls === 'string' && server.urls.includes(TURN_SERVER_IP)) ||
            (Array.isArray(server.urls) && server.urls.some(url => url.includes(TURN_SERVER_IP)))
          )
        );
        
        if (yourTurnServer) {
          console.log(`🎯 Your TURN server (${TURN_SERVER_IP}) detected and configured`);
        } else {
          console.warn(`⚠️ Your TURN server (${TURN_SERVER_IP}) not found in configuration`);
        }
        
        console.log(`📡 Loaded ${this.iceServers.length} ICE servers`);
      } else {
        throw new Error('Invalid ICE configuration received');
      }
      
    } catch (error) {
      console.warn('Config loading failed, using fallback:', error);
      
      // Robust fallback configuration
      this.iceServers = [
        {
          urls: [
            `turn:${TURN_SERVER_IP}:${TURN_SERVER_PORT}?transport=udp`,
            `turn:${TURN_SERVER_IP}:${TURN_SERVER_PORT}?transport=tcp`
          ],
          username: TURN_USERNAME,
          credential: 'pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN'
        },
        // Russian STUN servers as backup
        { urls: 'stun:stun.voipbuster.com:3478' },
        { urls: 'stun:stun.sipnet.net:3478' },
        { urls: 'stun:stun.sipnet.ru:3478' },
        // International fallbacks
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.l.google.com:19302' }
      ];
      
      console.log('📡 Fallback ICE configuration loaded');
    }
  }

  // ========== DEVICE MANAGEMENT ==========
  async enumerateDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      this.deviceCache.video = devices.filter(d => d.kind === 'videoinput');
      this.deviceCache.audio = devices.filter(d => d.kind === 'audioinput');
      this.deviceCache.audioOutput = devices.filter(d => d.kind === 'audiooutput');
      
      console.log(`🎥 Found ${this.deviceCache.video.length} video devices`);
      console.log(`🎤 Found ${this.deviceCache.audio.length} audio devices`);
      console.log(`🔊 Found ${this.deviceCache.audioOutput.length} output devices`);
      
      this.populateDeviceSelects();
      
      // Auto-select defaults if available
      if (this.deviceCache.video.length > 0 && !this.settings.selectedVideoDevice) {
        this.settings.selectedVideoDevice = this.deviceCache.video[0].deviceId;
      }
      if (this.deviceCache.audio.length > 0 && !this.settings.selectedAudioDevice) {
        this.settings.selectedAudioDevice = this.deviceCache.audio[0].deviceId;
      }
      
    } catch (error) {
      console.warn('Device enumeration failed:', error);
      this.showToast('warning', 'Не удалось получить список устройств');
    }
  }

  populateDeviceSelects() {
    // Video devices with enhanced labeling
    this.elements.videoInputSelect.innerHTML = '<option value="">Автоматический выбор камеры</option>';
    this.deviceCache.video.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Камера ${index + 1}`;
      this.elements.videoInputSelect.appendChild(option);
    });

    // Audio input devices
    this.elements.audioInputSelect.innerHTML = '<option value="">Автоматический выбор микрофона</option>';
    this.deviceCache.audio.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Микрофон ${index + 1}`;
      this.elements.audioInputSelect.appendChild(option);
    });

    // Audio output devices
    this.elements.audioOutputSelect.innerHTML = '<option value="">Динамики по умолчанию</option>';
    this.deviceCache.audioOutput.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Динамики ${index + 1}`;
      this.elements.audioOutputSelect.appendChild(option);
    });
  }

  // ========== UI MANAGEMENT ==========
  hideLoading() {
    try {
      this.elements.loadingScreen.classList.add('hidden');
      this.elements.app.classList.remove('hidden');
      this.startPreviewMedia();
    } catch (error) {
      console.error('Error hiding loading screen:', error);
    }
  }

  async startPreviewMedia() {
    try {
      const videoConstraints = VIDEO_CONSTRAINTS[this.settings.videoQuality];
      const audioConstraints = AUDIO_CONSTRAINTS[this.settings.audioQuality];
      
      const constraints = {
        video: this.settings.selectedVideoDevice ? 
          { ...videoConstraints, deviceId: { exact: this.settings.selectedVideoDevice } } : 
          videoConstraints,
        audio: this.settings.selectedAudioDevice ? 
          { ...audioConstraints, deviceId: { exact: this.settings.selectedAudioDevice } } : 
          audioConstraints
      };

      console.log('🎥 Starting media preview with constraints:', constraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      this.elements.previewVideo.srcObject = stream;
      this.localStream = stream;
      
      // Optimize video track
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && 'contentHint' in videoTrack) {
        videoTrack.contentHint = 'motion';
      }
      
      this.updateConnectionStatus('ready', 'Готов к подключению');
      
      console.log(`✅ Media preview started: ${stream.getTracks().length} tracks`);
      
      if (this.turnForced) {
        this.showToast('info', `🔄 TURN сервер ${TURN_SERVER_IP} готов`);
      }
      
    } catch (error) {
      console.error('Preview media error:', error);
      this.handleMediaError(error);
    }
  }

  handleMediaError(error) {
    let message = 'Ошибка доступа к медиа устройствам';
    
    if (error.name === 'NotAllowedError') {
      message = 'Разрешите доступ к камере и микрофону';
    } else if (error.name === 'NotFoundError') {
      message = 'Камера или микрофон не найдены';
    } else if (error.name === 'NotReadableError') {
      message = 'Устройства заняты другим приложением';
    } else if (error.name === 'OverconstrainedError') {
      message = 'Настройки качества не поддерживаются';
      // Try fallback quality
      this.settings.videoQuality = 'mobile';
      this.settings.audioQuality = 'minimal';
      setTimeout(() => this.startPreviewMedia(), 1000);
      return;
    }
    
    this.showToast('error', message);
    this.updateConnectionStatus('error', 'Ошибка медиа');
  }

  generateRoomCode() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.elements.roomInput.value = code;
    
    // Animate button
    this.elements.generateRoomBtn.style.transform = 'rotate(360deg)';
    setTimeout(() => {
      this.elements.generateRoomBtn.style.transform = '';
    }, 300);
    
    console.log(`🎲 Generated room code: ${code}`);
  }

  // ========== ROOM MANAGEMENT ==========
  async joinRoom() {
    const room = this.elements.roomInput.value.trim().toUpperCase();
    if (!room) {
      this.showToast('warning', 'Введите код комнаты');
      return;
    }

    if (room.length < 3 || room.length > 20) {
      this.showToast('warning', 'Код комнаты должен быть от 3 до 20 символов');
      return;
    }

    try {
      this.elements.joinBtn.disabled = true;
      this.diagnostics.connectionAttempts++;
      
      console.log(`🚪 Joining room: ${room}`);
      this.updateConnectionStatus('connecting', 'Подключение...');
      
      if (!this.localStream) {
        await this.startPreviewMedia();
      }

      this.currentRoom = room;
      this.elements.roomCode.textContent = `Комната: ${room}`;
      
      await this.createPeerConnection();
      await this.connectWebSocket(room);
      
      // Switch to call screen
      this.elements.joinScreen.style.display = 'none';
      this.elements.callScreen.classList.remove('hidden');
      this.elements.localVideo.srcObject = this.localStream;
      
      if (this.turnForced) {
        this.showToast('info', `🔄 Подключение через TURN сервер...`);
      } else {
        this.showToast('info', `📞 Подключение к комнате ${room}...`);
      }
      
    } catch (error) {
      console.error('Join room error:', error);
      this.showToast('error', `Ошибка подключения: ${error.message}`);
      this.elements.joinBtn.disabled = false;
      this.diagnostics.connectionAttempts--;
    }
  }

  // ========== PEER CONNECTION MANAGEMENT ==========
  async createPeerConnection() {
    try {
      console.log('🔗 Creating peer connection...');
      
      // Enhanced configuration for maximum reliability
      const config = { 
        iceServers: this.iceServers,
        iceCandidatePoolSize: this.isRussianUser ? 25 : 15, // More candidates for Russian networks
        rtcpMuxPolicy: 'require',
        bundlePolicy: 'max-bundle'
      };
      
      // GUARANTEED TURN enforcement for Russian users
      if (this.isRussianUser || this.turnForced) {
        config.iceTransportPolicy = 'relay'; // ONLY TURN, block STUN/host
        console.log('🔄 ENFORCING RELAY-ONLY POLICY (TURN mandatory)');
      } else {
        config.iceTransportPolicy = 'all';
        console.log('📡 Using standard ICE policy');
      }
      
      this.pc = new RTCPeerConnection(config);
      
      // Add local stream tracks with error handling
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          try {
            this.pc.addTrack(track, this.localStream);
            console.log(`➕ Added ${track.kind} track to peer connection`);
          } catch (error) {
            console.error(`Failed to add ${track.kind} track:`, error);
          }
        });
      }

      // Create data channel for enhanced features
      try {
        this.dataChannel = this.pc.createDataChannel('chat', {
          ordered: true,
          maxRetransmits: 3
        });
        this.setupDataChannelHandlers(this.dataChannel);
      } catch (error) {
        console.warn('Data channel creation failed:', error);
      }

      // Setup event handlers
      this.setupPeerConnectionHandlers();
      
      // Optimize encoding parameters after brief delay
      setTimeout(() => this.optimizePeerConnection(), 200);
      
      console.log('✅ Peer connection created successfully');
      
    } catch (error) {
      console.error('❌ Peer connection creation failed:', error);
      throw error;
    }
  }

  setupPeerConnectionHandlers() {
    // Track event - remote stream received
    this.pc.ontrack = async (event) => {
      console.log('📺 Remote track received:', event.track.kind);
      
      try {
        this.remoteStream = event.streams[0];
        this.elements.remoteVideo.srcObject = this.remoteStream;
        
        await this.elements.remoteVideo.play();
        
        this.updateConnectionStatus('connected', 'Подключен');
        this.startCallTimer();
        this.connectionIssues = 0;
        this.lastSuccessfulConnection = Date.now();
        this.diagnostics.successfulConnections++;
        
        if (this.turnForced) {
          this.showToast('success', '🔄 Соединение через TURN установлено');
        } else {
          this.showToast('success', '✅ Соединение установлено');
        }
        
        // Start quality monitoring
        this.startQualityMonitoring();
        
      } catch (error) {
        console.error('Error handling remote track:', error);
      }
    };

    // ICE candidate event
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.handleLocalIceCandidate(event.candidate);
      } else {
        console.log('🧊 ICE gathering completed');
      }
    };

    // Connection state changes
    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      console.log(`🔗 Connection state: ${state}`);
      this.updateConnectionIndicator();
      this.handleConnectionStateChange(state);
    };

    // ICE connection state changes  
    this.pc.oniceconnectionstatechange = () => {
      const iceState = this.pc.iceConnectionState;
      console.log(`🧊 ICE connection state: ${iceState}`);
      this.handleIceConnectionStateChange(iceState);
    };

    // ICE gathering state
    this.pc.onicegatheringstatechange = () => {
      console.log(`🧊 ICE gathering state: ${this.pc.iceGatheringState}`);
    };

    // Signaling state changes
    this.pc.onsignalingstatechange = () => {
      console.log(`📡 Signaling state: ${this.pc.signalingState}`);
    };

    // Data channel event
    this.pc.ondatachannel = (event) => {
      console.log('📨 Data channel received');
      this.setupDataChannelHandlers(event.channel);
    };

    // Stats and monitoring
    this.pc.onstatsended = () => {
      console.log('📊 Stats ended');
    };
  }

  handleLocalIceCandidate(candidate) {
    try {
      // Enhanced candidate logging and analysis
      const candidateStr = candidate.candidate;
      let candidateType = 'unknown';
      
      if (candidateStr.includes('typ relay')) {
        candidateType = 'TURN';
        if (candidateStr.includes(TURN_SERVER_IP)) {
          console.log('🎯 YOUR TURN SERVER CANDIDATE GENERATED!');
          this.turnConfirmed = true;
          this.diagnostics.turnUsageCount++;
        } else {
          console.log('🔄 TURN candidate generated (other server)');
        }
      } else if (candidateStr.includes('typ srflx')) {
        candidateType = 'STUN';
        console.log('📡 STUN candidate generated');
      } else if (candidateStr.includes('typ host')) {
        candidateType = 'HOST';
        console.log('🏠 Host candidate generated');
      }
      
      // Send candidate to remote peer
      this.sendSignalMessage({ 
        type: 'candidate', 
        candidate: candidate 
      });
      
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  handleConnectionStateChange(state) {
    switch (state) {
      case 'connecting':
        console.log('🔄 Connection establishing...');
        break;
        
      case 'connected':
        console.log('✅ Connection established successfully');
        this.reconnectAttempts = 0;
        this.connectionIssues = 0;
        this.verifyTurnUsage();
        break;
        
      case 'disconnected':
        console.warn('⚠️ Connection disconnected');
        this.showToast('warning', 'Соединение потеряно, восстановление...');
        this.scheduleReconnection();
        break;
        
      case 'failed':
        console.error('❌ Connection failed');
        this.connectionIssues++;
        this.handleConnectionFailure();
        break;
        
      case 'closed':
        console.log('🔒 Connection closed');
        break;
    }
  }

  handleIceConnectionStateChange(iceState) {
    switch (iceState) {
      case 'checking':
        console.log('🔍 ICE checking...');
        break;
        
      case 'connected':
        console.log('✅ ICE connected');
        break;
        
      case 'completed':
        console.log('✅ ICE completed');
        break;
        
      case 'failed':
        console.error('❌ ICE connection failed');
        this.handleIceFailure();
        break;
        
      case 'disconnected':
        console.warn('⚠️ ICE disconnected');
        this.handleIceDisconnection();
        break;
        
      case 'closed':
        console.log('🔒 ICE closed');
        break;
    }
  }

  setupDataChannelHandlers(channel) {
    channel.onopen = () => {
      console.log('📨 Data channel opened');
    };
    
    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleDataChannelMessage(data);
      } catch (error) {
        console.error('Data channel message error:', error);
      }
    };
    
    channel.onerror = (error) => {
      console.error('Data channel error:', error);
    };
    
    channel.onclose = () => {
      console.log('📨 Data channel closed');
    };
  }

  handleDataChannelMessage(data) {
    switch (data.type) {
      case 'quality-report':
        this.handleRemoteQualityReport(data);
        break;
      case 'connection-test':
        this.respondToConnectionTest(data);
        break;
      default:
        console.log('Unknown data channel message:', data);
    }
  }

  // ========== CONNECTION QUALITY OPTIMIZATION ==========
  optimizePeerConnection() {
    if (!this.pc) return;

    console.log('⚙️ Optimizing peer connection...');

    this.pc.getSenders().forEach(sender => {
      if (!sender.track) return;
      
      try {
        const params = sender.getParameters();
        if (!params.encodings) params.encodings = [{}];
        
        if (sender.track.kind === 'video') {
          this.optimizeVideoSender(sender, params);
        } else if (sender.track.kind === 'audio') {
          this.optimizeAudioSender(sender, params);
        }
        
        sender.setParameters(params).catch(error => {
          console.warn(`Failed to set ${sender.track.kind} parameters:`, error);
        });
        
      } catch (error) {
        console.error(`Error optimizing ${sender.track.kind} sender:`, error);
      }
    });

    // Set codec preferences
    this.setOptimalCodecPreferences();
  }

  optimizeVideoSender(sender, params) {
    // Determine optimal bitrate based on environment
    let maxBitrate;
    let maxFramerate;
    
    if (this.environment.connectionType === 'critical') {
      maxBitrate = 150000; // 150 kbps
      maxFramerate = 10;
    } else if (this.environment.connectionType === 'poor') {
      maxBitrate = 300000; // 300 kbps
      maxFramerate = 15;
    } else if (this.environment.connectionType === 'fair' || this.environment.isMobile) {
      maxBitrate = 600000; // 600 kbps
      maxFramerate = 20;
    } else if (this.environment.connectionType === 'good') {
      maxBitrate = 1200000; // 1.2 Mbps
      maxFramerate = 25;
    } else {
      maxBitrate = 2000000; // 2 Mbps
      maxFramerate = 30;
    }

    // Apply Russian network adjustments
    if (this.isRussianUser) {
      maxBitrate = Math.min(maxBitrate, 800000); // Cap at 800 kbps for Russian networks
      maxFramerate = Math.min(maxFramerate, 24); // Cap framerate
    }

    params.encodings[0].maxBitrate = maxBitrate;
    params.encodings[0].maxFramerate = maxFramerate;
    
    if ('degradationPreference' in params) {
      params.degradationPreference = 'maintain-framerate';
    }
    
    // Enable adaptive bitrate for unstable connections
    if (this.connectionIssues > 0) {
      params.encodings[0].maxBitrate = Math.floor(maxBitrate * 0.7);
    }
    
    console.log(`📹 Video optimized: ${params.encodings[0].maxBitrate} bps, ${params.encodings[0].maxFramerate} fps`);
  }

  optimizeAudioSender(sender, params) {
    let maxBitrate;
    
    if (this.environment.connectionType === 'critical') {
      maxBitrate = 32000; // 32 kbps
    } else if (this.environment.connectionType === 'poor' || this.environment.isMobile) {
      maxBitrate = 48000; // 48 kbps
    } else {
      maxBitrate = 64000; // 64 kbps
    }
    
    params.encodings[0].maxBitrate = maxBitrate;
    
    console.log(`🎤 Audio optimized: ${maxBitrate} bps`);
  }

  setOptimalCodecPreferences() {
    try {
      const capabilities = RTCRtpSender.getCapabilities('video');
      if (!capabilities) return;
      
      const videoTransceiver = this.pc.getTransceivers().find(t => 
        t.sender?.track?.kind === 'video'
      );
      
      if (videoTransceiver && videoTransceiver.setCodecPreferences) {
        // Prefer H.264 for better mobile/network compatibility
        let preferredCodecs = capabilities.codecs.filter(codec =>
          /H264/i.test(codec.mimeType) && !/rtx/i.test(codec.mimeType)
        );
        
        // Fallback to VP8 for better compatibility than VP9
        if (preferredCodecs.length === 0) {
          preferredCodecs = capabilities.codecs.filter(codec =>
            /VP8/i.test(codec.mimeType) && !/rtx/i.test(codec.mimeType)
          );
        }
        
        if (preferredCodecs.length > 0) {
          videoTransceiver.setCodecPreferences(preferredCodecs);
          console.log('📺 Codec preferences set for optimal compatibility');
        }
      }
    } catch (error) {
      console.warn('Codec preference setting failed:', error);
    }
  }

  // ========== WEBSOCKET MANAGEMENT ==========
  async connectWebSocket(room) {
    try {
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      const wsUrl = `${protocol}://${location.host}/ws`;
      
      console.log(`🔌 Connecting WebSocket to: ${wsUrl}`);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        
        this.sendSignalMessage({ 
          type: 'join', 
          room,
          userInfo: {
            isRussian: this.isRussianUser,
            isMobile: this.environment.isMobile,
            connectionType: this.environment.connectionType,
            turnForced: this.turnForced,
            appVersion: APP_VERSION
          }
        });
        
        this.updateConnectionStatus('connected', 'WebSocket подключен');
      };
      
      this.ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          await this.handleSignalMessage(message);
        } catch (error) {
          console.error('WebSocket message parsing error:', error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.showToast('error', 'Ошибка сигналинг соединения');
      };
      
      this.ws.onclose = (event) => {
        console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
        this.updateConnectionStatus('disconnected', 'Сигналинг отключен');
        
        if (this.currentRoom && !event.wasClean && event.code !== 1000) {
          console.log('🔄 Scheduling WebSocket reconnection...');
          setTimeout(() => this.reconnectWebSocket(), 2000);
        }
      };
      
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      throw error;
    }
  }

  async reconnectWebSocket() {
    if (this.currentRoom && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
      try {
        console.log('🔄 Reconnecting WebSocket...');
        await this.connectWebSocket(this.currentRoom);
      } catch (error) {
        console.error('WebSocket reconnection failed:', error);
        setTimeout(() => this.reconnectWebSocket(), 5000);
      }
    }
  }

  // ========== SIGNAL MESSAGE HANDLING ==========
  async handleSignalMessage(message) {
    try {
      switch (message.type) {
        case 'role':
          await this.handleRoleAssignment(message);
          break;
          
        case 'ready':
          await this.handleRoomReady(message);
          break;
          
        case 'description':
          await this.handleDescription(message.sdp);
          break;
          
        case 'candidate':
          await this.handleRemoteCandidate(message.candidate);
          break;
          
        case 'chat':
          this.receiveChatMessage(message.text, false);
          break;
          
        case 'peer-left':
          this.handlePeerLeft(message);
          break;
          
        case 'full':
          this.handleRoomFull(message);
          break;
          
        case 'bye':
          this.handleBye(message);
          break;
          
        case 'russia-config':
          this.handleRussiaConfig(message);
          break;
          
        case 'error':
          this.handleServerError(message);
          break;
          
        default:
          console.log('Unknown signal message type:', message.type);
      }
    } catch (error) {
      console.error('Signal message handling error:', error);
    }
  }

  async handleRoleAssignment(message) {
    this.role = message.role;
    console.log(`👤 Assigned role: ${this.role}`);
    
    if (message.turnServerAvailable) {
      console.log('🔄 TURN server availability confirmed');
    }
    
    if (message.russianOptimization) {
      console.log('🇷🇺 Russian optimization confirmed by server');
    }
  }

  async handleRoomReady(message) {
    console.log('🚀 Room ready, participants:', message.participants);
    
    if (this.role === 'caller') {
      await this.createOffer();
    }
    
    if (message.turnServerRecommended && this.isRussianUser) {
      console.log('🔄 Server recommends TURN usage');
    }
  }

  async handleDescription(sdp) {
    try {
      console.log(`📡 Handling ${sdp.type} description`);
      
      if (sdp.type === 'offer') {
        // Handle offer
        if (this.pc.signalingState !== 'stable') {
          console.log('📡 Rolling back to stable state');
          await this.pc.setLocalDescription({ type: 'rollback' });
        }
        
        await this.pc.setRemoteDescription(sdp);
        
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        
        this.sendSignalMessage({ 
          type: 'description', 
          sdp: this.pc.localDescription 
        });
        
        console.log('📡 Answer created and sent');
        
      } else if (sdp.type === 'answer') {
        // Handle answer
        if (this.pc.signalingState === 'have-local-offer') {
          await this.pc.setRemoteDescription(sdp);
          console.log('📡 Answer processed successfully');
        } else {
          console.warn(`Unexpected answer in state: ${this.pc.signalingState}`);
        }
      }
    } catch (error) {
      console.error('SDP handling error:', error);
      this.showToast('error', 'Ошибка обработки сигнала');
    }
  }

  async handleRemoteCandidate(candidate) {
    try {
      await this.pc.addIceCandidate(candidate);
      
      // Enhanced candidate analysis
      if (candidate.candidate) {
        const candidateStr = candidate.candidate;
        
        if (candidateStr.includes('typ relay')) {
          if (candidateStr.includes(TURN_SERVER_IP)) {
            console.log('🎯 Remote peer using YOUR TURN server!');
          } else {
            console.log('🔄 Remote peer using TURN server');
          }
        } else if (candidateStr.includes('typ srflx')) {
          console.log('📡 Remote STUN candidate processed');
        } else if (candidateStr.includes('typ host')) {
          console.log('🏠 Remote host candidate processed');
        }
      }
      
    } catch (error) {
      console.warn('Remote ICE candidate processing error:', error);
    }
  }

  handlePeerLeft(message) {
    console.log('👋 Peer left the room');
    this.showToast('info', 'Собеседник покинул звонок');
    this.elements.remoteVideo.srcObject = null;
  }

  handleRoomFull(message) {
    console.log('🚫 Room is full');
    this.showToast('error', 'Комната заполнена (максимум 2 участника)');
    this.hangup();
  }

  handleBye(message) {
    console.log('👋 Server initiated disconnect');
    this.hangup();
  }

  handleRussiaConfig(message) {
    if (message.turnServerForced) {
      this.turnForced = true;
      console.log('🔄 TURN usage forced by server');
    }
    
    if (message.recommendations) {
      console.log('🇷🇺 Server recommendations received');
      message.recommendations.forEach(rec => {
        console.log(`  - ${rec}`);
      });
    }
    
    if (message.turnServer) {
      this.showToast('success', `🔄 TURN: ${message.turnServer}`);
    }
  }

  handleServerError(message) {
    console.error('Server error:', message.message);
    this.showToast('error', `Ошибка сервера: ${message.message}`);
  }

  async createOffer() {
    try {
      console.log('📞 Creating offer...');
      
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await this.pc.setLocalDescription(offer);
      
      this.sendSignalMessage({ 
        type: 'description', 
        sdp: this.pc.localDescription 
      });
      
      console.log('📞 Offer created and sent successfully');
      
    } catch (error) {
      console.error('Create offer error:', error);
      this.showToast('error', 'Ошибка создания предложения');
      throw error;
    }
  }

  sendSignalMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Signal message send error:', error);
      }
    } else {
      console.warn('Cannot send signal message - WebSocket not ready');
    }
  }

  // ========== CONNECTION MONITORING AND RECOVERY ==========
  startConnectionMonitoring() {
    // Clear existing interval
    if (this.intervals.connectionMonitor) {
      clearInterval(this.intervals.connectionMonitor);
    }
    
    this.intervals.connectionMonitor = setInterval(() => {
      this.performConnectionHealthCheck();
    }, 10000); // Check every 10 seconds
  }

  async performConnectionHealthCheck() {
    if (!this.pc || this.pc.connectionState !== 'connected') {
      return;
    }
    
    try {
      const stats = await this.pc.getStats();
      this.analyzeConnectionStats(stats);
    } catch (error) {
      console.warn('Connection health check failed:', error);
    }
  }

  analyzeConnectionStats(stats) {
    let videoStats = null;
    let audioStats = null;
    
    stats.forEach(report => {
      if (report.type === 'inbound-rtp') {
        if (report.mediaType === 'video' || report.kind === 'video') {
          videoStats = report;
        } else if (report.mediaType === 'audio' || report.kind === 'audio') {
          audioStats = report;
        }
      }
    });
    
    if (videoStats) {
      this.analyzeVideoStats(videoStats);
    }
    
    if (audioStats) {
      this.analyzeAudioStats(audioStats);
    }
  }

  analyzeVideoStats(stats) {
    const packetsLost = stats.packetsLost || 0;
    const packetsReceived = stats.packetsReceived || 0;
    const totalPackets = packetsLost + packetsReceived;
    
    if (totalPackets > 0) {
      const packetLossPercentage = (packetsLost / totalPackets) * 100;
      this.diagnostics.lastPacketLoss = packetLossPercentage;
      
      // Auto-adjust quality based on packet loss
      if (packetLossPercentage > 5 && this.settings.videoQuality !== 'minimal') {
        this.autoDowngradeQuality();
      } else if (packetLossPercentage < 1 && this.diagnostics.qualityDowngrades > 0) {
        this.autoUpgradeQuality();
      }
    }
    
    // Check frame rate
    const framesDecoded = stats.framesDecoded || 0;
    if (framesDecoded === this.lastFramesDecoded) {
      this.staleFrameCount++;
      if (this.staleFrameCount > 5) {
        console.warn('⚠️ Video appears frozen');
        this.handleVideoFreeze();
      }
    } else {
      this.staleFrameCount = 0;
    }
    this.lastFramesDecoded = framesDecoded;
  }

  analyzeAudioStats(stats) {
    const packetsLost = stats.packetsLost || 0;
    const packetsReceived = stats.packetsReceived || 0;
    const totalPackets = packetsLost + packetsReceived;
    
    if (totalPackets > 0) {
      const audioPacketLoss = (packetsLost / totalPackets) * 100;
      if (audioPacketLoss > 3) {
        console.warn(`⚠️ High audio packet loss: ${audioPacketLoss.toFixed(1)}%`);
      }
    }
  }

  autoDowngradeQuality() {
    const qualityLevels = ['ultra', 'hd', 'sd', 'mobile', 'minimal'];
    const currentIndex = qualityLevels.indexOf(this.settings.videoQuality);
    
    if (currentIndex < qualityLevels.length - 1) {
      const newQuality = qualityLevels[currentIndex + 1];
      console.log(`📉 Auto-downgrading quality: ${this.settings.videoQuality} → ${newQuality}`);
      
      this.settings.videoQuality = newQuality;
      this.diagnostics.qualityDowngrades++;
      this.restartVideoStream();
      this.showToast('warning', `Качество снижено до ${newQuality.toUpperCase()}`);
    }
  }

  autoUpgradeQuality() {
    const qualityLevels = ['minimal', 'mobile', 'sd', 'hd', 'ultra'];
    const currentIndex = qualityLevels.indexOf(this.settings.videoQuality);
    
    if (currentIndex > 0 && this.diagnostics.qualityDowngrades > 0) {
      const newQuality = qualityLevels[currentIndex - 1];
      console.log(`📈 Auto-upgrading quality: ${this.settings.videoQuality} → ${newQuality}`);
      
      this.settings.videoQuality = newQuality;
      this.diagnostics.qualityDowngrades = Math.max(0, this.diagnostics.qualityDowngrades - 1);
      this.restartVideoStream();
      this.showToast('info', `Качество повышено до ${newQuality.toUpperCase()}`);
    }
  }

  handleVideoFreeze() {
    console.log('🔧 Handling video freeze...');
    
    if (this.pc && this.pc.connectionState === 'connected') {
      // Try to restart video stream
      this.restartVideoStream();
    } else {
      // Connection might be broken
      this.handleConnectionFailure();
    }
  }

  startQualityMonitoring() {
    if (this.intervals.qualityMonitor) {
      clearInterval(this.intervals.qualityMonitor);
    }
    
    this.intervals.qualityMonitor = setInterval(() => {
      this.updateConnectionIndicator();
    }, 5000);
  }

  startHeartbeat() {
    if (this.intervals.heartbeat) {
      clearInterval(this.intervals.heartbeat);
    }
    
    // Send periodic heartbeat through data channel
    this.intervals.heartbeat = setInterval(() => {
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        try {
          this.dataChannel.send(JSON.stringify({
            type: 'heartbeat',
            timestamp: Date.now()
          }));
        } catch (error) {
          console.warn('Heartbeat send failed:', error);
        }
      }
    }, 30000); // Every 30 seconds
  }

  // ========== CONNECTION FAILURE HANDLING ==========
  handleConnectionFailure() {
    this.connectionIssues++;
    console.error(`🚨 Connection failure #${this.connectionIssues}`);
    
    if (this.connectionIssues > this.maxConnectionIssues) {
      this.showToast('error', 'Критические проблемы соединения. Перезапустите звонок.');
      setTimeout(() => this.hangup(), 3000);
      return;
    }
    
    // Progressive failure handling
    if (this.connectionIssues === 1) {
      this.attemptIceRestart();
    } else if (this.connectionIssues === 2) {
      this.attemptConnectionOptimization();
    } else {
      this.scheduleReconnection();
    }
  }

  attemptIceRestart() {
    if (this.pc && this.pc.connectionState === 'failed') {
      console.log('🔄 Attempting ICE restart...');
      
      try {
        this.pc.restartIce();
        this.showToast('info', 'Попытка восстановления соединения...');
        
        // Give it time to work
        setTimeout(() => {
          if (this.pc && this.pc.connectionState === 'failed') {
            this.handleConnectionFailure();
          }
        }, 5000);
        
      } catch (error) {
        console.error('ICE restart failed:', error);
        this.handleConnectionFailure();
      }
    }
  }

  attemptConnectionOptimization() {
    console.log('⚙️ Attempting connection optimization...');
    
    // Force lowest quality settings
    this.settings.videoQuality = 'minimal';
    this.settings.audioQuality = 'minimal';
    
    // Force TURN if not already forced
    if (!this.turnForced) {
      this.turnForced = true;
      console.log('🔄 Forcing TURN due to connection issues');
    }
    
    // Re-optimize peer connection
    this.optimizePeerConnection();
    
    this.showToast('warning', 'Применены экстремальные оптимизации');
    
    // Schedule reconnection if optimization doesn't help
    setTimeout(() => {
      if (this.pc && this.pc.connectionState === 'failed') {
        this.scheduleReconnection();
      }
    }, 8000);
  }

  handleIceFailure() {
    console.error('🧊❌ ICE connection failed');
    
    // Immediate restart for ICE failures
    setTimeout(() => {
      if (this.pc && this.pc.iceConnectionState === 'failed') {
        console.log('🔄 Emergency ICE restart...');
        this.pc.restartIce();
      }
    }, 1000);
    
    // Escalate if still failed
    setTimeout(() => {
      if (this.pc && this.pc.iceConnectionState === 'failed') {
        this.handleConnectionFailure();
      }
    }, 10000);
  }

  handleIceDisconnection() {
    console.warn('🧊⚠️ ICE disconnected');
    
    // Quick restart for mobile networks
    const restartDelay = this.environment.isMobile ? 2000 : 3000;
    
    setTimeout(() => {
      if (this.pc && this.pc.iceConnectionState === 'disconnected') {
        console.log('🔄 ICE restart after disconnection...');
        this.pc.restartIce();
      }
    }, restartDelay);
  }

  scheduleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.showToast('error', 'Превышено максимальное количество попыток переподключения');
      setTimeout(() => this.hangup(), 5000);
      return;
    }
    
    const delay = Math.min(2000 * Math.pow(1.5, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    
    console.log(`🔄 Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(async () => {
      try {
        if (this.currentRoom) {
          this.showToast('info', `Переподключение ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
          
          // Full reconnection
          await this.performFullReconnection();
        }
      } catch (error) {
        console.error('Reconnection attempt failed:', error);
        this.scheduleReconnection();
      }
    }, delay);
  }

  async performFullReconnection() {
    console.log('🔄 Performing full reconnection...');
    
    // Clean up current connection
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Force TURN for reconnection attempts
    if (this.isRussianUser) {
      this.turnForced = true;
      console.log('🇷🇺 Forcing TURN for Russian user reconnection');
    }
    
    // Recreate connections
    await this.createPeerConnection();
    await this.connectWebSocket(this.currentRoom);
  }

  // ========== TURN USAGE VERIFICATION ==========
  async verifyTurnUsage() {
    // Wait a bit for connection to stabilize
    setTimeout(() => {
      this.performTurnVerification();
    }, 3000);
  }

  async performTurnVerification() {
    if (!this.pc) return;
    
    try {
      const stats = await this.pc.getStats();
      let turnConfirmed = false;
      let relayServerUsed = null;
      
      // Check active connection pairs
      stats.forEach(report => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          // Check both local and remote candidates
          [report.localCandidateId, report.remoteCandidateId].forEach(candidateId => {
            if (candidateId) {
              stats.forEach(candidate => {
                if (candidate.id === candidateId && candidate.candidateType === 'relay') {
                  turnConfirmed = true;
                  relayServerUsed = candidate.address || candidate.ip || 'relay-server';
                  
                  if (relayServerUsed.includes(TURN_SERVER_IP)) {
                    console.log('🎯✅ CONFIRMED: Using YOUR TURN server!');
                  } else {
                    console.log('🔄✅ CONFIRMED: Using TURN server:', relayServerUsed);
                  }
                }
              });
            }
          });
        }
      });
      
      // Fallback verification for forced TURN
      if (!turnConfirmed && this.turnForced) {
        let relayFound = false;
        
        stats.forEach(report => {
          if (report.type === 'local-candidate' && report.candidateType === 'relay') {
            relayFound = true;
            if (report.address && report.address.includes(TURN_SERVER_IP)) {
              turnConfirmed = true;
              relayServerUsed = TURN_SERVER_IP;
            }
          }
        });
        
        if (relayFound) {
          turnConfirmed = true;
          console.log('🔄✅ TURN usage confirmed via relay candidate presence');
        }
      }
      
      // Final result
      if (turnConfirmed) {
        this.turnConfirmed = true;
        
        if (relayServerUsed && relayServerUsed.includes(TURN_SERVER_IP)) {
          this.showToast('success', '🎯 Подключено через ВАШ TURN сервер!');
        } else {
          this.showToast('info', '🔄 Подключено через TURN сервер');
        }
        
        console.log('✅ TURN verification completed successfully');
      } else {
        if (this.turnForced) {
          console.log('🔄 TURN was forced - assuming active (verification inconclusive)');
          this.showToast('info', '🔄 TURN принудительно активен');
        } else {
          console.log('📡 Direct P2P connection established');
        }
      }
      
    } catch (error) {
      console.warn('TURN verification failed:', error);
    }
  }

  // ========== MEDIA CONTROLS ==========
  toggleVideo() {
    this.settings.videoEnabled = !this.settings.videoEnabled;
    
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = this.settings.videoEnabled;
      }
    }
    
    this.updateVideoButton();
    this.showToast('info', 
      this.settings.videoEnabled ? 'Видео включено' : 'Видео выключено'
    );
  }

  toggleAudio() {
    this.settings.audioEnabled = !this.settings.audioEnabled;
    
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = this.settings.audioEnabled;
      }
    }
    
    this.updateAudioButton();
    this.showToast('info', 
      this.settings.audioEnabled ? 'Микрофон включен' : 'Микрофон выключен'
    );
  }

  async toggleScreenShare() {
    try {
      if (!this.isScreenSharing) {
        const constraints = {
          video: { 
            mediaSource: 'screen',
            width: { max: this.environment.isMobile ? 720 : 1280 },
            height: { max: this.environment.isMobile ? 480 : 720 },
            frameRate: { max: this.environment.isMobile ? 10 : 15 }
          },
          audio: true
        };
        
        const screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);
        const videoTrack = screenStream.getVideoTracks()[0];
        
        // Replace video track
        const sender = this.pc.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        
        if (sender) {
          await sender.replaceTrack(videoTrack);
          
          // Optimize for screen sharing
          setTimeout(() => {
            const params = sender.getParameters();
            if (params.encodings && params.encodings[0]) {
              params.encodings[0].maxBitrate = 1000000; // 1 Mbps for screen
              params.encodings[0].maxFramerate = 15;
              sender.setParameters(params).catch(console.warn);
            }
          }, 100);
        }
        
        videoTrack.onended = () => {
          this.stopScreenShare();
        };
        
        this.isScreenSharing = true;
        this.elements.screenShareToggle.classList.add('active');
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
    try {
      const videoTrack = this.localStream.getVideoTracks()[0];
      const sender = this.pc.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      );
      
      if (sender && videoTrack) {
        await sender.replaceTrack(videoTrack);
        
        // Restore normal video optimization
        setTimeout(() => this.optimizePeerConnection(), 100);
      }
      
      this.isScreenSharing = false;
      this.elements.screenShareToggle.classList.remove('active');
      this.showToast('info', 'Демонстрация экрана выключена');
      
    } catch (error) {
      console.error('Stop screen share error:', error);
    }
  }

  async switchCamera() {
    if (!this.environment.isMobile) {
      this.showToast('info', 'Переключение камеры доступно на мобильных устройствах');
      return;
    }
    
    try {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (!videoTrack) return;
      
      const constraints = videoTrack.getConstraints();
      const currentFacingMode = constraints.facingMode;
      const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      
      const videoConstraints = {
        ...VIDEO_CONSTRAINTS[this.settings.videoQuality],
        facingMode: newFacingMode
      };
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false
      });
      
      const newVideoTrack = newStream.getVideoTracks()[0];
      const sender = this.pc.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      );
      
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }
      
      // Update local stream
      videoTrack.stop();
      this.localStream.removeTrack(videoTrack);
      this.localStream.addTrack(newVideoTrack);
      
      this.showToast('info', 'Камера переключена');
      
    } catch (error) {
      console.error('Switch camera error:', error);
      this.showToast('error', 'Не удалось переключить камеру');
    }
  }

  async restartVideoStream() {
    try {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (!videoTrack) return;
      
      const videoConstraints = VIDEO_CONSTRAINTS[this.settings.videoQuality];
      
      const constraints = {
        ...videoConstraints,
        deviceId: this.settings.selectedVideoDevice ? 
          { exact: this.settings.selectedVideoDevice } : undefined
      };
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: constraints,
        audio: false
      });
      
      const newVideoTrack = newStream.getVideoTracks()[0];
      const sender = this.pc.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      );
      
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }
      
      // Update local stream
      videoTrack.stop();
      this.localStream.removeTrack(videoTrack);
      this.localStream.addTrack(newVideoTrack);
      
      // Re-optimize
      setTimeout(() => this.optimizePeerConnection(), 100);
      
      console.log(`📹 Video stream restarted with quality: ${this.settings.videoQuality}`);
      
    } catch (error) {
      console.error('Video stream restart error:', error);
    }
  }

  async restartAudioStream() {
    try {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (!audioTrack) return;
      
      const audioConstraints = AUDIO_CONSTRAINTS[this.settings.audioQuality];
      
      const constraints = {
        ...audioConstraints,
        deviceId: this.settings.selectedAudioDevice ? 
          { exact: this.settings.selectedAudioDevice } : undefined
      };
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: constraints
      });
      
      const newAudioTrack = newStream.getAudioTracks()[0];
      const sender = this.pc.getSenders().find(s => 
        s.track && s.track.kind === 'audio'
      );
      
      if (sender) {
        await sender.replaceTrack(newAudioTrack);
      }
      
      // Update local stream
      audioTrack.stop();
      this.localStream.removeTrack(audioTrack);
      this.localStream.addTrack(newAudioTrack);
      
      console.log(`🎤 Audio stream restarted with quality: ${this.settings.audioQuality}`);
      
    } catch (error) {
      console.error('Audio stream restart error:', error);
    }
  }

  // ========== UI UPDATES ==========
  updateVideoButton() {
    this.elements.videoToggle.className = this.settings.videoEnabled 
      ? 'control-btn video-on' 
      : 'control-btn video-off';
  }

  updateAudioButton() {
    this.elements.audioToggle.className = this.settings.audioEnabled 
      ? 'control-btn audio-on' 
      : 'control-btn audio-off';
  }

  updateConnectionStatus(status, message) {
    if (!this.elements.connectionStatus) return;
    
    const statusDot = this.elements.connectionStatus.querySelector('.status-dot');
    const statusText = this.elements.connectionStatus.querySelector('span');
    
    if (statusDot) statusDot.className = `status-dot ${status}`;
    if (statusText) statusText.textContent = message;
  }

  updateConnectionIndicator() {
    if (!this.pc || !this.elements.connectionIndicator) return;
    
    const state = this.pc.connectionState;
    const indicator = this.elements.connectionIndicator;
    const bars = indicator.querySelectorAll('.bar');
    
    let quality = 0;
    let color = '#f44336'; // Red
    
    if (state === 'connected') {
      // Determine quality based on various factors
      if (this.turnConfirmed) {
        quality = 4; // Full bars for TURN
        color = '#4CAF50'; // Green
      } else if (this.environment.connectionType === 'excellent') {
        quality = 4;
        color = '#4CAF50';
      } else if (this.environment.connectionType === 'good') {
        quality = 3;
        color = '#8BC34A'; // Light green
      } else if (this.environment.connectionType === 'fair') {
        quality = 2;
        color = '#ff9800'; // Orange
      } else {
        quality = 1;
        color = '#f44336'; // Red
      }
      
      // Adjust for packet loss
      if (this.diagnostics.lastPacketLoss > 5) {
        quality = Math.max(1, quality - 1);
        color = '#ff9800';
      }
    }
    
    bars.forEach((bar, index) => {
      bar.style.opacity = index < quality ? '1' : '0.3';
      bar.style.backgroundColor = color;
    });
    
    indicator.className = `connection-indicator ${state}`;
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

  stopCallTimer() {
    if (this.intervals.callTimer) {
      clearInterval(this.intervals.callTimer);
      this.intervals.callTimer = null;
    }
  }

  // ========== CHAT FUNCTIONALITY ==========
  toggleChat() {
    const isOpen = this.elements.chatPanel.classList.contains('open');
    if (isOpen) {
      this.closePanel('chat');
    } else {
      this.openPanel('chat');
    }
  }

  sendChatMessage() {
    const text = this.elements.chatInput.value.trim();
    if (!text || text.length === 0) return;
    
    // Limit message length
    const sanitizedText = text.substring(0, 500);
    
    // Send via WebSocket
    this.sendSignalMessage({ type: 'chat', text: sanitizedText });
    
    // Send via data channel if available
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify({
          type: 'chat',
          text: sanitizedText,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.warn('Data channel message send failed:', error);
      }
    }
    
    this.receiveChatMessage(sanitizedText, true);
    this.elements.chatInput.value = '';
  }

  receiveChatMessage(text, isOwn = false) {
    if (!this.elements.chatMessages) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${isOwn ? 'own' : 'other'}`;
    messageElement.textContent = text;
    
    this.elements.chatMessages.appendChild(messageElement);
    this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    
    this.chatMessages.push({ text, isOwn, timestamp: Date.now() });
    
    // Show notification if chat panel is closed
    if (!isOwn && !this.elements.chatPanel.classList.contains('open')) {
      const preview = text.length > 50 ? text.substring(0, 50) + '...' : text;
      this.showToast('info', `💬 ${preview}`);
    }
  }

  // ========== PANEL MANAGEMENT ==========
  openPanel(panelName) {
    // Close other panels
    ['chat', 'settings', 'history'].forEach(panel => {
      if (panel !== panelName && this.elements[`${panel}Panel`]) {
        this.elements[`${panel}Panel`].classList.remove('open');
        this.panels[panel] = false;
      }
    });
    
    // Open requested panel
    if (this.elements[`${panelName}Panel`]) {
      this.elements[`${panelName}Panel`].classList.add('open');
      this.panels[panelName] = true;
      
      // Load content for specific panels
      if (panelName === 'history') {
        this.loadHistory();
      }
    }
  }

  closePanel(panelName) {
    if (this.elements[`${panelName}Panel`]) {
      this.elements[`${panelName}Panel`].classList.remove('open');
      this.panels[panelName] = false;
    }
  }

  // ========== SETTINGS MANAGEMENT ==========
  changeVideoQuality(quality) {
    // Validate quality setting
    if (!VIDEO_CONSTRAINTS[quality]) {
      console.warn(`Invalid video quality: ${quality}`);
      return;
    }
    
    // Check if quality is appropriate for connection
    if (this.environment.connectionType === 'critical' && quality !== 'minimal') {
      this.showToast('warning', 'Качество ограничено критическим соединением');
      quality = 'minimal';
    } else if (this.environment.connectionType === 'poor' && !['minimal', 'mobile'].includes(quality)) {
      this.showToast('warning', 'Качество ограничено слабым соединением');
      quality = 'mobile';
    }
    
    this.settings.videoQuality = quality;
    this.showToast('info', `Качество видео: ${quality.toUpperCase()}`);
    
    if (this.pc && this.localStream) {
      this.restartVideoStream();
    }
  }

  changeAudioInput(deviceId) {
    this.settings.selectedAudioDevice = deviceId;
    if (this.pc && this.localStream) {
      this.restartAudioStream();
    }
  }

  changeVideoInput(deviceId) {
    this.settings.selectedVideoDevice = deviceId;
    if (this.pc && this.localStream) {
      this.restartVideoStream();
    }
  }

  changeAudioOutput(deviceId) {
    this.settings.selectedAudioOutput = deviceId;
    if (this.elements.remoteVideo && this.elements.remoteVideo.setSinkId) {
      this.elements.remoteVideo.setSinkId(deviceId).catch(error => {
        console.warn('Audio output change failed:', error);
      });
    }
  }

  // ========== HISTORY MANAGEMENT ==========
  async loadHistory() {
    try {
      const response = await fetch('/history');
      const data = await response.json();
      const history = data.data || data;
      
      if (!this.elements.historyList) return;
      
      this.elements.historyList.innerHTML = '';
      
      if (history.length === 0) {
        const emptyElement = document.createElement('div');
        emptyElement.className = 'history-empty';
        emptyElement.innerHTML = '<p>История звонков пуста</p>';
        this.elements.historyList.appendChild(emptyElement);
        return;
      }
      
      history.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'history-item';
        
        const startTime = new Date(item.startedAt).toLocaleString();
        const endTime = item.endedAt ? 
          new Date(item.endedAt).toLocaleString() : 
          'В процессе';
        
        const duration = item.durationSec ? 
          `${Math.floor(item.durationSec / 60)}:${(item.durationSec % 60).toString().padStart(2, '0')}` : 
          '—';
        
        const flags = [];
        if (item.isRussian) flags.push('🇷🇺');
        if (item.turnUsed) flags.push('🔄');
        
        const qualityIcon = this.getQualityIcon(item.quality);
        
        itemElement.innerHTML = `
          <h5>Комната: ${item.room} ${flags.join(' ')} ${qualityIcon}</h5>
          <p><strong>Начало:</strong> ${startTime}</p>
          <p><strong>Окончание:</strong> ${endTime}</p>
          <p><strong>Длительность:</strong> ${duration}</p>
          <p><strong>Участников:</strong> ${item.participantsMax}</p>
          ${item.messages ? `<p><strong>Сообщений:</strong> ${item.messages}</p>` : ''}
          ${item.turnUsed ? `<p><strong>TURN сервер:</strong> ✅ Использован</p>` : ''}
        `;
        
        this.elements.historyList.appendChild(itemElement);
      });
      
      // Add statistics if available
      if (data.analytics) {
        const statsElement = document.createElement('div');
        statsElement.className = 'history-stats';
        statsElement.innerHTML = `
          <h5>📊 Статистика</h5>
          <p><strong>TURN использование:</strong> ${data.analytics.turnUsagePercent || 0}% звонков</p>
          <p><strong>Ваш TURN сервер:</strong> ${TURN_SERVER_IP}:${TURN_SERVER_PORT}</p>
        `;
        this.elements.historyList.insertBefore(statsElement, this.elements.historyList.firstChild);
      }
      
    } catch (error) {
      console.error('History loading error:', error);
      this.showToast('error', 'Не удалось загрузить историю звонков');
    }
  }

  getQualityIcon(quality) {
    const icons = {
      ultra: '🔥',
      hd: '📺',
      sd: '📱',
      mobile: '📞',
      minimal: '🔧'
    };
    return icons[quality] || '📹';
  }

  // ========== NOTIFICATION SYSTEM ==========
  showToast(type, message, duration = 4000) {
    if (!this.elements.toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    this.elements.toastContainer.appendChild(toast);
    
    // Auto-remove toast
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.add('removing');
        setTimeout(() => {
          if (toast.parentNode) {
            this.elements.toastContainer.removeChild(toast);
          }
        }, 300);
      }
    }, duration);
    
    // Log toast messages
    console.log(`Toast [${type}]: ${message}`);
  }

  showCriticalError(message) {
    this.showToast('error', message, 10000);
    console.error(`CRITICAL ERROR: ${message}`);
    
    // Show in UI as well
    if (this.elements.connectionStatus) {
      this.updateConnectionStatus('error', 'Критическая ошибка');
    }
  }

  // ========== EVENT HANDLERS ==========
  handleKeyboardShortcuts(event) {
    // Don't handle shortcuts when typing
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
    
    switch (event.key.toLowerCase()) {
      case 'm':
        if (this.pc) this.toggleAudio();
        break;
      case 'v':
        if (this.pc) this.toggleVideo();
        break;
      case 'c':
        if (this.pc) this.toggleChat();
        break;
      case 's':
        if (this.pc && event.ctrlKey) {
          event.preventDefault();
          this.toggleScreenShare();
        }
        break;
      case 't':
        if (event.ctrlKey && event.shiftKey) {
          event.preventDefault();
          this.performStressTest();
        }
        break;
      case 'f':
        if (event.ctrlKey) {
          event.preventDefault();
          this.toggleTurnForce();
        }
        break;
      case 'escape':
        this.closeAllPanels();
        break;
    }
  }

  toggleTurnForce() {
    this.turnForced = !this.turnForced;
    this.showToast('info', `TURN принуждение: ${this.turnForced ? 'ВКЛ' : 'ВЫКЛ'}`);
    console.log(`🔄 TURN forced toggled: ${this.turnForced}`);
  }

  closeAllPanels() {
    ['chat', 'settings', 'history'].forEach(panel => {
      this.closePanel(panel);
    });
  }

  handleResize() {
    // Adjust
