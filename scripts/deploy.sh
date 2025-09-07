#!/bin/bash

# VideoCall Deployment Script
# Usage: ./scripts/deploy.sh [environment]
# Environment: development, production, or staging

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default environment
ENVIRONMENT=${1:-development}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="logs/deploy_${ENVIRONMENT}_${TIMESTAMP}.log"

# Create logs directory if it doesn't exist
mkdir -p logs

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Main deployment function
main() {
    log "🚀 Starting VideoCall deployment to $ENVIRONMENT environment"
    log "📅 Deployment ID: deploy_${ENVIRONMENT}_${TIMESTAMP}"
    
    # Validate environment
    if [[ ! "$ENVIRONMENT" =~ ^(development|production|staging)$ ]]; then
        error "Invalid environment: $ENVIRONMENT. Use: development, production, or staging"
    fi
    
    # Check prerequisites
    log "🔍 Checking prerequisites..."
    
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
    fi
    
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
    fi
    
    if ! command -v pm2 &> /dev/null; then
        warning "PM2 is not installed globally. Installing..."
        npm install -g pm2
    fi
    
    success "Prerequisites check completed"
    
    # Load environment variables
    log "📋 Loading environment configuration for $ENVIRONMENT..."
    
    if [[ -f ".env.$ENVIRONMENT" ]]; then
        log "Loading .env.$ENVIRONMENT file"
        export $(cat ".env.$ENVIRONMENT" | grep -v '^#' | xargs)
    else
        warning ".env.$ENVIRONMENT file not found, using default configuration"
    fi
    
    # Install dependencies
    log "📦 Installing dependencies..."
    
    # Server dependencies
    cd server
    npm ci --only=production
    cd ..
    
    # Client dependencies and build
    log "🏗️ Building React frontend..."
    cd client
    npm ci
    npm run build
    cd ..
    
    success "Dependencies installed and React app built"
    
    # Stop existing services
    log "🛑 Stopping existing services..."
    pm2 delete videocall-server 2>/dev/null || log "No existing service found"
    
    # Start application with PM2
    log "🚀 Starting VideoCall server..."
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        pm2 start ecosystem.config.js --env production
    else
        pm2 start ecosystem.config.js --env development
    fi
    
    # Wait for startup
    sleep 5
    
    # Health check
    log "🏥 Performing health check..."
    
    MAX_RETRIES=10
    RETRY_COUNT=0
    
    while [[ $RETRY_COUNT -lt $MAX_RETRIES ]]; do
        if curl -f -s "http://localhost:${PORT:-3001}/api/status" > /dev/null 2>&1; then
            success "Health check passed!"
            break
        fi
        
        ((RETRY_COUNT++))
        log "Health check attempt $RETRY_COUNT/$MAX_RETRIES failed, retrying in 5 seconds..."
        sleep 5
    done
    
    if [[ $RETRY_COUNT -eq $MAX_RETRIES ]]; then
        error "Health check failed after $MAX_RETRIES attempts"
    fi
    
    # Display service status
    log "📊 Service Status:"
    pm2 status
    
    success "🎉 VideoCall deployed successfully to $ENVIRONMENT environment!"
    log "🌐 Service URL: http://localhost:${PORT:-3001}"
    log "📊 Status API: http://localhost:${PORT:-3001}/api/status"
    log "📝 Logs: pm2 logs videocall-server"
    log "📋 Deployment log saved to: $LOG_FILE"
}

# Execute main function
main "$@"