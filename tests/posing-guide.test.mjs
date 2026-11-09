import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { load } from 'cheerio';

const origin = 'https://artbild-fotografie.de';
const chapters = { 'posen-frauen': 10, 'posen-maenner': 10, hochzeitsposen: 20, grundlagen: 5 };
const cards = JSON.parse(await readFile('src/data/posing-guide-cards.json', 'utf8'));
const page = async route => load(await readFile(join('dist', route, 'index.html'), 'utf8'));

test('all 45 illustrations and descriptions are readable without JavaScript on canonical chapter pages', async () => {
  const seen = new Set();
  for (const [slug, count] of Object.entries(chapters)) {
    const route = `posing-guide/${slug}/`, $ = await page(route);
    assert.equal($('link[rel=canonical]').attr('href'), `${origin}/${route}`);
    assert.doesNotMatch($('meta[name=robots]').attr('content'), /noindex/);
    assert.equal($('h1').length, 1);
    const description = $('meta[name=description]').attr('content');
    assert.ok(description.length >= 90 && description.length <= 170, route);
    assert.equal($('meta[property="og:description"]').attr('content'), description);
    assert.equal($('.pose-reading-list > article').length, count);
    for (const article of $('.pose-reading-list > article').toArray()) {
      const id = $(article).attr('id').replace('pose-', '');
      assert.ok(!seen.has(id)); seen.add(id);
      const card = cards.find(record => record.id === id);
      assert.ok(card);
      assert.ok($(article).text().includes(card.description));
      assert.ok($(article).text().includes(card.camera));
      assert.equal($(article).find('img').attr('src'), `${card.image}-960.webp`);
      assert.ok($(article).find('source[type="image/avif"]').attr('srcset').includes('640w'));
      assert.equal($(article).find('a').last().attr('href'), `/posing-guide/#pose-${id}`);
    }
  }
  assert.equal(seen.size, 45);
});

test('book keeps 48 pages, crawlable chapter links and a lightweight initial image', async () => {
  const $ = await page('posing-guide');
  assert.equal($('template[data-book-page]').length, 47);
  assert.equal($('[data-book-choice] option').length, 48);
  assert.equal($('[data-book-stage] img').length, 1);
  assert.equal($('[data-book-stage] img').attr('loading'), 'eager');
  assert.equal($('[data-book-stage] img').attr('fetchpriority'), 'high');
  assert.equal($('link[rel=canonical]').attr('href'), `${origin}/posing-guide/`);
  for (const slug of Object.keys(chapters)) assert.ok($(`nav.guide-chapters a[href="/posing-guide/${slug}/"]`).length);
  for (const card of cards) assert.equal($(`#pose-${card.id}`).length, 1);
  assert.equal($('[data-desktop-submenu] a[href="/posing-guide/"]').length, 1);
  assert.ok($('.mobile-navigation a[href="/posing-guide/"]').length || $('[data-mobile-navigation] a[href="/posing-guide/"]').length || $('a[data-cta-id="mobile_posing_guide"]').length);
});

test('public guide assets contain only screen derivatives and no private reference material', async () => {
  const files = await readdir('public/images/posing-guide');
  assert.equal(files.length, 180);
  for (const file of files) {
    assert.match(file, /^\d{3}-[a-z0-9-]+-[a-f0-9]{12}-(640|960)\.(avif|webp)$/);
    assert.ok((await stat(join('public/images/posing-guide', file))).size < 220_000, `${file} exceeds the image budget`);
  }
  const serialized = JSON.stringify(cards);
  assert.doesNotMatch(serialized, /prompt|image_original|\/Users\/|\/Volumes\/|\.HEIC|Kindle|reference/);
  for (const card of cards) assert.ok(card.alt.length < 170);
});

test('guide and chapter pages are in the page and image sitemaps', async () => {
  const sitemap = await readFile('dist/sitemap.xml', 'utf8');
  const images = await readFile('dist/image-sitemap.xml', 'utf8');
  for (const path of ['', ...Object.keys(chapters).map(slug => `${slug}/`)]) {
    assert.ok(sitemap.includes(`${origin}/posing-guide/${path}`));
    assert.ok(images.includes(`${origin}/posing-guide/${path}`));
  }
});
