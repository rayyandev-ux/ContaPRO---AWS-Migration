# syntax=docker/dockerfile:1
# Multi-stage Dockerfile for ContaPRO Backend
# Optimized for fast builds via aggressive layer caching

# --- Stage 1: Node dependencies (cached unless package-lock changes) ---
FROM node:22-bullseye-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# --- Stage 2: Prisma generate (cached unless prisma schema changes) ---
FROM deps AS prisma
WORKDIR /app
COPY prisma ./prisma
RUN npx prisma generate

# --- Stage 3: TypeScript build (cached unless src changes) ---
FROM prisma AS builder
WORKDIR /app
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Stage 4: Python venv (cached unless requirements.txt changes) ---
FROM python:3.11-slim-bullseye AS python-builder
WORKDIR /app/python
COPY python/requirements.txt ./requirements.txt
RUN python -m venv /app/python/.venv && \
    /app/python/.venv/bin/pip install --upgrade pip
RUN --mount=type=cache,target=/root/.cache/pip \
    /app/python/.venv/bin/pip install -r requirements.txt
COPY python/ ./

# --- Stage 5: Production dependencies (cached unless package-lock changes) ---
FROM node:22-bullseye-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# --- Stage 6: Runtime ---
FROM node:22-bullseye-slim AS runtime
WORKDIR /app

# OS deps needed by sharp, healthcheck AND Puppeteer (single layer, sorted)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      chromium \
      curl \
      fonts-liberation \
      fonts-noto-color-emoji \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libc6 \
      libcairo2 \
      libcups2 \
      libdbus-1-3 \
      libexpat1 \
      libfontconfig1 \
      libgbm1 \
      libgcc1 \
      libglib2.0-0 \
      libgtk-3-0 \
      libnspr4 \
      libnss3 \
      libpango-1.0-0 \
      libpangocairo-1.0-0 \
      libstdc++6 \
      libvips \
      libx11-6 \
      libx11-xcb1 \
      libxcb1 \
      libxcomposite1 \
      libxcursor1 \
      libxdamage1 \
      libxext6 \
      libxfixes3 \
      libxi6 \
      libxrandr2 \
      libxrender1 \
      libxss1 \
      libxtst6 \
      lsb-release \
      xdg-utils && \
    rm -rf /var/lib/apt/lists/*

# Skip Puppeteer's Chrome download and use the system Chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy production node_modules (pre-built, no npm install at this stage)
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./

# Copy Prisma schema and generated client from builder
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy built app and templates
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/templates ./src/templates

# Copy pre-built Python venv and scripts
COPY --from=python-builder /app/python ./python

# Uploads directory writable
RUN mkdir -p /app/uploads && \
    chown -R node:node /app/uploads && \
    chown -R node:node /app/python

ENV NODE_ENV=production \
    PORT=8080 \
    LLM_BACKEND=python \
    PYTHON_CMD=/app/python/.venv/bin/python \
    NODE_OPTIONS=--experimental-specifier-resolution=node

EXPOSE 8080

# Simple healthcheck against /health
HEALTHCHECK --interval=20s --timeout=3s --retries=5 CMD curl -fsS http://localhost:${PORT}/health || exit 1

USER node

CMD ["node", "--experimental-specifier-resolution=node", "dist/index.js"]
