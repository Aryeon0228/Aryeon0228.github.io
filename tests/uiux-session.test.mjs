import test from 'node:test';
import assert from 'node:assert/strict';
import {createExperimentSession} from '../uiux-session.mjs';

function memoryStorage(initial = null) {
  let value = initial;
  return {getItem: () => value, setItem: (_key, next) => {value = next;}};
}

test('a new page in the same tab restores controls and completed measurements', () => {
  const storage = memoryStorage();
  const firstPage = createExperimentSession(storage);
  const fitts = {controls: {'bh-fitts-variable': 'distance', 'bh-fitts-level': '220'}, records: [{distance: 220, width: 48, time: 310, misses: 0, device: 'mouse'}]};
  firstPage.set('fitts', fitts);
  const nextPage = createExperimentSession(storage);
  assert.deepEqual(nextPage.get('fitts'), fitts);
});

test('resetting one experiment preserves the other saved experiments', () => {
  const storage = memoryStorage();
  const session = createExperimentSession(storage);
  session.set('proximity', {controls: {'pc-proximity-gap': '100'}});
  session.set('similarity', {controls: {'pc-similarity-cue': 'shape'}});
  session.clear('proximity');
  const nextPage = createExperimentSession(storage);
  assert.equal(nextPage.get('proximity'), undefined);
  assert.deepEqual(nextPage.get('similarity'), {controls: {'pc-similarity-cue': 'shape'}});
});

test('invalid or unavailable storage still permits in-page navigation', () => {
  for (const storage of [memoryStorage('{broken'), memoryStorage('[]'), memoryStorage('null'), undefined, {getItem() {throw Error('blocked');}, setItem() {throw Error('quota');}}]) {
    const session = createExperimentSession(storage);
    assert.equal(session.get('proximity'), undefined);
    session.set('proximity', {controls: {'pc-proximity-gap': '100'}});
    assert.equal(session.get('proximity').controls['pc-proximity-gap'], '100');
    session.clear('proximity');
    assert.equal(session.get('proximity'), undefined);
  }
});
