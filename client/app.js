// ---- VideoChat Pro with GUARANTEED TURN for Russia ----

// Polyfills and compatibility
if (!navigator.mediaDevices) navigator.mediaDevices = {};
if (!navigator.mediaDevices.getUserMedia) {
  navigator.mediaDevices.getUserMedia = function (constraints) {
    const gum = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    if (!gum) return Promise.reject(new Error('getUserMedia not supported'));
    return new Promise((resolve, reject) => gum.call(navigator, constraints, resolve, reject));
  };
}

// Optimized constraints for Russian mobile networks
const VIDEO_CONSTRAINTS = {
  hd: { 
    width: { ideal: 1280, min: 640 }, 
    height: { ideal: 720, min: 360 }, 
    frameRate: { ideal: 24, max: 30 }
  },
  fhd: { 
    width: { ideal: 1920, min: 1280 }, 
    height: { ideal: 1080, min: 720 }, 
    frameRate: { ideal: 24, max: 30 } 
  },
  lite: { 
    width: { ideal: 640, min: 480 }, 
    height: { ideal: 480, min: 360 }, 
    frameRate: { ideal: 20, max: 24 } 
  },
  mobile: {
    width: { ideal: 480, min: 320 },
    height: { ideal: 360, min: 240 },
    frameRate: { ideal: 15, max: 20 }
  }
};

const AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 16000
};

// Enhanced Russian network detection
function detectEnvironment() {
  const lang = navigator.language || navigator.userLanguage || '';
  const userAgent = navigator.userAgent || '';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  
  // Multiple checks for Russian network
  const isRussian = lang.startsWith('ru') || 
                   /ru|russia|moscow|cyrillic/i.test(lang) ||
                   timezone.includes('Moscow') || 
                   timezone.includes('Europe/') && 
                   ['Kaliningrad', 'Samara', 'Yekaterinburg', 'Omsk', 'Krasnoyarsk', 'Irkutsk', 'Yakutsk', 'Vladivostok', 'Magadan', 'Sakhalin', 'Kamchatka'].some(city => timezone.includes(city)) ||
                   /yandex|mail\.ru|rambler|vk\.com/i.test(userAgent);
  
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  const connectionType = (() => {
    if (!navigator.connection) return 'unknown';
    const conn = navigator.connection;
    const speed = conn.downlink || 0;
    const type = conn.effectiveType || 'unknown';
    
    if (type === '2g' || speed < 0.5) return 'poor';
    if (type === '3g' || speed < 2) return 'medium';
    return 'good';
  })();
  
  return { isRussian, isMobile, connectionType };
}

// VideoCallApp with GUARANTEED TURN for Russian users
class VideoCallApp {
  constructor() {
    this.ws = null;
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.role = null;
    this.currentRoom = null;
    this.callStartTime = null;
    this.callDurationInterval = null;
    this.iceServers = [];
    this.deviceCache = { video: [], audio: [], audioOutput: [] };
    this.settings = {
      videoQuality: 'hd',
      videoEnabled: true,
      audioEnabled: true,
      selectedVideoDevice: null,
      selectedAudioDevice: null,
      selectedAudioOutput: null
    };
    this.chatMessages = [];
    this.isScreenSharing = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.connectionIssues = 0;
    this.turnForced = false;
    this.russianOptimizations = false;
    
    // Detect environment FIRST
    this.environment = detectEnvironment();
    
    // FORCE TURN for Russian users immediately
    if (this.environment.isRussian) {
      this.turnForced = true;
      this.russianOptimizations = true;
      console.log('🇷🇺 RUSSIAN USER DETECTED - TURN WILL BE FORCED');
    }
    
    console.log('🌍 Environment detected:', this.environment);
    console.log('🔄 TURN forced:', this.turnForced);
    console.log('🇷🇺 Russian optimizations:', this.russianOptimizations);
    
    // Auto-adjust quality for mobile/poor connections
    if (this.environment.isMobile || this.environment.connectionType === 'poor') {
      this.settings.videoQuality = 'mobile';
    } else if (this.environment.connectionType === 'medium') {
      this.settings.videoQuality = 'lite';
    }
    
    this.initializeElements();
    this.attachEventListeners();
    this.initializeApp();
  }

  async initializeApp() {
    try {
      await this.loadConfig();
      await this.enumerateDevices();
      
      if (this.environment.isRussian) {
        this.showToast('success', '🇷🇺 Российские оптимизации включены - TURN принудительно активен');
      }
      
      setTimeout(() => this.hideLoading(), 1000);
    } catch (error) {
      console.error('App initialization error:', error);
      this.hideLoading();
    }
  }

