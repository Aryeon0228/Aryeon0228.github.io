import {roomDefaults,roomSchema,configureRoom,roomContributions} from './room-physics.mjs?v=a3bb513ceebc';
import {fitExposure} from './lighting-physics.mjs';
import {SOURCES} from './light-sources.mjs';

export function initRoomLab(showRoom){
 const $=id=>document.getElementById(id);let state=roomDefaults(),queued=false,drag=null,viewer=null,loading=false,failed=false;
 const canvases=[$('room-left-canvas'),$('room-right-canvas')];
 function error(message){failed=true;$('room-render-status').hidden=false;$('room-render-status').textContent=message;document.querySelectorAll('.room-lamp-handle,.room-sensor-label').forEach(el=>el.hidden=true);}
 function draw(){
  if($('room-panel').hidden||failed)return;
  if(viewer){try{viewer.render(state);}catch{error('3D 화면을 갱신하지 못했어요. 페이지를 새로고침해 주세요.');}return;}
  if(loading)return;loading=true;
  import('./room-renderer.mjs?v=68f0aa45b82b').then(({createRoomRenderer})=>{
   try{viewer=createRoomRenderer(canvases,queueDraw,error);viewer.render(state);}catch{error('3D 화면을 열지 못했어요. 브라우저의 그래픽 가속 설정을 확인한 뒤 새로고침해 주세요. 아래 조도 계산은 계속 사용할 수 있어요.');}
  }).catch(()=>error('3D 화면을 불러오지 못했어요. 연결을 확인한 뒤 새로고침해 주세요.'));
 }
 function queueDraw(){if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;draw();});}}
 const visibility=new MutationObserver(queueDraw);visibility.observe($('room-panel'),{attributes:true,attributeFilter:['hidden']});
 const fmt=x=>x===0?'0':x>=1000?x.toLocaleString('en-US',{maximumFractionDigits:2}):x>=.01?x.toLocaleString('en-US',{maximumFractionDigits:3}):x.toLocaleString('en-US',{maximumSignificantDigits:3});
 function update(){
  const r=roomContributions(state);
  $('room-outside').value=state.outside;$('room-lamp').value=state.lamp;$('room-outside-art').src='assets/'+SOURCES[state.outside].image+'.png';$('room-lamp-art').src='assets/'+SOURCES[state.lamp].image+'.png';
  for(const [id,key,log] of [['outdoor-lux','outdoorLux',true],['reach','reach',true],['count','count',false],['distance','distance',true],['exposure','exposure',false],['azimuth','lampAzimuth',false],['elevation','lampElevation',false]])$('room-'+id).value=log?Math.log10(state[key]):state[key];
  for(const [id,key] of [['window-on','windowOn'],['lamp-on','lampOn'],['color','color'],['bloom','bloom']])$('room-'+id).checked=state[key];
  $('room-azimuth-out').value=Math.round(state.lampAzimuth)+'°';$('room-elevation-out').value=Math.round(state.lampElevation)+'°';
  $('room-azimuth').setAttribute('aria-valuetext',Math.round(state.lampAzimuth)+'도');$('room-elevation').setAttribute('aria-valuetext',Math.round(state.lampElevation)+'도');$('room-distance').setAttribute('aria-valuetext',state.distance.toFixed(2)+'미터');
  $('room-outdoor-out').value=fmt(state.outdoorLux)+' lx';$('room-reach-out').value=fmt(state.reach*100)+'%';$('room-reach').setAttribute('aria-valuetext',fmt(state.reach*100)+'%');$('room-count-out').value=state.count+'개';$('room-distance-out').value=state.distance.toFixed(2)+' m';$('room-exposure-out').value=(state.exposure>=0?'+':'')+state.exposure.toFixed(2)+' stops';
  for(const [id,value] of [['left-lux',r.windowLux],['right-lux',r.totalLux],['window-value',r.windowLux],['lamp-value',r.lampLux],['total-value',r.totalLux]])$('room-'+id).textContent=fmt(value)+' lx';
  $('room-change').textContent=r.windowLux===0?(r.totalLux===0?'측정 지점에 닿는 빛 없음':'창빛 없이 실내 조명만'):'+'+r.increasePercent.toFixed(1)+'% · +'+r.stopsAdded.toFixed(2)+' stops';
  $('room-fit-window').disabled=r.windowLux===0;$('room-fit-total').disabled=r.totalLux===0;$('room-fit-lamp').disabled=r.lampLux===0;
  $('room-takeaway').textContent=state.lampOn&&r.lampBlocked?'물체가 측정 지점을 가려 실내 조명의 직접광이 닿지 않아요. 조명을 옆이나 위로 옮겨보세요.':r.totalLux===0?'창빛이나 실내 조명을 켜보세요.':!state.lampOn?'실내 조명이 꺼져 있어 두 화면이 같습니다.':r.windowLux===0?'창빛이 없어 오른쪽에는 실내 조명만 기여합니다.':r.increasePercent<1?'이 측정면에서는 창빛에 비해 실내 조명의 기여가 작습니다. 노출을 그대로 두고 창빛 도달 비율을 낮춰보세요.':'이 측정면에서 실내 조명의 몫은 전체 빛의 '+(r.lampShare*100).toFixed(1)+'%입니다. 창빛을 다시 높여 비교해보세요.';
  document.querySelectorAll('[data-room-count]').forEach(b=>b.setAttribute('aria-pressed',state.count===+b.dataset.roomCount));document.querySelectorAll('[data-reach]').forEach(b=>b.setAttribute('aria-pressed',Math.abs(state.reach-+b.dataset.reach)<1e-10));
  $('room-left-canvas').setAttribute('aria-label','창빛만: 측정면 '+fmt(r.windowLux)+'럭스');$('room-right-canvas').setAttribute('aria-label','창빛과 실내 조명: 측정면 '+fmt(r.totalLux)+'럭스. 두 화면은 같은 노출입니다.');
  queueDraw();
  return {settings:{...state},...r};
 }
 const apply=input=>{state=configureRoom(state,input);return update();};
 for(const [id,key,log] of [['outdoor-lux','outdoorLux',true],['reach','reach',true],['count','count',false],['distance','distance',true],['exposure','exposure',false],['azimuth','lampAzimuth',false],['elevation','lampElevation',false]])$('room-'+id).oninput=e=>apply({[key]:log?Number((10**+e.target.value).toPrecision(12)):+e.target.value});
 for(const [id,key] of [['outside','outside'],['lamp','lamp']])$('room-'+id).onchange=e=>apply({[key]:e.target.value});
 for(const [id,key] of [['window-on','windowOn'],['lamp-on','lampOn'],['color','color'],['bloom','bloom']])$('room-'+id).onchange=e=>apply({[key]:e.target.checked});
 document.querySelectorAll('[data-room-count]').forEach(b=>b.onclick=()=>apply({count:+b.dataset.roomCount}));document.querySelectorAll('[data-reach]').forEach(b=>b.onclick=()=>apply({reach:+b.dataset.reach}));
 for(const [id,key] of [['fit-window','windowLux'],['fit-lamp','lampLux'],['fit-total','totalLux']])$('room-'+id).onclick=()=>{const lux=roomContributions(state)[key];if(lux>0)apply({exposure:Math.min(42,Math.max(-6,fitExposure(lux)))});};
 const rotate=(yaw,pitch)=>apply({viewYaw:((yaw+180)%360+360)%360-180,viewPitch:Math.max(2,Math.min(75,pitch))});
 function finishDrag(){
  const previous=drag;drag=null;
  canvases.forEach(c=>c.classList.remove('is-orbiting'));
  previous?.canvas.classList.remove('is-orbiting');
  if(previous?.canvas.hasPointerCapture(previous.id))previous.canvas.releasePointerCapture(previous.id);
  update();
 }
 const resetView=()=>{finishDrag();const defaults=roomDefaults();apply({viewYaw:defaults.viewYaw,viewPitch:defaults.viewPitch});};
 for(const canvas of canvases){
  canvas.addEventListener('pointerdown',e=>{
   if(drag||e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0))return;
   e.preventDefault();canvas.focus();canvas.setPointerCapture(e.pointerId);
   drag={id:e.pointerId,canvas,x:e.clientX,y:e.clientY,yaw:state.viewYaw,pitch:state.viewPitch,width:Math.max(1,canvas.getBoundingClientRect().width)};
   canvases.forEach(c=>c.classList.add('is-orbiting'));
  });
  canvas.addEventListener('pointermove',e=>{if(!drag||drag.kind==='lamp'||drag.canvas!==canvas||drag.id!==e.pointerId)return;rotate(drag.yaw-(e.clientX-drag.x)/drag.width*180,drag.pitch+(e.clientY-drag.y)/drag.width*120);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(drag?.canvas===canvas&&drag.id===e.pointerId)finishDrag();});
  canvas.addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;
   e.preventDefault();if(e.key==='Home'){resetView();return;}
   rotate(state.viewYaw+(e.key==='ArrowLeft'?-10:e.key==='ArrowRight'?10:0),state.viewPitch+(e.key==='ArrowUp'?5:e.key==='ArrowDown'?-5:0));
  });
 }

 for(const handle of document.querySelectorAll('.room-lamp-handle')){
  const canvas=handle.parentElement.querySelector('canvas');
  handle.addEventListener('pointerdown',e=>{
   if(drag||!viewer||failed||e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0))return;
   const move=viewer.beginLampDrag(canvas,e.clientX,e.clientY);if(!move)return;
   e.preventDefault();e.stopPropagation();handle.focus();handle.setPointerCapture(e.pointerId);
   drag={id:e.pointerId,kind:'lamp',canvas:handle,move};handle.classList.add('is-orbiting');
  });
  handle.addEventListener('pointermove',e=>{if(drag?.kind!=='lamp'||drag.canvas!==handle||drag.id!==e.pointerId)return;const next=drag.move(e.clientX,e.clientY);if(next)apply(next);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(event,e=>{if(drag?.canvas===handle&&drag.id===e.pointerId){handle.classList.remove('is-orbiting');finishDrag();}});
  handle.addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();
   if(e.key==='Home'){resetLamp();return;}
   apply({lampAzimuth:((state.lampAzimuth+(e.key==='ArrowLeft'?-10:e.key==='ArrowRight'?10:0)+540)%360)-180,lampElevation:Math.min(90,Math.max(2,state.lampElevation+(e.key==='ArrowUp'?5:e.key==='ArrowDown'?-5:0)))});
  });
 }
 function resetLamp(){finishDrag();const d=roomDefaults();apply({distance:d.distance,lampAzimuth:d.lampAzimuth,lampElevation:d.lampElevation});}
 $('room-lamp-reset').onclick=resetLamp;
 window.addEventListener('pagehide',e=>{if(!e.persisted){visibility.disconnect();viewer?.dispose();}},{once:true});
 $('room-view-reset').onclick=resetView;
 function reset(){finishDrag();state=roomDefaults();update();}$('room-reset').onclick=reset;$('reset').addEventListener('click',reset);update();
 const context=document.modelContext;
 if(context?.registerTool){const lifecycle=new AbortController();try{Promise.resolve(context.registerTool({name:'configure_window_room',description:'Configure the window-room experiment and show its tab. Both views share one exposure: window light alone versus the same room with a local light. reach is an illustrative receiving-surface fraction, not glass transmission. viewYaw and viewPitch are shared camera angles in degrees; rotating never moves the lights or receiver. lampAzimuth and lampElevation position the draggable point light about the floor sensor. Lux includes inverse-square falloff, cosine incidence and object occlusion. bloom adds a bounded highlight glow without changing lux. Returns lux contributions after updating.',inputSchema:roomSchema,annotations:{readOnlyHint:false,untrustedContentHint:false},async execute(input){const result=apply(input);showRoom();await new Promise(requestAnimationFrame);return result;}},{signal:lifecycle.signal})).catch(()=>{});}catch{}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
 return {reset};
}
