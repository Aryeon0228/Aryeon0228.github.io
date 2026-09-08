import {fitExposure,linearDisplay,srgb} from './lighting-physics.mjs';
import {SOURCES,preset,illuminance,comparison,validateSettings,comparisonColors,daylightPreset} from './light-sources.mjs';
const $=id=>document.getElementById(id);
const fmt=x=>x>=1000?Math.round(x).toLocaleString('en-US'):x>=10?x.toFixed(2):x.toFixed(2);
const signed=x=>(x>=0?'+':'')+x.toFixed(1);
let state={left:preset('candle'),right:preset('sun'),mode:'shared',offsets:{left:0,right:0},exposure:0,rho:.18,color:true,whiteBalance:'neutral'};
let queued=false,dragSource=null;
function updateSourceIcons(side){
 const slot=state[side],src=SOURCES[slot.source],path=`assets/${src.image}.png`;
 $(side+'-settings-art').src=path;$('wb-'+side+'-art').src=path;$(side+'-marker-art').src=path;
 const group=$(side+'-count-icons'),key=slot.source+':'+slot.count;
 if(group.dataset.key===key)return;
 group.dataset.key=key;group.replaceChildren();group.setAttribute('aria-label',src.name+' '+slot.count+'개');
 if(src.kind!=='point')return;
 for(let i=0;i<slot.count;i++){const img=document.createElement('img');img.src=path;img.alt='';img.width=28;img.height=28;img.draggable=false;group.append(img);}
}
// A fixed linear ruler: 40 SVG units per metre. The 170 cm person is 68 units tall.
function updateDistanceGuide(side){
 const slot=state[side],src=SOURCES[slot.source];if(src.kind!=='point')return;
 const start=80,end=start+slot.distance*40;
 $(side+'-distance-light').setAttribute('transform',`translate(${end} 0)`);
 $(side+'-distance-art').setAttribute('href',`assets/${src.image}.png`);
 const label=$(side+'-distance-source-label');label.textContent=src.name+(slot.count>1?' × '+slot.count:'');
 label.setAttribute('text-anchor',end>430?'end':'middle');label.setAttribute('x',end>430?20:0);
 $(side+'-distance-ray').setAttribute('x2',end);
 $(side+'-distance-dimension').setAttribute('d',`M${start} 201v10M${start} 206H${end}M${end} 201v10`);
 $(side+'-distance-value').setAttribute('x',(start+end)/2);
 $(side+'-distance-value').textContent=slot.distance.toFixed(2)+' m';
 $(side+'-distance-comparison').textContent=slot.distance.toFixed(2)+' m · 사람 키의 약 '+(slot.distance/1.7).toFixed(2)+'배';
 $(side+'-distance-diagram').setAttribute('aria-label',`키 170cm인 사람 옆 측정면에서 ${src.name} ${slot.count}개까지 ${slot.distance.toFixed(2)}미터. 사람 키와 거리의 축척은 같습니다.`);
}
function refreshControls(side){
 const s=state[side],src=SOURCES[s.source];
 $(side+'-note-title').textContent=(side==='left'?'왼쪽 · ':'오른쪽 · ')+src.name;
 $(side+'-source').value=s.source;$(side+'-count').value=s.count;$(side+'-distance').value=Math.log10(s.distance);$(side+'-illuminance').value=Math.log10(s.lux);
 $(side+'-point').hidden=src.kind!=='point';$(side+'-ambient').hidden=src.kind==='point';$(side+'-sun-presets').hidden=s.source!=='sun';
 $(side+'-source-note').textContent=src.note;
}
function sync(){['left','right'].forEach(refreshControls);$('reflectance').value=state.rho*100;$('exposure').value=state.exposure;$('warm').checked=state.color;}
function assign(side,id){if(!['left','right'].includes(side)||!Object.hasOwn(SOURCES,id))return;state[side]=preset(id);refreshControls(side);update();$('assignment-status').textContent=`${SOURCES[id].name}을 ${side==='left'?'왼쪽':'오른쪽'} 비교칸에 놓았습니다.`;}
function update(){
 const result=comparison(state.left,state.right,state.mode,state.exposure,state.offsets),diff=result.stopsDifference;
 for(const side of ['left','right']){
  const s=state[side],src=SOURCES[s.source],v=result[side],label=side==='left'?'왼쪽':'오른쪽';
  updateSourceIcons(side);updateDistanceGuide(side);$(side+'-settings-title').textContent=label+' · '+src.name;$(side+'-offset').value=state.offsets[side];$(side+'-offset-out').value=signed(state.offsets[side])+' stops';$(side+'-name').textContent=src.name;$(side+'-art').src=`assets/${src.image}.png`;$(side+'-lux').textContent=fmt(v.lux);$(side+'-exposure').textContent=signed(v.exposure)+' stops';
  $(side+'-count-out').value=s.count+'개';$(side+'-distance-out').value=s.distance.toFixed(2)+' m';$(side+'-illuminance-out').value=fmt(s.lux)+' lx';
  $(side+'-distance').setAttribute('aria-valuetext',s.distance.toFixed(2)+'미터');$(side+'-illuminance').setAttribute('aria-valuetext',fmt(s.lux)+'럭스');
  $(side+'-canvas').setAttribute('aria-label',label+' 조명('+src.name+')으로 비춘 확산 구와 바닥');
  $(side+'-condition').textContent=src.kind==='point'?`${src.name} ${s.count}개 · ${s.distance.toFixed(2)} m · ${s.source==='candle'?'1개당 1 cd 가정':'1개당 800 lm / 전방향 가정'}`:s.source==='sun'?(daylightPreset(s.lux)?.condition||'햇빛 · 직접 설정')+' · '+fmt(s.lux)+' lx (예시)':src.condition+(Math.abs(s.lux-src.lux)>.00001?' · 조도 조절됨':'');
  const l=linearDisplay(v.lux,state.rho,v.exposure);$(side+'-status').textContent=l<.001?'현재 노출에서 반사광이 거의 보이지 않습니다.':l>.95?'하이라이트가 흰색에 가까워집니다.':state.mode==='individual'?'자동 노출에 공통·개별 보정을 더한 화면입니다.':state.offsets.left===state.offsets.right?'같은 노출로 비교 중입니다.':'개별 노출 보정이 적용된 화면입니다.';
  const marker=$(side+'-marker');marker.style.left=(Math.max(0,Math.min(1,(Math.log10(v.lux)+2)/8))*100)+'%';marker.querySelector('span').textContent=label+' · '+src.name;marker.title=fmt(v.lux)+' lx';
 }
 $('reflectance-out').value=Math.round(state.rho*100)+'%';$('exposure-out').value=signed(state.exposure)+' stops';$('exposure').disabled=false;
 $('shared').setAttribute('aria-pressed',state.mode==='shared'&&state.offsets.left===state.offsets.right);$('individual').setAttribute('aria-pressed',state.mode==='individual');
 $('mode-explanation').textContent=state.mode==='individual'?'각 장면의 18% 회색 기준이 비슷하게 보이도록 카메라 노출을 따로 맞춥니다. 광원의 세기는 그대로입니다.':'공통 밝기는 양쪽에, 개별 노출 보정은 해당 화면에 더해집니다. 같은 노출로 맞추기를 누르면 개별 보정이 초기화됩니다.';
 for(const key of ['neutral','left','right']){$('wb-'+key).setAttribute('aria-pressed',state.whiteBalance===key);$('wb-'+key).disabled=!state.color;}
 $('wb-left-label').textContent='왼쪽 · '+SOURCES[state.left.source].name+' 기준';$('wb-right-label').textContent='오른쪽 · '+SOURCES[state.right.source].name+' 기준';
 $('color-status').textContent=!state.color?'색감을 끄고 밝기만 비교합니다.':state.whiteBalance==='neutral'?'양쪽에 중립적인 색 기준을 적용합니다.':SOURCES[state[state.whiteBalance].source].name+'을 흰색의 기준으로 삼아 양쪽을 함께 보정합니다.';
 $('stops').textContent=Math.abs(diff).toFixed(2);$('ratio-text').replaceChildren();
 if(Math.abs(diff)<1e-8){$('ratio-text').textContent='두 측정면의 조도가 같습니다.';}
 else{const stronger=diff>0?'right':'left',name=SOURCES[state[stronger].source].name,strong=document.createElement('strong');strong.textContent=fmt(2**Math.abs(diff))+'배';$('ratio-text').append((stronger==='left'?'왼쪽':'오른쪽')+' '+name+' 쪽이 ',strong,' 강합니다.');}
 $('takeaway').textContent=state.mode==='individual'?'비슷하게 보여도 조도는 다를 수 있습니다. 각 그림 위의 노출 보정값을 비교해보세요.':'노출을 올려도 두 빛의 물리적인 비율은 바뀌지 않습니다.';
 $('exposure-note').textContent=state.mode==='individual'?'각 장면 자동 노출 + 공통 밝기 + 개별 보정':'공통 밝기 + 개별 보정 · 조도(lx)는 바뀌지 않습니다.';
 document.querySelectorAll('.source-card').forEach(card=>{const id=card.dataset.source,sides=['left','right'].filter(side=>state[side].source===id);card.classList.toggle('active',sides.length>0);$('chosen-'+id).textContent=sides.map(s=>s==='left'?'왼쪽':'오른쪽').join(' · ');});
 document.querySelectorAll('[data-lux]').forEach(b=>{const selected=state[b.dataset.side].source==='sun'&&Math.abs(state[b.dataset.side].lux-+b.dataset.lux)<.001;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',selected);});
 if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;const now=comparison(state.left,state.right,state.mode,state.exposure,state.offsets),colors=comparisonColors(state.left,state.right,state.whiteBalance,state.color);for(const side of ['left','right'])render(side+'-canvas',now[side].lux,state.rho,now[side].exposure,colors[side]);});}
 return {...result,commonExposure:state.exposure,exposureOffsets:{...state.offsets},whiteBalance:state.whiteBalance,displayColors:comparisonColors(state.left,state.right,state.whiteBalance,state.color)};
}
for(const side of ['left','right']){
 $(side+'-source').onchange=e=>assign(side,e.target.value);
 for(const key of ['count','distance','illuminance'])$(side+'-'+key).oninput=e=>{state[side][key==='illuminance'?'lux':key]=key==='count'?+e.target.value:10**+e.target.value;update();};
 $(side+'-offset').oninput=e=>{state.offsets[side]=+e.target.value;update();};
 $(side+'-offset-reset').onclick=()=>{state.offsets[side]=0;update();};
 $('fit-'+side).onclick=()=>{state.mode='shared';state.offsets={left:0,right:0};state.exposure=fitExposure(illuminance(state[side]));$('exposure').value=state.exposure;update();};
}
$('reflectance').oninput=e=>{state.rho=+e.target.value/100;update();};$('exposure').oninput=e=>{state.exposure=+e.target.value;update();};$('warm').onchange=e=>{state.color=e.target.checked;update();};
for(const key of ['neutral','left','right'])$('wb-'+key).onclick=()=>{state.whiteBalance=key;update();};
$('shared').onclick=()=>{state.mode='shared';state.offsets={left:0,right:0};update();};$('individual').onclick=()=>{state.mode='individual';state.exposure=0;state.offsets={left:0,right:0};sync();update();};
document.querySelectorAll('[data-assign]').forEach(b=>b.onclick=()=>assign(b.dataset.assign,b.dataset.source));
document.querySelectorAll('[data-lux]').forEach(b=>b.onclick=()=>{if(state[b.dataset.side].source!=='sun')return;state[b.dataset.side].lux=+b.dataset.lux;refreshControls(b.dataset.side);update();});
const zones=[...document.querySelectorAll('[data-drop-side]')];
function endDrag(){dragSource=null;document.querySelectorAll('.source-card').forEach(c=>c.classList.remove('dragging'));zones.forEach(z=>z.classList.remove('drop-ready','drag-over'));}
document.querySelectorAll('.source-card').forEach(card=>{
 card.addEventListener('dragstart',e=>{dragSource=card.dataset.source;e.dataTransfer.setData('application/x-penumbra-source',dragSource);e.dataTransfer.setData('text/plain',dragSource);e.dataTransfer.effectAllowed='copy';card.classList.add('dragging');zones.forEach(z=>z.classList.add('drop-ready'));});
 card.addEventListener('dragend',endDrag);
});
for(const zone of zones){
 zone.addEventListener('dragover',e=>{if(dragSource){e.preventDefault();e.dataTransfer.dropEffect='copy';zone.classList.add('drag-over');}});
 zone.addEventListener('dragleave',e=>{if(!zone.contains(e.relatedTarget))zone.classList.remove('drag-over');});
 zone.addEventListener('drop',e=>{if(!dragSource)return;e.preventDefault();const id=e.dataTransfer.getData('application/x-penumbra-source');if(id===dragSource&&Object.hasOwn(SOURCES,id))assign(zone.dataset.dropSide,id);endDrag();});
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')endDrag();});
$('reset').onclick=()=>{state={left:preset('candle'),right:preset('sun'),mode:'shared',offsets:{left:0,right:0},exposure:0,rho:.18,color:true,whiteBalance:'neutral'};endDrag();sync();update();$('assignment-status').textContent='촛불과 햇빛의 기본 비교로 초기화했습니다.';};
const W=520,H=390,normal=[-.5,.7,.5099019513592785];
const geometry=new Float32Array(W*H);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const px=(x/W-.5)*4.5, py=(.53-y/H)*3.375, z2=1-px*px-py*py;
 let shade=0;
 if(z2>=0){shade=Math.max(0,px*normal[0]+py*normal[1]+Math.sqrt(z2)*normal[2]);}
 else if(py<-.99){
  // Ground-plane study; projected contact shadow is a diagrammatic approximation.
  const depth=(-py-1)*2.6, sx=px-.5*depth, shadow=Math.exp(-(sx*sx*2.5+depth*depth*1.7));
  shade=normal[1]*(1-.92*shadow)*Math.max(0,1-depth*.35);
 }
 geometry[y*W+x]=shade;
}
function render(id,lux,rho,stops,color){
 const canvas=$(id),ctx=canvas.getContext('2d'); if(!ctx)return;
 const frame=ctx.createImageData(W,H),raw=color;
 const luminance=.2126*raw[0]+.7152*raw[1]+.0722*raw[2],rgb=raw.map(c=>c/luminance);
 for(let i=0;i<W*H;i++){
  const E=lux*geometry[i],k=i*4;
  for(let c=0;c<3;c++)frame.data[k+c]=Math.round(255*Math.min(1,srgb(linearDisplay(E*rgb[c],rho,stops))));
  frame.data[k+3]=255;
 }
 ctx.putImageData(frame,0,0);
 // Reference chips are calculated receiving surfaces, not a decorative brightness gradient.
 const chipRho=[.04,.18,.8],chipWidth=42,start=W/2-75;
 chipRho.forEach((r,i)=>{
 const color=rgb.map(c=>Math.round(255*Math.min(1,srgb(linearDisplay(lux*c,r,stops)))));
 ctx.fillStyle=`rgb(${color.join(',')})`;ctx.fillRect(start+i*54,H-42,chipWidth,15);
 });
}
function showPanel(panel,focus=false){
 const guide=panel==='guide';$('experiment-panel').hidden=guide;$('guide').hidden=!guide;
 for(const key of ['experiment','guide']){const selected=key===panel;$('tab-'+key).setAttribute('aria-selected',selected);$('tab-'+key).tabIndex=selected?0:-1;}
 if(focus)$('tab-'+panel).focus();
}
for(const key of ['experiment','guide']){const tab=$('tab-'+key);tab.onclick=()=>showPanel(key);tab.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();showPanel(e.key==='Home'?'experiment':e.key==='End'?'guide':key==='guide'?'experiment':'guide',true);}});}
$('open-guide').onclick=()=>showPanel('guide',true);$('back-experiment').onclick=()=>showPanel('experiment',true);$('color-help').onclick=()=>{showPanel('guide');$('color-guide').scrollIntoView({block:'start'});};

