// Only visible spreads are instantiated; images in templates are not requested.
export function installPosingBook(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>('[data-book-stage]')!;
  const chooser = root.querySelector<HTMLSelectElement>('[data-book-choice]')!;
  const status = root.querySelector<HTMLElement>('[data-book-status]')!;
  const previous = [...root.querySelectorAll<HTMLButtonElement>('[data-book-prev]')];
  const next = [...root.querySelectorAll<HTMLButtonElement>('[data-book-next]')];
  const templates = [...root.querySelectorAll<HTMLTemplateElement>('template[data-book-page]')];
  const cover = stage.firstElementChild!.cloneNode(true) as HTMLElement;
  const pages = [cover, ...templates.map(template => template.content.firstElementChild as HTMLElement)];
  const mobile = matchMedia('(max-width: 800px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;
  let requested = 0;
  let animation: Animation | undefined;
  let sheet: HTMLElement | undefined;
  const normalize = (index: number) => {
    const bounded = Math.max(0, Math.min(pages.length - 1, index));
    return mobile.matches || bounded === 0 ? bounded : 1 + 2 * Math.floor((bounded - 1) / 2);
  };
  const fromHash = () => {
    const pose = location.hash.match(/^#pose-(\d{3})$/);
    if (pose) { const index = templates.findIndex(template => template.dataset.poseId === pose[1]); return index < 0 ? 0 : index + 1; }
    const page = location.hash.match(/^#seite-(\d+)$/);
    return page ? Number(page[1]) - 1 : 0;
  };
  const cancelTurn = () => { animation?.cancel(); sheet?.remove(); animation = undefined; sheet = undefined; };
  function render() {
    const spread = !mobile.matches && current > 0 && current + 1 < pages.length;
    const visible = [current, ...(spread ? [current + 1] : [])].map(index => {
      const page = pages[index].cloneNode(true) as HTMLElement;
      page.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
      return page;
    });
    stage.replaceChildren(...visible);
    stage.classList.toggle('single', !spread);
    chooser.value = String(requested);
    status.textContent = spread ? `Seiten ${current + 1}–${current + 2} von ${pages.length}` : `Seite ${current + 1} von ${pages.length}`;
    previous.forEach(button => { button.disabled = current === 0; });
    next.forEach(button => { button.disabled = current + (spread ? 2 : 1) >= pages.length; });
    root.dispatchEvent(new Event('posing:pagechange', { bubbles: true }));
  }
  function go(index: number, animate = true, updateAddress = true) {
    requested = Math.max(0, Math.min(pages.length - 1, index));
    const target = normalize(requested);
    if (target === current) { chooser.value = String(requested); return; }
    cancelTurn();
    const forward = target > current;
    const old = stage.querySelector(forward ? '.book-page:last-child' : '.book-page:first-child')?.cloneNode(true) as HTMLElement | undefined;
    current = target;
    render();
    // A turn from the controls below a long page starts at the new illustration.
    if (animate && root.getBoundingClientRect().top < 0) root.scrollIntoView({ block: 'start', behavior: 'auto' });
    if (updateAddress) history.replaceState(null, '', `#seite-${requested + 1}`);
    if (animate && old && !reduced.matches) {
      sheet = old;
      old.classList.add('book-turn-sheet', forward ? 'forward' : 'backward');
      old.setAttribute('aria-hidden', 'true');
      old.inert = true;
      stage.append(old);
      const turn = old.animate([{ transform: 'rotateY(0deg)', opacity: 1 }, { transform: `rotateY(${forward ? '-' : ''}165deg)`, opacity: 0.12 }], { duration: 480, easing: 'cubic-bezier(.3,.1,.25,1)', fill: 'forwards' });
      animation = turn;
      turn.finished.then(() => { old.remove(); if (animation === turn) { animation = undefined; sheet = undefined; } }).catch(() => {});
    }
  }
  function move(direction: number) {
    const step = mobile.matches ? 1 : 2;
    go(direction > 0 ? (current === 0 ? 1 : current + step) : (current <= 1 ? 0 : current - step));
  }
  previous.forEach(button => button.addEventListener('click', () => move(-1)));
  next.forEach(button => button.addEventListener('click', () => move(1)));
  chooser.addEventListener('change', () => go(Number(chooser.value)));
  root.addEventListener('click', event => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('[data-book-jump]');
    if (!link || (event as MouseEvent).metaKey || (event as MouseEvent).ctrlKey || (event as MouseEvent).shiftKey) return;
    event.preventDefault(); go(Number(link.dataset.bookJump));
  });
  root.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || (event.target as Element).closest('select,input,textarea,[contenteditable=true],summary')) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
    if (event.key === 'Home') { event.preventDefault(); go(0); }
    if (event.key === 'End') { event.preventDefault(); go(pages.length - 1); }
  });
  let touch: { x: number; y: number } | undefined;
  stage.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' && !(event.target as Element).closest('a,button,select,summary')) touch = { x: event.clientX, y: event.clientY };
  });
  stage.addEventListener('pointerup', event => {
    if (!touch) return;
    const x = event.clientX - touch.x, y = event.clientY - touch.y; touch = undefined;
    if (Math.abs(x) > 55 && Math.abs(x) > Math.abs(y) * 1.4) move(x < 0 ? 1 : -1);
  });
  stage.addEventListener('pointercancel', () => { touch = undefined; });
  mobile.addEventListener('change', () => { cancelTurn(); current = normalize(requested); render(); });
  reduced.addEventListener('change', cancelTurn);
  window.addEventListener('hashchange', () => go(fromHash(), false, false));
  requested = Math.max(0, Math.min(pages.length - 1, fromHash()));
  current = normalize(requested);
  render();
  root.querySelectorAll<HTMLElement>('[data-book-controls]').forEach(control => { control.hidden = false; });
}
