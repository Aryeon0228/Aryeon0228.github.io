// Focus Lab: move the plane of focus through a desk and watch what lands as a point.
import {SUBJECTS,sharpZone,stopsBetween,focusToScale,scaleToFocus,blurDisc,isSharp,formatLength,formatAperture,FOCUS_MIN,FOCUS_MAX} from './focus-optics.mjs?v=fbf860ce43e1';
import {explain} from './focus-why.mjs?v=aa099c8e4764';
import {createSideView,SUBJECT_COLORS} from './focus-side.mjs?v=f78b2452f3d5';

const $=id=>document.getElementById(id);
const INITIAL={s:.8,N:2};
const state={...INITIAL};
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const clampFocus=d=>Math.min(FOCUS_MAX,Math.max(FOCUS_MIN,d));
const segments=parts=>parts.map(part=>{if(!part.strong)return part.text;const b=document.createElement('strong');b.textContent=part.text;return b;});
const drawSide=createSideView($('side'));
const frameButtons=[...document.querySelectorAll('.fl-frame-btn')];
let photo=null,points=[],rack=null,frame=0,thumbsAperture=null,activeTab='focus';

// ---------------------------------------------------------------- what the page says
function syncControls(){
 const {s,N}=state,zone=sharpZone(s,N),slider=$('focus');
 slider.value=Math.round(focusToScale(s)*1000);$('focus-out').value=formatLength(s);
 slider.setAttribute('aria-valuetext',`${formatLength(s)}, 선명 범위 ${formatLength(zone.depth)}`);
 const left=focusToScale(Math.max(zone.near,FOCUS_MIN)),right=Number.isFinite(zone.far)?focusToScale(Math.min(zone.far,FOCUS_MAX)):1;
 $('zone-band').style.left=(left*100)+'%';$('zone-band').style.width=Math.max(.8,(Math.min(1,right)-left)*100)+'%';
 for(const b of document.querySelectorAll('[data-subject]')){const S=SUBJECTS.find(x=>x.id===b.dataset.subject);b.setAttribute('aria-pressed',String(Math.abs(Math.log(S.distance/s))<.02));}
 for(const b of document.querySelectorAll('[data-aperture]'))b.setAttribute('aria-pressed',String(+b.dataset.aperture===N));
 const stops=stopsBetween(2,N);
 $('r-zone').textContent=Number.isFinite(zone.far)?`${formatLength(zone.near)}–${formatLength(zone.far)}`:`${formatLength(zone.near)}–∞`;
 $('r-depth').textContent=Number.isFinite(zone.far)?formatLength(zone.depth):'∞';
 $('r-hyper').textContent=formatLength(zone.hyperfocal);
 $('r-light').textContent=N===2?'기준':`−${stops.toFixed(1)} 스톱`;
 $('hud-lens').textContent='50 mm · '+formatAperture(N);$('hud-focus').textContent='초점 '+formatLength(s);
 $('why').replaceChildren(...segments(explain(s,N)));
 drawSide(s,N);
 let nearest=0;frameButtons.forEach((b,i)=>{if(Math.abs(Math.log(+b.dataset.focus/s))<Math.abs(Math.log(+frameButtons[nearest].dataset.focus/s)))nearest=i;});
 frameButtons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===nearest&&Math.abs(Math.log(+b.dataset.focus/s))<.06)));
 $('strip-aperture').textContent=formatAperture(N);
 updateTags();
}
function updateTags(){
 const box=$('tags');if(!photo){box.replaceChildren();return;}
 if(box.children.length!==SUBJECTS.length)box.replaceChildren(...SUBJECTS.map(S=>{const t=document.createElement('span');t.className='fl-tag';t.dataset.id=S.id;const i=document.createElement('i');i.style.background=SUBJECT_COLORS[S.id];t.append(i,document.createElement('b'));return t;}));
 for(const tag of box.children){
  const S=SUBJECTS.find(x=>x.id===tag.dataset.id),p=points.find(x=>x.id===S.id),sharp=isSharp(S.distance,state.s,state.N);
  tag.style.left=(p.x*100)+'%';tag.style.top=(p.y*100)+'%';tag.classList.toggle('is-soft',!sharp);
  tag.lastChild.textContent=sharp?`${S.name} · 선명`:`${S.name} · ${Math.abs(blurDisc(S.distance,state.s,state.N)).toFixed(2)} mm`;
 }
}

