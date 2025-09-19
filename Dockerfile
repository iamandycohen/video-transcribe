# Multi-stage build for production
FROM node:20-alpine AS builder

# Build arguments (set by Azure ACR build)
ARG BUILD_VERSION=2.0.0-stateless-dev
ARG BUILD_TIMESTAMP
ARG GIT_COMMIT=unknown
ARG GIT_BRANCH=unknown
ARG IMAGE_TAG=latest

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY package*.json ./
COPY packages/ ./packages/

# Install all dependencies (workspace aware)
RUN npm ci

# Fix permissions for node_modules binaries  
RUN chmod +x ./node_modules/.bin/*

# Build all packages
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install ffmpeg for audio processing
RUN apk add --no-cache ffmpeg

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy workspace package files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/server/package.json ./packages/server/
COPY --from=builder /app/packages/core/package.json ./packages/core/

# Create packages directory structure
RUN mkdir -p packages/server packages/core

# Copy built server application
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/core/dist ./packages/core/dist

# Install only production dependencies for server package
RUN npm ci --only=production && npm cache clean --force

# Set build info as environment variables in the container
ENV BUILD_VERSION=${BUILD_VERSION}
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP}
ENV GIT_COMMIT=${GIT_COMMIT}
ENV GIT_BRANCH=${GIT_BRANCH}
ENV IMAGE_TAG=${IMAGE_TAG}

# Create required directories
RUN mkdir -p temp output logs
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the stateless API server
CMD ["node", "packages/server/dist/server.js"]
