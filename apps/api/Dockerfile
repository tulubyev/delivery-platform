FROM node:20-alpine AS builder
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY apps/api/ apps/api/
COPY packages/shared/ packages/shared/
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api build

FROM node:20-alpine AS runner
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/prisma apps/api/prisma
COPY --from=builder /app/node_modules/.pnpm/@prisma+client*/node_modules/@prisma/client ./node_modules/@prisma/client 2>/dev/null || true
RUN mkdir -p /app/uploads
EXPOSE 3000
WORKDIR /app/apps/api
CMD ["node", "dist/app.js"]
