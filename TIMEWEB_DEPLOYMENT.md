# 🚀 VideoCall Timeweb Deployment Guide

## 📋 Overview
Руководство по развертыванию VideoCall приложения на Timeweb Cloud с доменом `malmik5482-videocall-fc69.twc1.net`.

## 🛠️ Prerequisites

### **1. Timeweb Cloud Account**
- Active Timeweb Cloud account
- Project created: `malmik5482-videocall-fc69`
- Domain configured: `malmik5482-videocall-fc69.twc1.net`
- SSL certificate enabled

### **2. Server Requirements**
- **OS**: Ubuntu 20.04+ / CentOS 8+
- **Node.js**: 18.x or higher  
- **RAM**: Minimum 1GB (recommended 2GB)
- **Storage**: Minimum 10GB
- **Network**: Public IP with ports 80, 443, 3001

### **3. Required Software**
```bash
# Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 Process Manager
sudo npm install -g pm2

# Git
sudo apt-get install -y git
```

## 🚀 Deployment Steps

### **Step 1: Clone Repository**
```bash
# Clone the repository
git clone https://github.com/malmik5482/VideoCall.git
cd VideoCall

# Switch to main branch
git checkout main
git pull origin main
```

### **Step 2: Install Dependencies**
```bash
# Install all dependencies (server + client)
npm run install:all

# Or manually:
# npm install
# cd server && npm install
# cd ../client && npm install
```

### **Step 3: Build Frontend**
```bash
# Build React frontend for production
npm run build:client

# Verify build
ls -la client/dist/
```

### **Step 4: Configure Environment**
```bash
# Copy Timeweb environment configuration
cp .env.timeweb .env

# Or create custom .env file:
cat > .env << EOF
NODE_ENV=production
PORT=3001
DOMAIN=malmik5482-videocall-fc69.twc1.net
APP_URL=https://malmik5482-videocall-fc69.twc1.net
TURN_SERVER=94.198.218.189:3478
TURN_USERNAME=webrtc
TURN_PASSWORD=pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN
EOF
```

### **Step 5: Deploy with PM2**
```bash
# Deploy using our automated script
npm run deploy:timeweb

# Or manually:
pm2 start ecosystem.config.js --env timeweb
pm2 save
pm2 startup
```

### **Step 6: Configure Reverse Proxy (Nginx)**
```bash
# Install Nginx
sudo apt-get install -y nginx

# Create Nginx configuration
sudo tee /etc/nginx/sites-available/videocall << EOF
server {
    listen 80;
    server_name malmik5482-videocall-fc69.twc1.net;
    
    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name malmik5482-videocall-fc69.twc1.net;
    
    # SSL Configuration (Timeweb managed)
    ssl_certificate /path/to/certificate.pem;
    ssl_certificate_key /path/to/private.key;
    
    # Proxy to Node.js app
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # WebSocket support
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # WebSocket endpoint
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable site and restart Nginx
sudo ln -s /etc/nginx/sites-available/videocall /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 🔧 Configuration

### **Environment Variables**
Key variables for Timeweb deployment:

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `3001` | Application port |
| `DOMAIN` | `malmik5482-videocall-fc69.twc1.net` | Your domain |
| `TURN_SERVER` | `94.198.218.189:3478` | TURN server for WebRTC |
| `TURN_USERNAME` | `webrtc` | TURN authentication |
| `TURN_PASSWORD` | `pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN` | TURN password |

### **PM2 Configuration**
The app uses PM2 ecosystem file with Timeweb-specific settings:

```javascript
env_timeweb: {
  NODE_ENV: 'production',
  PORT: 3001,
  DOMAIN: 'malmik5482-videocall-fc69.twc1.net',
  // ... other settings
}
```

## 📊 Monitoring & Management

### **PM2 Commands**
```bash
# Check status
pm2 status

# View logs
pm2 logs videocall-server

# Restart application
pm2 restart videocall-server

# Monitor resources
pm2 monit

# Save PM2 configuration
pm2 save
```

### **Health Checks**
```bash
# Application health
curl https://malmik5482-videocall-fc69.twc1.net/api/status

