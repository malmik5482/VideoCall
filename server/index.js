const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Enable CORS
app.use(cors());
app.use(express.json());

// Serve React build files
app.use(express.static(path.join(__dirname, '../client/dist')));

// Fallback to index.html for React Router (SPA)
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  ws.on('message', (message) => {
    console.log('Received:', message.toString());
    
    // Broadcast message to all connected clients
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

// API routes
app.get('/api/status', (req, res) => {
  res.json({ 
    message: 'VideoCall Server is running!',
    connections: wss.clients.size,
    timestamp: new Date().toISOString()
  });
});

// ICE servers configuration with TURN server for Russian mobile networks
app.get('/api/ice-config', (req, res) => {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // TURN server for Russian mobile networks
    {
      urls: [
        'turn:94.198.218.189:3478?transport=udp',
        'turn:94.198.218.189:3478?transport=tcp'
      ],
      username: 'webrtc',
      credential: 'pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN'
    }
  ];
  
  res.json({ iceServers });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
