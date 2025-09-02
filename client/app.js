const roomInput=document.getElementById("room");
const joinBtn=document.getElementById("joinBtn");
const localVideo=document.getElementById("local");
const remoteVideo=document.getElementById("remote");
const msg=document.getElementById("msg");
const send=document.getElementById("send");
const logDiv=document.getElementById("log");
let pc,dc,ws,localStream;

function log(t){const d=document.createElement("div");d.textContent=t;logDiv.appendChild(d);}

async function startMedia(){
  localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
  localVideo.srcObject=localStream;
}
function createPeer(){
  pc=new RTCPeerConnection();
  localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
  pc.ontrack=e=>remoteVideo.srcObject=e.streams[0];
  dc=pc.createDataChannel("chat");
  dc.onmessage=e=>log("Собеседник: "+e.data);
  pc.onicecandidate=e=>{if(e.candidate) ws.send(JSON.stringify({type:"candidate",candidate:e.candidate}));};
}
async function makeOffer(){
  const offer=await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws.send(JSON.stringify({type:"offer",sdp:pc.localDescription}));
}
async function handleOffer(sdp){
  await pc.setRemoteDescription(sdp);
  const ans=await pc.createAnswer();
  await pc.setLocalDescription(ans);
  ws.send(JSON.stringify({type:"answer",sdp:pc.localDescription}));
}
async function handleAnswer(sdp){await pc.setRemoteDescription(sdp);}
async function handleCandidate(c){await pc.addIceCandidate(c);}
function connectWs(r){
  const proto=location.protocol==="https:"?"wss":"ws";
  ws=new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen=()=>ws.send(JSON.stringify({type:"join",room:r}));
  ws.onmessage=async ev=>{
    const m=JSON.parse(ev.data);
    if(m.type==="joined"&&m.peers>=1) await makeOffer();
    if(m.type==="offer") await handleOffer(m.sdp);
    if(m.type==="answer") await handleAnswer(m.sdp);
    if(m.type==="candidate") await handleCandidate(m.candidate);
  };
}
joinBtn.onclick=async()=>{
  await startMedia();createPeer();connectWs(roomInput.value);
};
send.onclick=()=>{if(dc&&dc.readyState==="open"){dc.send(msg.value);log("Вы: "+msg.value);msg.value="";}};
