# Image e-PR untuk server internal. Build:  docker compose build
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Tahap "tools": berisi semua dependency — dipakai untuk migrasi & seed database.
FROM deps AS tools
COPY . .
RUN npx prisma generate

FROM tools AS builder
ARG SERVER_ACTIONS_ALLOWED_ORIGINS=""
ENV NEXT_TELEMETRY_DISABLED=1 SERVER_ACTIONS_ALLOWED_ORIGINS=$SERVER_ACTIONS_ALLOWED_ORIGINS
RUN npm run build

# Tahap runtime: hanya server Next.js standalone (kecil, tanpa source code).
FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl curl && rm -rf /var/lib/apt/lists/* \
  && groupadd -r epr && useradd -r -g epr epr
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=epr:epr /app/.next/standalone ./
COPY --from=builder --chown=epr:epr /app/.next/static ./.next/static
COPY --from=builder --chown=epr:epr /app/public ./public
RUN mkdir -p /app/uploads && chown epr:epr /app/uploads
USER epr
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -fs http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]
