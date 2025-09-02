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

// ----- ЭЛЕМЕНТЫ -----
const roomInput = document.getElementById('room') || document.querySelector('input');
const joinBtn   = document.getElementById('joinBtn') || document.querySelector('button');
const localVideo  = document.getElementById('localVideo')  || document.querySelector('video#localVideo');
const remoteVideo = document.getElementById('remoteVideo') || document.querySelector('video#remoteVideo');

// Важно для автозапуска видео в браузерах
[localVideo, remoteVideo].forEach(v => { if (v) { v.muted = v === localVideo; v.playsInline = true; v.autoplay = true; } });

let ws, pc, localStream;
let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

// Подтянем ICE-конфиг с сервера (если есть)
fetch('/config').then(r => r.json()).then(cfg => {
  if (cfg && Array.isArray(cfg.iceServers)) iceServers = cfg.iceServers;
}).catch(() => {});

async function startMedia() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream = stream;
    if (localVideo) {
      localVideo.srcObject = stream;
      try { await localVideo.play(); } catch (e) { console.warn('localVideo.play() blocked until user gesture', e); }
    }
    console.log('Local stream tracks:', stream.getTracks().map(t => t.kind));
    return stream;
  } catch (e) {
    console.error('Не удалось получить доступ к камере/микрофону:', e);
    alert('Браузер не дал доступ к камере/микрофону.');
  }
}

function connectWs(room) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => ws.send(JSON.stringify({ type: 'join', room }));
  ws.onmessage = async (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'joined') {
      if (msg.peers >= 1) await makeOffer();
    } else if (msg.type === 'offer') {
      await handleOffer(msg.sdp);
    } else if (msg.type === 'answer') {
      await handleAnswer(msg.sdp);
    } else if (msg.type === 'candidate') {
      await handleCandidate(msg.candidate);
    }
  };
  ws.onerror = (e) => console.error('WS error', e);
}

function createPeer() {
  pc = new RTCPeerConnection({ iceServers });
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  pc.ontrack = async (ev) => {
    if (remoteVideo) {
      remoteVideo.srcObject = ev.streams[0];
      try { await remoteVideo.play(); } catch(e) { console.warn('remoteVideo.play() blocked', e); }
    }
  };
  pc.onicecandidate = (ev) => {
    if (ev.candidate) ws.send(JSON.stringify({ type: 'candidate', candidate: ev.candidate }));
  };
}

async function makeOffer() {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws.send(JSON.stringify({ type: 'offer', sdp: pc.localDescription }));
}
async function handleOffer(sdp) {
  await pc.setRemoteDescription(sdp);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  ws.send(JSON.stringify({ type: 'answer', sdp: pc.localDescription }));
}
async function handleAnswer(sdp) {
  await pc.setRemoteDescription(sdp);
}
async function handleCandidate(c) {
  try { await pc.addIceCandidate(c); } catch (e) { console.warn('addIceCandidate error', e); }
}

joinBtn && (joinBtn.onclick = async () => {
  const room = (roomInput && roomInput.value || '').trim();
  if (!room) return alert('Введите код комнаты');
  const stream = await startMedia();
  if (!stream) return;
  createPeer();
  connectWs(room);
});
