// ==== MAX QUALITY + ADAPTIVE ====

// Polyfill
if (!navigator.mediaDevices) navigator.mediaDevices = {};
if (!navigator.mediaDevices.getUserMedia) {
  navigator.mediaDevices.getUserMedia = function (constraints) {
    const gum = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    if (!gum) return Promise.reject(new Error('getUserMedia not supported'));
    return new Promise((resolve, reject) => gum.call(navigator, constraints, resolve, reject));
  };
}
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  console.warn('Use HTTPS to access camera/mic with full quality.');
}

// ---- Target quality ----
const TARGETS = {
  // 1080p60, allow up to 4K60 if доступно
  videoConstraints: {
    width: { ideal: 1920, max: 3840 },
    height:{ ideal: 1080, max: 2160 },
    frameRate: { ideal: 60, max: 60 }
  },
  audioConstraints: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: false
  },
  startVideoBitrate: 3_000_000,   // старт 3 Мбит/с
  maxVideoBitrate:   8_000_000,   // потолок 8 Мбит/с
  minVideoBitrate:     600_000,   // нижняя граница
  audioBitrate:        128_000    // целевой битрейт OPUS
};

// DOM
const $ = (s)=>document.querySelector(s);
const els = {
  room: $('#room'),
  joinBtn: $('#joinBtn'),
  leaveBtn: $('#leaveBtn'),
  localVideo: $('#localVideo'),
  remoteVideo: $('#remoteVideo')
};
[els.localVideo, els.remoteVideo].forEach(v=>{ v.muted = v===els.localVideo; v.playsInline = true; v.autoplay = true; });

let ws, pc, localStream, abrTimer;
let role = null;
let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

fetch('/config').then(r=>r.json()).then(cfg=>{ if (cfg && Array.isArray(cfg.iceServers)) iceServers = cfg.iceServers; }).catch(()=>{});

// ---- Media ----
async function startMedia() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: TARGETS.videoConstraints,
    audio: TARGETS.audioConstraints
  });
  const [videoTrack] = stream.getVideoTracks();
  if (videoTrack && 'contentHint' in videoTrack) videoTrack.contentHint = 'motion';
  localStream = stream;
  els.localVideo.srcObject = stream;
  try { await els.localVideo.play(); } catch {}
  return stream;
}
function stopMedia() {
  if (localStream) localStream.getTracks().forEach(t=>t.stop());
  localStream=null;
  els.localVideo.srcObject = null;
  els.remoteVideo.srcObject = null;
}

// ---- Peer ----
function createPeer() {
  pc = new RTCPeerConnection({ iceServers });
  localStream.getTracks().forEach(t=>pc.addTrack(t, localStream));

  // Настройка отправителей: высокий битрейт + предпочтение кодеков
  setTimeout(()=>{
    pc.getSenders().forEach(s=>{
      if (!s.track) return;
      const p = s.getParameters() || {};
      p.encodings = p.encodings || [{}];
      if (s.track.kind === 'video') {
        p.encodings[0].maxBitrate = TARGETS.startVideoBitrate;
        // держать разрешение, если можно
        if ('degradationPreference' in p) p.degradationPreference = 'maintain-resolution';
      } else if (s.track.kind === 'audio') {
        p.encodings[0].maxBitrate = TARGETS.audioBitrate;
      }
      s.setParameters(p).catch(()=>{});
    });

    try {
      // Предпочесть H264 или VP9 (мн. устройств легче даётся H264)
      const caps = RTCRtpSender.getCapabilities('video');
      if (caps && pc.getTransceivers) {
        const tx = pc.getTransceivers().find(t => t.sender?.track?.kind === 'video');
        if (tx?.setCodecPreferences) {
          const preferred = caps.codecs.filter(c =>
            /H264|VP9/i.test(c.mimeType) && !/rtx/i.test(c.mimeType));
          if (preferred.length) tx.setCodecPreferences(preferred);
        }
      }
    } catch {}
  },0);

  pc.ontrack = async (ev)=>{
    els.remoteVideo.srcObject = ev.streams[0];
    try { await els.remoteVideo.play(); } catch {}
  };
  pc.onicecandidate = (ev)=>{ if (ev.candidate) send({type:'candidate', candidate:ev.candidate}); };
  pc.onconnectionstatechange = ()=>{
    if (pc.connectionState === 'failed') pc.restartIce();
  };
}

