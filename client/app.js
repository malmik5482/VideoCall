
// ---- Polyfill для getUserMedia (старые/нестандартные браузеры) ----
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
  alert('Для доступа к камере/микрофону нужен HTTPS. Откройте сайт по https://');
}

// ---------------------------------------------------------------
// Основной клиентский код (упрощённый пример)
const socket = io("https://" + window.location.host);

const joinBtn = document.querySelector("button");
const roomInput = document.querySelector("input");
const localVideo = document.createElement("video");
const remoteVideo = document.createElement("video");

localVideo.autoplay = true;
remoteVideo.autoplay = true;
document.body.appendChild(localVideo);
document.body.appendChild(remoteVideo);

async function startMedia() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = stream;
    return stream;
  } catch (err) {
    console.error("Ошибка доступа к камере/микрофону:", err);
  }
}

joinBtn.onclick = async () => {
  const room = roomInput.value;
  if (!room) return alert("Введите код комнаты");

  const stream = await startMedia();
  if (!stream) return;

  socket.emit("join", room);
};
