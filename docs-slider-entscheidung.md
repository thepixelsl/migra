# SEO-freundliche Slider-Umsetzung

## Empfehlung

Für diese Migration ist die beste Variante:

- Astro rendert alle Slider-Slides statisch im HTML.
- Desktop- und Mobile-Slider bleiben getrennte Markup-Blöcke.
- Nur die passende Variante wird per kleinem Vanilla-JS initialisiert.
- Die ersten relevanten Bilder bleiben priorisiert, weitere Bilder werden nachgelagert geladen.
- Keine Abhängigkeit wie Swiper, Splide, Slick oder Smart Slider.

## Warum keine Slider-Bibliothek?

Bibliotheken wie Swiper oder Splide sind technisch gut, aber für diesen konkreten Hero-Slider bringen sie mehr JavaScript, mehr Hydration-Logik und oft DOM-Wrapping mit. Für SEO und Performance ist hier besser, das vorhandene, einfache Verhalten direkt umzusetzen:

- statisches HTML ist crawlbar
- Alt-Texte bleiben direkt im Dokument
- ohne JavaScript ist ein Noscript-Fallback vorhanden
- weniger JavaScript im Above-the-fold-Bereich
- keine jQuery- oder WordPress-Abhängigkeit

## Astro-Rolle

Astro ist hier ideal als statischer Generator: Die Seite wird zu HTML/CSS/JS gebaut, aber kann später in Komponenten zerlegt werden, ohne den Frontend-Overhead eines SPA-Frameworks.