  initializeElements() {
    this.elements = {
      // Screens
      loadingScreen: document.getElementById('loadingScreen'),
      app: document.getElementById('app'),
      joinScreen: document.getElementById('joinScreen'),
      callScreen: document.getElementById('callScreen'),
      
      // Join screen
      roomInput: document.getElementById('roomInput'),
      generateRoomBtn: document.getElementById('generateRoomBtn'),
      previewVideo: document.getElementById('previewVideo'),
      joinBtn: document.getElementById('joinBtn'),
      toggleVideoBtn: document.getElementById('toggleVideoBtn'),
      toggleAudioBtn: document.getElementById('toggleAudioBtn'),
      
      // Call screen
      localVideo: document.getElementById('localVideo'),
      remoteVideo: document.getElementById('remoteVideo'),
      connectionIndicator: document.getElementById('connectionIndicator'),
      
      // Controls
      videoToggle: document.getElementById('videoToggle'),
      audioToggle: document.getElementById('audioToggle'),
      screenShareToggle: document.getElementById('screenShareToggle'),
      chatToggle: document.getElementById('chatToggle'),
      hangupBtn: document.getElementById('hangupBtn'),
      switchCameraBtn: document.getElementById('switchCameraBtn'),
      
      // Info
      callDuration: document.getElementById('callDuration'),
      roomCode: document.getElementById('roomCode'),
      connectionStatus: document.getElementById('connectionStatus'),
      remoteUserName: document.getElementById('remoteUserName'),
      
      // Panels
      chatPanel: document.getElementById('chatPanel'),
      settingsPanel: document.getElementById('settingsPanel'),
      historyPanel: document.getElementById('historyPanel'),
      
      // Panel controls
      settingsBtn: document.getElementById('settingsBtn'),
      historyBtn: document.getElementById('historyBtn'),
      closeChatBtn: document.getElementById('closeChatBtn'),
      closeSettingsBtn: document.getElementById('closeSettingsBtn'),
      closeHistoryBtn: document.getElementById('closeHistoryBtn'),
      
      // Chat
      chatMessages: document.getElementById('chatMessages'),
      chatInput: document.getElementById('chatInput'),
      sendMessageBtn: document.getElementById('sendMessageBtn'),
      
      // Settings
      audioInputSelect: document.getElementById('audioInputSelect'),
      audioOutputSelect: document.getElementById('audioOutputSelect'),
      videoInputSelect: document.getElementById('videoInputSelect'),
      
      // History
      historyList: document.getElementById('historyList'),
      
      // Toast
      toastContainer: document.getElementById('toastContainer')
    };
  }

