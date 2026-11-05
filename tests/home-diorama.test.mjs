import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../home-diorama.js', import.meta.url), 'utf8');

function harness() {
  const page = {baseURI:'https://example.test/portfolio/', activeElement:null};
  class Element extends EventTarget {
    constructor(tag) {
      super();
      this.tagName = tag;
      this.children = [];
      this.attrs = {};
      this.dataset = {};
      this.classList = new Set();
      this.classList.remove = value => this.classList.delete(value);
      if (tag === 'iframe') this.contentDocument = new EventTarget();
    }
    setAttribute(key, value) { this.attrs[key] = value; }
    append(...children) { children.forEach(child => { child.parent = this; this.children.push(child); }); }
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
    contains(target) { return target === this || this.children.some(child => child.contains(target)); }
    focus(options) { page.activeElement = this; this.focusOptions = options; }
    querySelector() { return play; }
  }
  const stage = new Element('figure'), play = new Element('button');
  stage.dataset = {diorama:'diorama-island/?embed=1&quality=low', dioramaTitle:'Diorama Island'};
  stage.append(play);
  page.createElement = tag => new Element(tag);
  page.querySelectorAll = () => [stage];
  const timers = new Map();
  let nextTimer = 0, observer;
  class IntersectionObserver {
    constructor(callback, options) { observer = {callback, options}; }
    observe(target) { observer.target = target; }
  }
  vm.runInNewContext(source, {
    document:page, window:{IntersectionObserver}, IntersectionObserver, URL,
    setTimeout(callback, delay) { timers.set(++nextTimer, {callback, delay}); return nextTimer; },
    clearTimeout(id) { timers.delete(id); },
  });
  return {
    stage, play, page, timers, observer,
    get frame() { return stage.children.find(child => child.tagName === 'iframe'); },
    get controls() { return stage.children.find(child => child.className === 'diorama-controls'); },
    get status() { return stage.children.find(child => child.className === 'diorama-status'); },
    click(element = play) { element.dispatchEvent(new Event('click')); },
    slow() { const batch = [...timers.values()]; timers.clear(); batch.forEach(timer => timer.callback()); },
    offscreen() { observer.callback([{isIntersecting:false}]); },
    escape(target = stage) {
      const event = new Event('keydown', {cancelable:true});
      Object.defineProperty(event, 'key', {value:'Escape'});
      target.dispatchEvent(event);
      return event;
    },
  };
}

test('the demo loads only on request and offers loading feedback and an independent full-page link', () => {
  const h = harness();
  assert.equal(h.frame, undefined);
  assert.equal(h.timers.size, 0);
  h.click();
  assert.equal(h.frame.src, 'diorama-island/?embed=1&quality=low');
  assert.equal(h.frame.attrs['aria-busy'], 'true');
  assert.match(h.status.textContent, /불러오는 중/);
  assert.equal(h.status.attrs.role, 'status');
  assert.equal(h.page.activeElement, h.controls.children[0]);
  assert.equal(h.controls.children[0].attrs['aria-keyshortcuts'], 'Escape');
  const link = h.controls.children[2];
  assert.equal(link.href, 'https://example.test/portfolio/diorama-island/?quality=low');
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
  const originalFrame = h.frame;
  h.click();
  assert.equal(h.frame, originalFrame, 'a repeated start does not create another app');
});

test('document load does not claim the scene is ready or cancel the slow-screen fallback', () => {
  const h = harness();
  h.click();
  h.frame.dispatchEvent(new Event('load'));
  assert.equal(h.frame.attrs['aria-busy'], 'false');
  assert.match(h.status.textContent, /장면이 보이면/);
  assert.equal(h.timers.size, 1);
  assert.equal([...h.timers.values()][0].delay, 12000);
  h.slow();
  assert.match(h.status.textContent, /비어 있거나 느리면/);
  assert.match(h.status.textContent, /다시 불러오거나 새 창/);
  h.frame.dispatchEvent(new Event('load'));
  assert.match(h.status.textContent, /비어 있거나 느리면/, 'a late load preserves recovery guidance');
});

test('retry replaces the app and ignores stale load callbacks and timers', () => {
  const h = harness();
  h.click();
  const previousFrame = h.frame, previousTimer = [...h.timers.values()][0].callback;
  h.click(h.controls.children[1]);
  assert.notEqual(h.frame, previousFrame);
  assert.equal(previousFrame.parent, null);
  assert.equal(h.timers.size, 1);
  previousFrame.dispatchEvent(new Event('load'));
  previousTimer();
  assert.match(h.status.textContent, /불러오는 중/);
  h.frame.dispatchEvent(new Event('error'));
  assert.match(h.status.textContent, /불러오지 못했습니다/);
  assert.equal(h.timers.size, 0);
});

test('close and Escape restore focus and remove the frame and pending feedback', () => {
  for (const action of ['click', 'escape']) {
    const h = harness();
    h.click();
    if (action === 'click') h.click(h.controls.children[0]);
    else assert.equal(h.escape().defaultPrevented, true);
    assert.equal(h.frame, undefined);
    assert.equal(h.status, undefined);
    assert.equal(h.controls, undefined);
    assert.equal(h.timers.size, 0);
    assert.equal(h.page.activeElement, h.play);
  }
});

test('Escape also closes a focused same-origin demo after its document loads', () => {
  const h = harness();
  h.click();
  const frame = h.frame;
  frame.dispatchEvent(new Event('load'));
  frame.focus();
  assert.equal(h.escape(frame.contentDocument).defaultPrevented, true);
  assert.equal(h.frame, undefined);
  assert.equal(h.page.activeElement, h.play);
  h.click();
  h.escape(frame.contentDocument);
  assert.ok(h.frame, 'a removed frame no longer handles Escape');
});

test('an inaccessible demo document still leaves the parent close control usable', () => {
  const h = harness();
  h.click();
  h.frame.contentDocument = null;
  h.frame.dispatchEvent(new Event('load'));
  h.click(h.controls.children[0]);
  assert.equal(h.frame, undefined);
  assert.equal(h.page.activeElement, h.play);
});

test('offscreen unloading releases the demo without stealing outside focus or scrolling back', () => {
  const h = harness();
  assert.equal(h.observer.options.rootMargin, '300px 0px');
  assert.equal(h.observer.target, h.stage);
  h.click();
  const outside = {};
  h.page.activeElement = outside;
  h.offscreen();
  assert.equal(h.frame, undefined);
  assert.equal(h.page.activeElement, outside);
  assert.equal(h.timers.size, 0);
  h.click();
  h.frame.focus();
  h.offscreen();
  assert.equal(h.page.activeElement, h.play);
  assert.equal(h.play.focusOptions.preventScroll, true);
});
