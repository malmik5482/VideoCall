// ---- Enhanced VideoChat Pro Application ----

// Polyfills and compatibility
if (!navigator.mediaDevices) navigator.mediaDevices = {};
if (!navigator.mediaDevices.getUserMedia) {
  navigator.mediaDevices.getUserMedia = function (constraints) {
    const gum = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    if (!gum) return Promise.reject(new Error('getUserMedia not supported'));
    return new Promise((resolve, reject) => gum.call(navigator, constraints, resolve, reject));
  };
}

// Enhanced video constraints
const VIDEO_CONSTRAINTS = {
  hd: { width: { ideal: 1280, min: 640 }, height: { ideal: 720, min: 360 }, frameRate: { ideal: 30, max: 60 } },
  fhd: { width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 }, frameRate: { ideal: 30, max: 60 } },
  lite: { width: { ideal: 640, min: 320 }, height: { ideal: 480, min: 240 }, frameRate: { ideal: 24, max: 30 } }
};

const AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000
};

// Application state
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
    this.iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
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

    this.initializeElements();
    this.attachEventListeners();
    this.loadConfig();
    this.enumerateDevices();
    
    // Show app after initialization
    setTimeout(() => this.hideLoading(), 1000);
  }

  initializeElements() {
    // Main elements
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
    
    // Visibility change for call optimization
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
  }

  async loadConfig() {
    try {
      const response = await fetch('/config');
      const config = await response.json();
      if (config && Array.isArray(config.iceServers)) {
        this.iceServers = config.iceServers;
      }
    } catch (error) {
      console.warn('Could not load ICE config:', error);
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
      
      // Update connection status
      this.updateConnectionStatus('ready', 'Готов к подключению');
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
      
      this.showToast('info', `Подключение к комнате ${room}...`);
      
    } catch (error) {
      console.error('Join room error:', error);
      this.showToast('error', 'Ошибка подключения');
      this.elements.joinBtn.disabled = false;
    }
  }

  createPeerConnection() {
    this.pc = new RTCPeerConnection({ 
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10
    });

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

    // Event handlers
    this.pc.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.elements.remoteVideo.srcObject = this.remoteStream;
      this.updateConnectionStatus('connected', 'Подключен');
      this.startCallTimer();
      this.showToast('success', 'Соединение установлено');
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalMessage({ type: 'candidate', candidate: event.candidate });
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log('Connection state:', this.pc.connectionState);
      this.updateConnectionIndicator();
      
      if (this.pc.connectionState === 'failed') {
        this.pc.restartIce();
        this.showToast('warning', 'Переподключение...');
      } else if (this.pc.connectionState === 'disconnected') {
        this.showToast('warning', 'Соединение потеряно');
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log('ICE state:', this.pc.iceConnectionState);
    };
  }

  optimizePeerConnection() {
    if (!this.pc) return;

    this.pc.getSenders().forEach(sender => {
      if (!sender.track) return;
      
      const params = sender.getParameters();
      if (!params.encodings) params.encodings = [{}];
      
      if (sender.track.kind === 'video') {
        const bitrates = { hd: 2500000, fhd: 4000000, lite: 800000 };
        params.encodings[0].maxBitrate = bitrates[this.settings.videoQuality];
        if ('degradationPreference' in params) {
          params.degradationPreference = 'maintain-framerate';
        }
      } else if (sender.track.kind === 'audio') {
        params.encodings[0].maxBitrate = 128000;
      }
      
      sender.setParameters(params).catch(console.warn);
    });

    // Codec preferences
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
          const preferredCodecs = capabilities.codecs.filter(codec =>
            /VP9|H264/i.test(codec.mimeType) && !/rtx/i.test(codec.mimeType)
          );
          if (preferredCodecs.length) {
            transceiver.setCodecPreferences(preferredCodecs);
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
      this.sendSignalMessage({ type: 'join', room });
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
      this.showToast('error', 'Ошибка соединения');
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket closed');
      this.updateConnectionStatus('disconnected', 'Соединение потеряно');
    };
  }

  async handleSignalMessage(message) {
    switch (message.type) {
      case 'role':
        this.role = message.role;
        console.log('Assigned role:', this.role);
        break;
        
      case 'ready':
        if (this.role === 'caller') {
          await this.createOffer();
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
    } catch (error) {
      console.error('Create offer error:', error);
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
      } else if (description.type === 'answer') {
        if (this.pc.signalingState === 'have-local-offer') {
          await this.pc.setRemoteDescription(description);
        }
      }
    } catch (error) {
      console.error('Handle description error:', error);
    }
  }

  async handleCandidate(candidate) {
    try {
      await this.pc.addIceCandidate(candidate);
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
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { mediaSource: 'screen' },
          audio: true
        });
        
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
    // Close other panels
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
    this.settings.videoQuality = quality;
    this.showToast('info', `Качество видео: ${quality.toUpperCase()}`);
    // Restart video stream with new quality if in call
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
      const history = await response.json();
      
      this.elements.historyList.innerHTML = '';
      
      history.reverse().forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'history-item';
        
        const startTime = new Date(item.startedAt).toLocaleString();
        const endTime = item.endedAt ? new Date(item.endedAt).toLocaleString() : 'В процессе';
        const duration = item.durationSec ? 
          `${Math.floor(item.durationSec / 60)}:${(item.durationSec % 60).toString().padStart(2, '0')}` : 
          '—';
        
        itemElement.innerHTML = `
          <h5>Комната: ${item.room}</h5>
          <p>Начало: ${startTime}</p>
          <p>Окончание: ${endTime}</p>
          <p>Длительность: ${duration}</p>
          <p>Участников: ${item.participantsMax}</p>
        `;
        
        this.elements.historyList.appendChild(itemElement);
      });
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
        this.elements.toastContainer.removeChild(toast);
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
      case 'escape':
        this.closePanel('chat');
        this.closePanel('settings');
        this.closePanel('history');
        break;
    }
  }

  // Responsive and optimization
  handleResize() {
    // Optimize for mobile
    if (window.innerWidth <= 768) {
      // Mobile optimizations
    }
  }

  handleVisibilityChange() {
    if (document.hidden && this.pc) {
      // Reduce quality when tab is not visible
      this.pc.getSenders().forEach(sender => {
        if (sender.track?.kind === 'video') {
          const params = sender.getParameters();
          if (params.encodings) {
            params.encodings[0].maxBitrate = 300000; // Low bitrate
            sender.setParameters(params).catch(console.warn);
          }
        }
      });
    } else if (!document.hidden && this.pc) {
      // Restore quality when tab becomes visible
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
    // Stop call timer
    this.stopCallTimer();
    
    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Close peer connection
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
  window.videoCallApp = new VideoCallApp();
});

// Handle connection errors and retry logic
window.addEventListener('online', () => {
  if (window.videoCallApp) {
    window.videoCallApp.showToast('success', 'Соединение восстановлено');
  }
});

window.addEventListener('offline', () => {
  if (window.videoCallApp) {
    window.videoCallApp.showToast('warning', 'Соединение потеряно');
  }
});
