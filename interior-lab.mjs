// Interior Lab: raymarched interior mapping behind a procedural facade (WebGL 1).
import {shaders} from './interior-shaders.mjs?v=0e51f3cf274c';
import {initSourcePanel} from './interior-source.mjs?v=8a2a9e3f966d';

const $=id=>document.getElementById(id),canvas=$('gl');
const initial={yaw:.20,pitch:.065,depth:4.8,grid:5,seed:0,refl:.28,dust:.08,day:.34,mode:0,reflOn:true,dustOn:true};
const state={...initial};let previousSeed=null,currentSeed=initial.seed,nextSeed=initial.seed;let gl,program,uniforms={},pending=0,dragging=false,lastX=0,lastY=0;
function fail(message){stopTour();$('bTour').hidden=true;$('errorText').textContent=message;$('error').hidden=false;$('statusText').textContent='미리보기 중단';}
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(message);}return s;}
function init(){
 try{
  gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'high-performance'});
  if(!gl)throw Error('WebGL unavailable');
  const vert=shader(gl.VERTEX_SHADER,shaders.vertex),frag=shader(gl.FRAGMENT_SHADER,shaders.fragment);
  program=gl.createProgram();gl.attachShader(program,vert);gl.attachShader(program,frag);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.deleteShader(vert);gl.deleteShader(frag);gl.useProgram(program);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const position=gl.getAttribLocation(program,'a_pos');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  for(const name of ['yaw','pitch','depth','grid','aspect','seed','refl','dust','day','mode'])uniforms[name]=gl.getUniformLocation(program,'u_'+name);
  $('error').hidden=true;resize();
 }catch(error){console.error('Interior renderer:',error);fail('3D 미리보기를 시작할 수 없어요. 브라우저의 그래픽 가속을 켜거나 다른 WebGL 지원 브라우저에서 열어주세요.');}
}
function render(){pending=0;if(!gl||gl.isContextLost()||!program)return;gl.useProgram(program);for(const key of ['yaw','pitch','depth','grid','seed','day'])gl.uniform1f(uniforms[key],state[key]);gl.uniform1f(uniforms.aspect,canvas.width/canvas.height);gl.uniform1f(uniforms.refl,state.reflOn?state.refl:0);gl.uniform1f(uniforms.dust,state.dustOn?state.dust:0);gl.uniform1i(uniforms.mode,state.mode);gl.drawArrays(gl.TRIANGLES,0,3);const degrees=x=>(x>=0?'+':'')+Math.round(x*180/Math.PI)+'°';$('readout').textContent='AZ '+degrees(state.yaw)+' / EL '+degrees(state.pitch);}
function requestRender(){if(!pending)pending=requestAnimationFrame(render);}
function resize(){if(!gl)return;const dpr=Math.min(devicePixelRatio||1,1.6),limit=1900/Math.max(1,canvas.clientWidth),scale=Math.min(dpr,limit);canvas.width=Math.max(1,Math.round(canvas.clientWidth*scale));canvas.height=Math.max(1,Math.round(canvas.clientHeight*scale));gl.viewport(0,0,canvas.width,canvas.height);requestRender();}
function aim(dx,dy){state.yaw=Math.max(-.78,Math.min(.78,state.yaw+dx));state.pitch=Math.max(-.28,Math.min(.38,state.pitch+dy));requestRender();}
canvas.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});});
canvas.addEventListener('pointermove',e=>{if(!dragging)return;aim((e.clientX-lastX)*.0035,(e.clientY-lastY)*.0025);lastX=e.clientX;lastY=e.clientY;});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>dragging=false);
canvas.addEventListener('keydown',e=>{const moves={ArrowLeft:[-.035,0],ArrowRight:[.035,0],ArrowUp:[0,.025],ArrowDown:[0,-.025]};if(moves[e.key]){e.preventDefault();aim(...moves[e.key]);}else if(e.key.toLowerCase()==='r'){e.preventDefault();resetView();}});
function resetView(){state.yaw=initial.yaw;state.pitch=initial.pitch;requestRender();}
function fill(input){input.style.setProperty('--fill',((+input.value-+input.min)/(+input.max-+input.min)*100)+'%');}
for(const [id,key,out,scale,format] of [['depth','depth','dV',100,v=>v.toFixed(1)+' m'],['grid','grid','gV',1,v=>v+' bays'],['reflStr','refl','rV',100,v=>Math.round(v*100)+'%'],['dustStr','dust','duV',100,v=>Math.round(v*100)+'%']]){
 const input=$(id);fill(input);input.addEventListener('input',()=>{state[key]=+input.value/scale;$(out).textContent=format(state[key]);fill(input);requestRender();});
}
for(const [id,key] of [['bRefl','reflOn'],['bDust','dustOn']])$(id).addEventListener('click',()=>{state[key]=!state[key];$(id).setAttribute('aria-checked',String(state[key]));requestRender();});
$('bReset').addEventListener('click',resetView);
$('bShuffle').addEventListener('click',()=>{previousSeed=state.seed;nextSeed+=13;currentSeed=nextSeed;state.seed=currentSeed;$('bCompare').disabled=false;$('bCompare').setAttribute('aria-pressed','false');$('announce').textContent='새 실내 구성을 만들었습니다. 이전 구성과 비교할 수 있어요.';requestRender();});
$('bCompare').addEventListener('click',()=>{if(previousSeed===null)return;const compare=$('bCompare').getAttribute('aria-pressed')!=='true';state.seed=compare?previousSeed:currentSeed;$('bCompare').setAttribute('aria-pressed',String(compare));$('announce').textContent=compare?'이전 실내 구성입니다. 다시 누르면 새 구성으로 돌아갑니다.':'새 실내 구성입니다.';requestRender();});
$('bMode').addEventListener('click',()=>{state.mode=1-state.mode;$('bMode').setAttribute('aria-pressed',String(!!state.mode));$('bMode').textContent=state.mode?'재질 보기':'면 구분 보기';$('legend').classList.toggle('visible',!!state.mode);requestRender();});
const lights={day:{value:1,label:'DAYLIGHT'},dusk:{value:.34,label:'BLUE HOUR'},night:{value:.035,label:'AFTER DARK'}};
function showLight(key){$('sceneName').textContent=lights[key].label;for(const button of document.querySelectorAll('[data-light]'))button.setAttribute('aria-pressed',String(button.dataset.light===key));}
for(const button of document.querySelectorAll('[data-light]'))button.addEventListener('click',()=>{state.day=lights[button.dataset.light].value;showLight(button.dataset.light);requestRender();});

