import test from 'node:test';
import assert from 'node:assert/strict';
import {blurDisc, sharpZone, hyperfocal, isSharp, stopsBetween, focusToScale, scaleToFocus, formatLength, SUBJECTS} from '../focus-optics.mjs';

const near = (actual, expected, tolerance) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≉ ${expected}`);

test('depth of field matches the reference table in FOCUS-LAB.md', () => {
  const table = [
    [.6, 2, .016], [.6, 5.6, .044], [.6, 16, .128],
    [1, 2, .046], [1, 5.6, .128], [1, 16, .377],
    [3, 2, .427], [3, 5.6, 1.238], [3, 16, 5.004]
  ];
  for (const [s, N, depth] of table) near(sharpZone(s, N).depth, depth, .0015);
});

test('hyperfocal distances for a 50 mm lens at c = 0.03 mm', () => {
  near(hyperfocal(2), 41.72, .01);
  near(hyperfocal(5.6), 14.93, .01);
  near(hyperfocal(16), 5.26, .01);
  assert.equal(sharpZone(6, 16).far, Infinity);
});

test('blur disc: sign says where the rays meet, size shrinks with the aperture', () => {
  near(blurDisc(1e9, 1, 2), -1.316, .001);   // infinity focused at 1 m, f/2: 1.32 mm, in front of the sensor
  near(blurDisc(1e9, 1, 16), -.1645, .0005);
  near(blurDisc(.4, .6, 2), 1.136, .001);    // a nearer point meets behind the sensor
  assert.equal(blurDisc(.8, .8, 2), 0);
});

test('stops, sharpness and the logarithmic focus scale', () => {
  near(stopsBetween(2, 16), 6, 1e-9);
  near(stopsBetween(2, 5.6), 2.97, .01);
  const [cactus, mug, bear] = SUBJECTS;
  assert.ok(isSharp(mug.distance, mug.distance, 2));
  assert.ok(!isSharp(cactus.distance, mug.distance, 2));
  assert.ok(!isSharp(bear.distance, mug.distance, 2));
  for (const d of [.25, .4, 1, 3.7, 10]) near(scaleToFocus(focusToScale(d)), d, 1e-9);
  assert.equal(formatLength(.016), '1.6 cm');
  assert.equal(formatLength(.427), '43 cm');
  assert.equal(formatLength(1.238), '1.24 m');
  assert.equal(formatLength(Infinity), '∞');
});
