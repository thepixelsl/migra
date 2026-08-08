# syntax=docker/dockerfile:1

FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
ENV PUBLIC_SITE_URL=https://artbild-fotografie.de
ENV PUBLIC_TRACKING_ENV=staging
ENV PUBLIC_TRACKING_ALLOWED_HOSTS=127.0.0.1,localhost
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/thepixelsl/migra"
LABEL org.opencontainers.image.description="Artbild Fotografie development runtime for bunny.net Magic Containers"

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
ENV DEV_NOINDEX=true

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/functions ./functions
COPY --from=build /app/src/worker.js ./src/worker.js
COPY --from=build /app/server ./server

USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server/bunny-server.mjs"]
