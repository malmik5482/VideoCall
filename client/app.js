// ==== Регистрация по телефону, поиск, звонки, история, join/leave ====
// + WebRTC с высоким качеством и автоадаптацией под сеть

if (!navigator.mediaDevices) navigator.mediaDevices = {};
if (!navigator.mediaDevices.getUserMedia) {
  navigator.mediaDevices.getUserMedia = function (constraints) {
    const gum = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    if (!gum) return Promise.reject(new Error('getUserMedia not supported'));
    return new Promise((resolve, reject) => gum.call(navigator, constraints, resolve, reject));
  };
}
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  console.warn('Для доступа к камере/микрофону нужен HTTPS.');
}

const TARGETS = {
  video: { width:{ ideal:1920, max:3840 }, height:{ ideal:1080, max:2160 }, frameRate:{ ideal:60, max:60 } },
  audio: { echoCancellation:true, noiseSuppression:true, autoGainControl:false },
  startVideoBitrate: 3_000_000, maxVideoBitrate: 8_000_000, minVideoBitrate: 600_000, audioBitrate:128_000
};

const $ = (s)=>document.querySelector(s);
const els = {
  myPhone: $('#myPhone'), myName: $('#myName'), registerBtn: $('#registerBtn'), meInfo: $('#meInfo'),
  searchPhone: $('#searchPhone'), searchBtn: $('#searchBtn'), results: $('#results'),
  room: $('#room'), joinBtn: $('#joinBtn'), leaveBtn: $('#leaveBtn'),
  localVideo: $('#localVideo'), remoteVideo: $('#remoteVideo'),
  chatInput: $('#chatInput'), sendBtn: $('#sendBtn'),
  historyList: $('#historyList')
};

[els.localVideo, els.remoteVideo].forEach(v=>{ v.muted = v===els.localVideo; v.playsInline = true; v.autoplay = true; });

let ws, pc, localStream, abrTimer, role=null, iceServers=[{ urls: 'stun:stun.l.google.com:19302' }];

fetch('/config').then(r=>r.json()).then(cfg=>{ if (cfg && Array.isArray(cfg.iceServers)) iceServers = cfg.iceServers; }).catch(()=>{});

function normPhone(s){ return String(s||'').replace(/\D+/g,''); }
function loadProfile(){ try{ const p=JSON.parse(localStorage.getItem('profile')||'{}'); els.myPhone.value=p.phone||''; els.myName.value=p.name||''; showMeInfo(); }catch{} }
function saveProfile(phone, name){ localStorage.setItem('profile', JSON.stringify({ phone, name })); showMeInfo(); }
function showMeInfo(){ const p=JSON.parse(localStorage.getItem('profile')||'{}'); els.meInfo.textContent = p.phone?`Ваш профиль: ${p.name||''} +${p.phone}`:'Профиль не задан'; }
loadProfile();

