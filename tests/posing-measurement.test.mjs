import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GuideMeter, guideParameters } from '../src/lib/posing-measurement.mjs';

const page = (id = 'pose_008', number = 6, mode = 'book') => ({ guide_mode: mode, guide_chapter: 'posen_frauen', guide_page_number: number, guide_content_id: id });
const payload = (event, extra = {}) => ({ event, measurement_page: 'posing_guide', ...page(), ...extra });
const fixture = () => { const events = [], saved = []; const meter = new GuideMeter({ emit: event => events.push(event), save: state => saved.push(state) }); return { meter, events, saved }; };
const tick = (meter, now, pages = [page()], extra = {}) => meter.tick(now, { consent: true, active: true, pages, ...extra });

test('a view requires a visible second, never just a loaded or rapidly skipped page', () => {
  const { meter, events } = fixture();
  tick(meter, 0); tick(meter, 500, []); tick(meter, 1000); tick(meter, 1500);
  assert.equal(events.length, 0);
  tick(meter, 2000);
  assert.deepEqual(events.map(event => event.event), ['posing_guide_open', 'posing_guide_page_view']);
  tick(meter, 3000);
  assert.equal(events.length, 2);
});

test('consent denial and withdrawal discard both counters and unsent time', () => {
  const { meter, events, saved } = fixture();
  tick(meter, 0, [page()], { consent: false }); tick(meter, 6000, [page()], { consent: false });
  assert.equal(events.length, 0); assert.equal(saved.length, 0);
  tick(meter, 7000); tick(meter, 8000);
  tick(meter, 9000, [page()], { consent: false });
  assert.equal(events.filter(e => e.event === 'posing_guide_read_time').length, 0);
  tick(meter, 10000); tick(meter, 11000);
  assert.equal(events.filter(e => e.event === 'posing_guide_open').length, 2);
});

test('background, loss of focus and obscured surfaces add no reading time', () => {
  const { meter, events } = fixture();
  tick(meter, 0); tick(meter, 1000); tick(meter, 2000);
  tick(meter, 2500, [], { active: false }); tick(meter, 100_000, [], { active: false });
  tick(meter, 101_000); tick(meter, 102_000); tick(meter, 103_000, [], { active: false });
  assert.equal(events.filter(e => e.event === 'posing_guide_read_time').reduce((sum, e) => sum + e.guide_visible_ms, 0), 3000);
  assert.equal(events.filter(e => e.event === 'posing_guide_engaged').length, 0);
});

test('holding and returning a paper corner adds neither reading time nor another view', () => {
  const { meter, events } = fixture();
  tick(meter, 0); tick(meter, 1000); tick(meter, 2000);
  meter.suspend(); meter.suspend();
  tick(meter, 100_000); tick(meter, 101_000); tick(meter, 102_000, [], { active: false });
  assert.equal(events.filter(e => e.event === 'posing_guide_page_view').length, 1);
  assert.equal(events.filter(e => e.event === 'posing_guide_read_time').reduce((sum, e) => sum + e.guide_visible_ms, 0), 3000);
  assert.equal(events.filter(e => e.event === 'posing_guide_engaged').length, 0);
});

test('desktop spreads count two pages without doubling visit reading time', () => {
  const { meter, events } = fixture(), spread = [page(), page('pose_009', 7)];
  for (let second = 0; second <= 30; second++) tick(meter, second * 1000, spread);
  assert.equal(events.filter(e => e.event === 'posing_guide_page_view').length, 2);
  const engaged = events.filter(e => e.event === 'posing_guide_engaged');
  assert.equal(engaged.length, 1); assert.equal(engaged[0].guide_engagement_reason, 'thirty_seconds');
  assert.equal(meter.readMs, 30_000);
});

test('three distinct poses qualify once; cover and the same pose in reading mode do not add distinct poses', () => {
  const { meter, events } = fixture();
  const surfaces = [page('cover', 1), page(), page('pose_008', 6, 'reading'), page('pose_009', 7), page('pose_010', 8)];
  surfaces.forEach((surface, index) => { tick(meter, index * 3000, [surface]); tick(meter, index * 3000 + 1000, [surface]); });
  assert.equal(events.filter(e => e.event === 'posing_guide_open').length, 1);
  assert.equal(events.filter(e => e.event === 'posing_guide_engaged').length, 1);
  assert.equal(events.find(e => e.event === 'posing_guide_engaged').guide_engagement_reason, 'three_poses');
});

test('variant interest requires a counted visible page; restored visits do not reopen', () => {
  const events = [], meter = new GuideMeter({ emit: e => events.push(e), restore: { opened: true, poses: ['pose_008'], readMs: 2000 } });
  meter.variant(page()); assert.equal(events.length, 0);
  tick(meter, 0); tick(meter, 1000); meter.variant(page());
  assert.deepEqual(events.map(e => e.event), ['posing_guide_page_view', 'posing_guide_variant_open']);
});

