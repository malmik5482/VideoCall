// ---- VideoChat Pro: Agora Edition for Russian Networks ----
// Version: 6.0.0-AGORA
// Ultra-optimized for mobile networks in Russia

// ========== AGORA CONFIGURATION ==========
// Замените эти значения на ваши из консоли Agora
const AGORA_CONFIG = {
  APP_ID: '86d591368acb4da89f891b8db54c842a', // Ваш реальный App ID
  APP_CERTIFICATE: null, // Для простоты пока null, можно добавить позже
  CHANNEL: 'videochat-' + Math.random().toString(36).substr(2, 9),
  TOKEN: null // Temporary token для тестирования
};

// ========== IMPORTS AND INITIALIZATION ==========
let AgoraRTC = null;
let localTracks = {
  videoTrack: null,
  audioTrack: null
};
let remoteUsers = {};
let rtc = {
  client: null,
  joined: false
};

// ========== MOBILE NETWORK OPTIMIZATION FOR RUSSIA ==========
const RUSSIAN_MOBILE_SETTINGS = {
  // Оптимизация для МТС, Билайн, Мегафон, Теле2
  video: {
    optimizationMode: "detail", // Лучше для мобильных сетей
    encoderConfig: {
      width: 640,
      height: 480,
      frameRate: 15,
      bitrateMin: 200,
      bitrateMax: 1000 // Адаптивно под российские сети
    }
  },
  audio: {
    sampleRate: 48000,
    stereo: false, // Mono для экономии трафика
    bitrate: 48 // Оптимально для мобильных сетей
  }
};

// ========== DOM ELEMENTS ==========
let localVideo, remoteVideo, startButton, hangupButton, statusDiv;

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 VideoChat Agora Edition загружается...');
  
  // Initialize DOM elements
  initializeDOMElements();
  
  // Load Agora SDK
  await loadAgoraSDK();
  
  // Initialize UI
  updateUI();
  
  // Network detection
  detectNetworkType();
  
  console.log('✅ Agora VideoChat готов к работе!');
});

function initializeDOMElements() {
  localVideo = document.getElementById('localVideo');
  remoteVideo = document.getElementById('remoteVideo');
  startButton = document.getElementById('startButton');
  hangupButton = document.getElementById('hangupButton');
  statusDiv = document.getElementById('status');
  
  if (!localVideo || !remoteVideo || !startButton || !hangupButton || !statusDiv) {
    console.error('❌ Не найдены обязательные DOM элементы');
  }
}

// ========== AGORA SDK LOADING ==========
async function loadAgoraSDK() {
  return new Promise((resolve, reject) => {
    // Load Agora SDK from CDN
    const script = document.createElement('script');
    script.src = 'https://download.agora.io/sdk/release/AgoraRTC_N-4.20.0.js';
    script.onload = () => {
      AgoraRTC = window.AgoraRTC;
      console.log('✅ Agora SDK загружен');
      resolve();
    };
    script.onerror = () => {
      console.error('❌ Ошибка загрузки Agora SDK');
      reject();
    };
    document.head.appendChild(script);
  });
}

// ========== NETWORK DETECTION ==========
function detectNetworkType() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  let networkType = 'unknown';
  let effectiveType = 'unknown';
  
  if (connection) {
    networkType = connection.type || 'unknown';
    effectiveType = connection.effectiveType || 'unknown';
  }
  
  // Detect Russian mobile carriers
  const userAgent = navigator.userAgent.toLowerCase();
  let carrier = 'unknown';
  
  if (userAgent.includes('mts')) carrier = 'MTS';
  else if (userAgent.includes('beeline')) carrier = 'Beeline';
  else if (userAgent.includes('megafon')) carrier = 'MegaFon';
  else if (userAgent.includes('tele2')) carrier = 'Tele2';
  
  console.log(`📱 Сеть: ${networkType}, Скорость: ${effectiveType}, Оператор: ${carrier}`);
  
  // Адаптируем настройки под тип сети
  adaptSettingsForNetwork(effectiveType, carrier);
}

function adaptSettingsForNetwork(effectiveType, carrier) {
  if (effectiveType === '2g' || effectiveType === 'slow-2g') {
    RUSSIAN_MOBILE_SETTINGS.video.encoderConfig = {
      width: 320,
      height: 240,
      frameRate: 10,
      bitrateMin: 50,
      bitrateMax: 200
    };
  } else if (effectiveType === '3g') {
    RUSSIAN_MOBILE_SETTINGS.video.encoderConfig = {
      width: 480,
      height: 360,
      frameRate: 15,
      bitrateMin: 150,
      bitrateMax: 500
    };
  }
  
  console.log('🔧 Настройки адаптированы под сеть:', RUSSIAN_MOBILE_SETTINGS);
}

