# syntax=docker/dockerfile:1
# =============================================================================
# Dockerfile multi-stage para el Backend de ContaPRO (Fastify + Prisma + Python)
# - Usa pnpm (el proyecto tiene pnpm-lock.yaml, NO package-lock.json)
# - Optimizado para builds rápidos mediante caché agresiva de capas
# - La imagen final corre como usuario sin privilegios (node)
# =============================================================================

# --- Stage 1: Dependencias de Node (se cachea salvo que cambie pnpm-lock.yaml) ---
FROM node:22-bullseye-slim AS deps
WORKDIR /app
# corepack activa pnpm sin instalarlo globalmente (viene incluido en Node 22)
RUN corepack enable && corepack prepare pnpm@9 --activate
# node-linker=hoisted: hace que pnpm genere un node_modules "plano" (estilo npm).
# Es necesario para poder copiar subcarpetas concretas (.prisma, @prisma/client)
# en el stage final sin romper los symlinks internos de pnpm.
RUN echo "node-linker=hoisted" > .npmrc
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# --- Stage 2: Prisma generate (se cachea salvo que cambie el schema) ---
FROM deps AS prisma
WORKDIR /app
COPY prisma ./prisma
RUN pnpm exec prisma generate

# --- Stage 3: Compilación de TypeScript (se cachea salvo que cambie src/) ---
FROM prisma AS builder
WORKDIR /app
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

# --- Stage 4: Entorno virtual de Python (se cachea salvo que cambie requirements.txt) ---
FROM python:3.11-slim-bullseye AS python-builder
WORKDIR /app/python
COPY python/requirements.txt ./requirements.txt
RUN python -m venv /app/python/.venv && \
    /app/python/.venv/bin/pip install --upgrade pip
RUN --mount=type=cache,target=/root/.cache/pip \
    /app/python/.venv/bin/pip install -r requirements.txt
COPY python/ ./

# --- Stage 5: Dependencias de producción (sin devDependencies) ---
FROM node:22-bullseye-slim AS prod-deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
RUN echo "node-linker=hoisted" > .npmrc
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# --- Stage 6: Imagen final (runtime) ---
FROM node:22-bullseye-slim AS runtime
WORKDIR /app

# Dependencias del SO para sharp, healthcheck (curl) y Puppeteer/Chromium
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

# Evita que Puppeteer descargue Chrome y usa el Chromium del sistema
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# node_modules de producción (pre-construido, sin instalar nada en este stage)
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./

# Schema de Prisma y cliente generado desde el stage builder
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Aplicación compilada y plantillas de email
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/templates ./src/templates

# Entorno virtual de Python y scripts (OCR / LLM)
COPY --from=python-builder /app/python ./python

# Directorio de uploads con permisos de escritura para el usuario node
RUN mkdir -p /app/uploads && \
    chown -R node:node /app/uploads && \
    chown -R node:node /app/python

# Variables por defecto (ECS las puede sobreescribir en la task definition)
ENV NODE_ENV=production \
    PORT=8080 \
    LLM_BACKEND=python \
    PYTHON_CMD=/app/python/.venv/bin/python \
    NODE_OPTIONS=--experimental-specifier-resolution=node

EXPOSE 8080

# Healthcheck local del contenedor (el ALB usa /api/health por su cuenta)
HEALTHCHECK --interval=20s --timeout=3s --retries=5 CMD curl -fsS http://localhost:${PORT}/health || exit 1

# Entrypoint: aplica migraciones de Prisma (idempotente) antes de arrancar.
# Garantiza que tras cada terraform apply la BD quede con el schema completo.
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER node

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "--experimental-specifier-resolution=node", "dist/index.js"]
