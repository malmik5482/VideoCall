#!/bin/bash

# Production Build Script for VideoCall
# Creates production-ready build with all necessary assets

set -e

echo "🚀 Building VideoCall for Production..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Clean previous builds
log "🧹 Cleaning previous builds..."
rm -rf client/dist
rm -rf client/node_modules/.vite

# Install client dependencies
log "📦 Installing client dependencies..."
cd client
npm ci --include=dev

# Build React app for production
log "🏗️ Building React application..."
npm run build

# Verify build
if [ -f "dist/index.html" ]; then
    success "React build completed successfully!"
    ls -la dist/
else
    echo "❌ Build failed - index.html not found"
    exit 1
fi

cd ..

# Install server dependencies (production only)
log "📦 Installing server dependencies..."
cd server
npm ci --only=production
cd ..

# Verify server files
log "✅ Verifying server files..."
if [ -f "server/index.js" ]; then
    success "Server files ready"
else
    echo "❌ Server index.js not found"
    exit 1
fi

# Create logs directory
log "📁 Creating logs directory..."
mkdir -p logs

success "🎉 Production build completed successfully!"
echo ""
echo "📋 Build Summary:"
echo "✅ React frontend built to client/dist/"
echo "✅ Server dependencies installed"
echo "✅ Production environment ready"
echo "✅ Ready for deployment"