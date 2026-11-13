export const GUIDE_STORAGE_KEY = 'artbild_posing_visit_v1';
export const GUIDE_EVENTS = ['posing_guide_open', 'posing_guide_page_view', 'posing_guide_read_time', 'posing_guide_engaged', 'posing_guide_variant_open'];
const chapters = ['intro', 'posen_frauen', 'posen_maenner', 'hochzeitsposen', 'grundlagen'];
const safeChapter = value => typeof value === 'string' && /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(value) && value.length <= 80;

// Public identifiers and bounded numbers only; no URL, title or visitor input.
export function guideParameters(input = {}, publicChapters = chapters) {
  if (!GUIDE_EVENTS.includes(input.event) || input.measurement_page !== 'posing_guide'
    || !['book', 'reading'].includes(input.guide_mode) || !safeChapter(input.guide_chapter) || !publicChapters.includes(input.guide_chapter)
    || !Number.isInteger(input.guide_page_number) || input.guide_page_number < 1 || input.guide_page_number > 1000
    || !/^(cover|contents|orientation|pose_(?!000)[0-9]{3})$/.test(input.guide_content_id || '')) return null;
  const result = Object.fromEntries(['event', 'measurement_page', 'guide_mode', 'guide_chapter', 'guide_page_number', 'guide_content_id'].map(key => [key, input[key]]));
  if (input.event === 'posing_guide_read_time') {
    if (!Number.isInteger(input.guide_visible_ms) || input.guide_visible_ms < 1 || input.guide_visible_ms > 60_000) return null;
    result.guide_visible_ms = input.guide_visible_ms;
  }
  if (input.event === 'posing_guide_engaged') {
    if (!['three_poses', 'thirty_seconds'].includes(input.guide_engagement_reason)) return null;
    result.guide_engagement_reason = input.guide_engagement_reason;
  }
  return result;
}

// Deterministic visibility meter, shared by the browser adapter and contract tests.
export class GuideMeter {
  constructor({ emit, save = () => {}, restore = null, publicChapters = chapters }) {
    const allowedChapters = publicChapters.filter(safeChapter);
    this.emit = payload => { const safe = guideParameters(payload, allowedChapters); if (safe) emit(safe); };
    this.save = save;
    this.opened = restore?.opened === true;
    this.engaged = restore?.engaged === true;
    this.poses = new Set((Array.isArray(restore?.poses) ? restore.poses : []).filter(id => /^pose_(?!000)[0-9]{3}$/.test(id)).slice(0, 999));
    this.readMs = Number.isFinite(restore?.readMs) ? Math.min(30_000, Math.max(0, restore.readMs)) : 0;
    this.active = new Map(); this.last = null;
  }
  reset() { this.active.clear(); this.last = null; this.opened = false; this.engaged = false; this.poses.clear(); this.readMs = 0; }
  // A held or returning sheet is a temporary visual transition, not a new view.
  suspend() { for (const state of this.active.values()) this.flush(state); this.last = null; }
  record(event, page, extra = {}) { this.emit({ event, measurement_page: 'posing_guide', ...page, ...extra }); }
  flush(state) {
    if (state.viewed && state.pending > 0) this.record('posing_guide_read_time', state.page, { guide_visible_ms: Math.round(state.pending) });
    state.pending = 0;
  }
  tick(now, { consent, active, pages = [] }) {
    if (!consent) { this.reset(); return; }
    const delta = this.last === null ? 0 : Math.max(0, Math.min(1500, now - this.last));
    this.last = now;
    // Pauses end at the previous sample: background time is never backfilled.
    const visible = new Map((active ? pages : []).map(page => [`${page.guide_mode}:${page.guide_content_id}`, page]));
    let contentTime = false;
    for (const [key, state] of this.active) {
      if (active && visible.has(key)) {
        state.elapsed += delta; state.pending += delta;
        if (!state.viewed && state.elapsed >= 1000) {
          state.viewed = true;
          if (!this.opened) { this.record('posing_guide_open', state.page); this.opened = true; }
          this.record('posing_guide_page_view', state.page);
          if (state.page.guide_content_id.startsWith('pose_')) this.poses.add(state.page.guide_content_id);
        }
        if (state.viewed && state.page.guide_content_id.startsWith('pose_')) contentTime = true;
        if (state.viewed && state.pending >= 30_000) this.flush(state);
      } else { this.flush(state); this.active.delete(key); }
    }
    // A desktop spread counts as two page views, but its visit time only once.
    if (contentTime) this.readMs = Math.min(30_000, this.readMs + delta);
    for (const [key, page] of visible) if (!this.active.has(key)) this.active.set(key, { page, viewed: false, elapsed: 0, pending: 0 });
    if (!this.engaged && (this.poses.size >= 3 || this.readMs >= 30_000)) {
      const state = [...this.active.values()].find(state => state.viewed && state.page.guide_content_id.startsWith('pose_'));
      if (state) { this.record('posing_guide_engaged', state.page, { guide_engagement_reason: this.poses.size >= 3 ? 'three_poses' : 'thirty_seconds' }); this.engaged = true; }
    }
    if (this.opened) this.save({ opened: this.opened, engaged: this.engaged, poses: [...this.poses], readMs: this.readMs });
  }
  variant(page) {
    const state = this.active.get(`${page.guide_mode}:${page.guide_content_id}`);
    if (state?.viewed) this.record('posing_guide_variant_open', page);
  }
}

