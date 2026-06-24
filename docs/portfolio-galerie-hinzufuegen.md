# Neue Galerie zum Portfolio hinzufuegen

Die Portfolio-Seite wird vollstaendig aus `src/data/portfolio.ts` erzeugt.
Filter, Reihenfolge, strukturierte Daten und die Kartenansicht aktualisieren
sich automatisch.

## Vorgehen

1. Das Vorschaubild unter `src/assets/portfolio/` ablegen.
2. Das Bild in `src/data/portfolio.ts` importieren.
3. Einen Eintrag zum internen Array `entries` hinzufuegen:

```ts
{
  title: "Name der Galerie",
  category: "Couples",
  filter: "Hochzeit",
  date: "24.06.2026",
  href: "/gallery/name-der-galerie/",
  image: vorschaubild,
  alt: "Konkrete Beschreibung des Vorschaubildes",
  aspect: "landscape",
},
```

## Regeln

- Neue Eintraege werden anhand des Datums automatisch sortiert.
- `href` verweist bei migrierten Galerien immer auf die lokale Astro-Route.
- `alt` beschreibt das sichtbare Motiv und wiederholt nicht nur den Titel.
- Erlaubte Filter sind `Travel`, `Hochzeit` und `Peoplefotografie`.
- Erlaubte Formate sind `square`, `portrait` und `landscape`.
- Die Portfolio-Seite zeigt zunaechst neun Eintraege; weitere werden ohne
  Seitenwechsel ueber „Mehr Galerien anzeigen“ eingeblendet.
