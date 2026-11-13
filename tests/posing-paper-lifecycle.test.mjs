import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the actual vendored renderer with a deterministic frame scheduler.
const code = await readFile(new URL('../src/lib/vendor/page-flip.mjs', import.meta.url), 'utf8');
const ownerOf = marker => [...code.slice(0, code.indexOf(marker)).matchAll(/\bclass (\w+)/g)].at(-1)[1];
const rendererClass = ownerOf('start(){this.stopped=false;');
const pageFlipClass = code.match(/export\{(\w+) as PageFlip\}/)[1];
function fixture({ realRender = false } = {}) {
  const frames = new Map(); let id = 0;
  const context = { window: { navigator: { userAgent: 'test' } },
    requestAnimationFrame: cb => { frames.set(++id, cb); return id; }, cancelAnimationFrame: id => frames.delete(id) };
  vm.runInNewContext(code.replace(/export\{[^}]+\};?/, '') + `;this.Renderer=${rendererClass};this.PageFlip=${pageFlipClass};`, context);
  const renderer = new context.Renderer({}, {});
  renderer.update = () => {}; let painted = 0;
  if (realRender) renderer.drawFrame = () => painted++;
  else renderer.render = () => painted++;
  return { context, renderer, frames, painted: () => painted,
    frame(timestamp = 16) { const [id, callback] = frames.entries().next().value; frames.delete(id); callback(timestamp); } };
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
  const f = fixture({ realRender: true }); let committed = false, progressed = 0;
  f.renderer.startAnimation(Array.from({length:90}, () => () => progressed++), 900, () => { committed = true; });
  f.renderer.start(); f.frame(5000); f.frame(5200);
  assert.equal(progressed, 2); assert.equal(committed, false); assert.equal(f.frames.size, 1);
  f.renderer.stop();
  assert.equal(f.frames.size, 0); assert.equal(f.renderer.animation, null); assert.equal(committed, false);
});

test('a newly created renderer starts its 900ms turn on the first animation frame even long after page load', () => {
  const f = fixture({ realRender: true }), progress = []; let completed = 0;
  f.renderer.startAnimation(Array.from({length:90}, (_, index) => () => progress.push(index)), 900, () => {
    completed++; f.renderer.stop();
  });
  f.renderer.start();
  // A fresh renderer is usually created seconds after navigation, on user input.
  f.frame(5000);
  assert.deepEqual(progress, [0]); assert.equal(completed, 0); assert.equal(f.frames.size, 1);
  f.frame(5450);
  assert.equal(progress.at(-1), 45); assert.equal(completed, 0);
  f.frame(5890);
  assert.equal(progress.at(-1), 89); assert.equal(completed, 0);
  f.frame(5900);
  assert.equal(completed, 1); assert.equal(f.frames.size, 0); assert.equal(f.renderer.animation, null);
});
