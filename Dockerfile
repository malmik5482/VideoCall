FROM node:18-alpine
WORKDIR /app

COPY server/package.json ./server/package.json
RUN cd server && npm install --omit=dev

COPY client ./client
COPY server ./server

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server/index.js"]