  attachEventListeners() {
    // Join screen events
    this.elements.generateRoomBtn.addEventListener('click', () => this.generateRoomCode());
    this.elements.joinBtn.addEventListener('click', () => this.joinRoom());
    this.elements.toggleVideoBtn.addEventListener('click', () => this.togglePreviewVideo());
    this.elements.toggleAudioBtn.addEventListener('click', () => this.togglePreviewAudio());
    
    // Call control events
    this.elements.videoToggle.addEventListener('click', () => this.toggleVideo());
    this.elements.audioToggle.addEventListener('click', () => this.toggleAudio());
    this.elements.screenShareToggle.addEventListener('click', () => this.toggleScreenShare());
    this.elements.chatToggle.addEventListener('click', () => this.toggleChat());
    this.elements.hangupBtn.addEventListener('click', () => this.hangup());
    this.elements.switchCameraBtn.addEventListener('click', () => this.switchCamera());
    
    // Panel events
    this.elements.settingsBtn.addEventListener('click', () => this.openPanel('settings'));
    this.elements.historyBtn.addEventListener('click', () => this.openPanel('history'));
    this.elements.closeChatBtn.addEventListener('click', () => this.closePanel('chat'));
    this.elements.closeSettingsBtn.addEventListener('click', () => this.closePanel('settings'));
    this.elements.closeHistoryBtn.addEventListener('click', () => this.closePanel('history'));
    
    // Chat events
    this.elements.sendMessageBtn.addEventListener('click', () => this.sendChatMessage());
    this.elements.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendChatMessage();
    });
    
    // Settings events
    document.querySelectorAll('input[name="quality"]').forEach(radio => {
      radio.addEventListener('change', (e) => this.changeVideoQuality(e.target.value));
    });
    
    this.elements.audioInputSelect.addEventListener('change', (e) => this.changeAudioInput(e.target.value));
    this.elements.audioOutputSelect.addEventListener('change', (e) => this.changeAudioOutput(e.target.value));
    this.elements.videoInputSelect.addEventListener('change', (e) => this.changeVideoInput(e.target.value));
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    
    // Room input enter key
    this.elements.roomInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.joinRoom();
    });
    
    // Window events
    window.addEventListener('beforeunload', () => this.cleanup());
    window.addEventListener('resize', () => this.handleResize());
    
    // Network change detection
    if ('connection' in navigator) {
      navigator.connection.addEventListener('change', () => this.handleNetworkChange());
    }
    
    // Visibility change for optimization
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
    
    // Online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  async loadConfig() {
    try {
      const response = await fetch('/config');
      const config = await response.json();
      
      if (config && Array.isArray(config.iceServers)) {
        this.iceServers = config.iceServers;
        
        console.log(`📡 Loaded ${this.iceServers.length} ICE servers`);
        
        // Log TURN server info
        const turnServers = this.iceServers.filter(server => 
          server.urls && (
            (typeof server.urls === 'string' && server.urls.includes('turn:')) ||
            (Array.isArray(server.urls) && server.urls.some(url => url.includes('turn:')))
          )
        );
        
        console.log(`🔄 TURN servers available: ${turnServers.length}`);
        
        turnServers.forEach((server, index) => {
          const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
          urls.forEach(url => {
            if (url.includes('94.198.218.189')) {
              console.log(`🔄 Your TURN server detected: ${url}`);
            }
          });
        });
      }
    } catch (error) {
      console.warn('Could not load ICE config:', error);
      // Fallback with your TURN server
      this.iceServers = [
        {
          urls: [
            'turn:94.198.218.189:3478?transport=udp',
            'turn:94.198.218.189:3478?transport=tcp'
          ],
          username: 'webrtc',
          credential: 'pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN'
        },
        { urls: 'stun:stun.voipbuster.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' }
      ];
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
      console.warn('Could not enumerate devices:', error);
    }
  }

  populateDeviceSelects() {
    // Video devices
    this.elements.videoInputSelect.innerHTML = '<option value="">Выберите камеру...</option>';
    this.deviceCache.video.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Камера ${device.deviceId.substr(0, 8)}`;
      this.elements.videoInputSelect.appendChild(option);
    });

    // Audio input devices
    this.elements.audioInputSelect.innerHTML = '<option value="">Выберите микрофон...</option>';
    this.deviceCache.audio.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Микрофон ${device.deviceId.substr(0, 8)}`;
      this.elements.audioInputSelect.appendChild(option);
    });

    // Audio output devices
    this.elements.audioOutputSelect.innerHTML = '<option value="">Выберите динамики...</option>';
    this.deviceCache.audioOutput.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Динамики ${device.deviceId.substr(0, 8)}`;
      this.elements.audioOutputSelect.appendChild(option);
    });
  }

  hideLoading() {
    this.elements.loadingScreen.classList.add('hidden');
    this.elements.app.classList.remove('hidden');
    this.startPreviewMedia();
  }

  async startPreviewMedia() {
    try {
      const constraints = {
        video: VIDEO_CONSTRAINTS[this.settings.videoQuality],
        audio: AUDIO_CONSTRAINTS
      };
      
      if (this.settings.selectedVideoDevice) {
        constraints.video.deviceId = { exact: this.settings.selectedVideoDevice };
      }
      if (this.settings.selectedAudioDevice) {
        constraints.audio.deviceId = { exact: this.settings.selectedAudioDevice };
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.elements.previewVideo.srcObject = stream;
      this.localStream = stream;
      
      this.updateConnectionStatus('ready', 'Готов к подключению');
      
      if (this.turnForced) {
        this.showToast('success', '🔄 TURN сервер активирован: 94.198.218.189');
      }
    } catch (error) {
      console.error('Preview media error:', error);
      this.showToast('error', 'Не удалось получить доступ к камере/микрофону');
    }
  }

  generateRoomCode() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.elements.roomInput.value = code;
    this.elements.generateRoomBtn.style.transform = 'rotate(360deg)';
    setTimeout(() => {
      this.elements.generateRoomBtn.style.transform = '';
    }, 300);
  }

  async joinRoom() {
    const room = this.elements.roomInput.value.trim();
    if (!room) {
      this.showToast('warning', 'Введите код комнаты');
      return;
    }

    try {
      this.elements.joinBtn.disabled = true;
      this.updateConnectionStatus('connecting', 'Подключение...');
      
      if (!this.localStream) {
        await this.startPreviewMedia();
      }

      this.currentRoom = room;
      this.elements.roomCode.textContent = `Комната: ${room}`;
      
      this.createPeerConnection();
      this.connectWebSocket(room);
      
      // Switch to call screen
      this.elements.joinScreen.style.display = 'none';
      this.elements.callScreen.classList.remove('hidden');
      this.elements.localVideo.srcObject = this.localStream;
      
      if (this.turnForced) {
        this.showToast('info', `🔄 Подключение через TURN сервер (${room})`);
      } else {
        this.showToast('info', `Подключение к комнате ${room}...`);
      }
      
    } catch (error) {
      console.error('Join room error:', error);
      this.showToast('error', 'Ошибка подключения');
      this.elements.joinBtn.disabled = false;
    }
  }

  createPeerConnection() {
    // Configuration with GUARANTEED TURN for Russian users
    const config = { 
      iceServers: this.iceServers,
      iceCandidatePoolSize: 20,
      rtcpMuxPolicy: 'require',
      bundlePolicy: 'max-bundle'
    };
    
    // GUARANTEED TURN enforcement for Russian users
    if (this.environment.isRussian || this.turnForced) {
      config.iceTransportPolicy = 'relay'; // ONLY TURN, no STUN allowed!
      this.turnForced = true;
      this.russianOptimizations = true;
      console.log('🔄 GUARANTEED TURN enforced - iceTransportPolicy: relay');
      console.log('🇷🇺 Russian optimizations: true');
      console.log('🔄 TURN forced: true');
    } else {
      config.iceTransportPolicy = 'all';
      console.log('📡 Standard policy - allowing STUN and TURN');
    }
    
    this.pc = new RTCPeerConnection(config);

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.pc.addTrack(track, this.localStream);
      });
    }

    // Enhanced encoding parameters
    setTimeout(() => {
      this.optimizePeerConnection();
    }, 100);

    // Event handlers with enhanced TURN monitoring
    this.pc.ontrack = async (event) => {
      this.remoteStream = event.streams[0];
      this.elements.remoteVideo.srcObject = this.remoteStream;
      this.updateConnectionStatus('connected', 'Подключен');
      this.startCallTimer();
      
      if (this.turnForced) {
        this.showToast('success', '🔄 Соединение через TURN сервер установлено');
      } else {
        this.showToast('success', 'Соединение установлено');
      }
      
      this.connectionIssues = 0;
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Enhanced TURN candidate logging
        if (event.candidate.candidate) {
          if (event.candidate.candidate.includes('relay')) {
            console.log('🔄 TURN candidate generated:', event.candidate.candidate);
            if (event.candidate.candidate.includes('94.198.218.189')) {
              console.log('🎯 YOUR TURN SERVER CANDIDATE GENERATED!');
              this.showToast('success', '🔄 Ваш TURN сервер активен');
            }
          } else if (event.candidate.candidate.includes('srflx')) {
            console.log('📡 STUN candidate generated (should not happen with relay-only)');
          } else if (event.candidate.candidate.includes('host')) {
            console.log('🏠 Host candidate generated (should not happen with relay-only)');
          }
        }
        
        this.sendSignalMessage({ 
          type: 'candidate', 
          candidate: event.candidate 
        });
      } else {
        console.log('🧊 ICE gathering complete');
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      console.log(`Connection state: ${state}`);
      this.updateConnectionIndicator();
      
      if (state === 'failed') {
        console.error('❌ Connection FAILED');
        this.connectionIssues++;
        this.handleConnectionFailure();
      } else if (state === 'disconnected') {
        console.warn('⚠️ Connection DISCONNECTED');
        this.showToast('warning', 'Соединение потеряно, восстановление...');
        this.scheduleReconnection();
      } else if (state === 'connected') {
        console.log('✅ Connection ESTABLISHED');
        this.reconnectAttempts = 0;
        this.checkTurnUsage();
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      const iceState = this.pc.iceConnectionState;
      console.log(`ICE connection state: ${iceState}`);
      
      if (iceState === 'failed') {
        console.error('🧊❌ ICE CONNECTION FAILED - Restarting...');
        this.sendSignalMessage({ type: 'connection-failed', reason: 'ice-failed' });
        
        // Immediate restart for failed ICE
        setTimeout(() => {
          if (this.pc && this.pc.iceConnectionState === 'failed') {
            console.log('🔄 Executing ICE restart...');
            this.pc.restartIce();
          }
        }, 500);
      } else if (iceState === 'disconnected') {
        console.warn('🧊⚠️ ICE DISCONNECTED - Scheduling restart...');
        setTimeout(() => {
          if (this.pc && this.pc.iceConnectionState === 'disconnected') {
            console.log('🔄 ICE restart after disconnect...');
            this.pc.restartIce();
          }
        }, 2000);
      } else if (iceState === 'connected') {
        console.log('🧊✅ ICE CONNECTED');
      }
    };
  }

  async checkTurnUsage() {
    if (!this.pc) return;
    
    try {
      const stats = await this.pc.getStats();
      let usingTurn = false;
      let turnServerUsed = null;
      
      stats.forEach(report => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          if (report.remoteCandidateId) {
            stats.forEach(candidateReport => {
              if (candidateReport.id === report.remoteCandidateId && 
                  candidateReport.candidateType === 'relay') {
                usingTurn = true;
                turnServerUsed = candidateReport.ip || candidateReport.address || 'unknown';
                console.log('🔄✅ Connection established via TURN server:', turnServerUsed);
              }
            });
          }
        }
      });
      
      if (usingTurn) {
        if (turnServerUsed && turnServerUsed.includes('94.198.218.189')) {
          this.showToast('success', '🎯 Подключено через ВАШ TURN сервер!');
        } else {
          this.showToast('info', '🔄 Подключено через TURN сервер');
        }
      } else if (this.turnForced) {
        console.warn('⚠️ TURN was forced but connection not using TURN - checking...');
        // Re-check in case stats are not ready yet
        setTimeout(() => this.checkTurnUsage(), 2000);
      } else {
        console.log('📡 Direct connection established (no TURN needed)');
      }
    } catch (error) {
      console.warn('Error checking TURN usage:', error);
    }
  }

  optimizePeerConnection() {
    if (!this.pc) return;

    this.pc.getSenders().forEach(sender => {
      if (!sender.track) return;
      
      const params = sender.getParameters();
      if (!params.encodings) params.encodings = [{}];
      
      if (sender.track.kind === 'video') {
        // Conservative bitrates for Russian networks
        let maxBitrate;
        if (this.environment.isMobile || this.environment.connectionType === 'poor') {
          maxBitrate = 300000; // 300 kbps for mobile/poor
        } else if (this.environment.connectionType === 'medium' || this.environment.isRussian) {
          maxBitrate = 600000; // 600 kbps for medium/Russian
        } else {
          const bitrates = { hd: 1200000, fhd: 2000000, lite: 500000, mobile: 300000 };
          maxBitrate = bitrates[this.settings.videoQuality];
        }
        
        params.encodings[0].maxBitrate = maxBitrate;
        params.encodings[0].maxFramerate = this.environment.isMobile ? 15 : 24;
        
        if ('degradationPreference' in params) {
          params.degradationPreference = 'maintain-framerate';
        }
        
        console.log(`📹 Video bitrate: ${maxBitrate} bps (${this.environment.connectionType} connection)`);
      } else if (sender.track.kind === 'audio') {
        const audioBitrate = this.environment.isMobile ? 32000 : 64000;
        params.encodings[0].maxBitrate = audioBitrate;
        console.log(`🎤 Audio bitrate: ${audioBitrate} bps`);
      }
      
      sender.setParameters(params).catch(err => {
        console.warn('Error setting parameters:', err);
      });
    });

    // Codec preferences - prefer H.264 for Russian networks
    this.setCodecPreferences();
  }

  setCodecPreferences() {
    try {
      const capabilities = RTCRtpSender.getCapabilities('video');
      if (capabilities && this.pc.getTransceivers) {
        const transceiver = this.pc.getTransceivers().find(t => 
          t.sender?.track?.kind === 'video'
        );
        
        if (transceiver && transceiver.setCodecPreferences) {
          // Prefer H.264 for better mobile/Russian network compatibility
          let preferredCodecs = capabilities.codecs.filter(codec =>
            /H264/i.test(codec.mimeType) && !/rtx/i.test(codec.mimeType)
          );
          
          // Fallback to VP8 if H.264 not available
          if (preferredCodecs.length === 0) {
            preferredCodecs = capabilities.codecs.filter(codec =>
              /VP8/i.test(codec.mimeType) && !/rtx/i.test(codec.mimeType)
            );
          }
          
          if (preferredCodecs.length > 0) {
            transceiver.setCodecPreferences(preferredCodecs);
            console.log('📺 H.264 codec preferred for Russian networks');
          }
        }
      }
    } catch (error) {
      console.warn('Codec preference error:', error);
    }
  }

  connectWebSocket(room) {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${protocol}://${location.host}/ws`);
    
    this.ws.onopen = () => {
      this.sendSignalMessage({ 
        type: 'join', 
        room,
        userInfo: {
          isRussian: this.environment.isRussian,
          isMobile: this.environment.isMobile,
          connectionType: this.environment.connectionType,
          turnForced: this.turnForced
        }
      });
      this.updateConnectionStatus('connected', 'WebSocket подключен');
    };
    
    this.ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        await this.handleSignalMessage(message);
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.showToast('error', 'Ошибка WebSocket соединения');
    };
    
    this.ws.onclose = (event) => {
      console.log(`WebSocket closed: ${event.code} ${event.reason}`);
      this.updateConnectionStatus('disconnected', 'WebSocket отключен');
      
      if (this.currentRoom && !event.wasClean) {
        this.scheduleReconnection();
      }
    };
  }

  async handleSignalMessage(message) {
    switch (message.type) {
      case 'role':
        this.role = message.role;
        console.log('Assigned role:', this.role);
        
        if (message.turnServerAvailable) {
          console.log('🔄 TURN server confirmed by server');
        }
        if (message.russianOptimization) {
          console.log('🇷🇺 Russian optimization confirmed by server');
        }
        break;
        
      case 'ready':
        if (this.role === 'caller') {
          await this.createOffer();
        }
        
        if (message.turnServerRecommended && this.environment.isRussian) {
          console.log('🔄 TURN server recommended by server');
        }
        break;
        
      case 'description':
        await this.handleDescription(message.sdp);
        break;
        
      case 'candidate':
        await this.handleCandidate(message.candidate);
        break;
        
      case 'chat':
        this.receiveChatMessage(message.text, false);
        break;
        
      case 'peer-left':
        this.showToast('info', 'Собеседник покинул звонок');
        this.elements.remoteVideo.srcObject = null;
        break;
        
      case 'full':
        this.showToast('error', 'Комната заполнена');
        this.hangup();
        break;
        
      case 'bye':
        this.hangup();
        break;
        
      case 'russia-config':
        if (message.turnServerForced) {
          this.turnForced = true;
          console.log('🔄 TURN server usage forced by server');
        }
        
        if (message.recommendations) {
          message.recommendations.forEach(rec => {
            console.log(`🇷🇺 Server recommendation: ${rec}`);
          });
        }
        
        if (message.turnServer) {
          this.showToast('success', `🔄 TURN: ${message.turnServer}`);
        }
        break;
        
      case 'turn-suggestion':
        this.showToast('warning', message.message);
        if (message.forceTurn) {
          this.turnForced = true;
        }
        break;
        
      case 'pong':
        const latency = Date.now() - this.lastPingTime;
        console.log(`🏓 Latency: ${latency}ms`);
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  async createOffer() {
    try {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await this.pc.setLocalDescription(offer);
      this.sendSignalMessage({ 
        type: 'description', 
        sdp: this.pc.localDescription 
      });
      console.log('📞 Offer created and sent');
    } catch (error) {
      console.error('Create offer error:', error);
      this.showToast('error', 'Ошибка создания предложения');
    }
  }

  async handleDescription(description) {
    try {
      if (description.type === 'offer') {
        if (this.pc.signalingState !== 'stable') {
          await this.pc.setLocalDescription({ type: 'rollback' });
        }
        await this.pc.setRemoteDescription(description);
        
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.sendSignalMessage({ 
          type: 'description', 
          sdp: this.pc.localDescription 
        });
        console.log('📞 Answer created and sent');
      } else if (description.type === 'answer') {
        if (this.pc.signalingState === 'have-local-offer') {
          await this.pc.setRemoteDescription(description);
          console.log('📞 Answer received and set');
        }
      }
    } catch (error) {
      console.error('Handle description error:', error);
      this.showToast('error', 'Ошибка обработки SDP');
    }
  }

  async handleCandidate(candidate) {
    try {
      await this.pc.addIceCandidate(candidate);
      
      // Enhanced candidate logging
      if (candidate.candidate) {
        if (candidate.candidate.includes('relay')) {
          console.log('🔄 TURN candidate added:', candidate.candidate);
          if (candidate.candidate.includes('94.198.218.189')) {
            console.log('🎯 YOUR TURN SERVER CANDIDATE ADDED!');
          }
        } else if (candidate.candidate.includes('srflx')) {
          console.log('📡 STUN candidate added');
        } else if (candidate.candidate.includes('host')) {
          console.log('🏠 Host candidate added');
        }
      }
    } catch (error) {
      console.warn('Add ICE candidate error:', error);
    }
  }

  sendSignalMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Send signal message error:', error);
      }
    }
  }

  handleConnectionFailure() {
    this.connectionIssues++;
    
    console.error(`🚨 Connection failure #${this.connectionIssues}`);
    
    if (this.connectionIssues > 3) {
      this.showToast('error', 'Множественные сбои соединения. Переподключитесь.');
      return;
    }
    
    // For Russian networks, ensure TURN is forced
    if (this.environment.isRussian && !this.turnForced) {
      console.log('🇷🇺 Enabling forced TURN due to connection failure');
      this.turnForced = true;
    }
    
    if (this.pc && this.pc.connectionState === 'failed') {
      console.log('🔄 Attempting ICE restart...');
      this.pc.restartIce();
      
      setTimeout(() => {
        if (this.pc && this.pc.connectionState === 'failed') {
          console.log('🔄 ICE restart failed, scheduling reconnection...');
          this.scheduleReconnection();
        }
      }, 3000);
    }
  }

  scheduleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.showToast('error', 'Превышено максимальное количество попыток переподключения');
      return;
    }
    
    const delay = 2000 * Math.pow(1.5, this.reconnectAttempts);
    this.reconnectAttempts++;
    
    console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(async () => {
      try {
        if (this.currentRoom) {
          this.showToast('info', `Переподключение ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
          
          // Clean up current connection
          if (this.pc) this.pc.close();
          if (this.ws) this.ws.close();
          
          // Force TURN for reconnection attempts on Russian networks
          if (this.environment.isRussian) {
            this.turnForced = true;
            console.log('🇷🇺 TURN forced for reconnection attempt');
          }
          
          // Recreate connection
          this.createPeerConnection();
          this.connectWebSocket(this.currentRoom);
        }
      } catch (error) {
        console.error('Reconnection error:', error);
        this.scheduleReconnection();
      }
    }, delay);
  }

  handleNetworkChange() {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      const newType = connection.effectiveType;
      
      console.log(`📶 Network changed to: ${newType}`);
      
      // Update environment
      const oldConnectionType = this.environment.connectionType;
      this.environment.connectionType = (() => {
        const speed = connection.downlink || 0;
        if (newType === '2g' || speed < 0.5) return 'poor';
        if (newType === '3g' || speed < 2) return 'medium';
        return 'good';
      })();
      
      console.log(`🌐 Connection quality: ${oldConnectionType} → ${this.environment.connectionType}`);
      
      if (oldConnectionType !== this.environment.connectionType) {
        // Auto-adjust settings
        if (this.environment.connectionType === 'poor' && this.settings.videoQuality !== 'mobile') {
          this.settings.videoQuality = 'mobile';
          this.showToast('warning', 'Качество снижено из-за слабой сети');
          if (this.pc && this.localStream) {
            this.restartVideoStream();
          }
        }
        
        // Re-optimize connection
        if (this.pc && this.pc.connectionState === 'connected') {
          this.optimizePeerConnection();
        }
      }
    }
  }

  handleOnline() {
    console.log('🌐 Network online');
    this.showToast('success', 'Соединение восстановлено');
    
    if (this.currentRoom && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
      this.scheduleReconnection();
    }
  }

  handleOffline() {
    console.log('🌐 Network offline');
    this.showToast('error', 'Нет соединения с интернетом');
  }

  // Media controls
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
        const screenShareConstraints = {
          video: { 
            mediaSource: 'screen',
            width: { max: this.environment.isMobile ? 720 : 1280 },
            height: { max: this.environment.isMobile ? 480 : 720 },
            frameRate: { max: this.environment.isMobile ? 10 : 15 }
          },
          audio: true
        };
        
        const screenStream = await navigator.mediaDevices.getDisplayMedia(screenShareConstraints);
        
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = this.pc.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        
        if (sender) {
          await sender.replaceTrack(videoTrack);
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
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          ...VIDEO_CONSTRAINTS[this.settings.videoQuality],
          facingMode: newFacingMode 
        },
        audio: false
      });
      
      const newVideoTrack = newStream.getVideoTracks()[0];
      const sender = this.pc.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      );
      
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }
      
      videoTrack.stop();
      this.localStream.removeTrack(videoTrack);
      this.localStream.addTrack(newVideoTrack);
      
      this.showToast('info', 'Камера переключена');
    } catch (error) {
      console.error('Switch camera error:', error);
      this.showToast('error', 'Не удалось переключить камеру');
    }
  }

  // UI Updates
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
    const statusDot = this.elements.connectionStatus.querySelector('.status-dot');
    const statusText = this.elements.connectionStatus.querySelector('span');
    
    statusDot.className = `status-dot ${status}`;
    statusText.textContent = message;
  }

  updateConnectionIndicator() {
    if (!this.pc) return;
    
    const state = this.pc.connectionState;
    const indicator = this.elements.connectionIndicator;
    const bars = indicator.querySelectorAll('.bar');
    
    let quality = 0;
    
    if (state === 'connected') {
      if (this.turnForced) {
        quality = 4; // Show full bars for TURN connections
      } else {
        quality = this.environment.connectionType === 'good' ? 4 : 
                 this.environment.connectionType === 'medium' ? 3 : 2;
      }
    }
    
    bars.forEach((bar, index) => {
      bar.style.opacity = index < quality ? '1' : '0.3';
      bar.style.backgroundColor = quality <= 1 ? '#f44336' : 
                                 quality <= 2 ? '#ff9800' : '#4CAF50';
    });
    
    indicator.className = `connection-indicator ${state}`;
  }

  startCallTimer() {
    this.callStartTime = Date.now();
    this.callDurationInterval = setInterval(() => {
      const elapsed = Date.now() - this.callStartTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      this.elements.callDuration.textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
  }

  stopCallTimer() {
    if (this.callDurationInterval) {
      clearInterval(this.callDurationInterval);
      this.callDurationInterval = null;
    }
  }

  // Chat functionality
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
    if (!text) return;
    
    this.sendSignalMessage({ type: 'chat', text });
    this.receiveChatMessage(text, true);
    this.elements.chatInput.value = '';
  }

  receiveChatMessage(text, isOwn = false) {
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${isOwn ? 'own' : 'other'}`;
    messageElement.textContent = text;
    
    this.elements.chatMessages.appendChild(messageElement);
    this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    
    this.chatMessages.push({ text, isOwn, timestamp: Date.now() });
    
    if (!isOwn && !this.elements.chatPanel.classList.contains('open')) {
      this.showToast('info', `Сообщение: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
    }
  }

  // Panel management
  openPanel(panelName) {
    ['chat', 'settings', 'history'].forEach(panel => {
      if (panel !== panelName) {
        this.elements[`${panel}Panel`].classList.remove('open');
      }
    });
    
    this.elements[`${panelName}Panel`].classList.add('open');
    
    if (panelName === 'history') {
      this.loadHistory();
    }
  }

  closePanel(panelName) {
    this.elements[`${panelName}Panel`].classList.remove('open');
  }

  // Settings
  changeVideoQuality(quality) {
    if (this.environment.connectionType === 'poor' && quality !== 'mobile') {
      this.showToast('warning', 'Качество ограничено из-за слабой сети');
      quality = 'mobile';
    }
    
    this.settings.videoQuality = quality;
    this.showToast('info', `Качество видео: ${quality.toUpperCase()}`);
    
    if (this.pc && this.localStream) {
      this.restartVideoStream();
    }
  }

  async restartVideoStream() {
    try {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (!videoTrack) return;
      
      const constraints = {
        ...VIDEO_CONSTRAINTS[this.settings.videoQuality],
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
      
      videoTrack.stop();
      this.localStream.removeTrack(videoTrack);
      this.localStream.addTrack(newVideoTrack);
      
      this.optimizePeerConnection();
    } catch (error) {
      console.error('Restart video stream error:', error);
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
    if (this.elements.remoteVideo.setSinkId) {
      this.elements.remoteVideo.setSinkId(deviceId).catch(console.warn);
    }
  }

  async restartAudioStream() {
    try {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (!audioTrack) return;
      
      const constraints = {
        ...AUDIO_CONSTRAINTS,
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
      
      audioTrack.stop();
      this.localStream.removeTrack(audioTrack);
      this.localStream.addTrack(newAudioTrack);
    } catch (error) {
      console.error('Restart audio stream error:', error);
    }
  }

  // History
  async loadHistory() {
    try {
      const response = await fetch('/history');
      const data = await response.json();
      const history = data.data || data;
      
      this.elements.historyList.innerHTML = '';
      
      history.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'history-item';
        
        const startTime = new Date(item.startedAt).toLocaleString();
        const endTime = item.endedAt ? new Date(item.endedAt).toLocaleString() : 'В процессе';
        const duration = item.durationSec ? 
          `${Math.floor(item.durationSec / 60)}:${(item.durationSec % 60).toString().padStart(2, '0')}` : 
          '—';
        
        const flags = [];
        if (item.isRussian) flags.push('🇷🇺');
        if (item.turnUsed) flags.push('🔄');
        
        itemElement.innerHTML = `
          <h5>Комната: ${item.room} ${flags.join(' ')}</h5>
          <p>Начало: ${startTime}</p>
          <p>Окончание: ${endTime}</p>
          <p>Длительность: ${duration}</p>
          <p>Участников: ${item.participantsMax}</p>
          ${item.messages ? `<p>Сообщений: ${item.messages}</p>` : ''}
          ${item.turnUsed ? `<p>TURN сервер: Использован ✅</p>` : ''}
        `;
        
        this.elements.historyList.appendChild(itemElement);
      });
      
      // Show TURN usage statistics
      if (data.analytics && data.analytics.turnUsagePercent !== undefined) {
        const statsElement = document.createElement('div');
        statsElement.className = 'history-stats';
        statsElement.innerHTML = `
          <h5>📊 Статистика TURN сервера</h5>
          <p>Использование: ${data.analytics.turnUsagePercent}% звонков</p>
          <p>Сервер: 94.198.218.189:3478</p>
        `;
        this.elements.historyList.insertBefore(statsElement, this.elements.historyList.firstChild);
      }
    } catch (error) {
      console.error('Load history error:', error);
      this.showToast('error', 'Не удалось загрузить историю');
    }
  }

  // Toast notifications
  showToast(type, message, duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    this.elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => {
        if (toast.parentNode) {
          this.elements.toastContainer.removeChild(toast);
        }
      }, 300);
    }, duration);
  }

  // Keyboard shortcuts
  handleKeyboardShortcuts(event) {
    if (event.target.tagName === 'INPUT') return;
    
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
        if (this.pc) this.toggleScreenShare();
        break;
      case 'f':
        if (event.ctrlKey) {
          event.preventDefault();
          this.turnForced = !this.turnForced;
          this.showToast('info', `TURN ${this.turnForced ? 'принудительно включен' : 'отключен'}`);
        }
        break;
      case 'escape':
        this.closePanel('chat');
        this.closePanel('settings');
        this.closePanel('history');
        break;
    }
  }

  // Responsive optimization
  handleResize() {
    if (window.innerWidth <= 768 && this.settings.videoQuality === 'fhd') {
      this.settings.videoQuality = 'hd';
      if (this.pc && this.localStream) {
        this.restartVideoStream();
      }
    }
  }

  handleVisibilityChange() {
    if (document.hidden && this.pc) {
      this.pc.getSenders().forEach(sender => {
        if (sender.track?.kind === 'video') {
          const params = sender.getParameters();
          if (params.encodings) {
            params.encodings[0].maxBitrate = 100000;
            params.encodings[0].maxFramerate = 5;
            sender.setParameters(params).catch(console.warn);
          }
        }
      });
    } else if (!document.hidden && this.pc) {
      setTimeout(() => {
        this.optimizePeerConnection();
      }, 1000);
    }
  }

  // Preview controls
  togglePreviewVideo() {
    this.settings.videoEnabled = !this.settings.videoEnabled;
    
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = this.settings.videoEnabled;
      }
    }
    
    this.elements.toggleVideoBtn.classList.toggle('active', this.settings.videoEnabled);
  }

  togglePreviewAudio() {
    this.settings.audioEnabled = !this.settings.audioEnabled;
    
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = this.settings.audioEnabled;
      }
    }
    
    this.elements.toggleAudioBtn.classList.toggle('active', this.settings.audioEnabled);
  }

  // Hangup and cleanup
  hangup() {
    try {
      this.sendSignalMessage({ type: 'leave' });
    } catch (error) {
      console.warn('Error sending leave message:', error);
    }
    
    this.cleanup();
    
    // Return to join screen
    this.elements.callScreen.classList.add('hidden');
    this.elements.joinScreen.style.display = 'block';
    this.elements.joinBtn.disabled = false;
    
    this.showToast('info', 'Звонок завершен');
  }

  cleanup() {
    console.log('🧹 Cleaning up connection...');
    
    // Stop call timer
    this.stopCallTimer();
    
    // Close connections
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    
    // Stop media streams
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
    }
    
    // Clear video elements
    this.elements.localVideo.srcObject = null;
    this.elements.remoteVideo.srcObject = null;
    
    // Reset state
    this.role = null;
    this.currentRoom = null;
    this.callStartTime = null;
    this.isScreenSharing = false;
    this.reconnectAttempts = 0;
    this.connectionIssues = 0;
    
    // Clear chat
    this.elements.chatMessages.innerHTML = '';
    this.chatMessages = [];
    
    // Close panels
    this.closePanel('chat');
    this.closePanel('settings');
    this.closePanel('history');
    
    // Update connection status
    this.updateConnectionStatus('disconnected', 'Отключен');
    
    // Restart preview
    setTimeout(() => {
      this.startPreviewMedia();
    }, 1000);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 Initializing VideoChat Pro for Russian networks...');
  window.videoCallApp = new VideoCallApp();
});

// Enhanced event handlers for Russian networks
window.addEventListener('online', () => {
  if (window.videoCallApp) {
    console.log('🌐 Network restored');
    window.videoCallApp.showToast('success', '🌐 Интернет подключен');
  }
});

window.addEventListener('offline', () => {
  if (window.videoCallApp) {
    console.log('🌐 Network lost');
    window.videoCallApp.showToast('error', '🌐 Потеряно соединение с интернетом');
  }
});

// Final initialization log
console.log('🎥🇷🇺 VideoChat Pro with GUARANTEED TURN for Russian networks initialized');
console.log('🔄 TURN server: 94.198.218.189:3478 (webrtc/pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN)');
