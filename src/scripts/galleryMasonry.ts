type MasonryState = {
  frame: number | undefined;
  observer: ResizeObserver;
  width: number;
};

const states = new WeakMap<HTMLElement, MasonryState>();
const desktopMedia = window.matchMedia("(min-width: 768px)");

const getItems = (gallery: HTMLElement) =>
  [...gallery.children].filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement && element.hasAttribute("data-masonry-item"),
  );

const getAspectDimensions = (item: HTMLElement) => {
  const width = Number(item.dataset.masonryWidth);
  const height = Number(item.dataset.masonryHeight);

  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    return { width, height };
  }

  return { width: 4, height: 3 };
};

const resetItemPosition = (item: HTMLElement) => {
  item.style.removeProperty("width");
  item.style.removeProperty("height");
  item.style.removeProperty("transform");
  delete item.dataset.masonryColumn;
};

const layoutGallery = (gallery: HTMLElement) => {
  const items = getItems(gallery);
  delete gallery.dataset.masonryFallback;

  if (!desktopMedia.matches) {
    gallery.style.removeProperty("height");
    gallery.dataset.masonryColumns = "1";
    gallery.dataset.masonryReady = "true";
    items.forEach(resetItemPosition);
    return;
  }

  const galleryWidth = gallery.getBoundingClientRect().width;
  if (galleryWidth <= 0 || items.length === 0) return;

  const computedStyle = window.getComputedStyle(gallery);
  const measuredGap = Number.parseFloat(computedStyle.columnGap);
  const gap = Number.isFinite(measuredGap) ? measuredGap : 0;
  const columnCount = 3;
  const columnWidth = (galleryWidth - gap * (columnCount - 1)) / columnCount;
  const columnHeights = Array.from({ length: columnCount }, () => 0);

  items.forEach((item) => {
    const { width, height } = getAspectDimensions(item);
    const itemHeight = columnWidth * (height / width);
    const shortestHeight = Math.min(...columnHeights);
    const column = columnHeights.findIndex((height) => height <= shortestHeight + 0.01);
    const x = column * (columnWidth + gap);
    const y = columnHeights[column];

    item.style.width = `${columnWidth}px`;
    item.style.height = `${itemHeight}px`;
    item.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    item.dataset.masonryColumn = String(column + 1);
    columnHeights[column] = y + itemHeight + gap;
  });

  gallery.style.height = `${Math.max(...columnHeights) - gap}px`;
  gallery.dataset.masonryColumns = String(columnCount);
  gallery.dataset.masonryReady = "true";
};

const scheduleLayout = (gallery: HTMLElement, state: MasonryState) => {
  if (state.frame !== undefined) cancelAnimationFrame(state.frame);

  state.frame = requestAnimationFrame(() => {
    state.frame = undefined;
    layoutGallery(gallery);
  });
};

const enhanceGallery = (gallery: HTMLElement) => {
  const existingState = states.get(gallery);
  if (existingState) {
    scheduleLayout(gallery, existingState);
    return;
  }

  const state: MasonryState = {
    frame: undefined,
    width: -1,
    observer: new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? gallery.clientWidth;
      if (Math.abs(width - state.width) < 0.25) return;

      state.width = width;
      scheduleLayout(gallery, state);
    }),
  };

  states.set(gallery, state);
  state.observer.observe(gallery);
  scheduleLayout(gallery, state);
};

export const enhanceMasonryGalleries = (root: ParentNode = document) => {
  root.querySelectorAll<HTMLElement>("[data-masonry-gallery]").forEach(enhanceGallery);
};
