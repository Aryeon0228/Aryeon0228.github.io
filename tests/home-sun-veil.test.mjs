import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three/build/three.module.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('  var sunVeil='), html.indexOf('  // ECLIPSE shows that sun:'));
const frameSource = html.slice(html.indexOf('    aimSun();'), html.indexOf('    bodyUniforms.uTime.value  = t;'));

function harness({width = 1280, height = 760, x = .04, y = .5} = {}) {
  const writes = [];
  const style = new Proxy({}, {set(target, property, value) {
    target[property] = value; writes.push({property, value}); return true;
  }});
  const state = {
    THREE, document:{querySelector:() => ({style})}, canvas:{clientWidth:width, clientHeight:height},
    compMat:{uniforms:{uSun:{value:{x, y}}, uExposure:{value:1}, uBacklit:{value:1}}},
  };
  vm.createContext(state); vm.runInContext(source, state);
  return {state, writes, style, update:(amount = 1, contact = 5) => state.updateSunVeil(amount, contact)};
}

function maskParts(mask) {
  const match = /^radial-gradient\(circle at (-?\d+)px (-?\d+)px,rgba\(0,0,0,([\d.]+)\) 24px,#000 (\d+)px\)$/.exec(mask);
  assert.ok(match, 'a finite local gradient leaves the surrounding text veil intact');
  return {x:Number(match[1]), y:Number(match[2]), alpha:Number(match[3]), radius:Number(match[4])};
}

test('an uncovered source pierces the dark veil locally without dimming its white center', () => {
  const h = harness(); h.update();
  const mask = maskParts(h.style.maskImage);
  assert.equal(mask.alpha, 0, 'transparent mask removes the black veil over the white source');
  assert.equal(mask.x, 51); assert.equal(mask.y, 380);
  assert.ok(mask.radius > 24, 'dark text backdrop returns outside the soft opening');
  assert.equal(h.style.webkitMaskImage, h.style.maskImage);
});

test('the veil stays open through the late flash and closes as the sun is fully hidden', () => {
  const h = harness(); h.update(1, -.45);
  assert.equal(maskParts(h.style.maskImage).alpha, 0, 'the late contact peak retains a bright source');
  h.update(1, -.725);
  assert.equal(maskParts(h.style.maskImage).alpha, .5, 'concealment closes the opening smoothly');
  h.update(1, -1); assert.equal(h.style.maskImage, '');
  assert.equal(h.style.webkitMaskImage, '');
  const count = h.writes.length;
  h.update(1, -2); assert.equal(h.writes.length, count, 'full concealment does not repaint a closed veil');
});

test('OFF, X-RAY, day, and a sun behind the viewer restore the original veil', () => {
  for (const mode of [{fxMode:'off', isDay:false}, {fxMode:'xray', isDay:false},
    {fxMode:'eclipse', isDay:true}, {fxMode:'eclipse', isDay:false, amount:0}]) {
    const h = harness(); h.update();
    let updates = 0;
    Object.assign(h.state, mode, {dt:.016, uFwd:{value:1}, aimSun() {}, clearName() {}, resetCamera() {},
      updateSun() { updates++; h.update(mode.amount ?? 1); return mode.amount ?? 1; }});
    vm.runInContext(frameSource, h.state);
    assert.equal(h.style.maskImage, '', JSON.stringify(mode));
    assert.equal(h.style.webkitMaskImage, '');
    assert.equal(updates, mode.fxMode === 'eclipse' && !mode.isDay ? 1 : 0);
  }
});

test('subpixel drift and unchanged state do not repaint the mask', () => {
  const h = harness({x:.1, y:.5}); h.update();
  assert.equal(h.writes.length, 2, 'standard and WebKit mask receive the initial update');
  h.state.compMat.uniforms.uSun.value.x += .2/1280;
  h.update(); h.update(); assert.equal(h.writes.length, 2);
  h.state.compMat.uniforms.uSun.value.x += .6/1280;
  h.update(); assert.equal(h.writes.length, 4);
  assert.equal(maskParts(h.style.maskImage).x, 129);
});

test('the opening stays bounded on mobile and handles an approaching offscreen source', () => {
  for (const [height, radius] of [[400, 90], [844, 150], [1600, 150]]) {
    const h = harness({width:390, height, x:-.1, y:.55}); h.update();
    const mask = maskParts(h.style.maskImage);
    assert.equal(mask.radius, radius); assert.equal(mask.x, -39);
    assert.equal(mask.y, Math.round(height*.45));
    h.state.compMat.uniforms.uSun.value.x = -.21;
    h.update(); assert.equal(h.style.maskImage, '', 'distant offscreen source leaves no stale opening');
    h.state.compMat.uniforms.uSun.value.x = .5;
    h.state.compMat.uniforms.uSun.value.y = 1.21;
    h.update(); assert.equal(h.style.maskImage, '', 'vertical offscreen bounds also clear the opening');
  }
});
