# VideoCall Application Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Add metadata
LABEL maintainer="malmik5482"
LABEL description="VideoCall WebRTC Application"
LABEL version="1.0.0"

# Install system dependencies
RUN apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN cd server && npm ci --only=production && npm cache clean --force
RUN cd client && (npm ci --only=production || true) && (npm cache clean --force || true)

# Copy application code
COPY server/ ./server/
COPY client/ ./client/
COPY ecosystem.config.js ./
COPY .env.production ./.env

# Create logs directory
RUN mkdir -p logs && chown -R node:node logs

# Create non-root user for security
USER node

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/status || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "server/index.js"]