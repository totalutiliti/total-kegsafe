# ============================================================================
# KegSafe Tech — Frontend Dockerfile (Next.js 16 with standalone output)
# Multi-stage build for minimal production image
# ============================================================================

# --- Stage 1: Install dependencies ---
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# --- Stage 2: Build ---
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars (replaced at build time)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# --- Stage 3: Production ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Next.js standalone output copies only what's needed
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Azure App Service uses port 8080 by default
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"
EXPOSE 8080

CMD ["node", "server.js"]
