import {roomDefaults,roomSchema,configureRoom,roomContributions} from './room-physics.mjs';
import {fitExposure} from './lighting-physics.mjs';
import {SOURCES} from './light-sources.mjs';
import {renderRoomPair} from './room-renderer.mjs';
export function initRoomLab(showRoom){
 const $=id=>document.getElementById(id);let state=roomDefaults(),queued=false,drag=null;
 const fmt=x=>x===0?'0':x>=1000?x.toLocaleString('en-US',{maximumFractionDigits:2}):x>=.01?x.toLocaleString('en-US',{maximumFractionDigits:3}):x.toLocaleString('en-US',{maximumSignificantDigits:3});
 function update(){
  const r=roomContributions(state);
  $('room-outside').value=state.outside;$('room-lamp').value=state.lamp;$('room-outside-art').src='assets/'+SOURCES[state.outside].image+'.png';$('room-lamp-art').src='assets/'+SOURCES[state.lamp].image+'.png';
  for(const [id,key,log] of [['outdoor-lux','outdoorLux',true],['reach','reach',true],['count','count',false],['distance','distance',true],['exposure','exposure',false]])$('room-'+id).value=log?Math.log10(state[key]):state[key];
  for(const [id,key] of [['window-on','windowOn'],['lamp-on','lampOn'],['color','color']])$('room-'+id).checked=state[key];
  $('room-outdoor-out').value=fmt(state.outdoorLux)+' lx';$('room-reach-out').value=fmt(state.reach*100)+'%';$('room-reach').setAttribute('aria-valuetext',fmt(state.reach*100)+'%');$('room-count-out').value=state.count+'개';$('room-distance-out').value=state.distance.toFixed(2)+' m';$('room-exposure-out').value=(state.exposure>=0?'+':'')+state.exposure.toFixed(2)+' stops';
  for(const [id,value] of [['left-lux',r.windowLux],['right-lux',r.totalLux],['window-value',r.windowLux],['lamp-value',r.lampLux],['total-value',r.totalLux]])$('room-'+id).textContent=fmt(value)+' lx';
  $('room-change').textContent=r.windowLux===0?(r.totalLux===0?'두 빛 모두 꺼짐':'창빛 없이 실내 조명만'):'+'+fmt(r.increasePercent)+'% · +'+r.stopsAdded.toFixed(3)+' stops';
  $('room-fit-window').disabled=r.windowLux===0;$('room-fit-total').disabled=r.totalLux===0;$('room-fit-lamp').disabled=r.lampLux===0;
  $('room-takeaway').textContent=r.totalLux===0?'창빛이나 실내 조명을 켜보세요.':r.lampLux===0?'실내 조명이 꺼져 있어 두 화면이 같습니다.':r.windowLux===0?'창빛이 없어 오른쪽에는 실내 조명만 기여합니다.':r.increasePercent<1?'이 측정면에서는 창빛에 비해 실내 조명의 기여가 작습니다. 노출을 그대로 두고 창빛 도달 비율을 낮춰보세요.':'이 측정면에서 실내 조명의 몫은 전체 빛의 '+(r.lampShare*100).toFixed(1)+'%입니다. 창빛을 다시 높여 비교해보세요.';
  document.querySelectorAll('[data-room-count]').forEach(b=>b.setAttribute('aria-pressed',state.count===+b.dataset.roomCount));document.querySelectorAll('[data-reach]').forEach(b=>b.setAttribute('aria-pressed',Math.abs(state.reach-+b.dataset.reach)<1e-10));
  $('room-left-canvas').setAttribute('aria-label','창빛만: 측정면 '+fmt(r.windowLux)+'럭스');$('room-right-canvas').setAttribute('aria-label','창빛과 실내 조명: 측정면 '+fmt(r.totalLux)+'럭스. 두 화면은 같은 노출입니다.');
  if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;renderRoomPair($('room-left-canvas'),$('room-right-canvas'),state,!!drag);});}
  return {settings:{...state},...r};
 }
 const apply=input=>{state=configureRoom(state,input);return update();};
 for(const [id,key,log] of [['outdoor-lux','outdoorLux',true],['reach','reach',true],['count','count',false],['distance','distance',true],['exposure','exposure',false]])$('room-'+id).oninput=e=>apply({[key]:log?Number((10**+e.target.value).toPrecision(12)):+e.target.value});
 for(const [id,key] of [['outside','outside'],['lamp','lamp']])$('room-'+id).onchange=e=>apply({[key]:e.target.value});
 for(const [id,key] of [['window-on','windowOn'],['lamp-on','lampOn'],['color','color']])$('room-'+id).onchange=e=>apply({[key]:e.target.checked});
 document.querySelectorAll('[data-room-count]').forEach(b=>b.onclick=()=>apply({count:+b.dataset.roomCount}));document.querySelectorAll('[data-reach]').forEach(b=>b.onclick=()=>apply({reach:+b.dataset.reach}));
 for(const [id,key] of [['fit-window','windowLux'],['fit-lamp','lampLux'],['fit-total','totalLux']])$('room-'+id).onclick=()=>{const lux=roomContributions(state)[key];if(lux>0)apply({exposure:fitExposure(lux)});};
 const canvases=[$('room-left-canvas'),$('room-right-canvas')];
 const rotate=(yaw,pitch)=>apply({viewYaw:((yaw+180)%360+360)%360-180,viewPitch:Math.max(2,Math.min(75,pitch))});
 function finishDrag(){
  const previous=drag;drag=null;
  canvases.forEach(c=>c.classList.remove('is-orbiting'));
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
  canvas.addEventListener('pointermove',e=>{if(!drag||drag.canvas!==canvas||drag.id!==e.pointerId)return;rotate(drag.yaw-(e.clientX-drag.x)/drag.width*180,drag.pitch+(e.clientY-drag.y)/drag.width*120);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(drag?.canvas===canvas&&drag.id===e.pointerId)finishDrag();});
  canvas.addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;
   e.preventDefault();if(e.key==='Home'){resetView();return;}
   rotate(state.viewYaw+(e.key==='ArrowLeft'?-10:e.key==='ArrowRight'?10:0),state.viewPitch+(e.key==='ArrowUp'?5:e.key==='ArrowDown'?-5:0));
  });
 }
 $('room-view-reset').onclick=resetView;
 function reset(){finishDrag();state=roomDefaults();update();}$('room-reset').onclick=reset;$('reset').addEventListener('click',reset);update();
 const context=document.modelContext;
 if(context?.registerTool){const lifecycle=new AbortController();try{Promise.resolve(context.registerTool({name:'configure_window_room',description:'Configure the window-room experiment and show its tab. Both views share one exposure: window light alone versus the same room with a local light. reach is an illustrative receiving-surface fraction, not glass transmission. viewYaw and viewPitch are shared camera angles in degrees; rotating never moves the lights or receiver. Returns lux contributions after updating.',inputSchema:roomSchema,annotations:{readOnlyHint:false,untrustedContentHint:false},async execute(input){const result=apply(input);showRoom();await new Promise(requestAnimationFrame);return result;}},{signal:lifecycle.signal})).catch(()=>{});}catch{}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
 return {reset};
}
