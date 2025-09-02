// ---- Полифилл getUserMedia ----
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

// ---- Константы качества ----
const VIDEO_CONSTRAINTS = {
  width: { ideal: 1280, min: 640, max: 1920 },
  height:{ ideal: 720,  min: 360, max: 1080 },
  frameRate: { ideal: 30, max: 60 }
};
const AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
};

// ---- DOM ----
const qs = (s) => document.querySelector(s);
const els = {
  room: qs('#room'),
  joinBtn: qs('#joinBtn'),
  leaveBtn: qs('#leaveBtn'),
  localVideo: qs('#localVideo'),
  remoteVideo: qs('#remoteVideo'),
  chatInput: qs('#chatInput'),
  sendBtn: qs('#sendBtn'),
  qualityHD: qs('#qualityHD'),
  qualityLite: qs('#qualityLite'),
  historyList: qs('#historyList'),
  refreshHistory: qs('#refreshHistory')
};

[els.localVideo, els.remoteVideo].forEach(v => {
  v.muted = (v === els.localVideo);
  v.playsInline = true;
  v.autoplay = true;
});

let ws, pc, localStream;
let role = null;
let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

// Подтянуть ICE‑конфиг с сервера
fetch('/config').then(r => r.json()).then(cfg => {
  if (cfg && Array.isArray(cfg.iceServers)) iceServers = cfg.iceServers;
}).catch(() => {});

// ---- Media ----
async function startMedia() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: VIDEO_CONSTRAINTS,
    audio: AUDIO_CONSTRAINTS
  });
  const [videoTrack] = stream.getVideoTracks();
  if (videoTrack && 'contentHint' in videoTrack) videoTrack.contentHint = 'motion';

  localStream = stream;
  els.localVideo.srcObject = stream;
  try { await els.localVideo.play(); } catch {}
  console.log('Local stream tracks:', stream.getTracks().map(t=>t.kind));
  return stream;
}

function stopMedia() {
  if (localStream) localStream.getTracks().forEach(t => t.stop());
  localStream = null;
  els.localVideo.srcObject = null;
  els.remoteVideo.srcObject = null;
}

// ---- Peer ----
function createPeer() {
  pc = new RTCPeerConnection({ iceServers });
  if (localStream) localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  // Поднять битрейт видео и настроить кодеки
  setTimeout(() => {
    pc.getSenders().forEach(s => {
      if (!s.track) return;
      const p = s.getParameters() || {};
      p.encodings = p.encodings || [{}];
      if (s.track.kind === 'video') {
        // потолок битрейта 2.5 Мбит/с
        p.encodings[0].maxBitrate = 2_500_000;
        // предпочтение стабильности кадров
        if ('degradationPreference' in p) p.degradationPreference = 'maintain-framerate';
      } else if (s.track.kind === 'audio') {
        // умеренный битрейт аудио (не везде поддерживается, но не мешает)
        p.encodings[0].maxBitrate = 64_000;
      }
      s.setParameters(p).catch(()=>{});
    });

    // Попробовать предпочесть VP9/H264
    try {
      const caps = RTCRtpSender.getCapabilities('video');
      if (caps && pc.getTransceivers) {
        const tx = pc.getTransceivers().find(t => t.sender?.track?.kind === 'video');
        if (tx && tx.setCodecPreferences) {
          const preferred = caps.codecs.filter(c =>
            /VP9|H264/i.test(c.mimeType) && !/rtx/i.test(c.mimeType)
          );
          if (preferred.length) tx.setCodecPreferences(preferred);
        }
      }
    } catch {}
  }, 0);

  pc.ontrack = async (ev) => {
    els.remoteVideo.srcObject = ev.streams[0];
    try { await els.remoteVideo.play(); } catch {}
  };
  pc.onicecandidate = (ev) => { if (ev.candidate) send({ type:'candidate', candidate: ev.candidate }); };
  pc.onconnectionstatechange = () => {
    console.log('pc.state =', pc.connectionState);
    if (pc.connectionState === 'failed') {
      // Перезапуск ICE — помогает при временных проблемах сети
      pc.restartIce();
    }
  };
}

