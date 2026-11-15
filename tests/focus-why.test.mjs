import test from 'node:test';
import assert from 'node:assert/strict';
import {explain} from '../focus-why.mjs';
import {sharpZone,formatFocusRange} from '../focus-optics.mjs';
const text=(s,N)=>explain(s,N).map(part=>part.text).join('');

test('the main caption names the sharp subject without sensor-plane jargon',()=>{
 assert.match(text(.8,2),/^머그컵이 선명/);
 assert.doesNotMatch(text(.8,2),/상면|원반/);
 assert.match(text(1.3,2),/세 물체가 모두 흐립니다/);
});
test('a narrow depth of field has distinct, precise endpoints',()=>{
 const zone=sharpZone(.4,2),range=formatFocusRange(zone);
 assert.equal(range,'39.7 cm–40.3 cm');
 assert.ok(zone.depth>0&&zone.depth<.01);
 assert.match(text(.4,2),/39\.7 cm–40\.3 cm/);
});
test('infinite depth does not display a finite depth or claim it is narrow',()=>{
 assert.match(text(10,16),/∞/);
 assert.doesNotMatch(text(10,16),/깊이는|여전히 좁습니다/);
});
test('stopping down explains the remaining blur without claiming every object is sharp',()=>{
 assert.match(text(.8,16),/나머지는 흐리게/);
 assert.match(text(.8,16),/조리개를 조이면 선명한 범위가 넓어지지만/);
});
