import test from 'node:test';
import assert from 'node:assert/strict';
import {explain} from '../lighting-why.mjs';
import {preset} from '../light-sources.mjs';

const base = () => ({left: preset('candle'), right: preset('sun'), mode: 'shared', offsets: {left: 0, right: 0}, exposure: 0, rho: .18});
const text = state => explain(state).map(part => part.text).join('');

test('a dim source under a shared exposure is explained as crushed to black', () => {
  const sentence = text(base());
  assert.match(sentence, /오른쪽 햇빛이 왼쪽 촛불보다 100,000배 \(16\.6 stops\) 밝습니다/);
  assert.match(sentence, /촛불 쪽 반사광이 너무 약해 거의 검게/);
  assert.match(sentence, /약 16\.6 stops 올려야 하고, 그러면 햇빛 쪽은 하얗게 날아갑니다/);
});

test('auto exposure per view explains the hidden exposure gap', () => {
  const sentence = text({...base(), mode: 'individual'});
  assert.match(sentence, /비슷해 보일 뿐, 카메라가 촛불 쪽에 노출을 16\.6 stops 더 준 것/);
});

test('equal illuminance says so and names the inverse-square factor', () => {
  const state = base();
  state.right = {...preset('candle'), count: 4, distance: 2};
  state.exposure = Math.log2(100000);
  const sentence = text(state);
  assert.match(sentence, /조도가 같습니다\. 같은 노출이라 화면 밝기도 같습니다/);
  assert.match(sentence, /촛불을 4개, 2\.00 m에 두면 .*1개·1 m일 때의 1배/);
});

test('inverse square: doubling the distance quarters the light', () => {
  const state = base();
  state.left = {...preset('incandescent'), distance: 2};
  state.right = preset('incandescent');
  const sentence = text(state);
  assert.match(sentence, /오른쪽 백열등이 왼쪽 백열등보다 4배 \(2\.0 stops\) 밝습니다/);
  assert.match(sentence, /둘 다 너무 약해 거의 검게 보입니다\. 노출을 약 10\.6 stops 올리면 백열등 쪽부터/);
  assert.match(sentence, /백열등을 1개, 2\.00 m에 두면 .*0\.25배/);
});

test('equal but under-exposed sources are called out as both dark', () => {
  const state = base();
  state.left = preset('incandescent');
  state.right = preset('fluorescent');
  assert.match(text(state), /조도가 같지만, 지금 노출에서는 둘 다 너무 약해 거의 검게 보입니다\. 노출을 약 10\.6 stops/);
});
