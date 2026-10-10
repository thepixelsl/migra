import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portfolioPublications } from '../src/lib/hub-portfolio.mjs';

test('only galleries appear in the portfolio, including after another Hub publication', () => {
  const heroImage = { src: '/hub-assets/poster.jpg' };
  const entries = [
    { kind: 'webstory', path: '/web-stories/eppendorf/', heroImage },
    { kind: 'webstory', showInPortfolio: true, heroImage },
    { kind: 'article', heroImage },
    { kind: 'gallery', path: '/gallery/legacy/', heroImage },
    { kind: 'gallery', path: '/gallery/new/', showInPortfolio: true, heroImage },
    { kind: 'gallery', showInPortfolio: false, heroImage },
    { kind: 'gallery', heroImage: null },
  ];
  assert.deepEqual(portfolioPublications(entries).map(v => v.path), ['/gallery/legacy/', '/gallery/new/']);
});
