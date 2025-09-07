# 🔄 GitHub Actions Setup Instructions

## 📋 Overview
Инструкции по настройке GitHub Actions CI/CD pipeline для VideoCall проекта.

## 🚀 Quick Setup

### **Step 1: Create .github/workflows directory**
```bash
mkdir -p .github/workflows
```

### **Step 2: Copy workflow files**
```bash
# Copy CI/CD pipeline
cp templates/github-workflows/ci-cd.yml .github/workflows/

# Copy health monitoring
cp templates/github-workflows/health-check.yml .github/workflows/
```

### **Step 3: Commit and push**
```bash
git add .github/
git commit -m "feat: Add GitHub Actions CI/CD pipeline"
git push origin main
```

## 🔧 Workflow Configuration

### **Main CI/CD Pipeline** (`ci-cd.yml`)

#### **Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` branch

#### **Jobs:**
1. **🧪 Test & Build**
   - Install dependencies
   - Run tests (if available)
   - Generate build report

2. **🔒 Security Audit**
   - npm audit for vulnerabilities
   - Security checks

3. **🚀 Deploy Development**
   - Auto-deploy on `develop` branch
   - Development environment

4. **🎯 Deploy Production**
   - Auto-deploy on `main` branch (push only)
   - Production environment

5. **📢 Notifications**
   - Report deployment status
   - Summary of pipeline results

### **Health Monitoring** (`health-check.yml`)

#### **Schedule:**
- Runs every 30 minutes automatically
- Can be triggered manually

#### **Checks:**
- **Service Health**: API endpoint availability
- **TURN Server**: Connectivity to WebRTC TURN server
- **Performance**: Response time monitoring

## 🔐 Environment Variables Setup

### **GitHub Repository Settings**

1. Go to **Settings** → **Secrets and variables** → **Actions**

2. Add **Repository Secrets:**
```bash
# Production deployment (if needed)
PRODUCTION_SERVER_HOST=your_server_ip
PRODUCTION_SSH_KEY=your_ssh_private_key
PRODUCTION_USERNAME=deploy_user

# Monitoring (optional)
SLACK_WEBHOOK_URL=your_slack_webhook
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

3. Add **Repository Variables:**
```bash
NODE_VERSION=18
HEALTH_CHECK_URL=https://your-app.com/api/status
TURN_SERVER_HOST=94.198.218.189
TURN_SERVER_PORT=3478
```

### **Environment Configuration**

#### **Development Environment**
- Name: `development`
- Protection rules: None (auto-deploy)

#### **Production Environment**  
- Name: `production`
- Protection rules: Required reviewers (recommended)
- Deployment branch policy: `main` only

## 📊 Monitoring & Alerts

### **Built-in Monitoring**
- **Health Checks**: Every 30 minutes
- **Performance**: Response time tracking
- **Infrastructure**: TURN server connectivity
- **Security**: Dependency vulnerability scans

### **Custom Alerts** (Optional)

#### **Slack Integration**
Add to workflow:
```yaml
- name: Slack Notification
  if: failure()
  uses: rtCamp/action-slack-notify@v2
  env:
    SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK_URL }}
    SLACK_MESSAGE: 'VideoCall deployment failed!'
```

#### **Email Notifications**
GitHub automatically sends email notifications for:
- Failed workflows
- Successful deployments to production
- Security alerts

## 🔧 Customization

### **Add More Tests**
Edit `ci-cd.yml`:
```yaml
- name: 🧪 Run Tests
  run: |
    cd server
    npm test
    npm run test:integration
    npm run test:e2e
```

### **Add Linting**
```yaml
- name: 🔍 Lint Code
  run: |
    cd server
    npm run lint
    npm run lint:fix
```

### **Add Build Steps**
```yaml
- name: 🏗️ Build Application
  run: |
    cd client
    npm run build
    npm run minify
```

### **Custom Deployment**

#### **SSH Deployment**
```yaml
- name: 🚀 Deploy to Server
  uses: appleboy/ssh-action@v0.1.5
  with:
    host: ${{ secrets.PRODUCTION_SERVER_HOST }}
    username: ${{ secrets.PRODUCTION_USERNAME }}
    key: ${{ secrets.PRODUCTION_SSH_KEY }}
    script: |
      cd /path/to/app
      git pull origin main
      npm install
      pm2 restart videocall-server
```

#### **Docker Deployment**
```yaml
- name: 🐳 Deploy with Docker
  run: |
    docker build -t videocall:${{ github.sha }} .
    docker tag videocall:${{ github.sha }} videocall:latest
    docker-compose up -d
```

## 🏥 Health Check URLs

Update these URLs in `health-check.yml`:

```yaml
# Replace with your actual deployment URLs
HEALTH_URLS=(
  "https://your-app.com/api/status"
  "https://your-app-staging.com/api/status"
)
```

## 📋 Troubleshooting

### **Common Issues**

#### **Workflow Permission Error**
If you get permission errors when creating workflows:
1. Go to **Settings** → **Actions** → **General**
2. Set **Workflow permissions** to "Read and write permissions"
3. Enable "Allow GitHub Actions to create and approve pull requests"

#### **Secrets Not Available**
- Check secret names match exactly (case-sensitive)
- Verify secrets are set at repository level, not organization
- Ensure environment names match in workflow and settings

#### **Failed Health Checks**
- Verify URLs are accessible publicly
- Check if services are actually running
- Update URLs in workflow if deployment changes

### **Debug Mode**
Enable debug logging by adding repository variable:
```bash
ACTIONS_STEP_DEBUG=true
ACTIONS_RUNNER_DEBUG=true
```

## 🎯 Next Steps

1. **Set up environments** in GitHub repository settings
2. **Configure secrets** for deployment and monitoring  
3. **Test workflows** with a test push/PR
4. **Monitor results** in Actions tab
5. **Customize alerts** based on needs
6. **Add more sophisticated deployment** steps

## 📞 Support

For issues with GitHub Actions:
- Check **Actions** tab for workflow logs
- Review **Settings** → **Secrets and variables**
- Verify **Environment** configuration
- Test with manual workflow dispatch first