// ========== MAIN VIDEOCHAT FUNCTIONS ==========
async function startVideoChat() {
  if (!AGORA_CONFIG.APP_ID || AGORA_CONFIG.APP_ID === 'YOUR_AGORA_APP_ID_HERE') {
    showStatus('❌ Введите App ID в AGORA_CONFIG!', 'error');
    return;
  }
  
  try {
    showStatus('🔄 Подключаемся к Agora...', 'info');
    
    // Получаем токен от сервера (если нужен)
    let token = null;
    try {
      showStatus('🔑 Получаем токен...', 'info');
      const tokenResponse = await fetch('/agora/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelName: AGORA_CONFIG.CHANNEL,
          uid: 0,
          role: 1
        })
      });
      
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        token = tokenData.token;
        console.log('✅ Токен получен:', token ? 'Да' : 'Режим разработки');
      }
    } catch (e) {
      console.log('ℹ️ Токен не требуется или сервер недоступен');
    }
    
    // Создаем Agora клиент
    rtc.client = AgoraRTC.createClient({ 
      mode: "rtc", 
      codec: "vp8" // Лучше для мобильных устройств
    });
    
    // Обработчики событий
    setupAgoraEventHandlers();
    
    // Присоединяемся к каналу
    await rtc.client.join(
      AGORA_CONFIG.APP_ID,
      AGORA_CONFIG.CHANNEL,
      token,
      null
    );
    rtc.joined = true;
    
    // Создаем локальные треки
    await createLocalTracks();
    
    // Публикуем треки
    await rtc.client.publish([localTracks.audioTrack, localTracks.videoTrack]);
    
    // Воспроизводим локальное видео
    localTracks.videoTrack.play('localVideo');
    
    showStatus('✅ Подключен! Канал: ' + AGORA_CONFIG.CHANNEL, 'success');
    updateUI();
    
  } catch (error) {
    console.error('❌ Ошибка подключения:', error);
    showStatus('❌ Ошибка: ' + error.message, 'error');
  }
}

async function createLocalTracks() {
  try {
    // Создаем аудио трек
    localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
      encoderConfig: {
        sampleRate: RUSSIAN_MOBILE_SETTINGS.audio.sampleRate,
        stereo: RUSSIAN_MOBILE_SETTINGS.audio.stereo,
        bitrate: RUSSIAN_MOBILE_SETTINGS.audio.bitrate
      }
    });
    
    // Создаем видео трек
    localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack({
      optimizationMode: RUSSIAN_MOBILE_SETTINGS.video.optimizationMode,
      encoderConfig: RUSSIAN_MOBILE_SETTINGS.video.encoderConfig
    });
    
    console.log('✅ Локальные треки созданы');
    
  } catch (error) {
    console.error('❌ Ошибка создания треков:', error);
    throw error;
  }
}

function setupAgoraEventHandlers() {
  // Пользователь присоединился
  rtc.client.on("user-published", async (user, mediaType) => {
    console.log('👤 Пользователь присоединился:', user.uid, mediaType);
    
    // Подписываемся на пользователя
    await rtc.client.subscribe(user, mediaType);
    
    if (mediaType === 'video') {
      // Воспроизводим удаленное видео
      const remoteVideoTrack = user.videoTrack;
      remoteVideoTrack.play('remoteVideo');
      
      showStatus('✅ Собеседник подключился!', 'success');
    }
    
    if (mediaType === 'audio') {
      // Воспроизводим удаленный звук
      const remoteAudioTrack = user.audioTrack;
      remoteAudioTrack.play();
    }
  });
  
  // Пользователь отключился
  rtc.client.on("user-unpublished", (user, mediaType) => {
    console.log('👋 Пользователь отключился:', user.uid, mediaType);
    showStatus('📞 Собеседник отключился', 'info');
  });
  
  // Пользователь покинул канал
  rtc.client.on("user-left", (user) => {
    console.log('🚪 Пользователь покинул канал:', user.uid);
    showStatus('📞 Звонок завершен', 'info');
  });
  
  // Ошибки подключения
  rtc.client.on("connection-state-change", (curState, prevState) => {
    console.log('🔗 Соединение:', prevState, '->', curState);
    
    if (curState === 'DISCONNECTED') {
      showStatus('❌ Соединение потеряно', 'error');
    } else if (curState === 'CONNECTED') {
      showStatus('✅ Соединение восстановлено', 'success');
    }
  });
}

async function hangupVideoChat() {
  try {
    showStatus('🔄 Завершаем звонок...', 'info');
    
    // Останавливаем локальные треки
    if (localTracks.audioTrack) {
      localTracks.audioTrack.stop();
      localTracks.audioTrack.close();
      localTracks.audioTrack = null;
    }
    
    if (localTracks.videoTrack) {
      localTracks.videoTrack.stop();
      localTracks.videoTrack.close();
      localTracks.videoTrack = null;
    }
    
    // Покидаем канал
    if (rtc.joined && rtc.client) {
      await rtc.client.leave();
      rtc.joined = false;
    }
    
    // Очищаем видео элементы
    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;
    
    showStatus('📞 Звонок завершен', 'info');
    updateUI();
    
  } catch (error) {
    console.error('❌ Ошибка завершения звонка:', error);
    showStatus('❌ Ошибка завершения: ' + error.message, 'error');
  }
}