export function initializeGuideMeasurement(win = window, doc = document) {
  if (!doc.querySelector('.posing-guide-page') || win.__artbildGuideMeasurement) return;
  win.__artbildGuideMeasurement = true;
  const granted = () => win.artbildConsentApi?.isServiceAllowed?.('googleAnalytics') === true;
  const clear = () => { try { win.sessionStorage.removeItem(GUIDE_STORAGE_KEY); } catch {} };
  let restore = null;
  if (granted()) {
    try { const value = JSON.parse(win.sessionStorage.getItem(GUIDE_STORAGE_KEY)); if (value && Date.now() >= value.at && Date.now() - value.at < 1800_000) restore = value; } catch {}
  } else clear();
  let lastActivity = restore?.at || Date.now();
  const publicChapters = ['intro', ...[...doc.querySelectorAll('[data-guide-chapter]')].map(element => element.dataset.guideChapter?.replaceAll('-', '_'))].filter(safeChapter);
  const meter = new GuideMeter({ restore, publicChapters,
    emit: event => { if (granted()) win.artbildTracking?.track?.(event); },
    save: state => { if (granted()) try { win.sessionStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify({ ...state, at: lastActivity })); } catch {} },
  });
  const pageData = element => ({ guide_mode: element.dataset.guideMode, guide_chapter: element.dataset.guideChapter?.replaceAll('-', '_'),
    guide_page_number: Number(element.dataset.guidePage), guide_content_id: element.dataset.guideContent });
  const visible = element => {
    if (element.closest('[hidden],[inert],[aria-hidden="true"],[data-book-turning]') || !element.getClientRects().length) return false;
    const rect = element.getBoundingClientRect();
    const height = Math.max(0, Math.min(rect.bottom, win.innerHeight) - Math.max(0, rect.top));
    const width = Math.max(0, Math.min(rect.right, win.innerWidth) - Math.max(0, rect.left));
    return rect.height > 0 && rect.width > 0 && height >= Math.min(rect.height, win.innerHeight) * .5 && width >= Math.min(rect.width, win.innerWidth) * .5;
  };
  const sample = (forcePause = false) => {
    const consent = granted();
    if (!consent) { clear(); meter.reset(); return; }
    if (doc.querySelector('[data-book-turning]')) { meter.suspend(); return; }
    const obscured = [...doc.querySelectorAll('[aria-modal="true"]')].some(element => element.getClientRects().length && win.getComputedStyle(element).visibility !== 'hidden');
    const active = !forcePause && doc.visibilityState === 'visible' && doc.hasFocus() && !obscured;
    const pages = active ? [...doc.querySelectorAll('[data-guide-page]')].filter(visible).map(pageData) : [];
    if (consent && active && pages.length) {
      if (Date.now() - lastActivity >= 1800_000) meter.reset();
      lastActivity = Date.now();
    }
    meter.tick(win.performance.now(), { consent, active, pages });
  };
  let timer = win.setInterval(sample, 1000);
  doc.addEventListener('visibilitychange', () => sample());
  win.addEventListener('blur', () => sample(true));
  win.addEventListener('focus', () => sample());
  win.addEventListener('pagehide', () => { sample(true); win.clearInterval(timer); });
  win.addEventListener('pageshow', event => { if (event.persisted) { win.clearInterval(timer); timer = win.setInterval(sample, 1000); sample(); } });
  win.addEventListener('artbild:consent_update', () => { if (!granted()) { clear(); meter.reset(); } sample(); });
  doc.addEventListener('posing:pagechange', () => sample());
  doc.addEventListener('toggle', event => {
    if (!granted() || doc.visibilityState !== 'visible' || !doc.hasFocus() || !event.target.open) return;
    const page = event.target.closest('[data-guide-page]');
    if (page && visible(page)) meter.variant(pageData(page));
  }, true);
  sample();
}
