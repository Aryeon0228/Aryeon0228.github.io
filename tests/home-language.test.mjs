import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { english } from '../home-translations.mjs';

const source = readFileSync(new URL('../home-language.mjs', import.meta.url), 'utf8').replace(/^import .*;\n/, '');
function harness(saved='ko') {
  class Element extends EventTarget {
    constructor(attrs={}, children=[]) { super(); this.nodeType=1; this.attrs={...attrs}; this.childNodes=children; this.dataset={}; for(const child of children)child.parentElement=this; }
    hasAttribute(key) { return key in this.attrs; }
    getAttribute(key) { return this.attrs[key] ?? null; }
    setAttribute(key,value) { this.attrs[key]=value; }
    matches() { return false; }
    closest() { return false; }
  }
  const text = value => ({nodeType:3,data:value});
  const title=text('김소연 | Studio Penumbra'), copy=text('  게임 아트를 만들고, 만드는 법을 가르칩니다.\n'), menu=text('메뉴');
  const image = new Element({'aria-label':'행성과 고리 회전'});
  const p = new Element({},[copy]), menuElement = new Element({},[menu]);
  const ko=new Element(), en=new Element(); ko.dataset.language='ko'; en.dataset.language='en';
  const hero=new Element();
  const root=new Element({},[new Element({},[title]),p,menuElement,image]);
  const document={nodeType:9,childNodes:[root],documentElement:root,
    querySelectorAll:()=>[ko,en],querySelector:()=>hero};
  const window=new EventTarget(), storage=new Map([['penumbra-language',saved]]);
  let notify;
  vm.runInNewContext(source,{english,document,window,Node:{TEXT_NODE:3,ELEMENT_NODE:1,DOCUMENT_NODE:9},
    Event,CustomEvent:class extends Event {constructor(type,options){super(type);this.detail=options.detail;}},
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
    MutationObserver:class {constructor(callback){notify=callback;}observe(){}}
  });
  return {root,copy,title,menu,image,p,storage,hero,language:value=>(value==='en'?en:ko).dispatchEvent(new Event('click')),
    updateMenu(value){menu.data=value;notify([{type:'characterData',target:menu}]);},
    updateImage(value){image.setAttribute('aria-label',value);notify([{type:'attributes',target:image,attributeName:'aria-label'}]);}};
}
test('English changes copy, metadata and accessible labels without replacing content nodes; Korean restores exact whitespace',()=>{
  const h=harness();const sameNode=h.p.childNodes[0];h.language('en');
  assert.equal(h.root.lang,'en');assert.equal(h.storage.get('penumbra-language'),'en');
  assert.equal(h.copy.data,'  I create game art and teach how it is made.\n');
  assert.equal(h.title.data,'Soyoun Kim | Studio Penumbra');
  assert.equal(h.image.getAttribute('aria-label'),'Rotate the planet and rings');
  assert.equal(h.p.childNodes[0],sameNode);
  h.language('ko');assert.equal(h.copy.data,'  게임 아트를 만들고, 만드는 법을 가르칩니다.\n');
  assert.equal(h.image.getAttribute('aria-label'),'행성과 고리 회전');
});
test('saved English also translates dynamic menu and accessibility changes, then restores their latest Korean source',()=>{
  const h=harness('en');assert.equal(h.menu.data,'Menu');
  h.updateMenu('닫기');assert.equal(h.menu.data,'Close');
  h.updateImage('언어');assert.equal(h.image.getAttribute('aria-label'),'Language');
  h.language('ko');assert.equal(h.menu.data,'닫기');assert.equal(h.image.getAttribute('aria-label'),'언어');
});
test('new About copy matches the supplied English wording, and inline fragments retain word boundaries',()=>{
  assert.equal(english['AI를 활용해 작업과 학습을 돕는 웹과 앱을 제작합니다.'],'I use AI to build web tools and apps for creation and learning.');
  assert.equal(english['막히는 지점을 함께 짚고 실현 가능한 해법을 찾습니다.'],'I collaborate to pinpoint bottlenecks and find practical solutions.');
  assert.match(english['주당 담당 시수']+english['입니다. 누적 강의시간과 구분해 표기합니다.'],/hours for/);
  assert.match('Run Script'+english['에서'],/Script and/);
});