sync();update();
const context=document.modelContext;
if(context?.registerTool){
 const lifecycle=new AbortController(),sourceEnum=Object.keys(SOURCES);
 const inputSchema={type:'object',properties:{leftSource:{type:'string',enum:sourceEnum},rightSource:{type:'string',enum:sourceEnum},leftDistance:{type:'number',minimum:.1,maximum:10},rightDistance:{type:'number',minimum:.1,maximum:10},leftCount:{type:'integer',minimum:1,maximum:100},rightCount:{type:'integer',minimum:1,maximum:100},leftLux:{type:'number',minimum:.01,maximum:100000},rightLux:{type:'number',minimum:.01,maximum:100000},mode:{type:'string',enum:['shared','individual']},exposureStops:{type:'number',minimum:-6,maximum:24},leftExposureOffset:{type:'number',minimum:-24,maximum:24},rightExposureOffset:{type:'number',minimum:-24,maximum:24},reflectancePercent:{type:'number',minimum:4,maximum:80},showColor:{type:'boolean'},whiteBalance:{type:'string',enum:['neutral','left','right']}},additionalProperties:false};
 try{Promise.resolve(context.registerTool({name:'configure_light_comparison',description:'Choose any two light sources and configure their visible comparison. exposureStops is a shared additive brightness correction in every mode; leftExposureOffset and rightExposureOffset add per-side corrections. Auto mode computes each base exposure from lux. Lux overrides apply only to moonlight and sunlight; candle and bulbs use count and distance.',inputSchema,annotations:{readOnlyHint:false,untrustedContentHint:false},async execute(input){
 validateSettings(input);
 const next=structuredClone(state);
 for(const side of ['left','right']){
  if(input[side+'Source']!==undefined)next[side]=preset(input[side+'Source']);
  const point=SOURCES[next[side].source].kind==='point';
  if(input[side+'Lux']!==undefined){if(point)throw new Error('Use count and distance for a point source');next[side].lux=input[side+'Lux'];}
  for(const key of ['Distance','Count'])if(input[side+key]!==undefined){if(!point)throw new Error('Distance and count require a point source');next[side][key.toLowerCase()]=input[side+key];}
 }
 for(const side of ['left','right'])if(input[side+'ExposureOffset']!==undefined)next.offsets[side]=input[side+'ExposureOffset'];
 if(input.mode!==undefined)next.mode=input.mode;if(input.exposureStops!==undefined)next.exposure=input.exposureStops;if(input.reflectancePercent!==undefined)next.rho=input.reflectancePercent/100;if(input.showColor!==undefined)next.color=input.showColor;if(input.whiteBalance!==undefined)next.whiteBalance=input.whiteBalance;
 state=next;sync();const result=update();await new Promise(requestAnimationFrame);return result;
 }},{signal:lifecycle.signal})).catch(()=>{});}catch{}
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
