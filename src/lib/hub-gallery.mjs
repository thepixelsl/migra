// Shared by the React preview and the standalone HTML export. No user code is executed.
export function installGalleryBehavior(root) {
  const grids = [...root.querySelectorAll('.gallery-layout-masonry')];
  const tiles = grids.flatMap(grid => [...grid.children]);
  const measure = () => tiles.forEach(tile => {
    const grid = getComputedStyle(tile.parentElement);
    const gap = parseFloat(grid.rowGap) || 0;
    const row = parseFloat(grid.gridAutoRows) || 4;
    tile.style.gridRowEnd = `span ${Math.max(1, Math.ceil((tile.firstElementChild.offsetHeight + gap) / (row + gap)))}`;
  });
  const observer = new ResizeObserver(measure);
  tiles.forEach(tile => observer.observe(tile.firstElementChild));
  measure();
  const links = [...root.querySelectorAll('[data-gallery-open]')];
  let dialog, previous, index = 0;
  const close = () => { dialog?.close(); };
  const show = (next) => {
    index = (next + links.length) % links.length;
    const source = links[index].querySelector('img');
    const image = dialog.querySelector('img');
    image.src = links[index].href;
    image.alt = source.alt;
    dialog.querySelector('[data-gallery-caption]').textContent = links[index].dataset.caption || source.alt;
    dialog.querySelector('[data-gallery-count]').textContent = `${index + 1} / ${links.length}`;
  };
  const open = (event) => {
    const link = event.target.closest('[data-gallery-open]');
    if (!link || !root.contains(link) || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    previous = link;
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'hub-gallery-lightbox';
      dialog.setAttribute('aria-label', 'Galerie in Vollansicht');
      dialog.innerHTML = '<button type="button" class="gallery-close" aria-label="Vollansicht schließen">×</button><div class="gallery-lightbox-stage"><button type="button" data-gallery-prev aria-label="Vorheriges Bild">←</button><img alt=""><button type="button" data-gallery-next aria-label="Nächstes Bild">→</button></div><div class="gallery-lightbox-footer"><span data-gallery-caption></span><span data-gallery-count aria-live="polite"></span></div>';
      document.body.append(dialog);
      dialog.querySelector('.gallery-close').addEventListener('click', close);
      dialog.querySelector('[data-gallery-prev]').addEventListener('click', () => show(index - 1));
      dialog.querySelector('[data-gallery-next]').addEventListener('click', () => show(index + 1));
      dialog.addEventListener('close', () => previous?.focus());
      dialog.addEventListener('click', e => { if (e.target === dialog) close(); });
      dialog.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault(); show(index + (e.key === 'ArrowRight' ? 1 : -1));
        }
      });
    }
    show(links.indexOf(link));
    dialog.showModal();
    dialog.querySelector('.gallery-close').focus();
  };
  root.addEventListener('click', open);
  return () => {
    observer.disconnect();
    root.removeEventListener('click', open);
    dialog?.remove();
  };
}
