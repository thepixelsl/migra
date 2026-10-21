# syntax=docker/dockerfile:1

# The new security release is available from nodejs.org before all Docker
# platforms have been published. Pin the available base and verify the official
# linux/amd64 runtime explicitly instead of retaining its older Node binary.
FROM node:24.22.0-bookworm-slim@sha256:91acba91b842bec0bf7ea6f5e09c644c7ccad72c4996ed9616d861d1c7cd60d4 AS node-base
ADD --checksum=sha256:eb6728e77c576a35162c122c45ccadf224d89ff00abc8dae46cc2897c6002d7c https://nodejs.org/dist/v24.22.1/node-v24.22.1-linux-x64.tar.gz /tmp/node-runtime.tar.gz
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/include/node \
    && tar -xzf /tmp/node-runtime.tar.gz --strip-components=1 -C /usr/local \
    && rm /tmp/node-runtime.tar.gz \
    && node -e "if (process.version !== 'v24.22.1') process.exit(1)"
ENV NODE_VERSION=24.22.1

FROM node-base AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
ARG PUBLIC_SITE_URL=https://artbild-fotografie.de
ARG HUB_RELEASE_ID=
ARG PUBLIC_TRACKING_ENV=production
ARG PUBLIC_TRACKING_ALLOWED_HOSTS=artbild-fotografie.de,www.artbild-fotografie.de
ARG PUBLIC_GTM_CONTAINER_ID=GTM-5TM37JC
ARG PUBLIC_GA4_MEASUREMENT_ID=G-TSWGFD1YKF
ARG PUBLIC_GA4_DATA_RETENTION_MONTHS=14
ARG PUBLIC_GOOGLE_ADS_ID=AW-874983678
ARG PUBLIC_GOOGLE_ADS_CONVERSION_LABEL=J-MWCM7x9IsdEP7hnKED
ARG PUBLIC_OPENAI_ADS_PIXEL_ID=
ARG PUBLIC_CONSENT_VERSION=2026-10-01.3
ENV PUBLIC_SITE_URL=${PUBLIC_SITE_URL}
ENV PUBLIC_TRACKING_ENV=${PUBLIC_TRACKING_ENV}
ENV PUBLIC_TRACKING_ALLOWED_HOSTS=${PUBLIC_TRACKING_ALLOWED_HOSTS}
ENV PUBLIC_GTM_CONTAINER_ID=${PUBLIC_GTM_CONTAINER_ID}
ENV PUBLIC_GA4_MEASUREMENT_ID=${PUBLIC_GA4_MEASUREMENT_ID}
ENV PUBLIC_GA4_DATA_RETENTION_MONTHS=${PUBLIC_GA4_DATA_RETENTION_MONTHS}
ENV PUBLIC_GOOGLE_ADS_ID=${PUBLIC_GOOGLE_ADS_ID}
ENV PUBLIC_GOOGLE_ADS_CONVERSION_LABEL=${PUBLIC_GOOGLE_ADS_CONVERSION_LABEL}
ENV PUBLIC_OPENAI_ADS_PIXEL_ID=${PUBLIC_OPENAI_ADS_PIXEL_ID}
ENV PUBLIC_CONSENT_VERSION=${PUBLIC_CONSENT_VERSION}
RUN npm run build && HUB_RELEASE_ID="$HUB_RELEASE_ID" node scripts/mark-hub-release.mjs

FROM node-base AS runtime
WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/thepixelsl/migra"
LABEL org.opencontainers.image.description="Artbild Fotografie runtime for bunny.net Magic Containers"

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
ENV DEV_NOINDEX=true

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/functions ./functions
COPY --from=build /app/src/worker.js ./src/worker.js
COPY --from=build /app/src/lib/legacyRedirects.mjs ./src/lib/legacyRedirects.mjs
COPY --from=build /app/src/lib/webStorySecurity.mjs ./src/lib/webStorySecurity.mjs
COPY --from=build /app/src/AgentRateLimiter.js ./src/AgentRateLimiter.js
COPY --from=build /app/server ./server
RUN node --input-type=module -e "await import('./src/worker.js')"

USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server/bunny-server.mjs"]
