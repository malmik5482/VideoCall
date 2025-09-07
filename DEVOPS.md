# 🔧 VideoCall DevOps Documentation

## 📋 Overview
Complete CI/CD pipeline and automation setup for VideoCall WebRTC application.

## 🏗️ Infrastructure Components

### **1. Application Stack**
- **Backend**: Node.js + Express + WebSocket
- **Frontend**: HTML5 + WebRTC API
- **Process Manager**: PM2
- **Containerization**: Docker + Docker Compose
- **CI/CD**: GitHub Actions

### **2. Environment Management**
- **Development**: `.env.development`
- **Production**: `.env.production`
- **Example Template**: `.env.example`

## 🚀 Deployment Options

### **Option 1: PM2 Deployment (Recommended)**
```bash
# Quick deployment
npm run deploy:prod

# Manual deployment
./scripts/deploy.sh production
```

### **Option 2: Docker Deployment**
```bash
# Build and run with Docker Compose
npm run docker:build
npm run docker:run

# Check logs
npm run docker:logs
```

### **Option 3: Manual Deployment**
```bash
# Install dependencies
npm run install:all

# Start in production mode
npm run pm2:start:prod
```

## 📊 Monitoring & Maintenance

### **Service Monitoring**
```bash
# Quick status check
npm run monitor:status

# Health check
npm run monitor:health

# View logs
npm run monitor:logs

# Interactive monitoring
npm run monitor
```

### **PM2 Commands**
```bash
# Start application
pm2 start ecosystem.config.js --env production

# Monitor processes
pm2 monit

# View logs
pm2 logs videocall-server

# Restart service
pm2 restart videocall-server

# Stop service
pm2 stop videocall-server
```

## 🔐 Environment Variables

### **Required Variables**
| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Application port | `3001` |
| `TURN_SERVER` | TURN server address | `94.198.218.189:3478` |
| `TURN_USERNAME` | TURN auth username | `webrtc` |
| `TURN_PASSWORD` | TURN auth password | `your_password` |

### **Optional Variables**
| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging level | `info` |
| `MAX_LOG_SIZE` | Max log file size | `10m` |
| `VLESS_SERVER` | VLESS proxy server | - |

## 🏥 Health Checks

### **Endpoints**
- **Status**: `GET /api/status`
- **ICE Config**: `GET /api/ice-config`

### **Health Check Script**
```bash
# Manual health check
curl -f http://localhost:3001/api/status

# Automated health check
npm run health
```

## 🔄 CI/CD Pipeline

### **GitHub Actions Workflows**

#### **Main Pipeline** (`.github/workflows/ci-cd.yml`)
- **Triggers**: Push to main/develop, Pull requests
- **Jobs**: Test → Security Audit → Deploy Dev → Deploy Prod → Notify
- **Environments**: Development, Production

#### **Health Monitoring** (`.github/workflows/health-check.yml`)
- **Schedule**: Every 30 minutes
- **Checks**: Service health, TURN server, Performance

### **Pipeline Stages**
1. **🧪 Test & Build**
   - Install dependencies
   - Run linting (if available)
   - Execute tests
   - Generate build report

2. **🔒 Security Audit**
   - npm audit for vulnerabilities
   - Security checks

3. **🚀 Deployment**
   - Deploy to development (develop branch)
   - Deploy to production (main branch only)

4. **📢 Notification**
   - Deployment status reporting

## 🐳 Docker Configuration

### **Dockerfile Features**
- Multi-stage build optimization
- Non-root user for security
- Health checks built-in
- Resource constraints

### **Docker Compose**
- Service orchestration
- Environment variable management
- Volume mounting for logs
- Network isolation
- Resource limits

## 📝 Logging

### **Log Locations**
- **PM2 Logs**: `~/.pm2/logs/`
- **Application Logs**: `./logs/`
- **Docker Logs**: `docker-compose logs`

### **Log Management**
```bash
# View live logs
pm2 logs videocall-server --lines 100

# Rotate logs
pm2 flush

# Docker logs
docker-compose logs -f --tail=100
```

## 🔧 Troubleshooting

### **Common Issues**

#### **Service Won't Start**
```bash
# Check PM2 status
pm2 status

# Check logs for errors
pm2 logs videocall-server --lines 50

# Verify port availability
netstat -tulpn | grep :3001
```

#### **Health Check Failing**
```bash
# Test manually
curl -v http://localhost:3001/api/status

# Check service binding
./scripts/monitor.sh health
```

#### **Docker Issues**
```bash
# Check container status
docker-compose ps

# View container logs
docker-compose logs videocall-app

# Restart containers
docker-compose restart
```

## 🌐 Timeweb Cloud Integration

### **Environment Setup for Timeweb**
1. Set environment variables in Timeweb control panel
2. Configure domain and SSL
3. Set up CI/CD webhook
4. Configure monitoring alerts

### **Required Timeweb Variables**
```bash
TIMEWEB_API_TOKEN=your_api_token
TIMEWEB_PROJECT_ID=your_project_id
TIMEWEB_DOMAIN=your_domain.com
```

## 📋 Deployment Checklist

### **Pre-Deployment**
- [ ] Environment variables configured
- [ ] TURN server accessibility verified
- [ ] Dependencies updated
- [ ] Security audit passed
- [ ] Health checks working

### **Post-Deployment**
- [ ] Service health verified
- [ ] Performance metrics checked
- [ ] Log rotation configured
- [ ] Monitoring alerts active
- [ ] Backup procedures verified

## 🔗 Useful Commands

### **Quick Reference**
```bash
# Full deployment
npm run deploy:prod

# Status check
npm run monitor:status

# View logs
npm run monitor:logs

# Restart service
npm run pm2:restart

# Health check
npm run health

# Docker deployment
npm run docker:run
```

## 📞 Support & Maintenance

### **Regular Tasks**
- Monitor service health (automated)
- Review logs weekly
- Update dependencies monthly
- Security audit quarterly
- Performance review quarterly

### **Emergency Procedures**
1. **Service Down**: Check logs → Restart service → Verify health
2. **High CPU/Memory**: Check processes → Restart if needed → Investigate logs
3. **Network Issues**: Verify TURN server → Check connectivity → Review configuration

---

## 🎯 Next Steps for Production

1. **🔒 Security Hardening**
   - SSL/TLS certificates
   - Firewall configuration
   - Rate limiting
   - Authentication system

2. **📊 Advanced Monitoring**
   - Prometheus + Grafana
   - Error tracking (Sentry)
   - Performance monitoring
   - User analytics

3. **🚀 Scaling Preparation**
   - Load balancer setup
   - Database integration
   - Caching layer
   - CDN configuration

4. **💾 Backup & Recovery**
   - Automated backups
   - Disaster recovery plan
   - Data retention policies
   - Recovery testing