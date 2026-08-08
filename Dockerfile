# syntax=docker/dockerfile:1

FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
ARG PUBLIC_SITE_URL=https://artbild-fotografie.de
ARG PUBLIC_TRACKING_ENV=staging
ARG PUBLIC_TRACKING_ALLOWED_HOSTS=127.0.0.1,localhost
ARG PUBLIC_GTM_CONTAINER_ID=
ARG PUBLIC_GA4_MEASUREMENT_ID=
ARG PUBLIC_META_PIXEL_ID=
ARG PUBLIC_CLARITY_PROJECT_ID=
ARG PUBLIC_GA4_DATA_RETENTION_MONTHS=
ARG PUBLIC_CONSENT_VERSION=2026-08-08.1
ENV PUBLIC_SITE_URL=${PUBLIC_SITE_URL}
ENV PUBLIC_TRACKING_ENV=${PUBLIC_TRACKING_ENV}
ENV PUBLIC_TRACKING_ALLOWED_HOSTS=${PUBLIC_TRACKING_ALLOWED_HOSTS}
ENV PUBLIC_GTM_CONTAINER_ID=${PUBLIC_GTM_CONTAINER_ID}
ENV PUBLIC_GA4_MEASUREMENT_ID=${PUBLIC_GA4_MEASUREMENT_ID}
ENV PUBLIC_META_PIXEL_ID=${PUBLIC_META_PIXEL_ID}
ENV PUBLIC_CLARITY_PROJECT_ID=${PUBLIC_CLARITY_PROJECT_ID}
ENV PUBLIC_GA4_DATA_RETENTION_MONTHS=${PUBLIC_GA4_DATA_RETENTION_MONTHS}
ENV PUBLIC_CONSENT_VERSION=${PUBLIC_CONSENT_VERSION}
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
