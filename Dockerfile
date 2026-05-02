# ============================================================
# Ticket Schmiede - Multi-Stage Dockerfile
# ============================================================

# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN --mount=type=cache,target=/root/.npm \
    npm ci
RUN npx prisma generate

# Stage 2: Builder
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma client is already generated, copy it
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

ARG DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV DATABASE_URL=${DATABASE_URL}

RUN npm run build

# Stage 3: Runner (production image)
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl tini curl postgresql-client

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# The official node image already provides user/group node:node as UID/GID 1000.
# We use it directly so bind mounts (uploads/backups) can be owned by 1000:1000 on the host.

# Copy built application
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Copy Prisma schema and full node_modules (needed for prisma migrate deploy)
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

# Copy startup script
COPY --from=builder --chown=node:node /app/scripts ./scripts
RUN chmod +x /app/scripts/start.sh \
    && mkdir -p /app/uploads /app/public/uploads /app/backups \
    && chown -R node:node /app/uploads /app/public/uploads /app/backups /app/scripts

USER node

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV UPLOAD_DIR=/app/uploads
ENV BACKUP_DIR=/app/backups

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

CMD ["/app/scripts/start.sh"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