// ---------------------------------------------------------------- drawing: only when something changed
function requestDraw(){if(!frame)frame=requestAnimationFrame(draw);}
function draw(now){
 frame=0;
 if(rack){const t=smooth((now-rack.start)/rack.duration);state.s=1/(rack.from+(rack.to-rack.from)*t);if(t<1)frame=requestAnimationFrame(draw);else{state.s=1/rack.to;rack=null;}}
 syncControls();
 if(!photo)return;
 if(activeTab==='focus'){photo.draw(state.s,state.N);if(!rack&&thumbsAperture!==state.N)drawThumbs();}
 if(activeTab==='exposure'&&!rack)drawExposure();
}
function drawThumbs(){thumbsAperture=state.N;for(const b of frameButtons)photo.drawTo(b.querySelector('canvas').getContext('2d'),+b.dataset.focus,state.N,1);}
function setFocus(d,animate=false){
 d=clampFocus(d);
 if(animate&&!reduceMotion.matches&&photo)rack={from:1/state.s,to:1/d,start:performance.now(),duration:650};
 else{rack=null;state.s=d;}
 requestDraw();
}
function setAperture(N){state.N=N;requestDraw();}
const announce=()=>{$('announce').textContent=$('why').textContent;};

// ---------------------------------------------------------------- aperture and exposure
const SHUTTERS=[1/4000,1/2000,1/1000,1/500,1/250,1/125,1/60,1/30,1/15,1/8,1/4,1/2,1];
const shutterText=t=>{const n=SHUTTERS.reduce((a,b)=>Math.abs(Math.log(b/t))<Math.abs(Math.log(a/t))?b:a);return n>=1?'1초':`1/${Math.round(1/n)}초`;};
let compensate=false;
function drawExposure(){
 const N=+$('cmp-aperture').value,stops=stopsBetween(2,N),gain=2**stops,za=sharpZone(state.s,2),zb=sharpZone(state.s,N),depth=z=>Number.isFinite(z.far)?formatLength(z.depth):'∞';
 if(photo){photo.drawTo($('cmp-a').getContext('2d'),state.s,2,1);photo.drawTo($('cmp-b').getContext('2d'),state.s,N,compensate?1:1/gain);}
 $('cmp-a-note').textContent=`선명 범위 ${depth(za)}`;$('cmp-b-name').textContent=formatAperture(N);
 $('cmp-b-note').textContent=compensate?`셔터 ${Math.round(gain)}배 · 선명 범위 ${depth(zb)}`:`−${stops.toFixed(1)} 스톱 · 선명 범위 ${depth(zb)}`;
 for(const b of document.querySelectorAll('[data-compensate]'))b.setAttribute('aria-pressed',String((b.dataset.compensate==='1')===compensate));
 const parts=compensate
  ?[{text:`셔터를 ${Math.round(gain)}배 길게 열어 `},{text:stops.toFixed(1)+' 스톱',strong:true},{text:`을 되돌렸습니다. f/2에서 1/500초였다면 ${formatAperture(N)}에서는 약 ${shutterText(gain/500)}입니다. 밝기는 같아지고 선명 범위만 달라집니다: f/2 `},{text:depth(za),strong:true},{text:`, ${formatAperture(N)} `},{text:depth(zb),strong:true},{text:'.'}]
  :[{text:`${formatAperture(N)} 조리개는 f/2보다 구멍의 넓이가 `},{text:`1/${Math.round(gain)}`,strong:true},{text:'이라 '},{text:stops.toFixed(1)+' 스톱',strong:true},{text:' 어둡습니다. 셔터와 ISO를 그대로 두면 사진이 그만큼 어두워집니다.'}];
 $('exposure-why').replaceChildren(...segments(parts));
}

// ---------------------------------------------------------------- tabs
const tabs=['focus','exposure','guide'];
function selectTab(name,focus=false){
 activeTab=name;
 for(const t of tabs){const tab=$('tab-'+t),panel=$('panel-'+t),on=t===name;tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;panel.hidden=!on;if(on&&focus)tab.focus();}
 if(name!=='focus')stopTour();
 requestDraw();
}
tabs.forEach((t,i)=>{$('tab-'+t).addEventListener('click',()=>selectTab(t));$('tab-'+t).addEventListener('keydown',e=>{const k={ArrowRight:1,ArrowLeft:-1}[e.key];if(k){e.preventDefault();selectTab(tabs[(i+k+tabs.length)%tabs.length],true);}});});

