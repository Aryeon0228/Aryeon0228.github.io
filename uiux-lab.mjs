import {perceptionModules} from './uiux-perception.mjs?v=34dbb23e061c';
import {behaviorModules} from './uiux-behavior.mjs?v=fedd388ead8d';
import {reviewModules} from './uiux-review.mjs?v=282dc6746934';
import {createExperimentSession} from './uiux-session.mjs?v=3ba308e9f6f1';
export const modules=[...perceptionModules,...behaviorModules,...reviewModules];
const $=id=>document.getElementById(id);
const storageKey='penumbra-uiux-observations-v1';
let notes={};try{const parsed=JSON.parse(localStorage.getItem(storageKey)||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))notes=parsed;}catch{}
let tabStorage;try{tabStorage=sessionStorage;}catch{}
const experimentSession=createExperimentSession(tabStorage);
let active=null,cleanup=null,snapshot=null,controller=null,context='service',toastTimer;
const drafts={...notes};
function rememberExperiment(){if(active&&snapshot)experimentSession.set(active.id,snapshot());}
function updateNoteStatus(){
 const saved=notes[active.id],value=$('reflection').value;
 $('save-status').textContent=typeof saved==='string'&&value===saved?'이 브라우저에 저장했어요.':value||typeof saved==='string'?'저장하지 않은 변경이 있어요.':'기록은 저장 버튼을 눌러 이 브라우저에 보관할 수 있어요.';
}
function announce(message){clearTimeout(toastTimer);$('lab-toast').textContent=message;toastTimer=setTimeout(()=>$('lab-toast').textContent='',4000);}
function navLink(module,index){const a=document.createElement('a');a.href='#'+module.id;a.dataset.module=module.id;const num=document.createElement('span');num.className='nav-index';num.textContent=String(index+1).padStart(2,'0');a.append(num,document.createTextNode(module.title));return a;}
function buildNavigation(){
 const groups=[['01 / 시지각의 원리',perceptionModules],['02 / 사용성의 법칙',behaviorModules],['03 / 화면 진단',reviewModules]];
 const nav=$('experiment-nav'),container=document.createElement('div');container.className='nav-groups';const navHeader=document.createElement('div');navHeader.className='nav-header';navHeader.innerHTML='<span>실험 목록</span><span>'+String(modules.length).padStart(2,'0')+'</span>';container.append(navHeader);
 const mobile=document.createElement('div');mobile.className='mobile-picker';const label=document.createElement('label');label.htmlFor='mobile-experiment';label.textContent='실험 선택';const select=document.createElement('select');select.id='mobile-experiment';
 for(const [title,items] of groups){const group=document.createElement('div');group.className='nav-group';const h=document.createElement('h2');h.textContent=title;group.append(h);const options=document.createElement('optgroup');options.label=title;
  for(const item of items){group.append(navLink(item,modules.indexOf(item)));const option=document.createElement('option');option.value=item.id;option.textContent=item.title;options.append(option);}container.append(group);select.append(options);
 }
 select.addEventListener('change',()=>location.hash=select.value);mobile.append(label,select);nav.append(mobile,container);const foot=document.createElement('p');foot.className='nav-footnote';foot.textContent='한 조건을 바꾼 뒤, 무엇이 달라졌는지 설명해보세요.';container.append(foot);
}
function updateApplication(){if(active)$('application-copy').textContent=active.applications?.[context]||'';}
function renderModule(){
 let id='';try{id=decodeURIComponent(location.hash.slice(1));}catch{}const module=modules.find(m=>m.id===id)||modules[0];
 if(active?.id===module.id)return;clearTimeout(toastTimer);$('lab-toast').textContent='';
 if(active)drafts[active.id]=$('reflection').value;
 rememberExperiment();controller?.abort();cleanup?.();controller=new AbortController();cleanup=null;snapshot=null;active=module;
 const index=modules.indexOf(module);
 $('experiment-number').textContent=String(index+1).padStart(2,'0');$('frame-position').textContent=String(index+1).padStart(2,'0')+' / '+String(modules.length).padStart(2,'0');$('experiment-page').dataset.experiment=module.id;
 document.title=module.title+' · UI/UX Lab | Studio Penumbra';
 $('experiment-kicker').textContent=module.category+' / '+module.en;
 $('experiment-heading').textContent=module.title;
 $('experiment-summary').textContent=module.summary;
 $('experiment-question').textContent=module.prompt;
 $('experiment-stage').replaceChildren();$('experiment-controls').replaceChildren();
 // Feature classes belong to the mounted module and must not leak to the next experiment.
 $('experiment-stage').className='experiment-stage';$('experiment-controls').className='experiment-controls';
 try{const mounted=module.mount({stage:$('experiment-stage'),controls:$('experiment-controls'),signal:controller.signal,announce,state:experimentSession.get(module.id)});cleanup=typeof mounted==='function'?mounted:mounted?.cleanup;snapshot=mounted?.getState||null;}catch(error){console.error(error);const p=document.createElement('p');p.className='lab-error';p.textContent='실험을 열지 못했어요. 실험 초기화를 눌러 다시 시작해주세요.';$('experiment-stage').replaceChildren(p);}
 $('reflection').value=typeof drafts[module.id]==='string'?drafts[module.id]:'';
 updateNoteStatus();
 $('source-links').replaceChildren();for(const source of module.sources||[]){const li=document.createElement('li');const a=document.createElement('a');a.textContent=source.title;a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';li.append(a);$('source-links').append(li);}
 document.querySelectorAll('[data-module]').forEach(a=>{if(a.dataset.module===module.id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});$('mobile-experiment').value=module.id;
 const selectedLink=document.querySelector('[data-module="'+module.id+'"]'),navScroller=selectedLink?.closest('.nav-groups');
 if(navScroller?.clientHeight){if(index===0)navScroller.scrollTop=0;const item=selectedLink.getBoundingClientRect(),panel=navScroller.getBoundingClientRect();if(item.top<panel.top+4)navScroller.scrollTop+=item.top-panel.top-4;else if(item.bottom>panel.bottom-4)navScroller.scrollTop+=item.bottom-panel.bottom+4;}
 for(const [element,other,prefix] of [[$('previous-experiment'),modules[index-1],'← '],[$('next-experiment'),modules[index+1],'다음 · ']]){element.textContent=other?prefix+other.title:(prefix==='← '?'첫 실험':'마지막 실험');element.href=other?'#'+other.id:'#'+module.id;element.setAttribute('aria-disabled',String(!other));element.tabIndex=other?0:-1;}
 $('experiment-counter').textContent=String(index+1).padStart(2,'0')+' / '+String(modules.length).padStart(2,'0');updateApplication();
}
buildNavigation();renderModule();
document.querySelector('.skip-link')?.addEventListener('click',event=>{event.preventDefault();$('experiment-heading').focus();$('experiment-heading').scrollIntoView({block:'start'});});
window.addEventListener('hashchange',()=>{renderModule();$('experiment-heading').focus({preventScroll:true});});
$('reset-experiment').addEventListener('click',()=>{const id=active.id;drafts[id]=$('reflection').value;experimentSession.clear(id);active=null;renderModule();announce('현재 실험을 처음 상태로 되돌렸어요.');});
$('copy-link').addEventListener('click',async()=>{const url=new URL(location.href);url.hash=active.id;if(active.id!=='heuristics')url.searchParams.delete('rule');try{await navigator.clipboard.writeText(url.href);announce('현재 실험 링크를 복사했어요.');}catch{announce('주소창의 링크를 복사해주세요. 현재 실험 주소가 표시되어 있어요.');history.replaceState(null,'',url);}});
document.querySelectorAll('[data-context]').forEach(button=>button.addEventListener('click',()=>{context=button.dataset.context;document.querySelectorAll('[data-context]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));updateApplication();}));
$('reflection').addEventListener('input',()=>{drafts[active.id]=$('reflection').value;updateNoteStatus();});
$('save-note').addEventListener('click',()=>{drafts[active.id]=$('reflection').value;const nextNotes={...notes,[active.id]:drafts[active.id]};try{localStorage.setItem(storageKey,JSON.stringify(nextNotes));notes=nextNotes;$('save-status').textContent='이 브라우저에 저장했어요.';announce('관찰 기록을 저장했어요.');}catch{$('save-status').textContent='저장하지 못했어요. 전체 기록 내려받기를 이용해주세요.';announce('브라우저에 저장할 수 없어요. 전체 기록 내려받기를 이용해주세요.');}});
$('export-notes').addEventListener('click',()=>{drafts[active.id]=$('reflection').value;const blocks=modules.filter(m=>typeof drafts[m.id]==='string'&&drafts[m.id].trim()).map(m=>'## '+m.title+'\n\n'+drafts[m.id].trim()+'\n\n참고: '+(m.sources?.[0]?.url||''));if(!blocks.length){announce('관찰 기록을 먼저 작성해주세요.');return;}const blob=new Blob(['# UI/UX Lab 관찰 기록\n\n'+blocks.join('\n\n')+'\n'],{type:'text/markdown;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='UIUX-Lab-관찰기록.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);announce('작성한 관찰 기록을 내려받았어요.');});
window.addEventListener('pagehide',()=>{rememberExperiment();controller?.abort();cleanup?.();clearTimeout(toastTimer);});

window.addEventListener('pageshow',event=>{if(event.persisted){if(active)drafts[active.id]=$('reflection').value;active=null;renderModule();}});
