import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAssetBinding } from '../server/bunny-assets.mjs';

test('guide AVIF images are delivered as images for browsers and publication checks', async () => {
  const cards = JSON.parse(await readFile('src/data/posing-guide-cards.json', 'utf8'));
  const assets = createAssetBinding('public');
  const url = `https://artbild-fotografie.de${cards[0].image}-960-v2.avif`;
  for (const method of ['GET', 'HEAD']) {
    const response = await assets.fetch(new Request(url, { method }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/avif');
    assert.ok(Number(response.headers.get('content-length')) > 0);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (method === 'GET') assert.equal(new TextDecoder().decode(bytes.slice(4, 12)), 'ftypavif');
    else assert.equal(bytes.length, 0);
  }
});
