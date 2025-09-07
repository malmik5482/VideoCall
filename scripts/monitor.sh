#!/bin/bash

# VideoCall Monitoring Script
# Usage: ./scripts/monitor.sh [action]
# Actions: status, logs, restart, stop, health

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SERVICE_NAME="videocall-server"
PORT=${PORT:-3001}
HOST=${HOST:-localhost}

# Functions
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if PM2 is available
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        error "PM2 is not installed. Please install it first: npm install -g pm2"
        exit 1
    fi
}

# Show service status
show_status() {
    log "📊 Service Status:"
    pm2 status "$SERVICE_NAME" || warning "Service not found in PM2"
    
    echo ""
    log "🌐 Network Status:"
    if netstat -tulpn 2>/dev/null | grep ":$PORT " | head -5; then
        success "Service is listening on port $PORT"
    else
        error "No service found listening on port $PORT"
    fi
    
    echo ""
    log "💾 Memory Usage:"
    pm2 show "$SERVICE_NAME" | grep -E "(memory usage|cpu usage)" || echo "No detailed info available"
}

# Show logs
show_logs() {
    local lines=${1:-50}
    log "📋 Recent logs (last $lines lines):"
    pm2 logs "$SERVICE_NAME" --lines "$lines" --nostream
}

# Health check
health_check() {
    log "🏥 Performing health check..."
    
    local health_url="http://$HOST:$PORT/api/status"
    log "Checking: $health_url"
    
    if curl -f -s --connect-timeout 5 --max-time 10 "$health_url" > /dev/null; then
        success "✅ Health check passed!"
        
        # Get detailed status
        local response=$(curl -s "$health_url" 2>/dev/null)
        if [[ -n "$response" ]]; then
            echo "📊 Service Response:"
            echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
        fi
    else
        error "❌ Health check failed!"
        warning "Service might be down or not responding"
        return 1
    fi
}

# Restart service
restart_service() {
    log "🔄 Restarting $SERVICE_NAME..."
    
    if pm2 restart "$SERVICE_NAME"; then
        success "Service restarted successfully"
        sleep 3
        health_check
    else
        error "Failed to restart service"
        return 1
    fi
}

# Stop service
stop_service() {
    log "🛑 Stopping $SERVICE_NAME..."
    
    if pm2 stop "$SERVICE_NAME"; then
        success "Service stopped successfully"
    else
        error "Failed to stop service"
        return 1
    fi
}

# Performance monitoring
performance_monitor() {
    log "⚡ Performance Monitoring (Press Ctrl+C to stop):"
    
    while true; do
        clear
        echo "📊 VideoCall Performance Monitor - $(date)"
        echo "=================================="
        
        # PM2 status
        pm2 status "$SERVICE_NAME" 2>/dev/null || echo "Service not running"
        
        echo ""
        echo "🌐 Network Connections:"
        netstat -an | grep ":$PORT " | head -10 || echo "No connections"
        
        echo ""
        echo "💾 System Resources:"
        echo "Memory: $(free -h | grep Mem | awk '{print $3"/"$2}')"
        echo "CPU Load: $(uptime | awk -F'load average:' '{print $2}')"
        
        echo ""
        echo "🔄 Refreshing in 5 seconds... (Ctrl+C to exit)"
        sleep 5
    done
}

# Main function
main() {
    local action=${1:-status}
    
    check_pm2
    
    case "$action" in
        status|s)
            show_status
            ;;
        logs|l)
            show_logs "${2:-50}"
            ;;
        health|h)
            health_check
            ;;
        restart|r)
            restart_service
            ;;
        stop)
            stop_service
            ;;
        monitor|m)
            performance_monitor
            ;;
        *)
            echo "Usage: $0 [action]"
            echo "Actions:"
            echo "  status|s     - Show service status"
            echo "  logs|l [n]   - Show last n log lines (default: 50)"
            echo "  health|h     - Perform health check"
            echo "  restart|r    - Restart service"
            echo "  stop         - Stop service"
            echo "  monitor|m    - Real-time performance monitoring"
            exit 1
            ;;
    esac
}

# Execute
main "$@"