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

# Only copy what's needed to run
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

# Azure App Service uses port 8080 by default
ENV PORT=8080
EXPOSE 8080

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
