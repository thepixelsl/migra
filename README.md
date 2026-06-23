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
