# VideoCall — готовый сервер и клиент

## Запуск на Timeweb Cloud (Docker Apps)
1. Залейте весь репозиторий в GitHub (включая Dockerfile).
2. В Timeweb → Apps → Docker → привяжите репозиторий, окружение Node.js 18 (Dockerfile будет использован).
3. Переменные (опционально):
   - `ICE_SERVERS` — JSON-массив ICE (STUN/TURN). Пример:
     ```json
     [{"urls":"stun:stun.l.google.com:19302"},
      {"urls":"turn:YOUR_TURN:3478","username":"USER","credential":"PASS"}]
     ```
4. После деплоя: `https://<домен>/healthz` → `{ "ok": true }`.

## Возможности
- Регистрация пользователя: номер телефона + имя (`/api/register`).
- Поиск по номеру (`/api/users?phone=`).
- Звонок пользователю → создаётся комната `call-<me>-<target>`.
- История звонков (`/history`), join/leave, чат.
- WebRTC с высоким качеством и автоподстройкой битрейта.

## Локально
```bash
cd server && npm i
node server/index.js
# откройте http://localhost:3000
```
