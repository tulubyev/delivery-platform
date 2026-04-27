FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json         apps/web/
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS builder
COPY packages/shared packages/shared
COPY apps/web         apps/web
ARG VITE_API_URL=https://api.delivery.yourdomain.ru
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @delivery/shared build 2>/dev/null || true
RUN pnpm --filter web build

# Финальный образ — просто статика (nginx берёт через volume)
FROM scratch AS export
COPY --from=builder /app/apps/web/dist /
