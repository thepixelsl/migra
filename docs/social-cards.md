# Social Cards

Das Projekt erzeugt beim Build fuer jede indexierbare Seite eine eigene
Open-Graph-Karte im Format 1200 x 630 Pixel. Die Karten liegen nach dem Build
unter `dist/social-cards/`. Die Datei `manifest.json` listet alle erzeugten
Dateien und die verwendeten Seitendaten auf.

## Ablauf

1. Astro baut die Website nach `dist/`.
2. `scripts/generate-social-cards.mjs` liest Titel, Beschreibung, vorhandene
   Social-Metadaten, JSON-LD und geeignete lokale Seitenbilder aus dem fertigen
   HTML.
3. Der Generator erstellt eine statische JPEG-Datei je indexierbarer URL.
4. Open-Graph- und Twitter-Metadaten werden im gebauten HTML vereinheitlicht.

404-, Danke-, API- und Admin-Seiten sowie Seiten mit `noindex` werden
ausgelassen. Logos, Favicons, Icons und der Kontakt-FAB sind als Bildquelle
ausgeschlossen. Wenn eine Seite kein eigenes geeignetes Motiv besitzt, wird
ein starkes fotografisches Standardmotiv verwendet.

## Seiten gezielt konfigurieren

Seitenspezifische Angaben werden zentral in `src/data/socialCards.mjs` unter
`socialCardOverrides` gepflegt. Der Key ist immer der interne Pfad mit
fuehrendem und abschliessendem Slash.

```js
"/trautermin-hamburg-online-reservieren/": {
  title: "Trautermine Hamburg",
  subtitle: "Online finden und reservieren",
  image: "/images/trautermin-hamburg.jpg",
  location: "Hamburg",
  label: "Ratgeber",
  year: 2027,
  updated: "2026-07-22",
  focalPoint: "center",
},
```

Unterstuetzte optionale Felder:

- `title`: kurze Social-Headline
- `subtitle`: kurze Unterzeile
- `image`: lokales Titelbild aus `public/` oder dem gebauten `_astro`-Ordner
- `location`: Ort
- `venue`: Location oder Standesamt
- `couple`: Namen eines Brautpaares
- `label`: Seitentyp, zum Beispiel `Hochzeitsreportage` oder `Ratgeber`
- `year`: feste Jahreszahl, `"current"` oder `"next"`
- `updated`: Aktualisierungsdatum im Format `YYYY-MM-DD`
- `datePublished`: Veroeffentlichungsdatum im Format `YYYY-MM-DD`
- `pageType`: interner Seitentyp
- `focalPoint`: `center`, `top`, `bottom`, `left` oder `right`

Eine feste Jahreszahl hat immer Vorrang. `current` und `next` werden beim
Build aus dem aktuellen Datum berechnet. Die Angaben aendern sich daher erst
mit dem naechsten Build. Der Generator behauptet niemals automatisch, dass
Termine frei sind, und verwendet keine Countdowns.

## Domain und Cache

Die absoluten Social-URLs folgen `PUBLIC_SITE_URL`. Damit funktioniert
dasselbe System auf der aktuellen `.ch`-Vorschau und spaeter auf `.de`:

```bash
PUBLIC_SITE_URL=https://artbild-fotografie.ch npm run build
```

Messenger und soziale Netzwerke cachen Vorschauen oft lange. Nach einem
Motivwechsel kann deshalb ein erneutes Einlesen durch das jeweilige
Plattform-Debugging-Werkzeug notwendig sein.

## Pruefung

```bash
npm run build
```

Der Build prueft danach automatisch:

- die vollstaendige Abdeckung aller indexierbaren Seiten,
- genau eine konsistente Open-Graph- und Twitter-Auszeichnung pro Seite,
- das Bildformat und Bildmass `1200 x 630 px`,
- den Ausschluss von Logos und Icons als Linkvorschau.

Bei einem Fehler stoppt der Build sichtbar. Das sichtbare Seitenlayout wird
vom Generator nicht veraendert.
