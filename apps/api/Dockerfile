FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# ── deps ──────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json         apps/api/
RUN pnpm install --frozen-lockfile --ignore-scripts

# ── builder ────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api         apps/api
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter @delivery/shared build || true
RUN pnpm --filter api build

# ── runner ─────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production PORT=3000

# Prod зависимости
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json         apps/api/
RUN pnpm install --frozen-lockfile --ignore-scripts --prod

# Schema + prisma generate в runner (самый надёжный способ в pnpm)
COPY apps/api/prisma apps/api/prisma
RUN pnpm --filter api exec prisma generate

# Собранный код
COPY --from=builder /app/apps/api/dist apps/api/dist

RUN mkdir -p /app/uploads
EXPOSE 3000
WORKDIR /app/apps/api

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
