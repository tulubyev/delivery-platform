FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# ── deps: только манифесты для кэша слоёв ─────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json         apps/api/
RUN pnpm install --frozen-lockfile --ignore-scripts

# ── builder ────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY packages/shared packages/shared
COPY apps/api         apps/api
# Prisma client генерируется до TypeScript сборки
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter @delivery/shared build 2>/dev/null || true
RUN pnpm --filter api build

# ── runner (только production зависимости) ─────────────────────────────────
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
ENV NODE_ENV=production PORT=3000

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json         apps/api/
RUN pnpm install --frozen-lockfile --ignore-scripts --prod

# Prisma client + schema (нужен для migrate deploy при старте)
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client \
                    node_modules/.pnpm/@prisma+client@5.22.0/node_modules/@prisma/client 2>/dev/null || true
COPY --from=builder /app/node_modules/.prisma node_modules/.prisma
COPY apps/api/prisma apps/api/prisma

# Собранный JS
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/packages/shared/dist packages/shared/dist 2>/dev/null || true

RUN mkdir -p /app/uploads
EXPOSE 3000
WORKDIR /app/apps/api

# При старте: применить миграции, затем запустить сервер
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
