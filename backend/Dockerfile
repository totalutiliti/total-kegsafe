# ============================================================================
# KegSafe Tech — Backend Dockerfile (NestJS + Prisma)
# Multi-stage build for minimal production image
# ============================================================================

# --- Stage 1: Install dependencies ---
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN npm ci

# --- Stage 2: Build ---
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build

# --- Stage 3: Production ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Only copy what's needed to run — owned by the non-root "node" user (uid 1000)
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./

# Writable uploads dir (disposal photos) owned by the non-root user
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

# Azure App Service uses port 8080 by default
ENV PORT=8080
EXPOSE 8080

# Healthcheck HTTP no endpoint público /health (usado pelo docker-compose local;
# no Azure App Service quem vale são as health probes do próprio serviço).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -q --spider http://localhost:8080/api/v1/health || exit 1

# Drop root privileges — never run the app as root
USER node

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