// ---- WebSocket ----
function connectWs(room){
  const proto = location.protocol === 'https:' ? 'wss':'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = ()=> send({type:'join', room});
  ws.onmessage = async (e)=>{
    const msg = JSON.parse(e.data);
    if (msg.type==='role') role = msg.role;
    else if (msg.type==='ready') { if (role==='caller') await makeOffer(); }
    else if (msg.type==='description') await handleDescription(msg.sdp);
    else if (msg.type==='candidate') await handleCandidate(msg.candidate);
  };
}

// ---- SDP munging: поднять OPUS битрейт ----
function sdpTuneOpus(sdp, maxAvgBitrate = TARGETS.audioBitrate) {
  return sdp.replace(/a=fmtp:(\d+) (.*)/g, (m, pt, params) => {
    if (!/useinbandfec|stereo|maxaveragebitrate/.test(params)) {
      return `a=fmtp:${pt} stereo=1;maxaveragebitrate=${maxAvgBitrate};useinbandfec=1`;
    }
    params = params.replace(/maxaveragebitrate=\d+/,'').replace(/\s*;/g,';').replace(/;;+/g,';');
    return `a=fmtp:${pt} stereo=1;useinbandfec=1;maxaveragebitrate=${maxAvgBitrate};${params}`;
  });
}

// ---- Offer/Answer ----
async function makeOffer(){
  let offer = await pc.createOffer({ offerToReceiveAudio:true, offerToReceiveVideo:true });
  // Поднятие OPUS битрейта через SDP munging
  offer.sdp = sdpTuneOpus(offer.sdp);
  await pc.setLocalDescription(offer);
  send({type:'description', sdp: pc.localDescription});
  startABR(); // запустить адаптер после старта сессии
}
async function handleDescription(desc){
  if (desc.type==='offer'){
    if (pc.signalingState!=='stable'){
      try { await pc.setLocalDescription({type:'rollback'});} catch{}
    }
    await pc.setRemoteDescription(desc);
    let answer = await pc.createAnswer();
    answer.sdp = sdpTuneOpus(answer.sdp);
    await pc.setLocalDescription(answer);
    send({type:'description', sdp: pc.localDescription});
    startABR();
  } else if (desc.type==='answer'){
    if (pc.signalingState!=='have-local-offer'){ console.warn('Ignore answer in', pc.signalingState); return; }
    await pc.setRemoteDescription(desc);
  }
}
async function handleCandidate(c){
  try { await pc.addIceCandidate(c); } catch(e){ console.warn('addIceCandidate', e); }
}

// ---- Простая адаптация битрейта по сети ----
function startABR(){
  stopABR();
  abrTimer = setInterval(async ()=>{
    if (!pc) return;
    try {
      const senders = pc.getSenders().filter(s=>s.track && s.track.kind==='video');
      for (const s of senders){
        const stats = await s.getStats();
        let loss = 0, rtt = 0;
        stats.forEach(rep=>{
          if (rep.type==='outbound-rtp' && !rep.isRemote) {
            if (rep.packetsSent && rep.packetsLost!=null) loss = (rep.packetsLost/(rep.packetsSent+rep.packetsLost))*100;
            if (rep.roundTripTime) rtt = rep.roundTripTime*1000;
          }
        });
        const p = s.getParameters() || {};
        p.encodings = p.encodings || [{}];
        const cur = p.encodings[0].maxBitrate || TARGETS.startVideoBitrate;
        let next = cur;
        if (loss > 5 || rtt > 250)       next = Math.max(TARGETS.minVideoBitrate, Math.floor(cur*0.7));
        else if (loss < 1 && rtt < 120)  next = Math.min(TARGETS.maxVideoBitrate, Math.floor(cur*1.2));
        if (next !== cur){
          p.encodings[0].maxBitrate = next;
          await s.setParameters(p).catch(()=>{});
        }
      }
    } catch {}
  }, 3000);
}
function stopABR(){ if (abrTimer) clearInterval(abrTimer); abrTimer=null; }

// ---- Utils ----
function send(o){ try{ ws && ws.send(JSON.stringify(o)); }catch{} }

// ---- Join/Leave ----
async function join(room){
  await startMedia();
  createPeer();
  connectWs(room);
}
function leave(){
  try{ send({type:'leave'});}catch{}
  try{ ws && ws.close(); }catch{}
  try{ pc && pc.close(); }catch{}
  stopABR();
  stopMedia();
}

// Export hooks for existing buttons
window.joinMaxQuality = async function(){
  const room = (els.room.value||'').trim();
  if (!room) return alert('Введите код комнаты');
  els.joinBtn.disabled = true;
  await join(room);
  els.leaveBtn.disabled = false;
};
window.leaveCall = function(){
  leave();
  els.joinBtn.disabled = false;
  els.leaveBtn.disabled = true;
};
