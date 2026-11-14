import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat, access } from 'node:fs/promises';
import { join } from 'node:path';
import { load } from 'cheerio';

const origin = 'https://artbild-fotografie.de';
const content = JSON.parse(await readFile('src/data/posing-guide.json', 'utf8'));
const chapters = Object.fromEntries(content.chapters.map(chapter => [chapter.slug, chapter.cards.length]));
const cards = content.chapters.flatMap(chapter => chapter.cards);
const totalPages = cards.length + 1;
const page = async route => load(await readFile(join('dist', route, 'index.html'), 'utf8'));

test('the single book delivers every edited description and image as real HTML without interaction', async () => {
  const $ = await page('posing-guide');
  assert.equal($('link[rel=canonical]').attr('href'), `${origin}/posing-guide/`);
  assert.doesNotMatch($('meta[name=robots]').attr('content'), /noindex/);
  assert.equal($('h1').length, 1);
  const description = $('meta[name=description]').attr('content');
  assert.equal(description, content.page.description);
  assert.equal($('title').text(), content.page.title);
  assert.equal($('h1').text(), content.page.heading);
  assert.equal($('.guide-intro .guide-kicker').text(), content.page.kicker);
  assert.equal($('.guide-lead').text(), content.page.intro);
  assert.equal($('meta[property="og:description"]').attr('content'), description);
  assert.equal($('template').length, 0);
  assert.equal($('[data-book-stage] > .pose-card').length, cards.length);
  for (const card of cards) {
    const article = $(`[data-book-stage] > #pose-${card.id}`);
    assert.equal(article.length, 1);
    assert.equal(article.attr('data-guide-mode'), 'book');
    assert.equal(article.attr('data-guide-content'), `pose_${card.id}`);
    assert.ok(article.text().includes(card.description));
    assert.equal(article.find('.pose-camera').length, 0);
    assert.equal(article.find('img').attr('src'), `${card.image}-960.webp`);
    assert.equal(article.find('img').attr('loading'), 'lazy');
    assert.ok(article.find('source[type="image/avif"]').attr('srcset').includes('640w'));
    assert.ok(article.find('.book-fallback-controls a').length);
  }
  for (const [chapter, count] of Object.entries(chapters)) {
    assert.equal($(`[data-book-stage] > [data-guide-chapter="${chapter}"]`).length, count);
  }
});

test('editorial page order preserves stable anchors, page numbers and fallback navigation', async () => {
  const $ = await page('posing-guide');
  assert.equal($('[data-book-stage] > .book-page').length, totalPages);
  assert.equal($('.guide-chapters, .book-toolbar, [data-book-choice]').length, 0);
  assert.equal($('.book-bottom [data-book-status]').length, 1);
  assert.equal($('[data-book-stage] img[loading=eager]').length, 1);
  assert.equal($('[data-book-stage] img[fetchpriority=high]').length, 1);
  assert.equal($('#titel h2').text(), content.cover.titleLines.join(''));
  assert.equal($('#titel .book-cover-line').text(), content.cover.lineLines.join(''));
  assert.equal($('#titel .book-cover-note').text(), content.cover.noteLines.join(''));
  const coverCard = cards.find(card => card.id === content.cover.imageCardId);
  assert.equal($('#titel img').attr('src'), `${coverCard.image}-960.webp`);
  const bookPages = $('[data-book-stage] > .book-page').toArray();
  assert.deepEqual(bookPages.map(node => $(node).attr('id')), ['titel', ...cards.map(card => `pose-${card.id}`)]);
  assert.equal($('#inhalt, #orientierung, .book-intro').length, 0);
  bookPages.forEach((node, index) => {
    const article = $(node);
    assert.equal(Number(article.attr('data-guide-page')), index + 1);
    assert.ok(article.find('img').length, `Page ${index + 1} must show an illustration`);
    assert.ok(article.find('.book-page-footer').text().includes(`${index + 1} / ${totalPages}`));
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

test('structured book data describes the actual book and its nonempty navigable chapters', async () => {
  const $ = await page('posing-guide');
  const graph = $('script[type="application/ld+json"]').toArray().flatMap(node => JSON.parse($(node).text())['@graph'] || []);
  const book = graph.find(node => node['@type'] === 'Book');
  assert.equal(book.numberOfPages, totalPages);
  assert.equal(book.bookFormat, 'https://schema.org/EBook');
  const nonempty = content.chapters.filter(chapter => chapter.cards.length > 0);
  assert.equal(book.hasPart.length, nonempty.length);
  let firstPage = 2;
  const expectedPagination = nonempty.map(chapter => {
    const pagination = `${firstPage}-${firstPage + chapter.cards.length - 1}`;
    firstPage += chapter.cards.length;
    return pagination;
  });
  assert.deepEqual(book.hasPart.map(chapter => chapter.pagination), expectedPagination);
  assert.deepEqual(book.hasPart.map(chapter => chapter.name), nonempty.map(chapter => chapter.title));
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
  // Old derivatives stay available for restored revisions. Every current picture
  // must have all four screen variants, independent of the number of revisions.
  for (const prefix of new Set(cards.map(card => card.image))) {
    for (const suffix of ['-640.webp', '-960.webp', '-640-v2.avif', '-960-v2.avif']) {
      await access(join('public', prefix + suffix));
    }
  }
  for (const file of files) {
    assert.match(file, /^(?:\d{3}-[a-z0-9-]+-[a-f0-9]{12}|hub-[a-f0-9]{64})-(640|960)(-v2\.avif|\.webp)$/);
    const budget = file.startsWith('hub-') ? 1_000_000 : 220_000;
    assert.ok((await stat(join('public/images/posing-guide', file))).size < budget, `${file} exceeds the image budget`);
  }
  for (const card of cards) {
    assert.match(card.image, /^\/images\/posing-guide\/(?:\d{3}-[a-z0-9-]+-[a-f0-9]{12}|hub-[a-f0-9]{64})$/);
    assert.doesNotMatch(card.image, /\/Users\/|\/Volumes\/|\.HEIC|Kindle|reference/);
    assert.ok(typeof card.alt === 'string' && card.alt.trim().length > 0 && card.alt.length <= 2000);
  }
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

test('the wedding article links to an existing couples page after editorial reordering or deletion', async () => {
  const $ = await page('hochzeitsfotograf-ratgeber');
  const firstCouplesCard = content.chapters.find(chapter => chapter.slug === 'hochzeitsposen')?.cards[0];
  const expected = firstCouplesCard ? `/posing-guide/#pose-${firstCouplesCard.id}` : '/posing-guide/';
  assert.ok($('a').toArray().some(node => $(node).attr('href') === expected));
});
