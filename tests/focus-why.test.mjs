import test from 'node:test';
import assert from 'node:assert/strict';
import {explain} from '../focus-why.mjs';

const text = (s, N) => explain(s, N).map(part => part.text).join('');

test('focused on the mug wide open', () => {
  assert.equal(text(.8, 2), '머그컵만 초점면에 걸려 한 점으로 맺힙니다. 선인장은 상면 뒤에서 모여 1.67 mm, 곰 인형은 상면 앞에서 모여 1.00 mm 원반이 됩니다. 선명 범위는 79 cm–81 cm (깊이 2.9 cm)입니다.');
});

test('stopping down shrinks the discs but not enough this close', () => {
  const sentence = text(.8, 16);
  assert.match(sentence, /선인장은 상면 뒤에서 모여 0\.21 mm, 곰 인형은 상면 앞에서 모여 0\.13 mm 원반이 됩니다/);
  assert.match(sentence, /f\/16으로 조여 원반은 f\/2일 때보다 8배 작아졌지만/);
});

test('focused on empty air', () => {
  assert.match(text(1.3, 2), /^초점면\(1\.3 m\)에 걸린 물체가 없어 셋 다 원반으로 맺힙니다\. 선인장은/);
});

test('beyond the hyperfocal distance the zone runs to infinity', () => {
  const sentence = text(10, 16);
  assert.match(sentence, /선명 범위는 3\.44 m부터 ∞입니다\.$/);
  assert.doesNotMatch(sentence, /얕습니다/);
});

test('the particle after an f-number follows how it is read', () => {
  assert.match(text(.8, 5.6), /f\/5\.6으로 조여/);
  assert.match(text(.8, 8), /f\/8로 조여/);
  assert.match(text(.8, 11), /f\/11로 조여/);
});