# ICE configuration
curl https://malmik5482-videocall-fc69.twc1.net/api/ice-config

# WebSocket test (manual)
# Open browser dev tools and test WebSocket connection
```

### **Log Files**
- **PM2 logs**: `~/.pm2/logs/`
- **Application logs**: `./logs/`
- **Nginx logs**: `/var/log/nginx/`

## 🔒 Security

### **Firewall Configuration**
```bash
# Configure UFW
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### **SSL/TLS**
- Use Timeweb managed SSL certificates
- Ensure HTTPS redirect is configured
- Verify SSL chain and security headers

### **Application Security**
- Environment variables properly secured
- CORS configured for production domain
- Rate limiting on API endpoints (if needed)

## 🚀 Automated Deployment

### **Using Deploy Script**
```bash
# Full automated deployment
./scripts/deploy.sh timeweb

# With logging
./scripts/deploy.sh timeweb 2>&1 | tee deployment.log
```

### **CI/CD Integration**
Add Timeweb deployment to GitHub Actions:

```yaml
- name: Deploy to Timeweb
  if: github.ref == 'refs/heads/main'
  run: |
    # SSH to Timeweb server and deploy
    ssh user@malmik5482-videocall-fc69.twc1.net 'cd /path/to/app && git pull && npm run deploy:timeweb'
```

## 📋 Troubleshooting

### **Common Issues**

#### **1. Application Won't Start**
```bash
# Check PM2 status
pm2 status

# Check logs for errors
pm2 logs videocall-server --lines 50

# Verify Node.js version
node --version  # Should be 18+
```

#### **2. Domain Not Accessible**
```bash
# Check Nginx configuration
sudo nginx -t

# Check Nginx status
sudo systemctl status nginx

# Verify DNS resolution
nslookup malmik5482-videocall-fc69.twc1.net
```

#### **3. WebRTC Not Working**
```bash
# Test TURN server connectivity
curl -I https://malmik5482-videocall-fc69.twc1.net/api/ice-config

# Check WebSocket connection
# Browser Dev Tools -> Network -> WS tab
```

#### **4. Build Issues**
```bash
# Clear cache and rebuild
cd client
rm -rf node_modules dist
npm install
npm run build
```

### **Performance Optimization**

#### **Node.js Optimization**
```bash
# Increase memory limit
pm2 start ecosystem.config.js --env timeweb --node-args="--max-old-space-size=2048"

# Enable cluster mode (if needed)
pm2 start ecosystem.config.js --env timeweb -i max
```

#### **Nginx Optimization**
Add to Nginx configuration:
```nginx
# Gzip compression
gzip on;
gzip_types text/css application/javascript application/json;

# Static file caching
location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## 📞 Support

### **Timeweb Support**
- Timeweb Cloud documentation
- Support tickets via Timeweb panel
- Community forums

### **Application Support**
- GitHub Issues: https://github.com/malmik5482/VideoCall/issues
- Application logs and monitoring
- PM2 process management tools

## 🎯 Next Steps

1. **SSL Certificate**: Ensure proper SSL configuration
2. **Monitoring**: Set up application monitoring (optional)
3. **Backup**: Configure automated backups  
4. **Scaling**: Consider load balancing for high traffic
5. **CDN**: Optional CDN integration for static assets

---

## ✅ Deployment Checklist

- [ ] Timeweb Cloud project created
- [ ] Domain `malmik5482-videocall-fc69.twc1.net` configured
- [ ] SSL certificate installed
- [ ] Server provisioned with required specs
- [ ] Node.js 18+ installed
- [ ] PM2 installed globally
- [ ] Repository cloned and dependencies installed
- [ ] React frontend built for production
- [ ] Environment variables configured
- [ ] PM2 application started
- [ ] Nginx reverse proxy configured
- [ ] Health checks passing
- [ ] WebRTC functionality tested
- [ ] Domain accessible via HTTPS

🚀 **Your VideoCall application should now be running at https://malmik5482-videocall-fc69.twc1.net!**