// ---- auto tour: a slow look around while the light cycles, until the visitor takes over.
// It never starts by itself under prefers-reduced-motion, and it draws nothing while the canvas is off screen or the tab is hidden.
const TOUR_LIGHTS=[[0,'dusk'],[9,'night'],[18,'day'],[27,'dusk']],TOUR_PERIOD=36,EASE_IN=1.6,LIGHT_EASE=1.8;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const hintText=$('canvasHint').textContent;
let touring=false,tourFrame=0,tourStart=0,tourBeat=-1,pausedAt=0,onScreen=true,from={yaw:0,pitch:0},dayFrom=state.day,dayTo=state.day,dayAt=0;
function tourButton(){$('bTour').setAttribute('aria-pressed',String(touring));$('bTour').textContent=touring?'자동 둘러보기 ❚❚':'자동 둘러보기 ▶';$('canvasHint').textContent=touring?'자동 둘러보기 중 · 드래그하거나 조절하면 멈춥니다':hintText;}
function tourTick(now){
 tourFrame=0;if(!touring)return;
 if(!onScreen||document.hidden){pausedAt=pausedAt||now;return;}
 if(pausedAt){tourStart+=now-pausedAt;dayAt+=now-pausedAt;pausedAt=0;}
 const t=(now-tourStart)/1000,w=smooth(t/EASE_IN);
 state.yaw=from.yaw+(initial.yaw+.46*Math.sin(t*Math.PI*2/18)-from.yaw)*w;
 state.pitch=from.pitch+(initial.pitch+.07*Math.sin(t*Math.PI*2/27)-from.pitch)*w;
 const phase=t%TOUR_PERIOD;let beat=0;TOUR_LIGHTS.forEach(([at],i)=>{if(phase>=at)beat=i;});
 if(beat!==tourBeat){tourBeat=beat;const key=TOUR_LIGHTS[beat][1];dayFrom=state.day;dayTo=lights[key].value;dayAt=now;showLight(key);}
 state.day=dayFrom+(dayTo-dayFrom)*smooth((now-dayAt)/1000/LIGHT_EASE);
 render();tourFrame=requestAnimationFrame(tourTick);
}
function startTour(){if(touring||!gl)return;touring=true;tourStart=performance.now();tourBeat=-1;pausedAt=0;from={yaw:state.yaw,pitch:state.pitch};tourButton();tourFrame=requestAnimationFrame(tourTick);}
function stopTour(){if(!touring)return;touring=false;cancelAnimationFrame(tourFrame);tourFrame=0;state.day=dayTo;tourButton();requestRender();}
function resumeTour(){if(touring&&!tourFrame)tourFrame=requestAnimationFrame(tourTick);}
$('bTour').addEventListener('click',()=>touring?stopTour():startTour());
// Any hand on the canvas or the controls ends the tour; the visitor's change then applies to a still scene.
canvas.addEventListener('pointerdown',stopTour,true);canvas.addEventListener('keydown',stopTour,true);
for(const event of ['pointerdown','keydown'])$('controlsPanel').addEventListener(event,stopTour,true);
new IntersectionObserver(entries=>{onScreen=entries[0].isIntersecting;if(onScreen)resumeTour();}).observe(canvas);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(pending)cancelAnimationFrame(pending);pending=0;fail('그래픽 연결이 잠시 끊겼어요. 다시 시도하면 미리보기를 복구합니다.');});
canvas.addEventListener('webglcontextrestored',init);$('retry').addEventListener('click',()=>location.reload());
new ResizeObserver(resize).observe(canvas);document.addEventListener('visibilitychange',()=>{if(!document.hidden){requestRender();resumeTour();}});
init();
if(gl&&program){$('bTour').hidden=false;tourButton();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)startTour();}
initSourcePanel(shaders);