// ---------------------------------------------------------------- controls
$('focus').addEventListener('input',e=>setFocus(scaleToFocus(+e.target.value/1000)));
$('focus').addEventListener('change',announce);
for(const b of document.querySelectorAll('[data-subject]'))b.addEventListener('click',()=>{setFocus(SUBJECTS.find(S=>S.id===b.dataset.subject).distance,true);setTimeout(announce,700);});
for(const b of document.querySelectorAll('[data-aperture]'))b.addEventListener('click',()=>{setAperture(+b.dataset.aperture);setTimeout(announce,50);});
for(const b of frameButtons)b.addEventListener('click',()=>{setFocus(+b.dataset.focus,true);setTimeout(announce,700);});
$('cmp-aperture').addEventListener('change',requestDraw);
for(const b of document.querySelectorAll('[data-compensate]'))b.addEventListener('click',()=>{compensate=b.dataset.compensate==='1';requestDraw();});
$('reset').addEventListener('click',()=>{stopTour();compensate=false;$('cmp-aperture').value='16';state.N=INITIAL.N;setFocus(INITIAL.s,true);$('announce').textContent='처음 상태로 되돌렸습니다.';});

// ---------------------------------------------------------------- auto tour: racks focus and stops down until the visitor takes over
const TOUR=[{s:.4,N:2},{s:2,N:2},{s:.8,N:2},{s:.8,N:16},{s:.8,N:2}];
let touring=false,tourTimer=0,tourBeat=0,onScreen=true;
function tourButton(){$('tour').setAttribute('aria-pressed',String(touring));$('tour').textContent=touring?'자동 둘러보기 ❚❚':'자동 둘러보기 ▶';}
function tourStep(){
 if(!touring)return;
 if(onScreen&&!document.hidden&&activeTab==='focus'){const beat=TOUR[tourBeat%TOUR.length];tourBeat++;setAperture(beat.N);setFocus(beat.s,true);}
 tourTimer=setTimeout(tourStep,3400);
}
function startTour(){if(touring||!photo)return;touring=true;tourBeat=0;tourButton();tourTimer=setTimeout(tourStep,1600);}
function stopTour(){if(!touring)return;touring=false;clearTimeout(tourTimer);tourButton();}
$('tour').addEventListener('click',()=>touring?stopTour():startTour());
for(const event of ['pointerdown','keydown'])for(const el of [$('panel-focus'),$('frame')])el.addEventListener(event,stopTour,true);

// ---------------------------------------------------------------- the photo
function fillGuideTable(){
 const Ns=[2,5.6,16],rows=[.4,.8,2,3];
 const head=`<thead><tr><th scope="col">초점 거리</th>${Ns.map(N=>`<th scope="col">${formatAperture(N)}</th>`).join('')}</tr></thead>`;
 const body=rows.map(s=>`<tr><th scope="row">${formatLength(s)}</th>${Ns.map(N=>{const z=sharpZone(s,N);return `<td>${Number.isFinite(z.far)?formatLength(z.depth):'∞'}</td>`;}).join('')}</tr>`).join('');
 const hyper=`<tr><th scope="row">과초점 거리</th>${Ns.map(N=>`<td>${formatLength(sharpZone(1,N).hyperfocal)}</td>`).join('')}</tr>`;
 $('dof-table').insertAdjacentHTML('beforeend',head+'<tbody>'+body+hyper+'</tbody>');
}
fillGuideTable();
syncControls();
try{
 const {createFocusPhoto}=await import('./focus-photo.mjs?v=664c37319e65');
 photo=createFocusPhoto($('photo'));
 const frameEl=$('frame');
 const fit=()=>{const w=frameEl.clientWidth,h=frameEl.clientHeight;if(!w||!h)return;const ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1.8e6/(w*h)));photo.resize(w,h,ratio);points=photo.subjectPoints();thumbsAperture=null;requestDraw();};
 new ResizeObserver(fit).observe(frameEl);fit();
 $('photo').addEventListener('webglcontextlost',e=>{e.preventDefault();stopTour();$('photo-error').hidden=false;});
 new IntersectionObserver(entries=>{onScreen=entries[0].isIntersecting;}).observe(frameEl);
 $('tour').hidden=false;tourButton();
 if(!reduceMotion.matches)startTour();
}catch(error){console.error('Focus Lab photo:',error);photo=null;$('photo-error').hidden=false;}
