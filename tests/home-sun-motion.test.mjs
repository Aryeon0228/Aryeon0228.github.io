import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('  var sunDrift ='), html.indexOf('  // Day and eclipse lighting'));
function harness() {
  const state = {reduce:false, P:{sun:.74}, planetBaseline:{sun:.74},
    compMat:{uniforms:{uSun:{value:{x:.5}}}}, bodyUniforms:{uLight:{value:{z:-1}}}};
  vm.createContext(state);
  vm.runInContext(source, state);
  return state;
}

test('the sun moves automatically without any slider elements', () => {
  const h = harness();
  const before = h.sunDrift;
  h.driftSun(1/60);
  assert.ok(h.sunDrift > before);
  assert.equal(h.P.sun, h.planetBaseline.sun + h.sunDrift);
});

test('Animation Off pauses the orbit and resuming continues from that position', () => {
  const h = harness(); h.driftSun(1/60);
  const before = h.P.sun;
  h.reduce = true;
  h.driftSun(10);
  assert.equal(h.P.sun, before);
  h.reduce = false; h.driftSun(1/60);
  assert.ok(h.P.sun > before && h.P.sun - before < .001);
});

test('the automatic orbit wraps smoothly at a full revolution', () => {
  const h = harness(); h.sunDrift = .999999;
  h.driftSun(1/60);
  assert.ok(h.sunDrift >= 0 && h.sunDrift < .001);
  assert.ok(h.P.sun >= .74 && h.P.sun < .741);
});
