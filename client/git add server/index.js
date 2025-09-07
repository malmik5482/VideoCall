// VideoCall Client - основа
let localVideo = document.getElementById('localVideo');
let remoteVideo = document.getElementById('remoteVideo');
let startBtn = document.getElementById('startBtn');
let endBtn = document.getElementById('endBtn');
let status = document.getElementById('status');

let localStream = null;
let peerConnection = null;
let websocket = null;

// WebRTC конфигурация
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// WebSocket соединение
function connectWebSocket() {
  const wsUrl = `ws://${window.location.hostname}:3001`;
  websocket = new WebSocket(wsUrl);
  
  websocket.onopen = () => {
    console.log('WebSocket подключен');
    updateStatus('Подключен к серверу', 'connected');
  };
  
  websocket.onmessage = async (event) => {
    const message = JSON.parse(event.data);
    console.log('Получено сообщение:', message);
    
    switch (message.type) {
      case 'offer':
        await handleOffer(message.offer);
        break;
      case 'answer':
        await handleAnswer(message.answer);
        break;
      case 'ice-candidate':
        await handleIceCandidate(message.candidate);
        break;
    }
  };
  
  websocket.onclose = () => {
    console.log('WebSocket отключен');
    updateStatus('Отключен от сервера', 'disconnected');
  };
  
  websocket.onerror = (error) => {
    console.error('WebSocket ошибка:', error);
    updateStatus('Ошибка подключения', 'disconnected');
  };
}

// Запрос доступа к медиа устройствам
async function getUserMedia() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: true
    });
    
    localVideo.srcObject = stream;
    localStream = stream;
    
    console.log('Медиа поток получен');
    return stream;
  } catch (error) {
    console.error('Ошибка доступа к медиа:', error);
    updateStatus('Ошибка доступа к камере/микрофону', 'disconnected');
    throw error;
  }
}

// Создание RTCPeerConnection
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(configuration);
  
  // Добавление локального потока
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }
  
  // Обработка удаленного потока
  peerConnection.ontrack = (event) => {
    console.log('Получен удаленный поток');
    remoteVideo.srcObject = event.streams[0];
  };
  
  // Обработка ICE кандидатов
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({
        type: 'ice-candidate',
        candidate: event.candidate
      }));
    }
  };
  
  // Обработка изменения состояния соединения
  peerConnection.onconnectionstatechange = () => {
    console.log('Состояние соединения:', peerConnection.connectionState);
    if (peerConnection.connectionState === 'connected') {
      updateStatus('Звонок активен', 'connected');
    } else if (peerConnection.connectionState === 'disconnected') {
      updateStatus('Звонок завершен', 'disconnected');
    }
  };
}

// Создание и отправка offer
async function createOffer() {
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    websocket.send(JSON.stringify({
      type: 'offer',
      offer: offer
    }));
    
    console.log('Offer отправлен');
  } catch (error) {
    console.error('Ошибка создания offer:', error);
  }
}

// Обработка входящего offer
async function handleOffer(offer) {
  try {
    await peerConnection.setRemoteDescription(offer);
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    websocket.send(JSON.stringify({
      type: 'answer',
      answer: answer
    }));
    
    console.log('Answer отправлен');
  } catch (error) {
    console.error('Ошибка обработки offer:', error);
  }
}

// Обработка входящего answer
async function handleAnswer(answer) {
  try {
    await peerConnection.setRemoteDescription(answer);
    console.log('Answer обработан');
  } catch (error) {
    console.error('Ошибка обработки answer:', error);
  }
}

// Обработка ICE кандидата
async function handleIceCandidate(candidate) {
  try {
    await peerConnection.addIceCandidate(candidate);
    console.log('ICE кандидат добавлен');
  } catch (error) {
    console.error('Ошибка добавления ICE кандидата:', error);
  }
}

// Обновление статуса
function updateStatus(message, type) {
  status.textContent = message;
  status.className = `status-${type}`;
}

// Начало звонка
async function startCall() {
  try {
    await getUserMedia();
    createPeerConnection();
    await createOffer();
    
    startBtn.disabled = true;
    endBtn.disabled = false;
    
    updateStatus('Инициирую звонок...', 'connected');
  } catch (error) {
    console.error('Ошибка начала звонка:', error);
    updateStatus('Ошибка начала звонка', 'disconnected');
  }
}

// Завершение звонка
function endCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  
  startBtn.disabled = false;
  endBtn.disabled = true;
  
  updateStatus('Звонок завершен', 'disconnected');
}

// Обработчики событий
startBtn.addEventListener('click', startCall);
endBtn.addEventListener('click', endCall);

// Инициализация при загрузке страницы
window.addEventListener('load', () => {
  console.log('VideoCall Client инициализирован');
  connectWebSocket();
  updateStatus('Готов к подключению', 'disconnected');
});

// Обработка закрытия страницы
window.addEventListener('beforeunload', () => {
  if (websocket) {
    websocket.close();
  }
  endCall();
});
