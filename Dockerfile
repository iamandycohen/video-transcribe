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

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for TypeScript)
RUN npm ci

# Copy source code
COPY . .

# Fix permissions for node_modules binaries
RUN chmod +x ./node_modules/.bin/*

# Build the application
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

# Copy package files first
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

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
CMD ["node", "dist/src/api-server-stateless.js"]
