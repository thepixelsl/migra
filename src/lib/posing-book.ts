// HTML content and navigation work independently of the optional paper renderer.
import type { createPaperTurn } from './posing-paper-turn';
type PaperTurn = Awaited<ReturnType<typeof createPaperTurn>>;
type Corner = 'top' | 'bottom';
type Drag = { pointer: number; startX: number; startY: number; x: number; y: number; moved: number; released: boolean; cancelled: boolean; engine?: PaperTurn; started?: boolean; failed?: boolean; forward: boolean; target: number; handle: HTMLElement };

export function installPosingBook(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>('[data-book-stage]')!;
  const chooser = root.querySelector<HTMLSelectElement>('[data-book-choice]')!;
  const status = root.querySelector<HTMLElement>('[data-book-status]')!;
  const previous = [...root.querySelectorAll<HTMLButtonElement>('[data-book-prev]')];
  const next = [...root.querySelectorAll<HTMLButtonElement>('[data-book-next]')];
  const pages = [...stage.querySelectorAll<HTMLElement>(':scope > .book-page')];
  const mobile = matchMedia('(max-width: 800px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0, requested = 0, operation = 0;
  let active: PaperTurn | undefined, drag: Drag | undefined;
  let renderer: Promise<typeof import('./posing-paper-turn')> | undefined;
  const loadRenderer = () => renderer ||= import('./posing-paper-turn').catch(error => { renderer = undefined; throw error; });
  const notify = () => root.dispatchEvent(new Event('posing:pagechange', { bubbles: true }));
  const normalize = (index: number) => {
    const bounded = Math.max(0, Math.min(pages.length - 1, index));
    return mobile.matches || bounded === 0 ? bounded : 1 + 2 * Math.floor((bounded - 1) / 2);
  };
  const fromHash = () => {
    const id = pages.findIndex(page => `#${page.id}` === location.hash);
    if (id >= 0) return id;
    const page = location.hash.match(/^#seite-(\d+)$/);
    return page ? Number(page[1]) - 1 : 0;
  };
  const adjacent = (direction: number) => {
    const step = mobile.matches ? 1 : 2;
    return Math.max(0, Math.min(pages.length - 1, direction > 0 ? (current === 0 ? 1 : current + step) : (current <= 1 ? 0 : current - step)));
  };
  const spread = (index: number): Array<HTMLElement | null> => mobile.matches ? [pages[index]]
    : index === 0 ? [null, pages[0]] : [pages[index], pages[index + 1] || null];
  const cancel = () => {
    operation++;
    if (drag) {
      drag.cancelled = true;
      if (drag.handle.hasPointerCapture(drag.pointer)) drag.handle.releasePointerCapture(drag.pointer);
      drag = undefined;
    }
    active?.destroy(); active = undefined;
    stage.removeAttribute('aria-busy');
    notify();
  };
  const corners = (['top', 'bottom'] as Corner[]).flatMap(corner => ([-1, 1] as const).map(direction => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `book-corner ${corner} ${direction > 0 ? 'forward' : 'backward'}`;
    button.dataset.corner = `${corner}-${direction > 0 ? 'next' : 'previous'}`;
    const label = `${corner === 'top' ? 'Obere' : 'Untere'} ${direction > 0 ? 'rechte' : 'linke'} Seitenecke: ziehen oder ${direction > 0 ? 'weiter' : 'zurück'}blättern`;
    button.setAttribute('aria-label', label); button.title = label;
    stage.append(button);
    button.addEventListener('click', event => { if (event.detail === 0) void go(adjacent(direction), true, true, corner); });
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0 || button.disabled) return;
      event.preventDefault(); cancel();
      button.focus({ preventScroll: true }); button.setPointerCapture(event.pointerId);
      const gesture: Drag = { pointer: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: 0, released: false, cancelled: false, forward: direction > 0, target: adjacent(direction), handle: button };
      drag = gesture;
      if (!reduced.matches) void begin(gesture.target, corner, gesture);
    });
    button.addEventListener('pointermove', event => {
      if (!drag || drag.pointer !== event.pointerId) return;
      drag.x = event.clientX; drag.y = event.clientY;
      drag.moved = Math.max(drag.moved, Math.hypot(drag.x - drag.startX, drag.y - drag.startY));
      updateDrag(drag);
    });
    button.addEventListener('pointerup', event => {
      if (!drag || drag.pointer !== event.pointerId) return;
      const gesture = drag;
      gesture.x = event.clientX; gesture.y = event.clientY; gesture.released = true;
      gesture.moved = Math.max(gesture.moved, Math.hypot(gesture.x - gesture.startX, gesture.y - gesture.startY));
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
      if (reduced.matches || gesture.failed) {
        finishWithoutAnimation(gesture);
      } else updateDrag(gesture);
    });
    button.addEventListener('pointercancel', () => cancel());
    return { button, direction };
  }));
  function finishWithoutAnimation(gesture: Drag) {
    const distance = (gesture.startX - gesture.x) * (gesture.forward ? 1 : -1);
    drag = undefined;
    if (gesture.moved < 6 || distance > stage.clientWidth / (mobile.matches ? 2 : 4)) commit(gesture.target); else notify();
  }
  function render() {
    const double = !mobile.matches && current > 0 && current + 1 < pages.length;
    pages.forEach((page, index) => {
      const visible = index === current || (double && index === current + 1);
      page.hidden = !visible;
      page.classList.toggle('is-visible', visible);
      page.classList.toggle('is-left', !mobile.matches && index === current && current > 0);
      page.classList.toggle('is-right', !mobile.matches && ((double && index === current + 1) || index === 0));
      if (visible) page.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
    });
    stage.classList.toggle('single', !double);
    root.classList.add('is-ready');
    root.querySelectorAll<HTMLElement>('.guide-chapters [data-book-jump]').forEach(link => {
      const selected = link.dataset.bookChapter ? link.dataset.bookChapter === pages[requested].dataset.guideChapter : requested < 3;
      if (selected) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    });
    chooser.value = String(requested);
    status.textContent = double ? `Seiten ${current + 1} und ${current + 2} von ${pages.length}` : `Seite ${current + 1} von ${pages.length}`;
    previous.forEach(button => { button.disabled = current === 0; });
    next.forEach(button => { button.disabled = current + (double ? 2 : 1) >= pages.length; });
    corners.forEach(({ button, direction }) => { button.hidden = direction < 0 ? current === 0 : current + (double ? 2 : 1) >= pages.length; button.disabled = button.hidden; });
    // Retain a height already reached so lower controls never move the viewport
    // upwards when the next book page contains less text.
    stage.style.minHeight = `${Math.ceil(Math.max(parseFloat(stage.style.minHeight) || 0, stage.getBoundingClientRect().height))}px`;
    notify();
  }
  function commit(index: number, updateAddress = true) {
    const scrollBefore = window.scrollY;
    const focusInPage = pages.some(page => page.contains(document.activeElement));
    requested = Math.max(0, Math.min(pages.length - 1, index)); current = normalize(requested);
    render();
    if (focusInPage) stage.focus({ preventScroll: true });
    if (updateAddress) history.replaceState(null, '', `#${pages[requested].id}`);
    if (window.scrollY !== scrollBefore) window.scrollTo({ top: scrollBefore, behavior: 'instant' });
  }
  async function begin(index: number, corner: Corner, gesture?: Drag) {
    const ticket = operation;
    stage.setAttribute('aria-busy', 'true');
    try {
      const { createPaperTurn } = await loadRenderer();
      if (ticket !== operation || gesture?.cancelled) return;
      const turn = await createPaperTurn({ stage, before: spread(current), after: spread(normalize(index)), forward: normalize(index) > current, portrait: mobile.matches, corner,
        finished: turned => {
          if (ticket !== operation) return;
          active?.destroy(); active = undefined; drag = undefined;
          stage.removeAttribute('aria-busy');
          if (turned) commit(index); else { chooser.value = String(requested); notify(); }
        },
      });
      if (ticket !== operation || gesture?.cancelled) { turn.destroy(); return; }
      active = turn;
      if (gesture) { gesture.engine = turn; updateDrag(gesture); } else turn.animate();
    } catch {
      if (ticket !== operation) return;
      stage.querySelector('.book-paper-overlay')?.remove(); stage.removeAttribute('data-book-turning'); stage.removeAttribute('aria-busy');
      // Basic book navigation survives an unavailable optional animation chunk.
      if (gesture) gesture.failed = true;
      if (!gesture) commit(index); else if (gesture.released) finishWithoutAnimation(gesture);
    }
  }
  function updateDrag(gesture: Drag) {
    if (!gesture.engine || gesture.cancelled) return;
    if (gesture.released && gesture.moved < 6) { gesture.engine.animate(); return; }
    if (!gesture.started) { gesture.engine.startDrag(gesture.startX, gesture.startY); gesture.started = true; }
    gesture.engine.drag(gesture.x, gesture.y);
    if (gesture.released) {
      const midpoint = stage.getBoundingClientRect().left + stage.clientWidth / 2;
      gesture.engine.release(gesture.forward ? gesture.x < midpoint : gesture.x > midpoint);
    }
  }
  async function go(index: number, animate = true, updateAddress = true, corner: Corner = 'top') {
    cancel();
    const target = normalize(index);
    if (target === current || !animate || reduced.matches) { commit(index, updateAddress); return; }
    await begin(index, corner);
  }
  previous.forEach(button => button.addEventListener('click', () => void go(adjacent(-1))));
  next.forEach(button => button.addEventListener('click', () => void go(adjacent(1))));
  chooser.addEventListener('change', () => void go(Number(chooser.value)));
  root.addEventListener('click', event => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('[data-book-jump]');
    if (!link || (event as MouseEvent).metaKey || (event as MouseEvent).ctrlKey || (event as MouseEvent).shiftKey) return;
    event.preventDefault(); void go(Number(link.dataset.bookJump));
  });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') { cancel(); chooser.value = String(requested); return; }
    if (event.altKey || event.ctrlKey || event.metaKey || (event.target as Element).closest('select,input,textarea,[contenteditable=true],summary')) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); void go(adjacent(1)); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); void go(adjacent(-1)); }
    if (event.key === 'Home') { event.preventDefault(); void go(0); }
    if (event.key === 'End') { event.preventDefault(); void go(pages.length - 1); }
  });
  let width = stage.clientWidth;
  new ResizeObserver(() => {
    if (Math.abs(stage.clientWidth - width) < 1) return;
    width = stage.clientWidth; cancel(); stage.style.minHeight = ''; current = normalize(requested); render();
  }).observe(stage);
  reduced.addEventListener('change', cancel);
  window.addEventListener('blur', cancel);
  window.addEventListener('pagehide', cancel);
  window.addEventListener('hashchange', () => void go(fromHash(), false, false));
  requested = Math.max(0, Math.min(pages.length - 1, fromHash())); current = normalize(requested);
  render();
  root.querySelectorAll<HTMLElement>('[data-book-controls]').forEach(control => { control.hidden = false; });
  const preload = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { preload.disconnect(); if (!reduced.matches) void loadRenderer().catch(() => {}); }
  }, { rootMargin: '300px' });
  preload.observe(stage);
}
