import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../home-music.js', import.meta.url), 'utf8').replace('export function', 'function');
function harness() {
  class Element extends EventTarget {
    dataset = {}; attrs = {}; textContent = ''; hidden = false;
    setAttribute(k,v) { this.attrs[k] = v; }
    getAttribute(k) { return this.attrs[k] || null; }
    removeAttribute(k) { delete this.attrs[k]; }
    querySelector() { return this.label; }
  }
  const button = new Element(), audio = new Element(), status = new Element();
  button.label = new Element(); button.hidden = true;
  audio.dataset.src = 'track.mp3'; audio.paused = true; audio.volume = 1;
  let plays = [], pauses = 0, time = 0, id = 0;
  const frames = new Map();
  audio.play = () => new Promise((resolve,reject) => {
    plays.push({resolve:() => { audio.paused = false; resolve(); },reject});
  });
  audio.pause = () => { pauses++; audio.paused = true; };
  Object.defineProperty(audio, 'src', {set: v => audio.setAttribute('src',v)});
  const page = new EventTarget(), win = new EventTarget();
  page.hidden = false;
  page.getElementById = id => ({'home-music':audio,'music-toggle':button,'music-status':status}[id]);
  vm.runInNewContext(source, {
    document:page, window:win, performance:{now:() => time},
    requestAnimationFrame:fn => { frames.set(++id,fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  return {button,audio,status,page,win,plays,get pauses(){return pauses;},
    click:() => button.dispatchEvent(new Event('click')),
    tick:(ms=1000) => { time+=ms; const batch=[...frames.values()]; frames.clear(); batch.forEach(f=>f(time)); },
    visible:value => { page.hidden=!value; page.dispatchEvent(new Event('visibilitychange')); },
  };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('initial visit stays silent and does not fetch audio', () => {
  const h=harness();
  assert.equal(h.plays.length,0); assert.equal(h.audio.getAttribute('src'),null);
  assert.equal(h.button.hidden,false); assert.equal(h.button.attrs['aria-pressed'],'false');
});
test('explicit toggle plays softly, then pauses without resetting position', async () => {
  const h=harness(); h.audio.currentTime=43;
  h.click(); assert.equal(h.audio.volume,0); assert.equal(h.audio.getAttribute('src'),'track.mp3');
  h.plays[0].resolve(); await settle(); h.tick();
  assert.equal(h.button.attrs['aria-pressed'],'true'); assert.equal(h.audio.volume,.72);
  h.click(); h.tick();
  assert.equal(h.audio.paused,true); assert.equal(h.audio.currentTime,43);
  assert.equal(h.button.attrs['aria-pressed'],'false');
});
test('a slow network play can be cancelled and cannot turn music back on', async () => {
  const h=harness(); h.click(); h.click(); h.plays[0].resolve(); await settle();
  assert.equal(h.audio.paused,true); assert.equal(h.button.dataset.state,'off');
});
test('failed playback stays off and can be retried', async () => {
  const h=harness(); h.click(); h.plays[0].reject(new Error('NotAllowedError')); await settle();
  assert.equal(h.button.dataset.state,'error'); assert.equal(h.button.label.textContent,'Retry Music'); assert.ok(h.status.textContent.length>0);
  h.click(); h.plays[1].resolve(); await settle(); h.tick();
  assert.equal(h.button.dataset.state,'on'); assert.equal(h.status.textContent,'');
});
test('a hidden page pauses and only resumes if music was requested', async () => {
  const h=harness(); h.visible(false); h.visible(true); assert.equal(h.plays.length,0);
  h.click(); h.plays[0].resolve(); await settle(); h.tick();
  h.visible(false); assert.equal(h.audio.paused,true);
  h.visible(true); h.plays[1].resolve(); await settle(); h.tick();
  assert.equal(h.button.dataset.state,'on');
  h.click(); h.tick(); h.visible(false); h.visible(true); assert.equal(h.plays.length,2);
});
test('fast off/on does not let the stale play promise silence a newer request', async () => {
  const h=harness(); h.click(); h.click(); h.click();
  h.plays[1].resolve(); await settle(); h.tick();
  h.plays[0].resolve(); await settle();
  assert.equal(h.audio.paused,false); assert.equal(h.button.dataset.state,'on');
});
test('network error clears source so the next press can load it again', async () => {
  const h=harness(); h.click(); h.audio.dispatchEvent(new Event('error'));
  assert.equal(h.button.dataset.state,'error'); assert.equal(h.audio.getAttribute('src'),null);
  h.click(); h.plays[1].resolve(); await settle();
  assert.equal(h.button.dataset.state,'on');
});
