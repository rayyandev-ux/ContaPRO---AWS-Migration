# syntax=docker/dockerfile:1
# Multi-stage Dockerfile for Next.js (production image)
# Optimized for fast builds via aggressive layer caching

# --- Stage 1: Dependencies (cached unless package-lock changes) ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# --- Stage 2: Build (cached unless source changes) ---
FROM node:22-alpine AS builder
WORKDIR /app

# Re-use cached node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./

# Copy source
COPY . .

ARG NEXT_PUBLIC_API_BASE
ARG NEXT_PUBLIC_LANDING_HOST
ARG NEXT_PUBLIC_APP_HOST
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE} \
    NEXT_PUBLIC_LANDING_HOST=${NEXT_PUBLIC_LANDING_HOST} \
    NEXT_PUBLIC_APP_HOST=${NEXT_PUBLIC_APP_HOST}
RUN npm run build

# --- Stage 3: Runtime (minimal footprint) ---
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# curl for healthcheck (alpine uses apk)
RUN apk add --no-cache curl

# Non-root user (Alpine already has 'node' user at uid 1000)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public folder
COPY --from=builder /app/public ./public

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create cache directory for Next.js image optimization
RUN mkdir -p /app/.next/cache && chown -R nextjs:nodejs /app/.next/cache

EXPOSE 3000

# Healthcheck against root
HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD curl -fsS http://localhost:${PORT}/ || exit 1

USER nextjs

# Run Next.js server
CMD ["node", "server.js"]
