import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../home-career-stars.js', import.meta.url), 'utf8');
function harness(enabled = true) {
  const window = new EventTarget(), document = new EventTarget();
  const frames = new Map(), classes = new Set();
  let id = 0, clock = 0, change;
  const star = new EventTarget();
  star.classList = { add: x => classes.add(x), remove: x => classes.delete(x) };
  star.getBoundingClientRect = () => ({ top: 600 - window.scrollY, bottom:610 - window.scrollY, height:10 });
  Object.assign(window, { scrollY:0, innerHeight:800, penumbraMotion:{ enabled, subscribe(fn) { change=fn; } } });
  Object.assign(document, { hidden:false, querySelectorAll:() => [star] });
  vm.runInNewContext(source, { window, document, performance:{ now:() => clock },
    requestAnimationFrame(fn) { frames.set(++id,fn); return id; },
    cancelAnimationFrame(i) { frames.delete(i); }
  });
  return { window, document, frames,
    lit:() => classes.has('is-twinkling'),
    scroll(y) { window.scrollY=y; window.dispatchEvent(new Event('scroll')); },
    flush() { for (const [i, fn] of [...frames]) { frames.delete(i); fn(); } },
    finish() { clock+=1000; star.dispatchEvent(new Event('animationend')); },
    motion(value) { change(value); }
  };
}
test('one glint per center pass, no repeated flashes from small scroll movements or idle loop', () => {
  const h=harness();
  assert.equal(h.lit(),false);
  h.scroll(170);h.scroll(200);assert.equal(h.frames.size,1);
  h.flush();assert.equal(h.lit(),true);assert.equal(h.frames.size,0);
  h.finish();h.scroll(210);h.flush();assert.equal(h.lit(),false);
  h.scroll(400);h.flush();h.scroll(200);h.flush();assert.equal(h.lit(),true);
});
test('fast visible crossings glint, but jumps past the entire viewport do not', () => {
  const h=harness();h.scroll(360);h.flush();assert.equal(h.lit(),true);
  const jump=harness();jump.scroll(2000);jump.flush();assert.equal(jump.lit(),false);
});
test('motion off cancels glints and pending work; resume and resize alone never flash', () => {
  const h=harness();h.scroll(200);h.flush();assert.equal(h.lit(),true);
  h.motion(false);assert.equal(h.lit(),false);
  h.scroll(400);assert.equal(h.frames.size,0);
  h.motion(true);assert.equal(h.lit(),false);
  h.scroll(200);assert.equal(h.frames.size,1);
  h.motion(false);assert.equal(h.frames.size,0);
  h.motion(true);h.window.dispatchEvent(new Event('resize'));assert.equal(h.lit(),false);
  h.document.hidden=true;h.document.dispatchEvent(new Event('visibilitychange'));
  h.scroll(205);assert.equal(h.frames.size,0);
});
