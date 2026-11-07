import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../home-work-media.js',import.meta.url),'utf8');
function fixture(videoSource='preview.mp4') {
  const make=()=>({dataset:{},events:{},attrs:{},children:[],classList:{values:new Set(),add(v){this.values.add(v)},remove(v){this.values.delete(v)}},addEventListener(n,fn){this.events[n]=fn},setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]||null},append(...items){this.children.push(...items)}});
  const card=make();card.querySelector=()=>({textContent:'Project'});
  const media=make();media.dataset.video=videoSource;media.closest=()=>card;media.querySelector=()=>null;media.querySelectorAll=()=>[];
  const document=make();document.hidden=false;document.querySelectorAll=()=>[media];
  let resolvePlay, rejectPlay, observer, onMotion;
  const video=make();video.pauseCount=0;video.pause=()=>video.pauseCount++;
  video.play=()=>new Promise((resolve,reject)=>{resolvePlay=resolve;rejectPlay=reject});
  document.createElement=tag=>tag==='video'?video:make();
  const motion={enabled:true,subscribe(fn){onMotion=fn}};
  vm.runInNewContext(source,{document,window:{penumbraMotion:motion},matchMedia:()=>({matches:true}),IntersectionObserver:class {constructor(fn){observer=fn}observe(){}}});
  return {media,card,video,document,motion,button:media.children[1],resolve:()=>resolvePlay(),reject:()=>rejectPlay(new Error('blocked')),offscreen:()=>observer([{isIntersecting:false}]),disable:()=>onMotion(false)};
}
test('empty media slots do not create a video or a dead playback button',()=>{
  assert.equal(fixture('').media.children.length,0);
});
test('video is silent, inline, looping and loaded only after an explicit play request',async()=>{
  const f=fixture();assert.equal(f.video.src,undefined);assert.equal(f.video.preload,'none');
  assert.ok(f.video.muted&&f.video.loop&&f.video.playsInline);
  f.button.events.click();assert.equal(f.video.src,'preview.mp4');f.resolve();await new Promise(setImmediate);
  assert.ok(f.media.classList.values.has('is-playing'));
  f.button.events.click();assert.ok(!f.media.classList.values.has('is-playing'));
});
test('leaving a card during loading cannot reveal or restart its video',async()=>{
  const f=fixture();f.card.events.pointerenter({pointerType:'mouse'});f.card.events.pointerleave({pointerType:'mouse'});
  f.resolve();await new Promise(setImmediate);assert.ok(!f.media.classList.values.has('is-playing'));
  assert.equal(f.button.attrs['aria-pressed'],'false');assert.ok(f.video.pauseCount>=1);
});
test('disabled animation prevents hover playback but allows the explicit button',()=>{
  const f=fixture();f.motion.enabled=false;f.card.events.pointerenter({pointerType:'mouse'});assert.equal(f.video.src,undefined);
  f.button.events.click();assert.equal(f.video.src,'preview.mp4');f.disable();assert.equal(f.button.attrs['aria-pressed'],'false');
});
test('blocked playback restores the poster and the play button',async()=>{
  const f=fixture();f.button.events.click();f.reject();await new Promise(setImmediate);
  assert.equal(f.button.attrs['aria-pressed'],'false');assert.ok(!f.media.classList.values.has('is-playing'));
});
test('hidden tabs and offscreen cards stop playback',()=>{
  const f=fixture();f.button.events.click();f.offscreen();assert.equal(f.button.attrs['aria-pressed'],'false');
  f.button.events.click();f.document.hidden=true;f.document.events.visibilitychange();assert.equal(f.button.attrs['aria-pressed'],'false');
});
