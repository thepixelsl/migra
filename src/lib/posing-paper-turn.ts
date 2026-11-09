import { PageFlip } from './vendor/page-flip.mjs';

type Corner = 'top' | 'bottom';
type Options = {
  stage: HTMLElement;
  before: Array<HTMLElement | null>;
  after: Array<HTMLElement | null>;
  forward: boolean;
  portrait: boolean;
  corner: Corner;
  finished: (turned: boolean) => void;
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
  const width = stage.clientWidth / (portrait ? 1 : 2);
  const overlay = document.createElement('div');
  overlay.className = 'book-paper-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.inert = true;
  const host = document.createElement('div');
  host.className = 'book-paper-host';
  overlay.append(host);
  stage.append(overlay);

  const before = options.before.map(face), after = options.after.map(face);
  const faces = forward ? [...before, ...after] : [...after, ...before];
  // Measure only the participating pages, then retain the largest height. A
  // shorter page must never clamp the document's current scroll position.
  host.classList.add('paper-measuring');
  host.style.setProperty('--paper-width', `${width}px`);
  host.append(...faces);
  const height = Math.ceil(Math.max(stage.getBoundingClientRect().height, ...faces.map(page => page.scrollHeight)));
  stage.style.minHeight = `${height}px`;
  host.classList.remove('paper-measuring');
  host.style.height = `${height}px`;
  const startPage = forward ? 0 : before.length;
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
  stage.setAttribute('data-book-turning', '');
  stage.dispatchEvent(new Event('posing:pagechange', { bubbles: true }));

  const point = (clientX: number, clientY: number) => {
    const rect = host.getBoundingClientRect();
    return { x: clientX - rect.left, y: Math.max(1, Math.min(height - 1, clientY - rect.top)) };
  };
  return {
    animate() {
      armed = true;
      if (forward) engine.flipNext(corner); else engine.flipPrev(corner);
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
      else if (turnPage) { if (forward) engine.flipNext(corner); else engine.flipPrev(corner); }
      else finished(false);
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      engine.destroy();
      overlay.remove();
      stage.removeAttribute('data-book-turning');
    },
  };
}
