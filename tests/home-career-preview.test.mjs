import {test} from 'node:test';
import assert from 'node:assert/strict';
import {previewPosition} from '../home-career-preview.mjs';

test('preview follows the cursor without covering it when there is room', () => {
  assert.deepEqual(previewPosition(200,200,280,190,1440,900), {left:220,top:220});
});
test('preview flips left and up near the viewport edge', () => {
  assert.deepEqual(previewPosition(1400,860,280,190,1440,900), {left:1100,top:650});
});
test('preview remains inside a narrow viewport when neither side fits', () => {
  for (const x of [0,160,319]) {
    for (const y of [0,200,499]) {
      const p=previewPosition(x,y,280,190,320,500);
      assert.ok(p.left>=12 && p.left+280<=308);
      assert.ok(p.top>=12 && p.top+190<=488);
    }
  }
});
