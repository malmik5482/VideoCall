// ---- Polyfill for getUserMedia (for older browsers) ----
if (!navigator.mediaDevices) navigator.mediaDevices = {};
if (!navigator.mediaDevices.getUserMedia) {
  navigator.mediaDevices.getUserMedia = function (constraints) {
    const getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    if (!getUserMedia) {
      return Promise.reject(new Error('getUserMedia not supported in this browser'));
    }
    return new Promise((resolve, reject) =>
      getUserMedia.call(navigator, constraints, resolve, reject)
    );
  };
}
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  console.warn('Для доступа к камере/микрофону нужен HTTPS.');
}
// --------------------------------------------------------

const els = {
  room: document.getElementById('room') || document.querySelector('input'),
  joinBtn: document.getElementById('joinBtn') || document.querySelector('button'),
  localVideo: document.getElementById('localVideo') || document.querySelector('video#localVideo'),
  remoteVideo: document.getElementById('remoteVideo') || document.querySelector('video#remoteVideo'),
};

let pc, ws, localStream;
let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

fetch('/config').then(r => r.json()).then(cfg => {
  if (cfg && Array.isArray(cfg.iceServers)) iceServers = cfg.iceServers;
}).catch(()=>{});

async function startMedia() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  if (els.localVideo) els.localVideo.srcObject = stream;
  return stream;
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
}

function createPeer() {
  pc = new RTCPeerConnection({ iceServers });
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  pc.ontrack = (ev) => { if (els.remoteVideo) els.remoteVideo.srcObject = ev.streams[0]; };
  pc.onicecandidate = (ev) => { if (ev.candidate) ws.send(JSON.stringify({ type: 'candidate', candidate: ev.candidate })); };
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
async function handleAnswer(sdp) { await pc.setRemoteDescription(sdp); }
async function handleCandidate(c) { try { await pc.addIceCandidate(c); } catch {} }

(els.joinBtn || {}).onclick = async () => {
  const room = (els.room && els.room.value || '').trim();
  if (!room) return alert('Введите код комнаты');
  localStream = await startMedia();
  createPeer();
  connectWs(room);
};
