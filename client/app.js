// Hotfix v3: robust UI wiring + clear feedback
(() => {
  const $ = (id) => document.getElementById(id);
  const myPhone = $("myPhone");
  const myName  = $("myName");
  const registerBtn = $("registerBtn");
  const searchPhone = $("searchPhone");
  const searchBtn   = $("searchBtn");
  const results = $("results");
  const roomInp = $("room");
  const joinBtn = $("joinBtn");
  const leaveBtn = $("leaveBtn");
  const chatInput = $("chatInput");
  const sendBtn = $("sendBtn");
  const localVideo = $("localVideo");
  const remoteVideo = $("remoteVideo");
  const meInfo = $("meInfo");
  const historyList = $("historyList");

  const log = (...a) => { console.log(...a); };
  const uiError = (msg) => { console.error(msg); alert(msg); };

  let ws = null;
  let pc = null;
  let localStream = null;
  let currentRoom = null;
  let role = "guest";

  // Restore profile from localStorage
  try {
    const prof = JSON.parse(localStorage.getItem("profile")||"null");
    if (prof) { myPhone.value = prof.phone || ""; myName.value = prof.name || ""; meInfo.innerText = `Профиль: ${prof.name} (${prof.phone})`; }
  } catch {}

  // --- Helpers ---
  async function api(path, opts={}) {
    const res = await fetch(path, { headers: { "Content-Type":"application/json" }, ...opts });
    if (!res.ok) throw new Error(`API ${path} => ${res.status}`);
    return res.json();
  }
  async function getConfig() {
    try {
      const cfg = await api("/config");
      if (!cfg || !Array.isArray(cfg.iceServers)) return { iceServers: [{urls:"stun:stun.l.google.com:19302"}] };
      return cfg;
    } catch {
      return { iceServers: [{urls:"stun:stun.l.google.com:19302"}] };
    }
  }
  function renderHistory(items=[]) {
    historyList.innerHTML = "";
    for (const it of items.slice().reverse()) {
      const div = document.createElement("div");
      const dur = it.durationSec ? `${it.durationSec}s` : "в процессе";
      div.className = "item";
      div.textContent = `Комната: ${it.room} • начат: ${new Date(it.startedAt).toLocaleString()} • длительность: ${dur} • макс участников: ${it.participantsMax}`;
      historyList.appendChild(div);
    }
  }
  async function refreshHistory() {
    try {
      const list = await api("/history");
      renderHistory(list);
    } catch (e) { console.warn("history:", e.message); }
  }
  refreshHistory();
  setInterval(refreshHistory, 10000);

  // --- Media ---
  async function ensureLocalMedia() {
    if (localStream) return localStream;
    const constraints = {
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: {
        width: { ideal: 1920 }, height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 60 }
      }
    };
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    localVideo.srcObject = localStream;
    log("Local stream tracks:", localStream.getTracks().map(t=>t.kind));
    return localStream;
  }

  function closePc() {
    try { pc?.getSenders()?.forEach(s=>s.track && s.track.stop && s.track.stop()); } catch {}
    try { pc?.close(); } catch {}
    pc = null;
  }
  function closeWs() { try { ws?.close(); } catch {} ws = null; }

  async function createPc() {
    const cfg = await getConfig();
    pc = new RTCPeerConnection(cfg);
    pc.onicecandidate = (e) => {
      if (e.candidate && ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type:"candidate", candidate: e.candidate }));
      }
    };
    pc.ontrack = (e) => { remoteVideo.srcObject = e.streams[0]; };
    pc.onconnectionstatechange = () => { log("pc state:", pc.connectionState); };
    const stream = await ensureLocalMedia();
    for (const track of stream.getTracks()) pc.addTrack(track, stream);
    // try bump bitrate
    try {
      const senders = pc.getSenders().filter(s=>s.track && s.track.kind==="video");
      for (const s of senders) {
        const p = s.getParameters(); p.encodings = [{ maxBitrate: 8_000_000 }]; await s.setParameters(p);
      }
    } catch {}
  }

  // --- WebSocket signaling ---
  function connectWs(room) {
    return new Promise((resolve, reject) => {
      const url = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws";
      ws = new WebSocket(url);
      ws.onopen = () => { ws.send(JSON.stringify({ type:"join", room })); resolve(); };
      ws.onerror = (e) => reject(new Error("WS error"));
      ws.onclose = () => { log("WS closed"); };
      ws.onmessage = async (ev) => {
        let msg; try { msg = JSON.parse(ev.data); } catch { return; }
        // role
        if (msg.type === "role") { role = msg.role; log("role:", role); return; }
        if (msg.type === "full") { uiError("Комната уже полная"); return; }
        if (msg.type === "ready") { // callee joined, let caller offer
          if (role === "caller") {
            await ensureLocalMedia();
            if (!pc) await createPc();
            const offer = await pc.createOffer({ iceRestart: false, offerToReceiveVideo: true, offerToReceiveAudio: true });
            await pc.setLocalDescription(offer);
            ws.send(JSON.stringify({ type:"description", sdp: pc.localDescription }));
          }
          return;
        }
        if (msg.type === "peer-left") { log("peer left"); return; }
        if (msg.type === "bye") { return; }

        if (msg.type === "description") {
          if (!pc) await createPc();
          const desc = new RTCSessionDescription(msg.sdp);
          if (desc.type === "offer") {
            await pc.setRemoteDescription(desc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type:"description", sdp: pc.localDescription }));
          } else if (desc.type === "answer") {
            if (pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(desc);
            }
          }
          return;
        }
        if (msg.type === "candidate") {
          try { await pc?.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch (e) { console.warn("addIceCandidate", e); }
          return;
        }
        if (msg.type === "chat") {
          console.log("chat:", msg.text);
          return;
        }
      };
    });
  }

  // --- UI actions ---
  registerBtn.addEventListener("click", async () => {
    try {
      const phone = (myPhone.value||"").replace(/\D+/g,"");
      const name  = (myName.value||"").trim();
      if (!phone || !name) return uiError("Введите телефон и имя");
      const res = await api("/api/register", { method:"POST", body: JSON.stringify({ phone, name }) });
      localStorage.setItem("profile", JSON.stringify({ phone: res.user.phone, name: res.user.name }));
      meInfo.innerText = `Профиль: ${res.user.name} (${res.user.phone})`;
      alert("Профиль сохранён");
    } catch (e) { uiError("Ошибка регистрации: " + e.message); }
  });

  searchBtn.addEventListener("click", async () => {
    try {
      const phone = (searchPhone.value||"").replace(/\D+/g,"");
      const list = await api("/api/users?phone=" + encodeURIComponent(phone));
      results.innerHTML = "";
      list.forEach(u => {
        const row = document.createElement("div");
        row.className = "user";
        row.innerHTML = `<div>${u.name} — ${u.phone}</div><button data-p="${u.phone}">Позвонить</button>`;
        row.querySelector("button").onclick = async () => {
          const me = (myPhone.value||"").replace(/\D+/g,"");
          if (!me) return uiError("Сначала сохраните профиль");
          const r = await api("/api/call/start", { method:"POST", body: JSON.stringify({ me, target: u.phone }) });
          roomInp.value = r.roomId;
          joinBtn.click();
        };
        results.appendChild(row);
      });
      if (!list.length) results.innerHTML = "<div class='small'>Ничего не найдено</div>";
    } catch (e) { uiError("Ошибка поиска: "+e.message); }
  });

  joinBtn.addEventListener("click", async () => {
    try {
      const r = roomInp.value.trim() || "demo";
      if (currentRoom) return uiError("Вы уже в комнате");
      await ensureLocalMedia();
      await connectWs(r);
      currentRoom = r;
      joinBtn.disabled = true;
      leaveBtn.disabled = false;
      // Если нам выдали роль callee, мы ждём offer; если caller — создадим offer по событию 'ready'.
      alert("Подключились к комнате: " + r + ". Откройте вторую вкладку и подключитесь тем же кодом.");
    } catch (e) { uiError("Не удалось подключиться: " + e.message); closeWs(); closePc(); currentRoom = null; }
  });

  leaveBtn.addEventListener("click", () => {
    try { ws?.send(JSON.stringify({ type: "leave" })); } catch {}
    closePc(); closeWs();
    currentRoom = null;
    joinBtn.disabled = false;
    leaveBtn.disabled = true;
    remoteVideo.srcObject = null;
  });

  sendBtn.addEventListener("click", () => {
    const text = (chatInput.value||"").trim();
    if (!text) return;
    try { ws?.send(JSON.stringify({ type:"chat", text })); } catch {}
    chatInput.value = "";
  });

  window.addEventListener("beforeunload", () => {
    try { ws?.send(JSON.stringify({ type: "leave" })); } catch {}
    closePc(); closeWs();
  });
})(); 
