# VideoCall v3 — стабильный билд (Timeweb Apps)
- Исправлены падения при запуске (nanoid v3 CommonJS, единственный импорт WebSocketServer).
- Health-check `/healthz`, статик из /client, WebSocket signaling `/ws`.
- Регистрация по телефону, поиск, call/start, история звонков, чат, join/leave.
- Высокое качество видео/звука + автоадаптация битрейта.

## Деплой
1) Залейте в GitHub **весь** репозиторий.
2) Timeweb → Apps (Docker) → привязать репозиторий. Dockerfile будет использован.
3) Переменные (рекомендуется): `ICE_SERVERS` — JSON STUN/TURN.
4) Проверка: https://<домен>/healthz → {"ok":true}.

