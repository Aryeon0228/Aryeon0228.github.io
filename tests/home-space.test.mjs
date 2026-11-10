import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../home-space.js', import.meta.url), 'utf8');
function harness(enabled = true) {
  const window = new EventTarget(), document = new EventTarget();
  const frames = new Map();
  let next = 0, positions = [], change;
  const context = {
    clearRect() { positions = []; }, setTransform() {}, beginPath() {}, fill() {},
    arc(x, y, radius) { positions.push([x, y, radius]); }
  };
  const canvas = { getContext: () => context };
  Object.assign(window, { innerWidth:1200, innerHeight:800, devicePixelRatio:3, scrollY:0,
    penumbraMotion:{ enabled, subscribe(fn) { change = fn; } } });
  Object.assign(document, { hidden:false, documentElement:{ dataset:{} }, getElementById:() => canvas });
  vm.runInNewContext(source, { window, document,
    requestAnimationFrame(fn) { frames.set(++next, fn); return next; },
    MutationObserver: class { observe() {} }
  });
  return {
    window, document, canvas, frames,
    flush() { for (const [id, fn] of [...frames]) { frames.delete(id); fn(); } return positions.map(p => [...p]); },
    scroll(y) { window.scrollY=y; window.dispatchEvent(new Event('scroll')); },
    motion(value) { change(value); }
  };
}
test('scroll batches a single draw with different depth speeds and no idle loop', () => {
  const h=harness(); const first=h.flush();
  assert.equal(h.frames.size,0);
  assert.equal(h.canvas.width,1800); // cap the rendering cost on high-DPI screens
  h.scroll(200); h.scroll(500);
  assert.equal(h.frames.size,1);
  const second=h.flush();
  assert.equal(h.frames.size,0);
  assert.ok(second.every(([x,y]) => x>=0 && x<=1200 && y>=0 && y<=800));
  const shifts = new Set(second.map((p,i)=>Math.round((first[i][1]-p[1]+800)%800)));
  assert.ok(shifts.size>=3);
});
test('motion off keeps stars static and resuming does not include skipped scrolling', () => {
  const h=harness(false); const first=h.flush();
  h.scroll(2000); assert.equal(h.frames.size,0);
  h.motion(true); h.scroll(2100); const next=h.flush();
  assert.ok(next.every((p,i)=> (first[i][1]-p[1]+800)%800 < 13));
  h.motion(false); h.scroll(5000); assert.equal(h.frames.size,0);
  h.document.hidden=true; h.motion(true); h.scroll(5100); assert.equal(h.frames.size,0);
  h.document.hidden=false; h.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(h.frames.size,1);
});