// ---- WS ----
function connectWs(room) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => send({ type:'join', room });
  ws.onmessage = async (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'role') {
      role = msg.role;
      console.log('Role:', role);
    } else if (msg.type === 'ready') {
      if (role === 'caller') await makeOffer();
    } else if (msg.type === 'description') {
      await handleDescription(msg.sdp);
    } else if (msg.type === 'candidate') {
      await handleCandidate(msg.candidate);
    } else if (msg.type === 'peer-left') {
      console.log('Peer left');
    } else if (msg.type === 'bye') {
      console.log('Server bye');
    } else if (msg.type === 'full') {
      alert('В комнате уже 2 участника');
    }
  };
  ws.onerror = (e) => console.error('WS error', e);
  ws.onclose = () => console.log('WS closed');
}
function send(obj) { try { ws && ws.send(JSON.stringify(obj)); } catch {} }

// ---- SDP / ICE ----
async function makeOffer() {
  const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
  await pc.setLocalDescription(offer);
  send({ type:'description', sdp: pc.localDescription });
}
async function handleDescription(desc) {
  if (desc.type === 'offer') {
    if (pc.signalingState !== 'stable') {
      try { await pc.setLocalDescription({ type:'rollback' }); } catch {}
    }
    await pc.setRemoteDescription(desc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    send({ type:'description', sdp: pc.localDescription });
  } else if (desc.type === 'answer') {
    if (pc.signalingState !== 'have-local-offer') {
      console.warn('Игнорируем answer в состоянии', pc.signalingState);
      return;
    }
    await pc.setRemoteDescription(desc);
  }
}
async function handleCandidate(c) {
  try { await pc.addIceCandidate(c); } catch (e) { console.warn('addIceCandidate error', e); }
}

// ---- История ----
async function loadHistory() {
  const res = await fetch('/history');
  const data = await res.json();
  els.historyList.innerHTML = data.slice().reverse().map(item => {
    const start = new Date(item.startedAt).toLocaleString();
    const end = item.endedAt ? new Date(item.endedAt).toLocaleString() : 'идёт';
    const dur = item.durationSec ? (item.durationSec+' сек') : '—';
    return `<div class="item">
      <div><b>Комната:</b> ${item.room}</div>
      <div><b>Начало:</b> ${start}</div>
      <div><b>Окончание:</b> ${end}</div>
      <div><b>Длительность:</b> ${dur}</div>
      <div><b>Участников макс:</b> ${item.participantsMax}</div>
    </div>`;
  }).join('');
}

// ---- Кнопки ----
els.joinBtn.onclick = async () => {
  const room = (els.room.value || '').trim();
  if (!room) return alert('Введите код комнаты');
  els.joinBtn.disabled = true;
  await startMedia();
  createPeer();
  connectWs(room);
  els.leaveBtn.disabled = false;
};
els.leaveBtn.onclick = () => {
  try { send({ type:'leave' }); } catch {}
  try { ws && ws.close(); } catch {}
  try { pc && pc.close(); } catch {}
  stopMedia();
  els.joinBtn.disabled = false;
  els.leaveBtn.disabled = true;
  loadHistory();
};
els.sendBtn.onclick = () => {
  const text = (els.chatInput.value || '').trim();
  if (!text) return;
  send({ type:'chat', text });
  els.chatInput.value = '';
};
els.qualityHD.onclick = async () => await setQuality(2_500_000);
els.qualityLite.onclick = async () => await setQuality(600_000);
els.refreshHistory.onclick = () => loadHistory();

async function setQuality(bitrate) {
  if (!pc) return;
  pc.getSenders().forEach(s => {
    if (s.track?.kind === 'video') {
      const p = s.getParameters() || {};
      p.encodings = p.encodings || [{}];
      p.encodings[0].maxBitrate = bitrate;
      s.setParameters(p).catch(()=>{});
    }
  });
}

// Загрузить историю при открытии
loadHistory();
