# Production API image (Railway / Render / Fly / any Docker host)
FROM node:20-bookworm-slim AS base
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/

RUN npm ci --workspace=api --include-workspace-root

COPY apps/api apps/api

WORKDIR /app/apps/api
ENV NODE_ENV=production

EXPOSE 8000
CMD ["npx", "tsx", "src/index.ts"]
