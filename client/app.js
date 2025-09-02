const roomInput = document.getElementById("room");
const joinBtn = document.getElementById("joinBtn");
const leaveBtn = document.getElementById("leaveBtn");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let pc, ws, localStream;

async function initMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 60 } }
  });
  localVideo.srcObject = localStream;
}

async function connect() {
  const room = roomInput.value;
  if (!room) return alert("Введите код комнаты");

  ws = new WebSocket(location.origin.replace(/^http/, "ws") + "/ws");

  ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: "answer", answer, room }));
    } else if (data.type === "answer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.type === "candidate") {
      try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
    }
  };

  ws.onopen = async () => {
    const config = await fetch("/config").then(r => r.json());
    pc = new RTCPeerConnection(config);

    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    pc.ontrack = (e) => { remoteVideo.srcObject = e.streams[0]; };
    pc.onicecandidate = (e) => { if (e.candidate) ws.send(JSON.stringify({ type: "candidate", candidate: e.candidate, room })); };

    ws.send(JSON.stringify({ type: "join", room }));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: "offer", offer, room }));
  };
}

joinBtn.onclick = async () => {
  await initMedia();
  connect();
};

leaveBtn.onclick = () => {
  pc?.close();
  ws?.close();
  remoteVideo.srcObject = null;
};
