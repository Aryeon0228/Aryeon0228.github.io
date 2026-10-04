import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three/build/three.module.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const toggleSource = html.slice(html.indexOf("  var ringToggle=document.getElementById('ring-toggle')"), html.indexOf('  /* ---------- Post FX prototypes'));
const passSource = html.slice(html.indexOf('  function renderPass(material, dustMat, target, clearHex){'), html.indexOf('  function setFx(mode){'));

function harness() {
  class Element extends EventTarget {
    attrs = {}; disabled = true; textContent = '';
    setAttribute(key, value) { this.attrs[key] = String(value); }
    getAttribute(key) { return this.attrs[key] ?? null; }
  }
  const toggle = new Element(), label = new Element(), canvas = new Element(), drag = new Element();
  const win = new EventTarget();
  const originalDescription = '행성과 실 같은 고리 사이로 작은 위성이 공전합니다.';
  canvas.setAttribute('aria-label', originalDescription);
  const scene = new THREE.Scene(), ring = new THREE.Mesh(), moon = new THREE.Mesh(), body = new THREE.Mesh();
  const ringDust = new THREE.Points(), ringDustNear = new THREE.Points(), stars = new THREE.Points(), atmo = new THREE.Mesh();
  ring.material.visible = false;
  ring.add(ringDust, ringDustNear, moon); scene.add(ring, body, stars, atmo);
  let cleared = 0;
  const draws = [];
  const state = {window:win, ringVisible:true, ringHeld:true, ringScatter:{value:.85}, ringDust, ringDustNear, canvas, dragControl:drag, scene, ring, atmo, camera:{},
    clearRingBrush() { cleared++; },
    document:{getElementById:id => ({'ring-toggle':toggle, 'ring-state':label}[id])},
    renderer:{
      setClearColor() {}, setRenderTarget() {},
      render(renderedScene) {
        const visible = [];
        renderedScene.traverseVisible(object => { if(object !== renderedScene) visible.push({object, material:object.material}); });
        draws.push(visible);
      }
    }
  };
  vm.createContext(state); vm.runInContext(toggleSource + '\n' + passSource, state);
  return {state, win, toggle, label, canvas, drag, originalDescription, ring, moon, body, ringDust, ringDustNear, stars, atmo, draws,
    cleared:() => cleared, click:() => toggle.dispatchEvent(new Event('click'))};
}

test('ring switch changes both visible halves and accessible state, retaining the moons and planet', () => {
  const h = harness();
  assert.equal(h.toggle.disabled, false);
  h.click();
  assert.equal(h.state.ringVisible, false);
  assert.equal(h.ringDust.visible, false); assert.equal(h.ringDustNear.visible, false);
  assert.equal(h.toggle.getAttribute('aria-checked'), 'false'); assert.equal(h.label.textContent, '꺼짐');
  assert.equal(h.drag.getAttribute('aria-label'), '행성 회전');
  assert.match(h.canvas.getAttribute('aria-label'), /고리 없는 행성/);
  assert.equal(h.cleared(), 1);
  assert.equal(h.state.ringHeld, false); assert.equal(h.state.ringScatter.value, 0, 'hiding clears any held click scatter');
  assert.equal(h.ring.visible, true); assert.equal(h.moon.visible, true); assert.equal(h.body.visible, true);
  h.click();
  assert.equal(h.state.ringVisible, true);
  assert.equal(h.state.ringHeld, false); assert.equal(h.state.ringScatter.value, 0, 're-enabling starts with settled grains');
  assert.equal(h.ringDust.visible, true); assert.equal(h.ringDustNear.visible, true);
  assert.equal(h.toggle.getAttribute('aria-checked'), 'true'); assert.equal(h.label.textContent, '켜짐');
  assert.equal(h.drag.getAttribute('aria-label'), '행성과 고리 회전');
  assert.equal(h.canvas.getAttribute('aria-label'), h.originalDescription);
});

test('theme changes retain the hidden-ring description and restore the current theme when rings return', () => {
  const h = harness();
  h.click();
  const hiddenDescription = h.canvas.getAttribute('aria-label');
  for (const description of ['밝은 행성과 가느다란 고리가 보입니다.', '어둠 속 행성과 은빛 고리가 보입니다.']) {
    // home-theme.js updates its description before dispatching this event.
    h.canvas.setAttribute('aria-label', description);
    h.win.dispatchEvent(new Event('penumbra-theme-change'));
    assert.equal(h.canvas.getAttribute('aria-label'), hiddenDescription);
    assert.equal(h.ringDust.visible, false); assert.equal(h.ringDustNear.visible, false);
    h.click();
    assert.equal(h.canvas.getAttribute('aria-label'), description);
    h.click();
  }
});

test('eclipse and X-Ray passes keep hidden dust hidden, then restore the enabled ring without hiding moons', () => {
  const h = harness(), originalDust = h.ringDust.material, originalMoon = h.moon.material;
  for (const show of [false, true, false]) {
    h.state.setRingVisible(show);
    for (const pass of ['eclipse', 'xray']) {
      const bodyMaterial = {name:pass + '-body'}, dustMaterial = {name:pass + '-dust'};
      h.state.renderPass(bodyMaterial, dustMaterial, {}, 0);
      const draw = h.draws.at(-1);
      assert.equal(draw.some(entry => entry.object === h.ringDust), show);
      assert.equal(draw.some(entry => entry.object === h.ringDustNear), false, 'one full-ring pass replaces both scene halves');
      assert.equal(draw.find(entry => entry.object === h.moon).material, bodyMaterial);
      assert.equal(draw.find(entry => entry.object === h.body).material, bodyMaterial);
      if (show) assert.equal(draw.find(entry => entry.object === h.ringDust).material, dustMaterial);
      assert.equal(h.ringDust.visible, show); assert.equal(h.ringDustNear.visible, show);
      assert.equal(h.ringDust.material, originalDust); assert.equal(h.moon.material, originalMoon);
      assert.equal(h.moon.visible, true); assert.equal(h.stars.visible, true); assert.equal(h.atmo.visible, true);
    }
  }
});
