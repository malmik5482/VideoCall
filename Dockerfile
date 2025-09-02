FROM node:18-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server ./server
COPY client ./client

ENV NODE_ENV=production

# Defaults (can be overridden in build or run)
ARG PORT=3000
ENV PORT=$PORT

# Comma-separated list of ICE URLs, e.g.:
# "stun:stun.l.google.com:19302,turn:94.198.218.189:3478?transport=udp,turn:94.198.218.189:3478?transport=tcp"
ARG ICE_URLS="stun:stun.l.google.com:19302"
ENV ICE_URLS=$ICE_URLS

ARG TURN_USER=""
ARG TURN_PASS=""
ENV TURN_USER=$TURN_USER
ENV TURN_PASS=$TURN_PASS

EXPOSE 3000
CMD ["node","server/index.js"]
