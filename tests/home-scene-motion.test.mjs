import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const preferenceSource = readFileSync(new URL('../home-motion.js', import.meta.url), 'utf8');
function between(start, end) {
  const from = html.indexOf(start), to = html.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Scene test requires the ${start.trim()} section`);
  return html.slice(from, to);
}
// Exercise the real preference wiring and frame gate while replacing only GPU work
// after the clock update. This makes clock/visibility regressions observable in Node.
const controlsSource = between('  var motion = window.penumbraMotion;', '  var dragCenter =');
const frameSource = between('  var t0 = performance.now(), sceneTime = 0;', '    stepRingBrush(dt,now);') +
  '\n    draws.push({ time:t, dt });\n  }';

function harness({ reduced = false } = {}) {
  class DetailEvent extends Event {
    constructor(type, options) { super(type); this.detail = options.detail; }
  }
  let now = 1000, observer, clears = 0, resizes = 0, scheduled = 0;
  const win = new EventTarget(), document = new EventTarget(), hero = new EventTarget(), system = new EventTarget();
  document.documentElement = { dataset: {} };
  document.hidden = false; document.readyState = 'complete'; document.fonts = new EventTarget();
  const hint = { hidden: false };
  document.getElementById = id => id === 'sun-hint' ? hint : null;
  system.matches = reduced;
  win.matchMedia = () => system;
  class IntersectionObserver {
    constructor(callback) { observer = callback; }
    observe() {}
  }
  win.IntersectionObserver = IntersectionObserver;
  const state = {
    window: win, document, heroEl: hero, canvas: {}, CustomEvent: DetailEvent, IntersectionObserver,
    performance: { now: () => now }, draws: [], tierWatch: { since: 1000 }, ringHeld: true, ringScatter: { value: .8 }, activePointer: null,
    clearRingBrush() { clears++; }, resize() { resizes++; },
    requestAnimationFrame() { scheduled++; }
  };
  vm.createContext(state);
  vm.runInContext(preferenceSource + '\n' + controlsSource + '\n' + frameSource, state);
  return {
    state, hint, win, document, hero, motion: win.penumbraMotion,
    get now() { return now; },
    get clears() { return clears; }, get resizes() { return resizes; }, get scheduled() { return scheduled; },
    tick(ms = 16) { now += ms; state.frame(now); },
    elapse(ms) { now += ms; },
    setVisible(visible) { observer([{ isIntersecting: visible }]); },
    setHidden(hidden) { document.hidden = hidden; document.dispatchEvent(new Event('visibilitychange')); }
  };
}

test('pausing keeps the current orbit, renders once, then stops GPU work until needed', () => {
  const h = harness(); h.tick(); h.tick();
  const time = h.state.sceneTime;
  assert.ok(time > 0);
  h.motion.setEnabled(false);
  assert.equal(h.hint.hidden, true);
  assert.equal(h.clears, 1);
  assert.equal(h.state.ringHeld, false);
  assert.equal(h.state.ringScatter.value, 0);
  h.tick();
  assert.equal(h.state.sceneTime, time);
  assert.equal(h.state.draws.at(-1).dt, 0);
  const count = h.state.draws.length;
  for (let n = 0; n < 100; n++) h.tick(1000);
  assert.equal(h.state.sceneTime, time);
  assert.equal(h.state.draws.length, count);
  assert.equal(h.resizes, count, 'paused idle frames skip layout/GPU preparation too');
});

test('resume starts from the paused time without adding time spent paused', () => {
  const h = harness(); h.tick(); h.motion.setEnabled(false); h.tick();
  const before = h.state.sceneTime;
  h.elapse(60000); h.motion.setEnabled(true); h.tick(16);
  assert.ok(Math.abs(h.state.sceneTime - before - .016) < 1e-10);
  assert.equal(h.hint.hidden, false);
  h.tick(16); assert.ok(Math.abs(h.state.sceneTime - before - .032) < 1e-10);
});

test('manual controls and layout changes redraw a paused scene without advancing it', () => {
  const h = harness({ reduced: true }); h.tick();
  const triggers = [
    () => h.hero.dispatchEvent(new Event('input')),
    () => h.hero.dispatchEvent(new Event('keydown')),
    () => h.win.dispatchEvent(new Event('resize')),
    () => h.win.dispatchEvent(new Event('penumbra-theme-change')),
    () => h.document.fonts.dispatchEvent(new Event('loadingdone'))
  ];
  for (const trigger of triggers) {
    const count = h.state.draws.length;
    trigger(); h.tick();
    assert.equal(h.state.draws.length, count + 1);
    assert.equal(h.state.sceneTime, 0);
    h.tick(); assert.equal(h.state.draws.length, count + 1, 'redraw requests are consumed');
  }
});

test('paused pointer movement redraws only while dragging the planet', () => {
  const h = harness({ reduced: true }); h.tick();
  const count = h.state.draws.length;
  h.hero.dispatchEvent(new Event('pointermove')); h.tick();
  assert.equal(h.state.draws.length, count, 'ordinary mouse hover does not wake the paused scene');
  h.state.activePointer = 7;
  h.hero.dispatchEvent(new Event('pointermove')); h.tick();
  assert.equal(h.state.draws.length, count + 1, 'manual dragging remains visible while automatic motion is paused');
  assert.equal(h.state.sceneTime, 0);
  h.state.activePointer = null;
  h.hero.dispatchEvent(new Event('pointermove')); h.tick();
  assert.equal(h.state.draws.length, count + 1);
});

test('a hidden document or offscreen hero does not advance the orbit or catch up on return', () => {
  for (const hiddenBy of ['document', 'viewport']) {
    const h = harness(); h.tick();
    const before = h.state.sceneTime, count = h.state.draws.length;
    const hide = hiddenBy === 'document' ? value => h.setHidden(value) : value => h.setVisible(!value);
    hide(true); h.tick(60000);
    assert.equal(h.state.sceneTime, before);
    assert.equal(h.state.draws.length, count);
    assert.equal(h.state.tierWatch.since, 0);
    h.elapse(60000); hide(false); h.tick(16);
    assert.ok(Math.abs(h.state.sceneTime - before - .016) < 1e-10);
  }
});

test('explicit play overrides a reduced-motion first visit all the way to the frame clock', () => {
  const h = harness({ reduced: true }); h.tick(1000); h.tick(1000);
  assert.equal(h.state.sceneTime, 0);
  assert.equal(h.state.draws.length, 1);
  h.motion.setEnabled(true); h.tick(16); h.tick(16);
  assert.ok(Math.abs(h.state.sceneTime - .032) < 1e-10);
  assert.equal(h.state.draws.length, 3);
});

test('an already queued RAF timestamp cannot move the clock backward after resume', () => {
  const h = harness(); h.tick(16);
  const before = h.state.sceneTime;
  h.motion.setEnabled(false); h.elapse(60000); h.motion.setEnabled(true);
  h.state.frame(h.now - 4);
  assert.equal(h.state.sceneTime, before);
  assert.equal(h.state.draws.at(-1).dt, 0);
  h.tick(16);
  assert.ok(h.state.sceneTime > before && h.state.sceneTime <= before + .05);
});
