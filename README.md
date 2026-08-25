# Artbild Migration

Astro-Version der statischen Artbild-Migration aus `../output`.

## Start

```bash
npm install
npm run dev
```

Danach:

```text
http://127.0.0.1:4321
```

## Slider-Entscheidung

Der Hero-Slider bleibt bewusst ohne externe Carousel-Bibliothek. Die Slides werden von Astro als statisches HTML gerendert, inklusive lokaler Bildpfade und Alt-Texte. Ein kleines Vanilla-JavaScript initialisiert nur die aktive Desktop- oder Mobile-Variante, Autoplay, Hover-Pause und Swipe.

Das ist SEO-freundlicher als ein vollständig clientseitiger Slider, weil Suchmaschinen und Nutzer ohne JavaScript weiterhin semantisches HTML und Bildinhalte erhalten.

## Terminverfügbarkeit mit Cloudflare KV

Der Floating Action Button prüft einzelne Wunschdaten über:

```text
GET /api/availability?date=YYYY-MM-DD
```

Die öffentliche API gibt niemals die komplette Liste aus. Gespeichert werden nur blockierte Datumswerte im Format `YYYY-MM-DD` unter dem KV-Key `blockedDates`.

### Cloudflare KV

Der KV-Namespace ist als Binding `AVAILABILITY_KV` vorgesehen.

Anlegen per Wrangler:

```bash
wrangler kv namespace create AVAILABILITY_KV
```

Danach den Namespace im Worker als Binding setzen:

```text
Binding name: AVAILABILITY_KV
KV namespace: AVAILABILITY_KV
```

Für dieses Repository ist der aktuelle Namespace bereits in `wrangler.toml` und `wrangler.worker.toml` eingetragen.

### Lokale Entwicklung

Für die Worker-Vorschau:

```bash
npm run build
wrangler dev --config wrangler.worker.toml
```

Der Cloudflare-Worker bleibt das bestehende Produktionsziel:

```text
https://migra.fancy-wildflower-0608.workers.dev
```

Worker-Preview-URLs sind deaktiviert. Cloudflare Pages wird für dieses Projekt
nicht als zusätzliches Deployment-Ziel verwendet.

Daneben gibt es die getrennte Bunny-Dev-App `artbild-dev`. Sie wird als
Linux/amd64-Container gebaut und bewusst mit `DEV_NOINDEX=true` betrieben.
`npm run deploy` veröffentlicht ausschließlich den Cloudflare-Worker und darf
nicht für den Bunny-Rollout verwendet werden. Der vollständige Bunny-Ablauf
steht in [`docs/bunny-dev-deploy.md`](docs/bunny-dev-deploy.md).

Lokale Secrets gehören in `.dev.vars`. Eine Vorlage liegt in `.dev.vars.example`. Keine echten Secrets committen.

### Admin-Bereich

Die geschützte Terminpflege liegt unter:

```text
/admin-termine
```

Die Admin-API liegt unter:

```text
GET  /api/admin/availability
POST /api/admin/availability
```

Cloudflare Access muss diese Pfade schützen:

```text
/admin-termine
/admin-termine/*
/api/admin/*
```

Empfohlene Access-Konfiguration:

1. In Cloudflare Zero Trust eine Self-hosted Application für `artbild-fotografie.ch` anlegen.
2. Die oben genannten Pfade zur Application hinzufügen.
3. Eine Allow-Policy nur für `info@artbild-fotografie.de` setzen.
4. MFA/2FA für den Identity Provider erzwingen.
5. Optional zusätzlich `ADMIN_EMAIL=info@artbild-fotografie.de` als Worker/Pages-Variable setzen.

Die API prüft zusätzlich den Cloudflare-Access-Header `Cf-Access-Authenticated-User-Email`. Ohne passenden Access-Login werden keine Admin-Daten ausgegeben und keine Termine geändert.

### Datenmodell

Beispielwert in KV:

```json
["2026-07-18", "2026-08-22", "2026-09-05"]
```

Es werden keine Kundennamen, keine Kontaktdaten und keine Notizen gespeichert.

## Social Cards

Der Build erzeugt fuer jede indexierbare Seite eine statische Social Card im
Format 1200 x 630 Pixel und vereinheitlicht die Open-Graph- und Twitter-Tags.
Seitenspezifische Angaben werden zentral in `src/data/socialCards.mjs`
gepflegt. Die vollstaendige Dokumentation steht unter
[`docs/social-cards.md`](docs/social-cards.md).

## Consent und Tracking

Der Cookie-Banner, Google Consent Mode, Google Tag Manager, GA4 sowie die dort
eingerichteten Meta- und Clarity-Tags werden über eine zentrale, hostgebundene
Build-Konfiguration gesteuert. Production-Builds prüfen die Kennungen und die
Domainfreigabe vor dem Build. Meta und Clarity erhalten zusätzlich eigene
Consent-Sperren im GTM-Container.

Einrichtung, Data-Layer-Vertrag und Live-Umschaltung:
[`docs/tracking-consent.md`](docs/tracking-consent.md).
