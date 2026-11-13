import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat, access } from 'node:fs/promises';
import { join } from 'node:path';
import { load } from 'cheerio';

const origin = 'https://artbild-fotografie.de';
const chapters = { 'posen-frauen': 10, 'posen-maenner': 10, hochzeitsposen: 20, grundlagen: 5 };
const cards = JSON.parse(await readFile('src/data/posing-guide-cards.json', 'utf8'));
const page = async route => load(await readFile(join('dist', route, 'index.html'), 'utf8'));

test('the single book delivers all 45 descriptions and images as real HTML without interaction', async () => {
  const $ = await page('posing-guide');
  assert.equal($('link[rel=canonical]').attr('href'), `${origin}/posing-guide/`);
  assert.doesNotMatch($('meta[name=robots]').attr('content'), /noindex/);
  assert.equal($('h1').length, 1);
  const description = $('meta[name=description]').attr('content');
  assert.ok(description.length >= 90 && description.length <= 170);
  assert.equal($('meta[property="og:description"]').attr('content'), description);
  assert.equal($('template').length, 0);
  assert.equal($('[data-book-stage] > .pose-card').length, 45);
  for (const card of cards) {
    const article = $(`[data-book-stage] > #pose-${card.id}`);
    assert.equal(article.length, 1);
    assert.equal(article.attr('data-guide-mode'), 'book');
    assert.equal(article.attr('data-guide-content'), `pose_${card.id}`);
    assert.ok(article.text().includes(card.description));
    assert.ok(article.text().includes(card.camera));
    assert.equal(article.find('img').attr('src'), `${card.image}-960.webp`);
    assert.equal(article.find('img').attr('loading'), 'lazy');
    assert.ok(article.find('source[type="image/avif"]').attr('srcset').includes('640w'));
    assert.ok(article.find('.book-fallback-controls a').length);
  }
  for (const [chapter, count] of Object.entries(chapters)) {
    assert.equal($(`[data-book-stage] > [data-guide-chapter="${chapter}"]`).length, count);
  }
});

test('the book has 46 pages, in-place chapter targets and no separate reading routes', async () => {
  const $ = await page('posing-guide');
  assert.equal($('[data-book-stage] > .book-page').length, 46);
  assert.equal($('.guide-chapters, .book-toolbar, [data-book-choice]').length, 0);
  assert.equal($('.book-bottom [data-book-status]').length, 1);
  assert.equal($('[data-book-stage] img[loading=eager]').length, 1);
  assert.equal($('[data-book-stage] img[fetchpriority=high]').length, 1);
  const bookPages = $('[data-book-stage] > .book-page').toArray();
  assert.deepEqual(bookPages.map(node => $(node).attr('id')), ['titel', ...cards.map(card => `pose-${card.id}`)]);
  assert.equal($('#inhalt, #orientierung, .book-intro').length, 0);
  bookPages.forEach((node, index) => {
    const article = $(node);
    assert.equal(Number(article.attr('data-guide-page')), index + 1);
    assert.ok(article.find('img').length, `Page ${index + 1} must show an illustration`);
    assert.ok(article.find('.book-page-footer').text().includes(`${index + 1} / 46`));
    const links = article.find('.book-fallback-controls a').toArray().map(link => $(link).attr('href'));
    assert.deepEqual(links, [index > 0 && `#${$(bookPages[index - 1]).attr('id')}`,
      index < bookPages.length - 1 && `#${$(bookPages[index + 1]).attr('id')}`].filter(Boolean));
  });
  assert.equal($('.pose-reading-list').length, 0);
  for (const slug of Object.keys(chapters)) {
    assert.equal($(`a[href="/posing-guide/${slug}/"]`).length, 0);
    await assert.rejects(access(`dist/posing-guide/${slug}/index.html`));
  }
  assert.equal($('[data-desktop-submenu] a[href="/posing-guide/"]').length, 1);
  assert.ok($('a[data-cta-id="mobile_posing_guide"]').length);
});

test('structured book data describes the actual book and its four navigable chapters', async () => {
  const $ = await page('posing-guide');
  const graph = $('script[type="application/ld+json"]').toArray().flatMap(node => JSON.parse($(node).text())['@graph'] || []);
  const book = graph.find(node => node['@type'] === 'Book');
  assert.equal(book.numberOfPages, 46);
  assert.equal(book.bookFormat, 'https://schema.org/EBook');
  assert.equal(book.hasPart.length, 4);
  assert.deepEqual(book.hasPart.map(chapter => chapter.pagination), ['2-6', '7-16', '17-26', '27-46']);
  assert.equal(book.url, `${origin}/posing-guide/`);
  assert.ok(graph.some(node => node['@type'] === 'BreadcrumbList'));
  for (const chapter of book.hasPart) {
    const article = $(new URL(chapter.url).hash);
    assert.equal(article.length, 1);
    assert.equal(Number(chapter.pagination.split('-')[0]), Number(article.attr('data-guide-page')));
  }
});

test('public guide assets contain only screen derivatives and no private reference material', async () => {
  const files = await readdir('public/images/posing-guide');
  assert.equal(files.length, 180);
  for (const file of files) {
    assert.match(file, /^\d{3}-[a-z0-9-]+-[a-f0-9]{12}-(640|960)(-v2\.avif|\.webp)$/);
    assert.ok((await stat(join('public/images/posing-guide', file))).size < 220_000, `${file} exceeds the image budget`);
  }
  const serialized = JSON.stringify(cards);
  assert.doesNotMatch(serialized, /prompt|image_original|\/Users\/|\/Volumes\/|\.HEIC|Kindle|reference/);
  for (const card of cards) assert.ok(card.alt.length < 170);
});

test('only the book URL appears in the page and image sitemaps', async () => {
  const sitemap = await readFile('dist/sitemap.xml', 'utf8');
  const images = await readFile('dist/image-sitemap.xml', 'utf8');
  assert.ok(sitemap.includes(`${origin}/posing-guide/`));
  assert.ok(images.includes(`${origin}/posing-guide/`));
  for (const slug of Object.keys(chapters)) {
    assert.ok(!sitemap.includes(`${origin}/posing-guide/${slug}/`));
    assert.ok(!images.includes(`${origin}/posing-guide/${slug}/`));
  }
});
