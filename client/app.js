// ---- Polyfill для getUserMedia ----
if (!navigator.mediaDevices) navigator.mediaDevices = {};
if (!navigator.mediaDevices.getUserMedia) {
  navigator.mediaDevices.getUserMedia = function (constraints) {
    const gum = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    if (!gum) return Promise.reject(new Error('getUserMedia not supported in this browser'));
    return new Promise((resolve, reject) => gum.call(navigator, constraints, resolve, reject));
  };
}
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  console.warn('Для доступа к камере/микрофону нужен HTTPS.');
}

// ----- DOM -----
const els = {
  room: document.getElementById('room'),
  joinBtn: document.getElementById('joinBtn'),
  localVideo: document.getElementById('localVideo'),
  remoteVideo: document.getElementById('remoteVideo'),
  chatInput: document.getElementById('chatInput'),
  sendBtn: document.getElementById('sendBtn'),
};

// Автоплей/инлайн
[els.localVideo, els.remoteVideo].forEach(v => {
  v.muted = (v === els.localVideo);
  v.playsInline = true;
  v.autoplay = true;
});

let ws, pc, localStream;
let role = null; // 'caller' | 'callee'
let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

// Подтянуть ICE-конфиг с сервера
fetch('/config').then(r => r.json()).then(cfg => {
  if (cfg && Array.isArray(cfg.iceServers)) iceServers = cfg.iceServers;
}).catch(() => {});

async function startMedia() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localStream = stream;
  els.localVideo.srcObject = stream;
  try { await els.localVideo.play(); } catch {}
  console.log('Local stream tracks:', stream.getTracks().map(t=>t.kind));
  return stream;
}

function createPeer() {
  pc = new RTCPeerConnection({ iceServers });
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  pc.ontrack = async (ev) => {
    els.remoteVideo.srcObject = ev.streams[0];
    try { await els.remoteVideo.play(); } catch {}
  };
  pc.onicecandidate = (ev) => {
    if (ev.candidate) send({ type:'candidate', candidate: ev.candidate });
  };
}

function connectWs(room) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => send({ type:'join', room });
  ws.onmessage = async (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'role') {
      role = msg.role; // 'caller' | 'callee'
      console.log('Role:', role);
    } else if (msg.type === 'ready') {
      if (role === 'caller') {
        await makeOffer();
      } // callee ждёт offer
    } else if (msg.type === 'description') {
      await handleDescription(msg.sdp);
    } else if (msg.type === 'candidate') {
      await handleCandidate(msg.candidate);
    } else if (msg.type === 'peer-left') {
      console.log('Peer left');
    } else if (msg.type === 'full') {
      alert('В комнате уже 2 участника');
    }
  };
  ws.onerror = (e) => console.error('WS error', e);
  ws.onclose = () => console.log('WS closed');
}

function send(obj) {
  try { ws.send(JSON.stringify(obj)); } catch {}
}

async function makeOffer() {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  send({ type:'description', sdp: pc.localDescription });
}

async function handleDescription(desc) {
  if (desc.type === 'offer') {
    // Мы — callee: принимаем оффер, отправляем answer
    if (pc.signalingState !== 'stable') {
      try { await pc.setLocalDescription({ type:'rollback' }); } catch {}
    }
    await pc.setRemoteDescription(desc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    send({ type:'description', sdp: pc.localDescription });
  } else if (desc.type === 'answer') {
    // Мы — caller: ждём answer только после собственного offer
    if (pc.signalingState !== 'have-local-offer') {
      console.warn('Игнорируем answer в состоянии', pc.signalingState);
      return;
    }
    await pc.setRemoteDescription(desc);
  }
}

async function handleCandidate(c) {
  try {
    await pc.addIceCandidate(c);
  } catch (e) {
    console.warn('addIceCandidate error', e);
  }
}

// Кнопки
els.joinBtn.onclick = async () => {
  const room = (els.room.value || '').trim();
  if (!room) return alert('Введите код комнаты');
  await startMedia();
  createPeer();
  connectWs(room);
};

els.sendBtn.onclick = () => {
  const text = (els.chatInput.value || '').trim();
  if (!text) return;
  send({ type:'chat', text });
  els.chatInput.value = '';
};
