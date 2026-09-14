import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {PRESETS, DEFAULT_STATE, CONTACT_MODES} from './weathering-model.mjs?v=fcd8c5bc1129';
import {createWeatherMaterial} from './weathering-surface.mjs?v=28f7372f93be';
import {createWeatheringCamera} from './weathering-camera.mjs?v=b6dc9a5ca0b0';
import {createWeatheringBox as roundedBox} from './weathering-geometry.mjs?v=e3aca10313dd';

const $ = id => document.getElementById(id);
const canvas = $('weather-canvas'), stage = $('weather-stage');
const DEFAULT_COAT='#26333b';
const state = {...DEFAULT_STATE, layer:'surface', compare:false, material:'paint',coatColor:DEFAULT_COAT};
let renderer, scene, camera, controls, cameraMotion, frame=0, disposed=false, visible=true;
let width=0, height=0, pixelRatio=0, selectedPoint='top', split=50;
const meshes=[], materials=[], resources=[], dustArrows=[];
const markerRay=new THREE.Raycaster();
const shared={
  uDust:{value:0},uWear:{value:0},uWind:{value:0},uContact:{value:0},
  uHeuristic:{value:0},uLayer:{value:0},uPlastic:{value:0},uCoatColor:{value:new THREE.Color(DEFAULT_COAT)}
};
const observationPoints={
  top:{point:[-.77,.982,.22],normal:[0,1,0],part:1,index:'01'},
  handle:{point:[0,1.19,.102],normal:[0,0,1],part:2,index:'02'},
  edge:{point:[1.23,-.10,.64],normal:[.707,0,.707],part:0,index:'03'},
  base:{point:[1,-.952,.48],normal:[0,-1,0],part:3,index:'04'}
};
function weatherMaterial(center,half,kind,hardware=false){
  const material=createWeatherMaterial({center,half,kind,hardware,uniforms:shared});
  materials.push(material);return material;
}

