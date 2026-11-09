import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the actual vendored renderer with a deterministic frame scheduler.
const code = await readFile(new URL('../src/lib/vendor/page-flip.mjs', import.meta.url), 'utf8');
const ownerOf = marker => [...code.slice(0, code.indexOf(marker)).matchAll(/\bclass (\w+)/g)].at(-1)[1];
const rendererClass = ownerOf('start(){this.stopped=false;');
const pageFlipClass = code.match(/export\{(\w+) as PageFlip\}/)[1];
function fixture() {
  const frames = new Map(); let id = 0;
  const context = { window: { navigator: { userAgent: 'test' } },
    requestAnimationFrame: cb => { frames.set(++id, cb); return id; }, cancelAnimationFrame: id => frames.delete(id) };
  vm.runInNewContext(code.replace(/export\{[^}]+\};?/, '') + `;this.Renderer=${rendererClass};this.PageFlip=${pageFlipClass};`, context);
  const renderer = new context.Renderer({}, {});
  renderer.update = () => {}; let painted = 0;
  renderer.render = () => painted++;
  return { context, renderer, frames, painted: () => painted,
    frame() { const [id, callback] = frames.entries().next().value; frames.delete(id); callback(16); } };
}

test('destroying the animation stops all later rendering frames', () => {
  const f = fixture();
  f.renderer.start(); assert.equal(f.frames.size, 1);
  f.frame(); assert.equal(f.painted(), 1); assert.equal(f.frames.size, 1);
  const cleanup = [];
  f.context.PageFlip.prototype.destroy.call({ render: f.renderer, ui: { destroy() { assert.equal(f.frames.size, 0); cleanup.push('handlers'); } }, block: { remove() { cleanup.push('overlay'); } } });
  assert.equal(f.frames.size, 0);
  assert.deepEqual(cleanup, ['handlers', 'overlay']);
});

test('finishing a turn inside its paint callback cannot start a new idle loop', () => {
  const f = fixture(); f.renderer.render = () => f.renderer.stop();
  f.renderer.start(); f.frame();
  assert.equal(f.frames.size, 0);
});

test('manual cancellation drops a queued animation without completing the page turn', () => {
  const f = fixture(); let committed = false;
  f.renderer.animation = { onAnimateEnd: () => { committed = true; } };
  f.renderer.start(); f.renderer.stop();
  assert.equal(f.frames.size, 0); assert.equal(f.renderer.animation, null); assert.equal(committed, false);
});
