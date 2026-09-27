import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const bind = html.slice(html.indexOf('  function bind(id, out, key, target){'), html.indexOf("  bind('s-pen'"));
const motion = html.slice(html.indexOf("  var sunSlider = document.getElementById('s-sun')"), html.indexOf('  // The one sun of every mode:'));
const ease = html.match(/  function ease\(current, target, dt, speed\)\{[^\n]+/)[0];

function harness({reduce = false} = {}) {
  class Element extends EventTarget {
    value = '0'; defaultValue = '0'; hidden = false; attrs = {}; textContent = '';
    setAttribute(key, value) { this.attrs[key] = String(value); }
  }
  const slider = new Element(), label = new Element(), panel = new Element(), toggle = new Element();
  const doc = new EventTarget(), win = new EventTarget();
  doc.hidden = false;
  doc.getElementById = id => ({'s-sun':slider, 'v-sun':label, 'rack-b':panel}[id]);
  doc.querySelector = () => toggle;
  // The real panel handler is registered before the renderer's listener.
  toggle.addEventListener('click', () => { panel.hidden = !panel.hidden; });
  let now = 0;
  const state = {document:doc, window:win, performance:{now:() => now}, reduce, P:{}, planetBaseline:{sun:.74},
    compMat:{uniforms:{uSun:{value:{x:.5}}}}, bodyUniforms:{uLight:{value:{z:-1}}}};
  vm.createContext(state);
  vm.runInContext(bind + "\nbind('s-sun','v-sun','sun',planetBaseline.sun + 1);\n" + ease + '\n' + motion, state);
  function send(target, type, props = {}) {
    const event = new Event(type);
    Object.assign(event, props);
    target.dispatchEvent(event);
  }
  return {state, slider, panel, label, doc, win, send,
    input(value) { slider.value = String(value); send(slider, 'input'); },
    down() { send(slider, 'pointerdown', {pointerId:7, button:0}); },
    up() { send(win, 'pointerup', {pointerId:7}); },
    close() { panel.hidden = false; send(toggle, 'click'); },
    advance(seconds) {
      for(let elapsed = 0; elapsed < seconds - 1e-8; elapsed += .02) {
        now += 20; state.driftSun(.02);
      }
    },
  };
}

test('manual dragging holds even without movement, then resumes from the chosen angle without jumping', () => {
  const h = harness(); h.advance(.1);
  h.down(); h.input(40);
  const selected = h.state.P.sun;
  h.advance(5); assert.equal(h.state.P.sun, selected);
  h.up(); h.advance(1.98); assert.equal(h.state.P.sun, selected);
  h.advance(.04);
  const firstStep = h.state.P.sun - selected;
  assert.ok(firstStep > 0 && firstStep < .00001, 'restart should initially be much slower than normal drift');
  h.advance(2);
  assert.ok(h.state.P.sun > selected && h.state.P.sun < selected + .01, 'resume stays near the manually selected position');
});

test('a click without a value change cannot leave the orbit frozen', () => {
  const h = harness(); h.advance(.1); h.down();
  const before = h.state.P.sun;
  h.advance(4); assert.equal(h.state.P.sun, before);
  h.up(); h.advance(3); assert.ok(h.state.P.sun > before);
});

test('holding a range key pauses at its endpoint; release and subsequent inputs restart the wait', () => {
  const h = harness();
  h.send(h.slider, 'keydown', {key:'End'}); h.input(100);
  h.advance(4); assert.equal(h.state.P.sun, 1.74);
  h.send(h.slider, 'keyup', {key:'End'}); h.advance(1);
  h.input(38); const selected = h.state.P.sun;
  h.advance(1.98); assert.equal(h.state.P.sun, selected);
  h.advance(.04); assert.ok(h.state.P.sun > selected);
});

test('closing the panel resumes promptly and smoothly, without waiting for the hold', () => {
  const h = harness(); h.input(65); const selected = h.state.P.sun;
  h.close(); h.advance(.02);
  assert.ok(h.state.P.sun > selected && h.state.P.sun < selected + .00001);
});

test('pointer cancellation, capture loss, blur and a hidden document cannot strand manual hold', () => {
  for(const reason of ['pointercancel', 'lostpointercapture', 'blur', 'visibilitychange']) {
    const h = harness(); h.down(); h.input(60); const selected = h.state.P.sun;
    if(reason === 'pointercancel') h.send(h.win, reason, {pointerId:7});
    if(reason === 'lostpointercapture') h.send(h.slider, reason, {pointerId:7});
    if(reason === 'blur') h.send(h.win, reason);
    if(reason === 'visibilitychange') { h.doc.hidden = true; h.send(h.doc, reason); }
    h.advance(3); assert.ok(h.state.P.sun > selected, reason);
  }
});

test('reduced motion stays still after input and panel close; enabling motion later works', () => {
  const h = harness({reduce:true}); h.input(50); const selected = h.state.P.sun;
  h.close(); h.advance(5); assert.equal(h.state.P.sun, selected);
  h.state.reduce = false; h.advance(.1); assert.ok(h.state.P.sun > selected);
});

test('the 360-degree endpoint wraps to the same physical angle when motion restarts', () => {
  const h = harness(); h.input(100); h.close(); h.advance(.02);
  assert.ok(h.state.P.sun >= .74 && h.state.P.sun < .74001);
  assert.equal(h.slider.value, 0);
});
