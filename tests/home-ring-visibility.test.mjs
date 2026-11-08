import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three/build/three.module.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const passSource = html.slice(html.indexOf('  function renderPass(material, dustMat, target, clearHex){'), html.indexOf('  // Where the planet sits on screen'));

function harness() {
  const scene = new THREE.Scene(), ring = new THREE.Mesh(), moon = new THREE.Mesh(), body = new THREE.Mesh();
  const ringDust = new THREE.Points(), ringDustNear = new THREE.Points(), stars = new THREE.Points(), atmo = new THREE.Mesh();
  ring.material.visible = false;
  ring.add(ringDust, ringDustNear, moon); scene.add(ring, body, stars, atmo);
  const draws = [];
  const state = {ringDust, ringDustNear, scene, ring, atmo, camera:{},
    renderer:{
      setClearColor() {}, setRenderTarget() {},
      render(renderedScene) {
        const visible = [];
        renderedScene.traverseVisible(object => { if(object !== renderedScene) visible.push({object, material:object.material}); });
        draws.push(visible);
      }
    }
  };
  vm.createContext(state); vm.runInContext(passSource, state);
  return {state, ring, moon, body, ringDust, ringDustNear, stars, atmo, draws};
}

test('the eclipse pass draws the full ring and restores both visible halves without hiding moons', () => {
  const h = harness(), originalDust = h.ringDust.material, originalMoon = h.moon.material;
  for (let frame = 0; frame < 3; frame++) {
    const bodyMaterial = {name:'eclipse-body'}, dustMaterial = {name:'eclipse-dust'};
    h.state.renderPass(bodyMaterial, dustMaterial, {}, 0);
    const draw = h.draws.at(-1);
    assert.equal(draw.some(entry => entry.object === h.ringDust), true);
    assert.equal(draw.some(entry => entry.object === h.ringDustNear), false, 'one full-ring pass replaces both scene halves');
    assert.equal(draw.find(entry => entry.object === h.moon).material, bodyMaterial);
    assert.equal(draw.find(entry => entry.object === h.body).material, bodyMaterial);
    assert.equal(draw.find(entry => entry.object === h.ringDust).material, dustMaterial);
    assert.equal(h.ringDust.visible, true); assert.equal(h.ringDustNear.visible, true);
    assert.equal(h.ringDust.material, originalDust); assert.equal(h.moon.material, originalMoon);
    assert.equal(h.moon.visible, true); assert.equal(h.stars.visible, true); assert.equal(h.atmo.visible, true);
  }
});