function addPart(name,center,half,kind,{radius=.055,hardware=false,geometry}={}){
  const mesh=new THREE.Mesh(geometry||roundedBox(half,Math.min(radius,...half.map(x=>x*.75))),weatherMaterial(center,half,kind,hardware));
  mesh.position.set(...center);mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.userData={name,kind,center,half};scene.add(mesh);meshes.push(mesh);return mesh;
}
function buildCase(){
  addPart('몸체',[0,0,0],[1.25,.77,.65],0,{radius:.075});
  addPart('뚜껑',[0,.87,0],[1.32,.10,.72],1,{radius:.055});
  addPart('손잡이',[0,1.19,0],[.53,.09,.09],2,{radius:.065});
  for(const x of [-.44,.44])addPart('손잡이 지지대',[x,1.055,0],[.065,.135,.085],2,{radius:.04});
  for(const x of [-1,1])for(const z of [-.48,.48])addPart('받침',[x,-.86,z],[.18,.09,.18],3,{radius:.05});
  for(const x of [-.89,.89]){
    addPart('잠금장치',[x,.62,.707],[.105,.20,.041],4,{radius:.022,hardware:true});
    addPart('잠금장치 축',[x,.65,.758],[.124,.037,.029],4,{radius:.018,hardware:true});
  }
  for(const z of [-.666,.666])for(const x of [-.78,0,.78])addPart('보강 리브',[x,-.14,z],[.034,.36,.025],4,{radius:.018});
  // Narrow gasket and badge are physical geometry, separate from the weather masks.
  const gasket=new THREE.Mesh(roundedBox([1.265,.018,.665],.012),new THREE.MeshStandardMaterial({color:'#161b18',roughness:.89}));
  gasket.position.y=.767;scene.add(gasket);resources.push(gasket.geometry,gasket.material);
  const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=160;
  const ctx=labelCanvas.getContext('2d');ctx.fillStyle='#27302b';ctx.fillRect(0,0,512,160);
  ctx.strokeStyle='#798579';ctx.lineWidth=3;ctx.strokeRect(5,5,502,150);ctx.fillStyle='#d8d9c7';ctx.font='22px monospace';ctx.fillText('P E N U M B R A',26,45);
  ctx.font='bold 37px monospace';ctx.fillText('FIELD / 07',26,98);ctx.font='15px monospace';ctx.fillStyle='#a6ad9e';ctx.fillText('SURFACE OBSERVATION SPECIMEN',26,132);
  const texture=new THREE.CanvasTexture(labelCanvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
  const badge=new THREE.Mesh(new THREE.PlaneGeometry(.62,.194),new THREE.MeshStandardMaterial({map:texture,roughness:.73}));badge.position.set(.40,.32,.653);scene.add(badge);resources.push(texture,badge.geometry,badge.material);
  // A transparent contact shadow, with no opaque floor to block the underside.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=256;shadowCanvas.height=256;
  const sx=shadowCanvas.getContext('2d'),grad=sx.createRadialGradient(128,128,12,128,128,127);grad.addColorStop(0,'rgba(0,0,0,.65)');grad.addColorStop(.5,'rgba(0,0,0,.28)');grad.addColorStop(1,'rgba(0,0,0,0)');sx.fillStyle=grad;sx.fillRect(0,0,256,256);
  const shadowTexture=new THREE.CanvasTexture(shadowCanvas),shadow=new THREE.Mesh(new THREE.PlaneGeometry(5.2,3.7),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.965;scene.add(shadow);resources.push(shadowTexture,shadow.geometry,shadow.material);
}
function invalidate(){if(!frame&&!disposed&&visible&&!document.hidden)frame=requestAnimationFrame(render);}
function resize(){
  const w=stage.clientWidth,h=stage.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);
  if(!w||!h)return;
  if(w===width&&h===height&&dpr===pixelRatio)return;
  width=w;height=h;pixelRatio=dpr;renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
function render(now){
  frame=0;if(disposed||!visible||document.hidden)return;
  resize();const moving=cameraMotion?.update(now);controls.update();cameraMotion?.constrain();
  $('compare-handle').style.marginLeft=Math.max(24-width*split/100,Math.min(0,width*(1-split/100)-24))+'px';
  renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);
  shared.uHeuristic.value=0;
  if(state.compare){
    const boundary=Math.round(width*split/100);renderer.setScissorTest(true);
    if(boundary>0){renderer.setScissor(0,0,boundary,height);shared.uHeuristic.value=1;dustArrows.forEach(a=>a.visible=false);renderer.render(scene,camera);}
    if(boundary<width){renderer.setScissor(boundary,0,width-boundary,height);shared.uHeuristic.value=0;dustArrows.forEach(a=>a.visible=state.layer==='dust'&&state.dust>0);renderer.render(scene,camera);}
    renderer.setScissorTest(false);
  }else renderer.render(scene,camera);
  shared.uHeuristic.value=0;updateMarker();if(moving)invalidate();
}
function updateMarker(){
  const o=observationPoints[selectedPoint],p=new THREE.Vector3(...o.point),v=p.clone().project(camera);
  const facing=new THREE.Vector3(...o.normal).dot(camera.position.clone().sub(p))>0;
  markerRay.set(camera.position,p.clone().sub(camera.position).normalize());
  const occluder=markerRay.intersectObjects(meshes,false)[0];
  const blocked=occluder&&occluder.distance<camera.position.distanceTo(p)-.025;
  $('point-marker').hidden=!facing||blocked||v.z>1||v.z< -1||Math.abs(v.x)>.92||Math.abs(v.y)>.8;
  $('point-marker').style.left=(v.x*.5+.5)*width+'px';$('point-marker').style.top=(-v.y*.5+.5)*height+'px';$('point-marker').querySelector('b').textContent=o.index;
}
function observe(){
  const mode=state.layer,point=selectedPoint;
  const titles={top:'먼지가 도착할 수 있는 면',handle:'형태보다 사용이 남기는 흔적',edge:'모든 모서리가 닳지는 않아요',base:'바닥과 맞닿는 곳의 흔적'};
  const texts={
    top:state.dust===0?'먼지 쌓임이 0이라 지금은 침착 흔적이 없어요. 쌓임을 올리고 윗면과 아랫면을 비교해보세요.':Math.abs(state.wind)>.15?'먼지가 비스듬히 유입되는 조건이에요. 방향을 반대로 바꾸고, 두 옆면과 뚜껑 아래의 차이를 관찰하세요.':'덮개 없이 둔 케이스의 위쪽에 먼지가 내려앉는 조건이에요. 아래쪽을 돌려 보면 같은 양으로 쌓이지 않아요.',
    handle:state.contact==='handle'?'손으로 반복해서 잡는 부위예요. 마모를 올리면 도장 또는 플라스틱 표면이 닳고, 느슨한 먼지도 닦여요.':'지금은 손잡이를 주된 접촉 부위로 정하지 않았어요. ‘주로 닿는 곳’을 손잡이로 바꾸고 차이를 확인하세요.',
    edge:state.contact==='edges'?'앞쪽 오른 모서리가 다른 물체에 부딪히는 조건이에요. 다른 모서리까지 같은 강도로 닳는지 비교하세요.':'돌출되어 있다는 이유만으로 모두 벗겨지지 않아요. ‘주로 닿는 곳’을 앞쪽 오른 모서리로 바꿔보세요.',
    base:state.contact==='base'?'케이스를 돌려 받침 아래쪽을 보세요. 바닥에 끌리는 접촉을 지정하면 아래쪽에 마모가 모이고, 윗면은 그대로 남아요.':'지금은 받침에 접촉을 지정하지 않았어요. 바닥과 닿는 흔적은 ‘주로 닿는 곳’을 받침으로 바꿔 관찰할 수 있어요.'
  };
  $('observation-title').textContent=titles[point];
  $('observation-text').textContent=texts[point]+(mode==='dust'?' 황갈색은 현재 조건의 먼지 침착 강도예요.':mode==='wear'?(state.compare?' 왼쪽은 형태로 고른 모서리, 오른쪽은 지정한 접촉 부위를 청록색으로 보여줘요.':' 청록색은 지정한 접촉 부위예요. 실제 마모량은 마모 슬라이더로 조절해요.'):'');
  $('lab-status').textContent=(state.preset?PRESETS[state.preset].label:'직접 조절')+' · '+({surface:'표면 보기',dust:'먼지 원인 보기',wear:'접촉 원인 보기'}[mode])+(state.compare?' · 형태만 적용과 비교':'');
}
function sync(){
  for(const id of ['dust','wear','wind']){
    const input=$(id);input.value=Math.round(state[id]*100);input.style.setProperty('--fill',((+input.value-+input.min)/(+input.max-+input.min)*100)+'%');
    $(id+'-value').textContent=id==='wind'?(Math.abs(state.wind)<.05?'위에서':(state.wind<0?'왼쪽 위 ':'오른쪽 위 ')+Math.round(Math.abs(state.wind)*100)):Math.round(state[id]*100);
  }
  $('material').value=state.material;$('contact').value=state.contact;
  $('coat-color').value=state.coatColor;shared.uCoatColor.value.set(state.coatColor);
  if(document.activeElement!==$('coat-hex')&&!$('coat-hex').hasAttribute('aria-invalid'))$('coat-hex').value=state.coatColor.toUpperCase();
  $('coat-label').textContent=state.material==='paint'?'도장색':'표면 색상';
  document.querySelectorAll('[data-coat]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.coat===state.coatColor)));
  $('material-label').textContent=state.material==='paint'?'PAINTED STEEL':'SOLID PLASTIC';
  $('material-note').textContent=state.material==='paint'?'도막이 닳으면 아래 금속이 드러납니다.':'마찰에 따른 색과 광택 변화입니다. 금속이 드러나지 않아요.';
  $('history-note').textContent=state.preset?PRESETS[state.preset].description:'조건을 직접 조절하고 있어요. 프리셋을 누르면 해당 환경의 값으로 돌아갑니다.';
  document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===state.preset)));
  document.querySelectorAll('[data-layer]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layer===state.layer)));
  document.querySelectorAll('[data-point]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.point===selectedPoint)));
  $('compare').setAttribute('aria-pressed',String(state.compare));
  for(const id of ['compare-labels','compare-line','compare-scrub'])$(id).hidden=!state.compare;
  shared.uDust.value=state.dust;shared.uWear.value=state.wear;shared.uWind.value=state.wind;
  shared.uContact.value=CONTACT_MODES[state.contact];shared.uPlastic.value=state.material==='plastic'?1:0;shared.uLayer.value={surface:0,dust:1,wear:2}[state.layer];
  for(const arrow of dustArrows){arrow.visible=state.layer==='dust'&&state.dust>0;arrow.setDirection(new THREE.Vector3(-state.wind,-1,0).normalize());}
  observe();invalidate();
}
function applyPreset(name){Object.assign(state,PRESETS[name],{preset:name});selectedPoint=name==='handled'?'handle':name==='outdoor'?'edge':'top';sync();}
function resetView(){cameraMotion.reset();}
function focusObservation(name){
  cameraMotion.focus(name);
  if(getComputedStyle(stage).position==='sticky')return;
  const bounds=stage.getBoundingClientRect(),header=document.querySelector('.site-header').getBoundingClientRect();
  if(bounds.top<header.bottom||bounds.bottom>innerHeight)stage.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
function setCoat(value){
  const match=value.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if(!match){$('coat-hex').setAttribute('aria-invalid','true');$('coat-hex').setAttribute('aria-describedby','coat-error');$('coat-error').hidden=false;return;}
  const hex=match[1].length===3?[...match[1]].map(c=>c+c).join(''):match[1];
  state.coatColor='#'+hex.toLowerCase();$('coat-hex').removeAttribute('aria-invalid');$('coat-hex').removeAttribute('aria-describedby');$('coat-error').hidden=true;$('coat-hex').value=state.coatColor.toUpperCase();sync();
}
function updateSplit(value){
  split=Math.round(THREE.MathUtils.clamp(value,0,100));
  $('comparison').value=split;$('comparison-value').textContent=split+'%';$('compare-line').style.left=split+'%';$('comparison').style.setProperty('--fill',split+'%');$('compare-handle').setAttribute('aria-valuenow',split);invalidate();
}
function installUI(){
  // Keyboard focus must not land behind the compact sticky mobile preview.
  document.querySelector('.weather-controls').addEventListener('focusin',event=>{
    if(getComputedStyle(stage).position!=='sticky'||!event.target.matches('input,select'))return;
    if(event.target.getBoundingClientRect().top<stage.getBoundingClientRect().bottom+24)event.target.scrollIntoView({block:'start',behavior:'instant'});
  });
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>applyPreset(b.dataset.preset)));
  document.querySelectorAll('[data-layer]').forEach(b=>b.addEventListener('click',()=>{state.layer=b.dataset.layer;if(state.layer==='wear')selectedPoint={handle:'handle',edges:'edge',base:'base'}[state.contact];if(state.layer==='dust')selectedPoint='top';sync();}));
  document.querySelectorAll('[data-point]').forEach(b=>b.addEventListener('click',()=>{selectedPoint=b.dataset.point;sync();focusObservation(selectedPoint);}));
  document.querySelectorAll('[data-coat]').forEach(b=>b.addEventListener('click',()=>setCoat(b.dataset.coat)));
  $('coat-color').addEventListener('input',()=>setCoat($('coat-color').value));
  $('coat-hex').addEventListener('change',()=>setCoat($('coat-hex').value));
  $('coat-hex').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();setCoat($('coat-hex').value);}});
  for(const id of ['dust','wear','wind'])$(id).addEventListener('input',()=>{state[id]=+$(id).value/100;state.preset='';sync();});
  $('contact').addEventListener('change',()=>{state.contact=$('contact').value;state.preset='';selectedPoint={handle:'handle',edges:'edge',base:'base'}[state.contact];sync();focusObservation(selectedPoint);});
  $('material').addEventListener('change',()=>{state.material=$('material').value;sync();});
  $('compare').addEventListener('click',()=>{state.compare=!state.compare;sync();});
  $('comparison').addEventListener('input',()=>updateSplit(+$('comparison').value));
  const handle=$('compare-handle');
  handle.addEventListener('pointerdown',event=>{if(event.button!==0)return;handle.setPointerCapture(event.pointerId);event.preventDefault();});
  handle.addEventListener('pointermove',event=>{if(!handle.hasPointerCapture(event.pointerId))return;const bounds=stage.getBoundingClientRect();updateSplit((event.clientX-bounds.left)/bounds.width*100);});
  handle.addEventListener('pointerup',event=>{if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);});
  handle.addEventListener('keydown',event=>{const changes={ArrowLeft:-1,ArrowDown:-1,ArrowRight:1,ArrowUp:1,PageDown:-10,PageUp:10};if(event.key in changes){event.preventDefault();updateSplit(split+changes[event.key]);}else if(event.key==='Home'||event.key==='End'){event.preventDefault();updateSplit(event.key==='Home'?0:100);}});
  $('reset-view').addEventListener('click',resetView);
  $('reset-all').addEventListener('click',()=>{Object.assign(state,DEFAULT_STATE,{layer:'surface',compare:false,material:'paint',coatColor:DEFAULT_COAT});$('coat-hex').removeAttribute('aria-invalid');$('coat-hex').removeAttribute('aria-describedby');$('coat-error').hidden=true;selectedPoint='top';updateSplit(50);applyPreset('storage');resetView();});
  canvas.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(event.key))return;
    event.preventDefault();
    if(event.key==='Home'){resetView();return;}
    cameraMotion.cancel();
    const offset=camera.position.clone().sub(controls.target),spherical=new THREE.Spherical().setFromVector3(offset);
    if(event.key==='ArrowLeft')spherical.theta-=.12;if(event.key==='ArrowRight')spherical.theta+=.12;
    if(event.key==='ArrowUp')spherical.phi-=.12;if(event.key==='ArrowDown')spherical.phi+=.12;
    if(event.key==='+'||event.key==='=')spherical.radius*=.9;if(event.key==='-')spherical.radius*=1.1;
    spherical.radius=THREE.MathUtils.clamp(spherical.radius,controls.minDistance,controls.maxDistance);spherical.makeSafe();
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();invalidate();
  });
  // Short taps inspect; an orbit gesture never changes the selected observation.
  let down=null;const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  canvas.addEventListener('pointerdown',e=>{if(down||!e.isPrimary||e.button!==0){down=null;return;}down={x:e.clientX,y:e.clientY,id:e.pointerId,moved:false};});
  canvas.addEventListener('pointermove',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)down.moved=true;});
  canvas.addEventListener('pointercancel',()=>{down=null;});
  canvas.addEventListener('pointerup',e=>{
    if(!down||down.id!==e.pointerId||down.moved||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5){down=null;return;}down=null;
    const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(meshes,false)[0];if(!hit)return;
    const kind=hit.object.userData.kind;
    // Only the named study areas select a marker; a plain face stays unchanged.
    if(kind===2)selectedPoint='handle';else if(kind===1)selectedPoint='top';else if(kind===3)selectedPoint='base';else if(kind===0&&hit.point.x>1&&hit.point.z>.45)selectedPoint='edge';else return;sync();focusObservation(selectedPoint);
  });
}
function init(){
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(35,1,.1,60);controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.12;controls.minDistance=3.7;controls.maxDistance=10;controls.enablePan=false;controls.addEventListener('change',invalidate);
  cameraMotion=createWeatheringCamera({camera,controls,stage,invalidate,onViewChange:name=>{stage.dataset.view=name;$('view-help').textContent=name==='overview'?'드래그 회전 · 스크롤 확대':({top:'윗면',handle:'손잡이',edge:'모서리',base:'받침'}[name]+' 확대 · 드래그 회전');}});
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(renderer),env=pmrem.fromScene(room,.04);scene.environment=env.texture;resources.push(env);room.dispose();pmrem.dispose();
  const key=new THREE.DirectionalLight(0xfff6e4,1.8);key.position.set(-4.5,4,5.5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-2.4,right:2.4,top:2.4,bottom:-2.4,near:.1,far:16});key.shadow.normalBias=.022;key.shadow.bias=-.0003;scene.add(key);
  const fill=new THREE.DirectionalLight(0xbccada,.65);fill.position.set(4,1,-3);scene.add(fill);scene.add(new THREE.HemisphereLight(0xe5e7df,0x33382f,.4));
  for(const x of [-1.05,0,1.05]){const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,-1,0),new THREE.Vector3(x,1.9,.08),.40,0xcab28a,.10,.05);arrow.visible=false;scene.add(arrow);dustArrows.push(arrow);resources.push(arrow.line.geometry,arrow.line.material,arrow.cone.geometry,arrow.cone.material);}
  buildCase();renderer.shadowMap.needsUpdate=true;cameraMotion.reset({animate:false});installUI();applyPreset('storage');
  const observer=new ResizeObserver(invalidate);observer.observe(stage);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)invalidate();else if(frame){cancelAnimationFrame(frame);frame=0;}});intersection.observe(stage);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0;}else invalidate();});window.addEventListener('resize',invalidate);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();disposed=true;if(frame)cancelAnimationFrame(frame);$('render-error').hidden=false;});
  window.addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();cameraMotion.dispose();controls.dispose();for(const mesh of meshes)mesh.geometry.dispose();for(const resource of [...materials,...resources])resource.dispose();renderer.dispose();},{once:true});
  // Keep the newly selected lab discoverable in the shared mobile nav's overflow.
  const active=document.querySelector('.lab-navigation [aria-current="page"]');
  if(active)active.parentElement.scrollLeft=Math.max(0,active.offsetLeft-active.parentElement.offsetLeft-active.parentElement.clientWidth+active.offsetWidth+18);
}
$('retry').addEventListener('click',()=>location.reload());
try{init();}catch(error){console.error('Weathering Lab initialization failed',error);$('render-error').hidden=false;}
