import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three/build/three.module.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const brushSource = html.slice(html.indexOf('  var ringHoverMedia='), html.indexOf("  document.querySelector('.hero').addEventListener('pointerdown'"));
const hitSource = html.slice(html.indexOf('  var ringHitSlop='), html.indexOf('  // A held brush eases'));

function harness() {
  const doc = new EventTarget(), win = new EventTarget(), hero = new EventTarget(), media = new EventTarget();
  doc.hidden = false; doc.querySelector = () => hero; media.matches = true; win.matchMedia = () => media;
  const brushes = Array.from({length:4}, () => new THREE.Vector4(0, 0, .12, 0));
  let hit = new THREE.Vector3(2, 0, 0), hitChecks = 0, now = 0;
  const state = {document:doc, window:win, reduce:false, activePointer:null, dragControl:{},
    ringBrushes:{value:brushes}, ringSpin:{value:new THREE.Vector2(.2, 1.5)}, dragDiameter:260,
    canvas:{getBoundingClientRect:() => ({left:0, top:0, width:1280, height:760})},
    scene:{updateMatrixWorld() {}}, finishDrag() {}, nearestVisibleOrbit:() => { hitChecks++; return hit; }};
  vm.createContext(state); vm.runInContext(brushSource, state);
  return {state, brushes, doc, win, hero, media,
    move({pointerType = 'mouse', excluded = false} = {}) {
      state.moveRingBrush({pointerType, clientX:500, clientY:250, target:{closest:() => excluded}});
    },
    hit(point) { hit = point; },
    checks() { return hitChecks; },
    advance(seconds, hz = 60) {
      for (let i = 0; i < Math.round(seconds*hz); i++) { now += 1000/hz; state.stepRingBrush(1/hz, now); }
    },
  };
}

test('hover parts one wide patch, then lets it follow the orbit and settle', () => {
  const h = harness(); h.move(); h.advance(.05);
  assert.ok(h.brushes[0].w > 0 && h.brushes[0].w < .2, 'no sudden first-frame kick');
  h.advance(.7);
  assert.ok(h.brushes[0].w > .98);
  assert.ok(h.brushes[0].z >= .24 && h.brushes[0].z <= .60, 'about three times the old fingertip reach');
  assert.equal(h.brushes.filter(b => b.w > 0).length, 1);
  const radius = Math.hypot(h.brushes[0].x, h.brushes[0].y);
  h.hero.dispatchEvent(new Event('pointerleave')); h.advance(.2);
  assert.ok(h.brushes[0].w > .25 && h.brushes[0].w < .85, 'leaving eases instead of snapping');
  assert.ok(h.brushes[0].y > 0, 'released touch travels with the orbit');
  assert.ok(Math.abs(Math.hypot(h.brushes[0].x, h.brushes[0].y)-radius) < 1e-10);
  h.advance(2); assert.ok(h.brushes.every(b => b.w === 0));
});

test('a separated second touch does not move the previous settling patch across the ring', () => {
  const h = harness(); h.move(); h.advance(.5);
  h.hit(new THREE.Vector3(-3, 0, 0)); h.move(); h.advance(.1);
  assert.ok(h.brushes[0].x > 1.9 && h.brushes[0].w > .5);
  assert.ok(h.brushes[1].x < -2.9 && h.brushes[1].w > 0);
  h.hit(null); h.advance(2); assert.ok(h.brushes.every(b => b.w === 0));
});

test('coarse pointers, controls, dragging and reduced motion cannot trigger hovering', () => {
  for (const condition of ['touch', 'coarse', 'control', 'drag', 'reduce']) {
    const h = harness();
    if (condition === 'coarse') h.media.matches = false;
    if (condition === 'drag') h.state.activePointer = 3;
    if (condition === 'reduce') h.state.reduce = true;
    h.move({pointerType:condition === 'touch' ? 'touch' : 'mouse', excluded:condition === 'control'});
    h.advance(1); assert.ok(h.brushes.every(b => b.w === 0), condition);
  }
});

test('blur, scroll, hidden document and preference changes clear stale touches', () => {
  for (const cause of ['blur', 'scroll', 'hidden', 'media', 'reduce']) {
    const h = harness(); h.move(); h.advance(.5); assert.ok(h.brushes[0].w > .9);
    if (cause === 'blur' || cause === 'scroll') h.win.dispatchEvent(new Event(cause));
    if (cause === 'hidden') { h.doc.hidden = true; h.doc.dispatchEvent(new Event('visibilitychange')); }
    if (cause === 'media') { h.media.matches = false; h.media.dispatchEvent(new Event('change')); }
    if (cause === 'reduce') { h.state.reduce = true; h.advance(.02); }
    assert.ok(h.brushes.every(b => b.w === 0), cause);
  }
});

test('high-refresh displays keep bounded hit tests and the same damped response', () => {
  const low = harness(), high = harness(); low.move(); high.move();
  low.advance(.5, 30); high.advance(.5, 120);
  assert.ok(Math.abs(low.brushes[0].w-high.brushes[0].w) < 1e-12);
  assert.ok(high.checks() <= 13, 'hit tests stay at or below 24 Hz, plus the initial check');
});

test('hit testing rejects the ring behind the planet and empty gaps while accepting its near side', () => {
  const camera = new THREE.PerspectiveCamera(32, 1280/760, .1, 100);
  camera.position.z = 8; camera.updateMatrixWorld();
  const ring = new THREE.Object3D(), body = new THREE.Object3D();
  ring.rotation.x = 1.22; ring.updateMatrixWorld(); body.updateMatrixWorld();
  const state = {THREE, camera, ring, body, dustLaneRadii:[2]};
  vm.createContext(state); vm.runInContext(hitSource, state);
  const bounds = {left:0, top:0, width:1280, height:760};
  function screenPoint(angle) {
    const p = new THREE.Vector3(Math.cos(angle)*2, Math.sin(angle)*2, 0).applyMatrix4(ring.matrixWorld).project(camera);
    return [(p.x+1)*bounds.width/2, (1-p.y)*bounds.height/2];
  }
  assert.ok(state.nearestVisibleOrbit(...screenPoint(Math.PI/2), bounds, 5), 'front-facing ring remains brushable over the planet');
  assert.equal(state.nearestVisibleOrbit(...screenPoint(-Math.PI/2), bounds, 5), null, 'far side cannot be touched through the planet');
  assert.equal(state.nearestVisibleOrbit(50, 50, bounds, 5), null, 'empty background stays still');
});