els.registerBtn.onclick = async () => {
  const phone = normPhone(els.myPhone.value);
  const name  = String(els.myName.value||'').trim();
  if (!phone || !name) return alert('Укажите номер и имя');
  const res = await fetch('/api/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ phone, name }) });
  const data = await res.json();
  if (data && data.ok) { saveProfile(phone, name); alert('Профиль сохранён'); } else alert('Ошибка регистрации');
};

els.searchBtn.onclick = async () => {
  const q = normPhone(els.searchPhone.value);
  const res = await fetch('/api/users?phone=' + encodeURIComponent(q));
  const list = await res.json();
  els.results.innerHTML = list.map(u => (
    `<div class="user"><div><b>${u.name}</b><br/>+${u.phone}</div><button data-phone="${u.phone}" class="callBtn">Позвонить</button></div>`
  )).join('');
  document.querySelectorAll('.callBtn').forEach(btn => btn.onclick = async () => {
    const target = btn.getAttribute('data-phone');
    const mePhone = normPhone(els.myPhone.value);
    if (!mePhone) return alert('Сначала сохраните свой профиль (номер телефона)');
    const res = await fetch('/api/call/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ me: mePhone, target }) });
    const { roomId } = await res.json();
    els.room.value = roomId;
    els.joinBtn.click();
  });
});

async function startMedia(){
  const stream = await navigator.mediaDevices.getUserMedia({ video: TARGETS.video, audio: TARGETS.audio });
  const [vt] = stream.getVideoTracks();
  if (vt && 'contentHint' in vt) vt.contentHint = 'motion';
  localStream = stream;
  els.localVideo.srcObject = stream;
  try { await els.localVideo.play(); } catch {}
  return stream;
}
function stopMedia(){ if (localStream) localStream.getTracks().forEach(t=>t.stop()); localStream=null; els.localVideo.srcObject=null; els.remoteVideo.srcObject=null; }

function createPeer(){
  pc = new RTCPeerConnection({ iceServers });
  if (localStream) localStream.getTracks().forEach(t=>pc.addTrack(t, localStream));

  setTimeout(()=>{
    pc.getSenders().forEach(s=>{
      if (!s.track) return;
      const p = s.getParameters() || {}; p.encodings = p.encodings || [{}];
      if (s.track.kind==='video') { p.encodings[0].maxBitrate = TARGETS.startVideoBitrate; if ('degradationPreference' in p) p.degradationPreference='maintain-resolution'; }
      else if (s.track.kind==='audio') { p.encodings[0].maxBitrate = TARGETS.audioBitrate; }
      s.setParameters(p).catch(()=>{});
    });
  },0);

  pc.ontrack = async (ev)=>{ els.remoteVideo.srcObject = ev.streams[0]; try { await els.remoteVideo.play(); } catch {} };
  pc.onicecandidate = (ev)=>{ if (ev.candidate) send({ type:'candidate', candidate: ev.candidate }); };
  pc.onconnectionstatechange = ()=>{ if (pc.connectionState==='failed') pc.restartIce(); };
}

function connectWs(room){
  const proto = location.protocol === 'https:' ? 'wss':'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = ()=> send({ type:'join', room });
  ws.onmessage = async (e)=>{
    const msg = JSON.parse(e.data);
    if (msg.type==='role') role=msg.role;
    else if (msg.type==='ready'){ if (role==='caller') await makeOffer(); }
    else if (msg.type==='description'){ await handleDescription(msg.sdp); }
    else if (msg.type==='candidate'){ await handleCandidate(msg.candidate); }
  };
}

function sdpTuneOpus(sdp, maxAvgBitrate = TARGETS.audioBitrate) {
  return sdp.replace(/a=fmtp:(\d+) (.*)/g, (m, pt, params) => {
    if (!/useinbandfec|stereo|maxaveragebitrate/.test(params)) {
      return `a=fmtp:${pt} stereo=1;maxaveragebitrate=${maxAvgBitrate};useinbandfec=1`;
    }
    params = params.replace(/maxaveragebitrate=\d+/,'').replace(/\s*;/g,';').replace(/;;+/g,';');
    return `a=fmtp:${pt} stereo=1;useinbandfec=1;maxaveragebitrate=${maxAvgBitrate};${params}`;
  });
}

async function makeOffer(){
  let offer = await pc.createOffer({ offerToReceiveAudio:true, offerToReceiveVideo:true });
  offer.sdp = sdpTuneOpus(offer.sdp);
  await pc.setLocalDescription(offer);
  send({ type:'description', sdp: pc.localDescription });
  startABR();
}
async function handleDescription(desc){
  if (desc.type==='offer'){
    if (pc.signalingState!=='stable'){ try { await pc.setLocalDescription({ type:'rollback' }); } catch {} }
    await pc.setRemoteDescription(desc);
    let answer = await pc.createAnswer();
    answer.sdp = sdpTuneOpus(answer.sdp);
    await pc.setLocalDescription(answer);
    send({ type:'description', sdp: pc.localDescription });
    startABR();
  } else if (desc.type==='answer'){
    if (pc.signalingState!=='have-local-offer'){ console.warn('Ignore answer in', pc.signalingState); return; }
    await pc.setRemoteDescription(desc);
  }
}
async function handleCandidate(c){ try { await pc.addIceCandidate(c); } catch (e) { console.warn('addIceCandidate', e); } }

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
        const p = s.getParameters() || {}; p.encodings = p.encodings || [{}];
        const cur = p.encodings[0].maxBitrate || TARGETS.startVideoBitrate;
        let next = cur;
        if (loss > 5 || rtt > 250)       next = Math.max(TARGETS.minVideoBitrate, Math.floor(cur*0.7));
        else if (loss < 1 && rtt < 120)  next = Math.min(TARGETS.maxVideoBitrate, Math.floor(cur*1.2));
        if (next !== cur){ p.encodings[0].maxBitrate = next; await s.setParameters(p).catch(()=>{}); }
      }
    } catch {}
  }, 3000);
}
function stopABR(){ if (abrTimer) clearInterval(abrTimer); abrTimer=null; }

els.joinBtn.onclick = async () => {
  const room = (els.room.value || '').trim();
  if (!room) return alert('Введите код комнаты (или позвоните пользователю через поиск)');
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
  stopABR();
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

async function loadHistory(){
  const res = await fetch('/history'); const data = await res.json();
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
loadHistory();

function send(obj){ if (ws && ws.readyState===1) ws.send(JSON.stringify(obj)); }
