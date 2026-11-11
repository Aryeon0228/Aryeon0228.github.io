import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three/build/three.module.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('  function sunRayLength('), html.indexOf('  function updateSun(dt)'));
const state = {THREE};
vm.createContext(state); vm.runInContext(source, state);
const length = state.sunRayLength;

test('open sky has short rays, while the name and planet keep their original reach', () => {
  assert.equal(length(Infinity, 20), .28);
  assert.equal(length(0, 20), 1);
  assert.equal(length(80, -2), 1);
  assert.equal(length(28, 20), .28);
});
test('rays extend only in a narrow approach to the limb and do not overshoot', () => {
  assert.equal(length(100, 12), .28);
  assert.equal(length(100, 4), .28);
  assert.ok(length(100, 2.75) > .6);
  assert.equal(length(100, 1.5), 1);
  for (const gap of [0, 7, 14, 28, 100]) {
    for (const contact of [-5, 0, 1.5, 2, 4, 20]) {
      assert.ok(length(gap, contact) >= .28 && length(gap, contact) <= 1);
    }
  }
});
