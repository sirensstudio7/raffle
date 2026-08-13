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

# Render may set NODE_ENV=production during build; keep typescript available for `tsc`.
RUN npm ci --workspace=api --include-workspace-root --include=dev

COPY apps/api apps/api

WORKDIR /app/apps/api
RUN npx tsc -p tsconfig.json && mkdir -p uploads

ENV NODE_ENV=production
ENV HOST=0.0.0.0

EXPOSE 8000

# Compiled JS — no tsx needed at runtime.
CMD ["node", "dist/index.js"]
