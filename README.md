# VideoCall v3 (Docker-ready)

Видеозвонок 1‑к‑1 на WebRTC + Express + WebSocket. Работает в Docker и на Timeweb Apps.

## Локально
```bash
npm i
npm start
# откройте http://localhost:3000 в двух вкладках, введите один код комнаты
```

## Переменные окружения
* `ICE_JSON` — (опционально) полный JSON‑массив ICE servers.
* `ICE_URLS` — (альтернатива) список через запятую: `stun:...,turn:...` (по умолчанию только STUN Google)
* `TURN_USER`, `TURN_PASS` — логин/пароль для TURN (если используете `ICE_URLS`)

Пример:
```
ICE_URLS=stun:stun.l.google.com:19302,turn:94.198.218.189:3478?transport=udp,turn:94.198.218.189:3478?transport=tcp
TURN_USER=webrtc
TURN_PASS=СЕКРЕТ
```

## Docker
```bash
docker build -t videocall     --build-arg PORT=3000     --build-arg ICE_URLS="stun:stun.l.google.com:19302,turn:94.198.218.189:3478?transport=udp,turn:94.198.218.189:3478?transport=tcp"     --build-arg TURN_USER=webrtc     --build-arg TURN_PASS=СЕКРЕТ .

docker run -p 3000:3000     -e ICE_URLS="stun:stun.l.google.com:19302,turn:94.198.218.189:3478?transport=udp,turn:94.198.218.189:3478?transport=tcp"     -e TURN_USER=webrtc -e TURN_PASS=СЕКРЕТ videocall
```

## Timeweb Apps (через Dockerfile)
* Тип: **Docker**
* Репозиторий: ваш GitHub
* Аргументы сборки (Build Args):
  - `PORT` = `3000`
  - `ICE_URLS` = `stun:stun.l.google.com:19302,turn:94.198.218.189:3478?transport=udp,turn:94.198.218.189:3478?transport=tcp`
  - `TURN_USER` = `webrtc`
  - `TURN_PASS` = `ВАШ_ПАРОЛЬ`
* Порт публикации: `3000`

Или используйте преднастройку **Express** без Dockerfile (Build: `npm install --omit=dev`, Start: `npm start`) и добавьте переменные окружения аналогично.