test('measurement schema rejects private input, unknown events and unbounded counters', () => {
  const safe = guideParameters(payload('posing_guide_page_view', { email: 'private@example.invalid', url: '?name=Private', title: 'Private' }));
  assert.ok(safe); assert.doesNotMatch(JSON.stringify(safe), /private|url|title/i);
  assert.equal(guideParameters(payload('posing_guide_page_view', { guide_content_id: 'private@example.invalid' })), null);
  assert.equal(guideParameters(payload('posing_guide_page_view', { guide_page_number: 1001 })), null);
  assert.equal(guideParameters(payload('posing_guide_page_view', { guide_content_id: 'pose_000' })), null);
  assert.equal(guideParameters(payload('posing_guide_page_view', { guide_content_id: 'pose_1000' })), null);
  assert.equal(guideParameters(payload('posing_guide_read_time', { guide_visible_ms: 60_001 })), null);
  assert.equal(guideParameters(payload('posing_guide_unknown')), null);
});

test('new stable card IDs and reordered page numbers retain bounded analytics', () => {
  for (const id of ['pose_046', 'pose_100', 'pose_999']) {
    const value = payload('posing_guide_page_view', { guide_content_id: id, guide_page_number: 1000 });
    assert.equal(guideParameters(value).guide_content_id, id);
    const { meter, events } = fixture();
    tick(meter, 0, [page(id, 49)]); tick(meter, 1000, [page(id, 49)]);
    assert.equal(events.at(-1).guide_content_id, id);
  }
  const meter = new GuideMeter({ emit: () => {}, restore: { poses: ['pose_999', 'pose_000', 'private@example.invalid'] } });
  assert.deepEqual([...meter.poses], ['pose_999']);
});

test('new editorial chapters are measured only through their public allowlist', () => {
  const publicChapters = ['intro', 'kapitel_abc123'];
  const value = payload('posing_guide_page_view', { guide_chapter: 'kapitel_abc123' });
  assert.equal(guideParameters(value), null);
  assert.equal(guideParameters(value, publicChapters).guide_chapter, 'kapitel_abc123');
  assert.equal(guideParameters({ ...value, guide_chapter: 'unknown_private_input' }, publicChapters), null);
  const events = [], meter = new GuideMeter({ emit: event => events.push(event), publicChapters });
  const surface = { ...page(), guide_chapter: 'kapitel_abc123' };
  tick(meter, 0, [surface]); tick(meter, 1000, [surface]);
  assert.equal(events.at(-1).guide_chapter, 'kapitel_abc123');
});

test('the real delivery boundary preserves guide parameters, requires Analytics and excludes all advertising channels', async () => {
  const source = await readFile('src/components/TrackingDataLayer.astro', 'utf8');
  const body = source.split('const pushEvent = (payload) => {')[1].split('    const publishTrackingReady')[0].replace(/;\s*$/, '');
  const deliveries = [], ads = [];
  let granted = false;
  const win = { artbildConsentApi: { isServiceAllowed: service => service === 'googleAnalytics' ? granted : true },
    artbildOpenAIAds: { track: p => ads.push(p) }, artbildGoogleAds: { track: p => ads.push(p) }, artbildMetaPixel: { track: p => ads.push(p) },
    gtag: (...args) => deliveries.push(args) };
  const make = new Function('window', 'compact', 'pageId', 'pageType', 'trackingConfiguration', 'confirmedLeads', `return (payload) => {${body};`);
  const track = make(win, value => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== '')), () => 'posing_guide', () => 'posing_guide', { googleAnalyticsId: 'G-TEST000000' }, new Set());
  track(payload('posing_guide_page_view')); assert.equal(deliveries.length, 0);
  granted = true; track(payload('posing_guide_page_view', { privateEmail: 'private@example.invalid' }));
  assert.equal(deliveries.length, 1); assert.equal(deliveries[0][2].guide_content_id, 'pose_008');
  assert.equal(deliveries[0][2].guide_page_number, 6); assert.equal(deliveries[0][2].measurement_page, 'posing_guide');
  assert.doesNotMatch(JSON.stringify(deliveries), /private@example/); assert.equal(ads.length, 0);
  track(payload('posing_guide_read_time', { guide_visible_ms: 900_000 })); assert.equal(deliveries.length, 1);
  granted = false; track(payload('posing_guide_read_time', { guide_visible_ms: 1000 })); assert.equal(deliveries.length, 1);
  granted = true; track(payload('posing_guide_page_view', { guide_content_id: 'pose_999', guide_page_number: 1000 }));
  assert.equal(deliveries.length, 2); assert.equal(deliveries[1][2].guide_content_id, 'pose_999');
  track(payload('posing_guide_page_view', { guide_content_id: 'pose_000' }));
  track(payload('posing_guide_page_view', { guide_page_number: 1001 }));
  assert.equal(deliveries.length, 2); assert.equal(ads.length, 0);
  track(payload('posing_guide_page_view', { guide_chapter: 'kapitel_abc123' }));
  assert.equal(deliveries.length, 2);
  win.document = { querySelectorAll: () => [{ dataset: { guideChapter: 'kapitel-abc123' } }] };
  track(payload('posing_guide_page_view', { guide_chapter: 'kapitel_abc123' }));
  assert.equal(deliveries.length, 3); assert.equal(deliveries[2][2].guide_chapter, 'kapitel_abc123');
  assert.match(await readFile('src/lib/consentRuntime.js', 'utf8'), /googleAnalytics: \[[^\]]+artbild_posing_visit_v1/);
});