// ========== UI MANAGEMENT ==========
function updateUI() {
  const isActive = rtc.joined;
  
  if (startButton) startButton.disabled = isActive;
  if (hangupButton) hangupButton.disabled = !isActive;
  
  // Обновляем заголовок канала
  const channelInfo = document.getElementById('channelInfo');
  if (channelInfo && isActive) {
    channelInfo.textContent = `Канал: ${AGORA_CONFIG.CHANNEL}`;
  } else if (channelInfo) {
    channelInfo.textContent = 'Не подключен';
  }
}

function showStatus(message, type = 'info') {
  console.log(`📢 ${message}`);
  
  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.className = 'status-' + type;
    
    // Автоматически очищаем через 5 секунд для успешных сообщений
    if (type === 'success') {
      setTimeout(() => {
        if (statusDiv && statusDiv.textContent === message) {
          statusDiv.textContent = '';
          statusDiv.className = '';
        }
      }, 5000);
    }
  }
}

// ========== DIAGNOSTIC FUNCTIONS ==========
async function runAgoraDiagnostics() {
  showStatus('🔍 Запуск Agora диагностики...', 'info');
  
  const results = {
    sdk: false,
    camera: false,
    microphone: false,
    network: false
  };
  
  try {
    // Проверяем SDK
    if (AgoraRTC && AGORA_CONFIG.APP_ID && AGORA_CONFIG.APP_ID !== 'YOUR_AGORA_APP_ID_HERE') {
      results.sdk = true;
    }
    
    // Проверяем камеру
    try {
      const testVideoTrack = await AgoraRTC.createCameraVideoTrack();
      testVideoTrack.close();
      results.camera = true;
    } catch (e) {
      console.log('Камера недоступна:', e);
    }
    
    // Проверяем микрофон
    try {
      const testAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      testAudioTrack.close();
      results.microphone = true;
    } catch (e) {
      console.log('Микрофон недоступен:', e);
    }
    
    // Проверяем сеть
    results.network = navigator.onLine;
    
    // Показываем результаты
    const grade = calculateAgoraGrade(results);
    showAgoraDiagnosticResults(results, grade);
    
  } catch (error) {
    console.error('❌ Ошибка диагностики:', error);
    showStatus('❌ Ошибка диагностики: ' + error.message, 'error');
  }
}

function calculateAgoraGrade(results) {
  const total = Object.keys(results).length;
  const passed = Object.values(results).filter(r => r).length;
  const percentage = (passed / total) * 100;
  
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

function showAgoraDiagnosticResults(results, grade) {
  let message = `🎯 Agora Диагностика - Оценка: ${grade}\n`;
  message += `SDK: ${results.sdk ? '✅' : '❌'}\n`;
  message += `Камера: ${results.camera ? '✅' : '❌'}\n`;
  message += `Микрофон: ${results.microphone ? '✅' : '❌'}\n`;
  message += `Сеть: ${results.network ? '✅' : '❌'}`;
  
  console.log(message);
  showStatus(`Диагностика завершена - Оценка: ${grade}`, grade === 'F' ? 'error' : grade === 'A' ? 'success' : 'info');
}

// ========== EVENT LISTENERS ==========
document.addEventListener('DOMContentLoaded', () => {
  // Кнопки основного интерфейса
  const startBtn = document.getElementById('startButton');
  const hangupBtn = document.getElementById('hangupButton');
  const diagnosticBtn = document.getElementById('diagnosticButton');
  
  if (startBtn) startBtn.addEventListener('click', startVideoChat);
  if (hangupBtn) hangupBtn.addEventListener('click', hangupVideoChat);
  if (diagnosticBtn) diagnosticBtn.addEventListener('click', runAgoraDiagnostics);
});

// ========== UTILITY FUNCTIONS ==========
function generateChannelName() {
  return 'videochat-' + Math.random().toString(36).substr(2, 9);
}

function copyChannelToClipboard() {
  if (navigator.clipboard && AGORA_CONFIG.CHANNEL) {
    navigator.clipboard.writeText(AGORA_CONFIG.CHANNEL).then(() => {
      showStatus('📋 Название канала скопировано!', 'success');
    });
  }
}

// ========== GLOBAL ERROR HANDLING ==========
window.addEventListener('error', (event) => {
  console.error('🚨 Глобальная ошибка:', event.error);
  showStatus('❌ Системная ошибка: ' + event.error.message, 'error');
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 Необработанная ошибка Promise:', event.reason);
  showStatus('❌ Ошибка Promise: ' + event.reason, 'error');
});

console.log('🚀 VideoChat Agora Edition загружен - готов к работе!');