# Standard fuer Galerieseiten

Alle weiteren Galerieseiten werden im Stil der Seite
`/gallery/lovebirds-am-elbstrand/` umgesetzt.

## Verbindliche Bausteine

- Bilder werden als responsives, formatgerechtes Raster mit stabilen Seitenverhaeltnissen ausgegeben.
- Jedes Galeriebild ist per Tastatur erreichbar und besitzt einen konkreten Alt-Text.
- Die Vollbildansicht wird ausschliesslich mit
  `src/components/GalleryLightbox.astro` umgesetzt.
- Galerie-Ausloeser erhalten dieselbe `galleryId` wie die Lightbox:

```astro
<button
  type="button"
  data-gallery-trigger="gallery-name"
  data-full-src={item.image.src}
  data-alt={item.alt}
  aria-label={`Bild in Vollansicht oeffnen: ${item.alt}`}
>
  <!-- Optimiertes Astro Image -->
</button>

<GalleryLightbox
  galleryId="gallery-name"
  dialogLabel="Galeriename in Vollansicht"
/>
```

- Pfeile liegen immer auf der optischen Mitte des sichtbaren Bildes.
- Desktop, Tablet und Mobilansicht verwenden dieselbe Tastatur- und ARIA-Logik.
- Neue Galerien duerfen keine eigene, abweichende Lightbox-Kopie enthalten.
