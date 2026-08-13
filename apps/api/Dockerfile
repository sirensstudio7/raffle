FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Workspace lockfile needs every workspace package.json present for `npm ci`.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/

RUN npm ci --workspace=api --include-workspace-root

COPY apps/api apps/api

WORKDIR /app/apps/api
RUN mkdir -p uploads

ENV NODE_ENV=production
ENV HOST=0.0.0.0

EXPOSE 8000

# Use the hoisted binary explicitly (more reliable than npx in workspaces).
CMD ["node", "--import", "tsx", "src/index.ts"]
