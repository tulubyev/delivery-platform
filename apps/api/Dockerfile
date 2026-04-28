FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# ── deps + build ──────────────────────────────────────────────────────────
FROM base AS builder
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json         apps/api/
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY packages/shared packages/shared
COPY apps/api         apps/api
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter @delivery/shared build || true
RUN pnpm --filter api build

# ── runner ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
ENV NODE_ENV=production PORT=3000
WORKDIR /app

# Берём готовый node_modules из builder (включает prisma client)
COPY --from=builder /app/node_modules       node_modules
COPY --from=builder /app/packages           packages
COPY --from=builder /app/apps/api/dist      apps/api/dist
COPY --from=builder /app/apps/api/prisma    apps/api/prisma
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/

RUN mkdir -p /app/uploads
EXPOSE 3000
WORKDIR /app/apps/api

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/app.js"]
