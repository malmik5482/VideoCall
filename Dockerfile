# Multi-stage Docker build for VideoCall (CosmosChat)
# Stage 1: Build frontend (React + Tailwind)
FROM node:18-alpine AS frontend

# Set working directory for frontend
WORKDIR /app/frontend

# Copy package.json and package-lock.json (if exists)
COPY client/package*.json ./

# Install frontend dependencies
RUN npm ci --only=production

# Copy frontend source code
COPY client/ .

# Build frontend for production
RUN npm run build || echo "No build script found, using source files directly"

# Stage 2: Build backend (Node.js)
FROM node:18-alpine AS backend

# Set working directory for backend
WORKDIR /app/backend

# Copy package.json and package-lock.json (if exists)
COPY server/package*.json ./

# Install backend dependencies
RUN npm ci --only=production

# Copy backend source code
COPY server/ .

# Stage 3: Production image with both services
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S cosmoschat -u 1001

# Copy built frontend from frontend stage
COPY --from=frontend --chown=cosmoschat:nodejs /app/frontend /app/client

# Copy built backend from backend stage  
COPY --from=backend --chown=cosmoschat:nodejs /app/backend /app/server

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3002
ENV TURN_SERVER=94.198.218.189:3478
ENV TURN_USERNAME=webrtc
ENV TURN_CREDENTIAL=pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN
ENV SERVICE_FRONTEND=frontend
ENV SERVICE_BACKEND=backend

# Expose the port
EXPOSE 3002

# Switch to non-root user
USER cosmoschat

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the backend server
CMD ["node", "server/server.js"]
