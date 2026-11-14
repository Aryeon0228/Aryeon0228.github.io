import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../home-space.js', import.meta.url), 'utf8');
function harness(enabled = true) {
  const window = new EventTarget(), document = new EventTarget();
  const frames = new Map(), timers = new Map();
  let next = 0, positions = [], change, clock = 0, themeChanged, spikes = 0;
  const context = {
    clearRect() { positions = []; spikes = 0; }, setTransform() {}, beginPath() {}, fill() {},
    moveTo() { spikes++; }, lineTo() {}, closePath() {},
    arc(x, y, radius) { positions.push([x, y, radius]); }
  };
  const canvas = { getContext: () => context };
  Object.assign(window, { innerWidth:1200, innerHeight:800, devicePixelRatio:3, scrollY:0,
    penumbraMotion:{ enabled, subscribe(fn) { change = fn; } } });
  Object.assign(document, { hidden:false, documentElement:{ dataset:{} }, getElementById:() => canvas });
  vm.runInNewContext(source, { window, document, performance:{now:() => clock},
    setTimeout(fn, delay) { timers.set(++next, {fn, delay}); return next; },
    clearTimeout(id) { timers.delete(id); },
    cancelAnimationFrame(id) { frames.delete(id); },
    requestAnimationFrame(fn) { frames.set(++next, fn); return next; },
    MutationObserver: class { constructor(fn) { themeChanged=fn; } observe() {} }
  });
  return {
    window, document, canvas, frames, timers,
    spikes:() => spikes,
    advance(ms) { clock += ms; },
    startTwinkle() { const [id, timer] = timers.entries().next().value; timers.delete(id); clock += timer.delay; timer.fn(); },
    theme(value) { document.documentElement.dataset.theme=value; themeChanged(); },
    flush() { for (const [id, fn] of [...frames]) { frames.delete(id); fn(); } return positions.map(p => [...p]); },
    scroll(y) { window.scrollY=y; window.dispatchEvent(new Event('scroll')); },
    motion(value) { change(value); }
  };
}
test('scroll batches one draw with depth speeds; quiet intervals use a timer, not an idle frame loop', () => {
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
  h.motion(false); h.flush(); h.scroll(5000); assert.equal(h.frames.size,0);
  h.document.hidden=true; h.motion(true); h.scroll(5100); assert.equal(h.frames.size,0);
  h.document.hidden=false; h.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(h.frames.size,1);
});

test('an occasional glint brightens one star, ends, and returns to timer-only idle', () => {
  const h=harness(); const base=h.flush();
  assert.equal(h.timers.size,1);
  h.startTwinkle(); h.flush(); assert.equal(h.frames.size,1);
  h.advance(800); const peak=h.flush();
  assert.equal(h.spikes(),1);
  assert.equal(peak.filter((p,i)=>p[2]>base[i][2]).length,1);
  h.advance(1500); const end=h.flush();
  assert.equal(h.spikes(),0);
  assert.deepEqual(end,base);
  assert.equal(h.frames.size,0); assert.equal(h.timers.size,1);
});
test('hidden, motion-off and day mode cancel glints and timers', () => {
  const h=harness(); h.flush(); h.startTwinkle(); h.flush();
  h.motion(false); h.flush();
  assert.equal(h.frames.size,0); assert.equal(h.timers.size,0); assert.equal(h.spikes(),0);
  h.motion(true); h.flush(); assert.equal(h.timers.size,1);
  h.document.hidden=true; h.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(h.frames.size,0); assert.equal(h.timers.size,0);
  h.document.hidden=false; h.document.dispatchEvent(new Event('visibilitychange')); h.flush();
  assert.equal(h.timers.size,1);
  h.theme('day'); h.flush(); assert.equal(h.timers.size,0);
  h.theme('night'); h.flush(); assert.equal(h.timers.size,1);
});
