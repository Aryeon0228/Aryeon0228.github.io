import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../home-motion.js', import.meta.url), 'utf8');

function harness({ reduced = false, stored = null, storageError = false, ready = false } = {}) {
  class Element extends EventTarget {
    dataset = {}; attrs = {}; hidden = true; textContent = '';
    setAttribute(name, value) { this.attrs[name] = value; }
    querySelector() { return this.label; }
  }
  class DetailEvent extends Event {
    constructor(type, options) { super(type); this.detail = options.detail; }
  }
  const win = new EventTarget(), document = new EventTarget(), system = new EventTarget();
  const button = new Element(); button.label = new Element();
  document.documentElement = { dataset: {} };
  document.readyState = ready ? 'complete' : 'loading';
  document.getElementById = id => id === 'motion-toggle' ? button : null;
  system.matches = reduced;
  win.matchMedia = () => system;
  const saved = new Map(stored === null ? [] : [['penumbra-motion', stored]]);
  const storage = {
    getItem(key) { if (storageError) throw new Error('Storage unavailable'); return saved.get(key) ?? null; },
    setItem(key, value) { if (storageError) throw new Error('Storage unavailable'); saved.set(key, value); }
  };
  Object.defineProperty(win, 'localStorage', { get() { if (storageError) throw new Error('Storage unavailable'); return storage; } });
  const changes = [];
  win.addEventListener('penumbra-motion-change', event => changes.push(event.detail.enabled));
  vm.runInNewContext(source, { window: win, document, CustomEvent: DetailEvent });
  return {
    motion: win.penumbraMotion, button, saved, changes, root: document.documentElement,
    ready() { document.dispatchEvent(new Event('DOMContentLoaded')); },
    click() { button.dispatchEvent(new Event('click')); },
    system(reduce) { system.matches = reduce; system.dispatchEvent(new Event('change')); },
    storage(value, key = 'penumbra-motion') {
      const event = new Event('storage');
      Object.assign(event, { key, newValue: value, storageArea: storage });
      win.dispatchEvent(event);
    }
  };
}

test('a first visit follows the system before the body and its switch are ready', () => {
  for (const reduced of [false, true]) {
    const h = harness({ reduced });
    assert.equal(h.motion.enabled, !reduced);
    assert.equal(h.root.dataset.motion, reduced ? 'off' : 'on');
    assert.equal(h.button.hidden, true);
    h.ready();
    assert.equal(h.button.hidden, false);
    assert.equal(h.button.attrs.role, 'switch');
    assert.equal(h.button.attrs['aria-label'], 'Animation');
    assert.equal(h.button.attrs['aria-checked'], String(!reduced));
    assert.equal(h.button.label.textContent, reduced ? 'Off' : 'On');
    assert.equal(h.saved.size, 0, 'reading the system does not create a user preference');
  }
});

test('explicit enabling overrides reduced motion, notifies consumers, and survives a return visit', () => {
  const h = harness({ reduced: true, ready: true });
  const frames = [];
  const unsubscribe = h.motion.subscribe(enabled => frames.push(enabled));
  h.click();
  assert.equal(h.motion.enabled, true);
  assert.equal(h.root.dataset.motion, 'on');
  assert.equal(h.button.attrs['aria-checked'], 'true');
  assert.equal(h.button.label.textContent, 'On');
  assert.equal(h.saved.get('penumbra-motion'), 'on');
  assert.deepEqual(frames, [true]);
  assert.deepEqual(h.changes, [true]);
  const returned = harness({ reduced: true, stored: h.saved.get('penumbra-motion') });
  assert.equal(returned.motion.enabled, true);
  h.click();
  assert.deepEqual(frames, [true, false]);
  assert.equal(h.root.dataset.motion, 'off');
  unsubscribe();
  h.click();
  assert.deepEqual(frames, [true, false], 'unsubscribed effects are no longer invoked');
});

test('system changes update only an unset preference, including an explicit unchanged selection', () => {
  const h = harness(); h.ready();
  h.system(true); assert.equal(h.motion.enabled, false);
  h.system(false); assert.equal(h.motion.enabled, true);
  h.motion.setEnabled(true);
  h.system(true); assert.equal(h.motion.enabled, true, 'explicit on remains on even when system changes later');
  assert.equal(h.saved.get('penumbra-motion'), 'on');
  h.motion.setEnabled(false);
  h.system(false); assert.equal(h.motion.enabled, false, 'explicit pause remains paused');
});

test('explicit playback and pause still work without access to local storage', () => {
  const h = harness({ reduced: true, storageError: true, ready: true });
  h.click(); assert.equal(h.motion.enabled, true);
  h.system(false); h.system(true); assert.equal(h.motion.enabled, true);
  h.click(); assert.equal(h.motion.enabled, false);
  assert.equal(h.button.label.textContent, 'Off');
});

test('saved pause wins over system animation; invalid saved values use the system', () => {
  assert.equal(harness({ stored: 'off' }).motion.enabled, false);
  assert.equal(harness({ reduced: true, stored: 'invalid' }).motion.enabled, false);
  assert.equal(harness({ stored: 'invalid' }).motion.enabled, true);
});

test('another tab can update the preference; clearing it restores the current system setting', () => {
  const h = harness({ reduced: true, ready: true });
  h.storage('on'); assert.equal(h.motion.enabled, true);
  assert.equal(h.button.label.textContent, 'On');
  h.storage('off', 'unrelated-key'); assert.equal(h.motion.enabled, true);
  h.storage(null); assert.equal(h.motion.enabled, false);
  h.system(false); assert.equal(h.motion.enabled, true);
  h.storage('off'); assert.equal(h.motion.enabled, false);
  h.storage(null, null); assert.equal(h.motion.enabled, true);
});
