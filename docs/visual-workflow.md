# Visual Migration Workflow

Dieser Workflow ist fuer die Migration einzelner WordPress-/Flothemes-Seiten nach Astro gedacht. Er erzeugt pro Seite Vergleichs-Screenshots der WordPress-Referenz und des lokalen Astro-Builds in drei Viewports.

## Einmalige Einrichtung

Im Projektordner ausfuehren:

```bash
cd /Volumes/Cache/migra/migra-repo
npm install -D @playwright/test
npx playwright install
```

Falls die Installation lokal wegen fehlendem Netzwerkzugriff scheitert:

```text
getaddrinfo ENOTFOUND registry.npmjs.org
```

Wenn das lokal passiert, die beiden Befehle einfach in einem Terminal mit Internetzugang erneut ausfuehren.

## Lokalen Astro-Stand starten

In Terminal 1:

```bash
cd /Volumes/Cache/migra/migra-repo
npm run dev -- --port 4321
```

## Screenshots erzeugen

In Terminal 2:

```bash
cd /Volumes/Cache/migra/migra-repo
REFERENCE_URL="https://artbild-fotografie.de/portfolio/" \
ASTRO_URL="http://localhost:4321/portfolio/" \
PAGE_LABEL="portfolio" \
npm run test:visual
```

Alternativ koennen Basis-URLs plus Pfad genutzt werden:

```bash
REFERENCE_URL="https://artbild-fotografie.de" \
ASTRO_URL="http://localhost:4321" \
PAGE_PATH="/portfolio/" \
PAGE_LABEL="portfolio" \
npm run test:visual
```

Die Screenshots landen hier:

```text
screenshots/reference/<page-label>/mobile.png
screenshots/reference/<page-label>/tablet.png
screenshots/reference/<page-label>/desktop.png
screenshots/astro/<page-label>/mobile.png
screenshots/astro/<page-label>/tablet.png
screenshots/astro/<page-label>/desktop.png
```

## Viewports

- Mobile: 390 x 844 px
- Tablet: 768 x 1024 px
- Desktop: 1440 x 1200 px

## Optional stabile Screenshots

Wenn Cookie-Banner, Chat-Widgets oder Adminleisten stoeren, koennen Selektoren fuer den Screenshot versteckt werden:

```bash
HIDE_SELECTORS=".cookie-banner,.chat-widget,#wpadminbar" npm run test:visual
```

Mit `CAPTURE_DELAY_MS=2000` kann nach dem Laden laenger gewartet werden. Mit `FULL_PAGE=false` wird nur der sichtbare Viewport aufgenommen.

## Migrationsablauf

1. WordPress-Referenz-URL festlegen.
2. Astro-Seite im passenden `src/pages/...` Pfad erstellen.
3. Lokale Bilder in `src/assets/...` oder `public/images/...` ablegen.
4. Astro-Dev-Server starten.
5. Mit `npm run test:visual` Referenz- und Astro-Screenshots erzeugen.
6. Screenshots nebeneinander pruefen: Header, Menue, Typografie, Bildwirkung, Whitespace, Grid, CTA-Bereiche und responsive Verhalten.
7. Astro-CSS minimal anpassen.
8. Screenshots erneut erzeugen, bis die Seite optisch nah genug am Original ist.
9. Abschliessend `npm run build` ausfuehren.

Der Test veraendert keine Seiteninhalte. Er deaktiviert nur Animationen und Transitions waehrend der Aufnahme, damit Vergleiche ruhiger und reproduzierbarer werden.
