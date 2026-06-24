# Standard fuer Galerieseiten

Alle weiteren Galerieseiten werden im Stil der Seite
`/gallery/lovebirds-am-elbstrand/` umgesetzt.

## Verbindliche Bausteine

- Bilder werden als responsives, formatgerechtes Raster mit stabilen Seitenverhaeltnissen ausgegeben.
- Jedes Galeriebild ist per Tastatur erreichbar und besitzt einen konkreten Alt-Text.
- Bildraster und Vollbildansicht werden ausschliesslich mit
  `src/components/GalleryImageGrid.astro` umgesetzt. Die Komponente bindet
  `src/components/GalleryLightbox.astro` automatisch ein.
- Die Bilder werden in Spalten uebergeben:

```astro
<GalleryImageGrid
  columns={galleryColumns}
  galleryId="gallery-name"
  label="Galeriename Galerie"
  dialogLabel="Galeriename in Vollansicht"
/>
```

- Pfeile liegen immer auf der optischen Mitte des sichtbaren Bildes.
- Desktop, Tablet und Mobilansicht verwenden dieselbe Tastatur- und ARIA-Logik.
- Neue Galerien duerfen keine eigene, abweichende Lightbox-Kopie enthalten.
