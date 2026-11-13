import { PageFlip } from './vendor/page-flip.mjs';

type Corner = 'top' | 'bottom';
type Options = {
  stage: HTMLElement;
  before: Array<HTMLElement | null>;
  after: Array<HTMLElement | null>;
  forward: boolean;
  portrait: boolean;
  corner: Corner;
  preserveViewport: (change: () => void) => void;
  finished: (turned: boolean) => void;
  tease?: boolean;
};

// The real, server-rendered pages stay in place. These short-lived copies only
// paint the curled sheet, its reverse and the pages revealed underneath it.
function face(original: HTMLElement | null) {
  const wrapper = document.createElement('div');
  wrapper.className = 'paper-face';
  if (!original) { wrapper.classList.add('paper-blank'); return wrapper; }
  const copy = original.cloneNode(true) as HTMLElement;
  for (const element of [copy, ...copy.querySelectorAll<HTMLElement>('*')]) {
    for (const attribute of [...element.attributes]) {
      if (attribute.name === 'id' || attribute.name === 'hidden' || attribute.name.startsWith('data-guide-')) element.removeAttribute(attribute.name);
    }
  }
  copy.classList.remove('is-left', 'is-right');
  copy.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
  wrapper.append(copy);
  return wrapper;
}

export async function createPaperTurn(options: Options) {
  const { stage, forward, portrait, corner, finished } = options;
  // The library's portrait back turn slides the previous face over the whole
  // current page. Mirror its forward curl instead, keeping the text readable.
  const mirrored = portrait && !forward;
  const engineForward = forward || mirrored;
  const width = stage.clientWidth / (portrait ? 1 : 2);
  const overlay = document.createElement('div');
  overlay.className = 'book-paper-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.inert = true;
  const host = document.createElement('div');
  host.className = `book-paper-host${mirrored ? ' paper-mirrored' : ''}`;
  overlay.append(host);
  stage.append(overlay);

  const before = options.before.map(face), after = options.after.map(face);
  const faces = engineForward ? [...before, ...after] : [...after, ...before];
  // Both sides need enough room while curling. On phones this temporary
  // animation height is released again when the sheet settles or is cancelled.
  host.classList.add('paper-measuring');
  host.style.setProperty('--paper-width', `${width}px`);
  host.append(...faces);
  const height = Math.ceil(options.tease ? stage.getBoundingClientRect().height : Math.max(stage.getBoundingClientRect().height, ...faces.map(page => page.scrollHeight)));
  const previousHeight = stage.style.minHeight;
  options.preserveViewport(() => { stage.style.minHeight = `${height}px`; });
  host.classList.remove('paper-measuring');
  host.style.height = `${height}px`;
  const startPage = engineForward ? 0 : before.length;
  const engine = new PageFlip(host, {
    width, height, size: 'fixed', autoSize: false, usePortrait: portrait,
    startPage, showCover: false, useMouseEvents: false, mobileScrollSupport: false,
    showPageCorners: false, disableFlipByClick: false, drawShadow: true,
    maxShadowOpacity: .48, flippingTime: 900,
  });
  let disposed = false, armed = false;
  engine.on('changeState', (event: { data: string }) => {
    if (event.data === 'read' && armed && !disposed) {
      armed = false;
      const turned = engine.getCurrentPageIndex() !== startPage;
      queueMicrotask(() => { if (!disposed) finished(turned); });
    }
  });
  await new Promise<void>(resolve => {
    engine.on('init', () => resolve());
    engine.loadFromHTML(faces);
  });
  // Keep the real sheet visible until the temporary renderer has drawn its
  // initial spread. WebKit can deliver init before its first rendering frame.
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  stage.setAttribute('data-book-turning', '');
  stage.dispatchEvent(new Event('posing:pagechange', { bubbles: true }));

  const point = (clientX: number, clientY: number) => {
    const rect = host.getBoundingClientRect();
    const x = clientX - rect.left;
    return { x: mirrored ? width - x : x, y: Math.max(1, Math.min(height - 1, clientY - rect.top)) };
  };
  return {
    tease(teaseCorner: Corner = corner) {
      // Use the same paper geometry as dragging, but stay close to the corner.
      // This never calls flip/release or changes the engine's current page.
      const controller = engine.getFlipController();
      const extent = Math.max(48, Math.min(84, width * .16));
      const edge = engineForward ? stage.clientWidth - 1 : 1;
      const initial = { x: edge, y: teaseCorner === 'top' ? 1 : height - 1 };
      if (!controller.start(initial)) { finished(false); return false; }
      const ease = (value: number) => (1 - Math.cos(Math.PI * value)) / 2;
      const frames = Array.from({ length: 82 }, (_, index) => () => {
        if (disposed) return;
        const elapsed = index / 81 * 1350;
        const amount = elapsed < 450 ? ease(elapsed / 450) : elapsed < 800 ? 1 : 1 - ease(Math.min(1, (elapsed - 800) / 550));
        controller.fold({ x: edge + (engineForward ? -1 : 1) * extent * amount, y: initial.y + (teaseCorner === 'top' ? 1 : -1) * extent * .85 * amount });
      });
      engine.getRender().startAnimation(frames, 1350, () => {
        queueMicrotask(() => { if (!disposed) finished(false); });
      });
      return true;
    },
    animate() {
      armed = true;
      if (engineForward) engine.flipNext(corner); else engine.flipPrev(corner);
    },
    startDrag(clientX: number, clientY: number) {
      armed = true;
      const start = point(clientX, clientY);
      // Fix direction at the grabbed corner, before a fast drag crosses the spine.
      engine.getFlipController().start(start);
      engine.getFlipController().fold(start);
    },
    drag(clientX: number, clientY: number) { engine.getFlipController().fold(point(clientX, clientY)); },
    release(turnPage: boolean) {
      const controller = engine.getFlipController();
      const position = controller.getCalculation()?.getPosition();
      // Continue from the actual bend. In portrait mode the built-in release
      // threshold lies outside the viewport; use the visible page midpoint.
      if (position) controller.animateFlippingTo(position, { x: turnPage ? -width : width, y: corner === 'top' ? 0 : height }, turnPage);
      else if (turnPage) { if (engineForward) engine.flipNext(corner); else engine.flipPrev(corner); }
      else finished(false);
    },
    destroy({ restoreLayout = true } = {}) {
      if (disposed) return;
      disposed = true;
      options.preserveViewport(() => {
        engine.destroy();
        overlay.remove();
        if (!stage.querySelector('.book-paper-overlay')) stage.removeAttribute('data-book-turning');
        if (restoreLayout && (portrait || options.tease)) stage.style.minHeight = previousHeight;
      });
    },
  };
}
