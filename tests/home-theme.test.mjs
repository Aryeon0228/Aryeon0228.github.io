import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../home-theme.js',import.meta.url),'utf8');
function harness(saved=null, blocked=false) {
  const window=new EventTarget(), button=new EventTarget();
  const attributes={}, root={dataset:{},style:{}};
  button.setAttribute=(key,value)=>attributes[key]=value;
  const savedItems=new Map(saved ? [['penumbra-theme',saved]] : []), events=[];
  window.addEventListener('penumbra-theme-change',event=>events.push(event.detail.theme));
  const state={window,document:{documentElement:root,getElementById:id=>id==='theme-toggle'?button:null},
    localStorage:{getItem:key=>{if(blocked)throw Error('Unavailable');return savedItems.get(key);},setItem:(key,value)=>{if(blocked)throw Error('Unavailable');savedItems.set(key,value);}},
    CustomEvent:class extends Event {constructor(type,options){super(type);this.detail=options.detail;}}
  };
  vm.runInNewContext(source,state);
  return {root,attributes,events,savedItems,button,click:()=>button.dispatchEvent(new Event('click')),
    storage(key,newValue){const event=new Event('storage');Object.assign(event,{key,newValue});window.dispatchEvent(event);}};
}
test('one toggle defaults to dark, switches both ways, persists and notifies every scene',()=>{
  const h=harness();assert.equal(h.attributes['aria-checked'],'true');
  h.click();assert.equal(h.root.dataset.theme,'day');assert.equal(h.root.style.colorScheme,'light');
  assert.equal(h.attributes['aria-checked'],'false');assert.equal(h.savedItems.get('penumbra-theme'),'day');
  h.click();assert.equal(h.root.dataset.theme,'night');assert.equal(h.attributes['aria-checked'],'true');
  assert.deepEqual(h.events,['night','day','night']);
});
test('saved choice and cross-tab changes keep the sky, toggle and tooltip synchronized',()=>{
  const h=harness('day');assert.equal(h.root.dataset.theme,'day');assert.equal(h.button.title,'다크 모드로 전환');
  h.storage('penumbra-theme','night');assert.equal(h.attributes['aria-checked'],'true');assert.equal(h.button.title,'라이트 모드로 전환');
  h.storage('unrelated','day');assert.equal(h.root.dataset.theme,'night');
  h.storage('penumbra-theme','day');h.storage(null,null);assert.equal(h.root.dataset.theme,'night');
});
test('blocked storage does not prevent changing the theme',()=>{
  const h=harness(null,true);h.click();assert.equal(h.root.dataset.theme,'day');h.click();assert.equal(h.root.dataset.theme,'night');
});
