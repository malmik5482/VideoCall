(() => {
  const $ = id => document.getElementById(id);
  const roomInp = $("room");
  const joinBtn = $("joinBtn");
  const leaveBtn = $("leaveBtn");
  const chatInput = $("chatInput");
  const sendBtn = $("sendBtn");
  const localVideo = $("localVideo");
  const remoteVideo = $("remoteVideo");
  const historyList = $("historyList");

  let ws = null, pc = null, localStream = null, currentRoom = null, role = "guest";

  const uiErr = (m) => { console.error(m); alert(m); };

  async function api(path){
    const r = await fetch(path);
    if(!r.ok) throw new Error(path+" -> "+r.status);
    return r.json();
  }
  async function getIce(){
    try {
      const cfg = await api("/config");
      if(cfg && Array.isArray(cfg.iceServers)) return cfg;
    } catch {}
    return { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
  }
  function renderHistory(items){
    historyList.innerHTML="";
    (items||[]).slice().reverse().forEach(it=>{
      const d = document.createElement("div");
      d.className="item";
      d.textContent=`Комната ${it.room} • макс участников ${it.participantsMax} • начат ${new Date(it.startedAt).toLocaleString()}`;
      historyList.appendChild(d);
    });
  }
  async function refreshHistory(){ try { renderHistory(await api("/history")); } catch {} }
  setInterval(refreshHistory, 10000); refreshHistory();

  async function ensureLocal(){
    if(localStream) return localStream;
    localStream = await navigator.mediaDevices.getUserMedia({
      audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true},
      video:{width:{ideal:1920}, height:{ideal:1080}, frameRate:{ideal:30, max:60}}
    });
    localVideo.srcObject = localStream;
    return localStream;
  }
  function closePc(){ try{ pc?.close(); }catch{}; pc=null; }
  function closeWs(){ try{ ws?.close(); }catch{}; ws=null; }

  async function createPc(){
    const cfg = await getIce();
    pc = new RTCPeerConnection(cfg);
    pc.onicecandidate = e => { if(e.candidate && ws?.readyState===1){ ws.send(JSON.stringify({type:"candidate", candidate:e.candidate})); } };
    pc.ontrack = e => { remoteVideo.srcObject = e.streams[0]; };
    await ensureLocal();
    for(const t of localStream.getTracks()) pc.addTrack(t, localStream);
    // try bump bitrate
    try{
      for(const s of pc.getSenders()){
        if(s.track && s.track.kind==="video"){
          const p = s.getParameters();
          p.encodings = [{ maxBitrate: 6_000_000 }];
          await s.setParameters(p);
        }
      }
    }catch{}
  }

  function connectWs(room){
    return new Promise((resolve,reject)=>{
      const url = (location.protocol==="https:"?"wss://":"ws://")+location.host+"/ws";
      ws = new WebSocket(url);
      ws.onopen = () => { ws.send(JSON.stringify({type:"join", room})); resolve(); };
      ws.onerror = () => reject(new Error("WS error"));
      ws.onmessage = async ev => {
        let m; try{ m=JSON.parse(ev.data); }catch{ return; }
        if(m.type==="full"){ uiErr("Комната уже занята (2/2)."); return; }
        if(m.type==="ready"){
          if(role==="caller"){
            if(!pc) await createPc();
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(JSON.stringify({type:"description", sdp: pc.localDescription}));
          }
        }
        if(m.type==="description"){
          if(!pc) await createPc();
          const desc = new RTCSessionDescription(m.sdp);
          if(desc.type==="offer"){
            await pc.setRemoteDescription(desc);
            const ans = await pc.createAnswer();
            await pc.setLocalDescription(ans);
            ws.send(JSON.stringify({type:"description", sdp: pc.localDescription}));
          }else if(desc.type==="answer"){
            if(pc.signalingState==="have-local-offer"){
              await pc.setRemoteDescription(desc);
            }
          }
        }
        if(m.type==="candidate"){
          try{ await pc?.addIceCandidate(new RTCIceCandidate(m.candidate)); }catch(e){ console.warn(e); }
        }
        if(m.type==="peer-left"){
          console.log("peer left");
        }
        if(m.type==="role"){
          role = m.role;
        }
      };
    });
  }

  joinBtn.addEventListener("click", async () => {
    try{
      const room = (roomInp.value||"").trim();
      if(!room) return uiErr("Введите код комнаты");
      if(currentRoom) return uiErr("Вы уже подключены");
      await ensureLocal();
      await connectWs(room);
      currentRoom = room;
      joinBtn.disabled = true;
      leaveBtn.disabled = false;
      alert("Подключились. Откройте вторую вкладку и введите тот же код.");
    }catch(e){
      uiErr("Не удалось подключиться: "+e.message);
      closeWs(); closePc(); currentRoom=null;
    }
  });

  leaveBtn.addEventListener("click", () => {
    try{ ws?.send(JSON.stringify({type:"leave"})); }catch{}
    closePc(); closeWs();
    currentRoom=null;
    joinBtn.disabled=false;
    leaveBtn.disabled=true;
    remoteVideo.srcObject=null;
  });

  window.addEventListener("beforeunload", () => { try{ ws?.send(JSON.stringify({type:"leave"})); }catch{}; });
})();
