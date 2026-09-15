import * as THREE from 'three';
import {createWeatheringLight} from './weathering-light.mjs?v=16b4749fea62';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EFFECTS, DEFAULT_STATE, CONTACT_MODES, getEffectUniforms} from './weathering-model.mjs?v=f81b724df54d';
import {createWeatherMaterial} from './weathering-surface.mjs?v=80cf0707d10e';
import {createWeatheringCamera} from './weathering-camera.mjs?v=1e8bb4de4be8';
import {createWeatheringBox as roundedBox} from './weathering-geometry.mjs?v=e3aca10313dd';

const $ = id => document.getElementById(id);
const canvas = $('weather-canvas'), stage = $('weather-stage');
const CASE_COLOR='#3b4d5b';
const state = {...DEFAULT_STATE,effects:{...DEFAULT_STATE.effects}};
let renderer, scene, camera, controls, cameraMotion, lightMotion, frame=0, disposed=false, visible=true;
let width=0, height=0, pixelRatio=0, selectedPoint='top', split=50;
const meshes=[], materials=[], resources=[], surfaceDetails=[];
const markerRay=new THREE.Raycaster();
const shared={
  uRunoff:{value:0},uRust:{value:0},uMoss:{value:0},
  uDust:{value:0},uWear:{value:0},uContact:{value:0},
  uHeuristic:{value:0},uMaskView:{value:0},uLayer:{value:0},uPlastic:{value:0},uCoatColor:{value:new THREE.Color(CASE_COLOR)}
};
const observationPoints={
  top:{point:[-.77,.982,.22],normal:[0,1,0],part:1,index:'01'},
  handle:{point:[0,1.19,.102],normal:[0,0,1],part:2,index:'02'},
  edge:{point:[1.29849,.94849,.69849],normal:[.57735,.57735,.57735],part:1,index:'03'},
  base:{point:[.95,-.772,.44],normal:[0,-1,0],part:0,index:'04'},
  runoff:{point:[-.89,-.10,.65],normal:[0,0,1],part:0,index:'05'}
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
  for(const x of [-.89,.89]){
    addPart('잠금장치',[x,.62,.707],[.105,.20,.041],4,{radius:.022,hardware:true});
    addPart('잠금장치 축',[x,.65,.758],[.124,.037,.029],4,{radius:.018,hardware:true});
  }
  for(const z of [-.666,.666])for(const x of [-.78,0,.78])addPart('보강 리브',[x,-.14,z],[.034,.36,.025],4,{radius:.018});
  // Narrow gasket and badge are physical geometry, separate from the weather masks.
  const gasket=new THREE.Mesh(roundedBox([1.265,.018,.665],.012),new THREE.MeshStandardMaterial({color:'#161b18',roughness:.89}));
  gasket.position.y=.767;scene.add(gasket);surfaceDetails.push(gasket);resources.push(gasket.geometry,gasket.material);
  const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=160;
  const ctx=labelCanvas.getContext('2d');ctx.fillStyle='#27302b';ctx.fillRect(0,0,512,160);
  ctx.strokeStyle='#798579';ctx.lineWidth=3;ctx.strokeRect(5,5,502,150);ctx.fillStyle='#d8d9c7';ctx.font='22px monospace';ctx.fillText('P E N U M B R A',26,45);
  ctx.font='bold 37px monospace';ctx.fillText('FIELD / 07',26,98);ctx.font='15px monospace';ctx.fillStyle='#a6ad9e';ctx.fillText('SURFACE OBSERVATION SPECIMEN',26,132);
  const texture=new THREE.CanvasTexture(labelCanvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
  const badge=new THREE.Mesh(new THREE.PlaneGeometry(.62,.194),new THREE.MeshStandardMaterial({map:texture,roughness:.73}));badge.position.set(.40,.32,.653);scene.add(badge);surfaceDetails.push(badge);resources.push(texture,badge.geometry,badge.material);
  // A transparent contact shadow, with no opaque floor to block the underside.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=256;shadowCanvas.height=256;
  const sx=shadowCanvas.getContext('2d'),grad=sx.createRadialGradient(128,128,12,128,128,127);grad.addColorStop(0,'rgba(0,0,0,.65)');grad.addColorStop(.5,'rgba(0,0,0,.28)');grad.addColorStop(1,'rgba(0,0,0,0)');sx.fillStyle=grad;sx.fillRect(0,0,256,256);
  const shadowTexture=new THREE.CanvasTexture(shadowCanvas),shadow=new THREE.Mesh(new THREE.PlaneGeometry(5.2,3.7),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.785;scene.add(shadow);surfaceDetails.push(shadow);resources.push(shadowTexture,shadow.geometry,shadow.material);
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
  resize();const moving=cameraMotion?.update(now);controls.update();cameraMotion?.constrain();lightMotion?.update();
  $('compare-handle').style.marginLeft=Math.max(24-width*split/100,Math.min(0,width*(1-split/100)-24))+'px';
  renderer.setScissorTest(false);renderer.setViewport(0,0,width,height);
  shared.uHeuristic.value=0;
  if(state.compare){
    const boundary=Math.round(width*split/100);renderer.setScissorTest(true);
    if(boundary>0){renderer.setScissor(0,0,boundary,height);shared.uHeuristic.value=1;renderer.render(scene,camera);}
    if(boundary<width){renderer.setScissor(boundary,0,width-boundary,height);shared.uHeuristic.value=0;renderer.render(scene,camera);}
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
  $('point-marker').hidden=state.view!=='surface'||!facing||blocked||v.z>1||v.z< -1||Math.abs(v.x)>.92||Math.abs(v.y)>.8;
  $('point-marker').style.left=(v.x*.5+.5)*width+'px';$('point-marker').style.top=(-v.y*.5+.5)*height+'px';$('point-marker').querySelector('b').textContent=o.index;
}
function effectEnabled(id){return Boolean(state.effects[id])&&!(id==='rust'&&state.material==='plastic');}
function selectedEffects(){return Object.keys(EFFECTS).filter(effectEnabled);}
function observe(){
  const point=selectedPoint,active=selectedEffects(),has=id=>effectEnabled(id)&&state[id]>0;
  const titles={top:'먼지가 내려앉는 면',handle:'손이 반복해서 닿은 자리',edge:'세 면으로 퍼지는 꼭짓점 마모',base:'바닥에 닿은 아랫면의 흔적',runoff:'위에서 흘러온 물길'};
  const texts={
    top:has('dust')?'위쪽에 내려앉은 먼지가 곡면을 따라 아래로 갈수록 옅어지는 모습을 살펴보세요.':has('moss')?'오래 젖은 표면에 이끼가 자리 잡은 모습이에요. 군락 사이에 남은 표면과 가늘게 갈라지는 가장자리를 살펴보세요.':'먼지나 이끼를 켜고 윗면과 아랫면에 남는 흔적을 비교해보세요.',
    handle:state.contact==='handle'?(has('wear')?'손으로 반복해서 잡는 부위예요. 마모량을 바꾸며 가는 긁힘과 문질린 광택을 살펴보세요.':'마모를 켜면 손으로 반복해서 잡은 부위에 긁힘과 광택 변화가 남아요.'):'손잡이의 마찰을 보려면 ‘주로 닿는 곳’을 손잡이로 바꿔보세요.',
    edge:state.contact==='edges'?(has('wear')?'앞쪽 오른 위 꼭짓점에 모인 긁힘이 윗면·앞면·오른쪽 면으로 퍼지고, 아래로 갈수록 듬성해져요. 조명 핸들을 움직여 세 면에 남은 홈과 밝은 가장자리를 살펴보세요.':'마모를 켜면 앞쪽 오른 위 꼭짓점을 중심으로 세 면에 긁힘이 모여요.'):'꼭짓점의 마찰을 보려면 ‘주로 닿는 곳’을 앞쪽 오른 위 꼭짓점으로 바꿔보세요.',
    base:state.contact==='base'?(has('wear')?'케이스를 뒤집어 몸체의 아랫면을 보세요. 바닥에 끌리는 모서리를 따라 마모가 모여요.':'마모를 켜면 바닥에 끌리는 아랫면에 흔적이 남아요.'):'아랫면의 마찰을 보려면 ‘주로 닿는 곳’을 바닥에 끌리는 아랫면으로 바꿔보세요.',
    runoff:has('runoff')?(has('dust')?'이음새 아래의 침착막과 흘러내린 가는 자국을 살펴보세요. 먼지를 씻어 간 자리와 아래에 옮겨 쌓은 자리가 달라요.':'먼지와 함께 켜면 씻김과 이동 흔적을 볼 수 있어요.'):'빗물 흐름을 켜고 먼지와 조합해 씻기기 전과 후를 비교해보세요.'
  };
  let title=titles[point],description=texts[point];
  if(point==='edge'&&has('rust')){
    title='벗겨진 강철에 남은 녹';
    description='녹 효과는 도막 손상과 반복된 수분 노출을 함께 표현해요. 밝은 새 철과 거칠게 산화된 부분을 비교해보세요.';
  }
  if(!active.length){title='깨끗한 표면부터 시작해요';description='위의 효과를 하나씩 켜거나 여러 개를 함께 켜서 표면의 변화를 비교해보세요.';}
  if(state.view!=='surface'){
    const inspected=state.inspect==='all'?'선택한 효과 전체':EFFECTS[state.inspect].label;
    title=inspected+(state.view==='layers'?' · 색상 레이어':' · 흑백 마스크');
    description=state.view==='layers'?'각 효과가 닿는 곳을 범례의 고유 색으로 보여줘요. 효과를 겹쳐 켜고, 관찰할 레이어를 골라 분포를 살펴보세요.':'검정은 영향 없음, 흰색은 강한 영향, 회색은 중간값이에요. 관찰할 레이어를 바꾸어도 켜 둔 효과의 조합은 유지돼요.';
    if(state.inspect!=='all'&&!has(state.inspect))description=state.inspect==='rust'&&state.material==='plastic'?'플라스틱에는 녹이 생기지 않아 이 레이어는 비어 있어요.':EFFECTS[state.inspect].label+' 효과가 꺼져 있거나 강도가 0이라 이 레이어는 비어 있어요. 위에서 효과를 켜고 강도를 조절해보세요.';
  }
  $('observation-title').textContent=title;$('observation-text').textContent=description;
  $('lab-status').textContent=(active.length?active.map(id=>EFFECTS[id].label).join(' + '):'효과 없음')+' · '+({surface:'표면 보기',layers:'색상 레이어',mask:'흑백 마스크'}[state.view])+(state.view!=='surface'&&state.inspect!=='all'?' · '+EFFECTS[state.inspect].label:'')+(state.compare?' · 배치 규칙 비교':'');
}
function sync(){
  for(const id of Object.keys(EFFECTS)){
    const input=$(id);input.value=Math.round(state[id]*100);input.disabled=!effectEnabled(id);
    input.style.setProperty('--fill',((+input.value-+input.min)/(+input.max-+input.min)*100)+'%');
    $(id+'-value').textContent=Math.round(state[id]*100);
  }
  const diagnostic=state.view!=='surface';
  $('layer-tools').hidden=!diagnostic;$('inspect-layer').value=state.inspect;
  $('layer-legend').hidden=state.view!=='layers';$('mask-legend').hidden=state.view!=='mask';
  stage.dataset.mask=String(diagnostic);
  shared.uMaskView.value={surface:0,mask:1,layers:2}[state.view];
  shared.uLayer.value=diagnostic?{all:7,dust:1,wear:2,rust:4,moss:5,runoff:6}[state.inspect]:0;
  surfaceDetails.forEach(mesh=>mesh.visible=!diagnostic);lightMotion.setMaskMode(diagnostic);
  $('material').value=state.material;$('contact').value=state.contact;
  $('material-label').textContent=state.material==='paint'?'PAINTED STEEL':'SOLID PLASTIC';
  $('material-note').textContent=state.material==='paint'?'도막이 닳으면 아래 금속이 드러납니다.':'가는 스크래치와 밝은 가장자리, 문질린 광택이 남습니다. 플라스틱에는 녹이 생기지 않아요.';
  const active=selectedEffects();
  let history=active.length?active.map(id=>EFFECTS[id].label).join(' + ')+' 효과를 함께 적용하고 있어요. 버튼을 다시 누르면 해당 효과만 꺼집니다.':'선택한 효과가 없어요. 위에서 효과를 눌러 하나씩 또는 여러 개를 함께 적용해보세요.';
  if(active.length===1)history=EFFECTS[active[0]].label+' 효과를 적용하고 있어요. 다른 효과를 함께 켜서 조합할 수 있어요.';
  if(effectEnabled('runoff')&&!effectEnabled('dust'))history+=' 먼지와 함께 켜면 씻김과 이동 흔적을 볼 수 있어요.';
  if(state.material==='plastic'&&state.effects.rust)history+=' 녹 선택은 기억하고 있어요. 도장한 강철로 돌아가면 다시 적용됩니다.';
  $('history-note').textContent=history;
  document.querySelectorAll('[data-effect]').forEach(button=>{
    const id=button.dataset.effect,unavailable=id==='rust'&&state.material==='plastic';
    button.setAttribute('aria-pressed',String(Boolean(state.effects[id])));button.disabled=unavailable;
    button.title=unavailable?'플라스틱에는 녹이 생기지 않아요. 강철로 바꾸면 이전 선택이 복원됩니다.':EFFECTS[id].description;
    const status=button.querySelector('.effect-state');if(status)status.textContent=unavailable?'사용 불가':state.effects[id]?'켜짐':'꺼짐';
  });
  document.querySelectorAll('button[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===state.view)));
  document.querySelectorAll('[data-legend]').forEach(item=>{
    const id=item.dataset.legend,active=effectEnabled(id)&&state[id]>0;
    item.dataset.active=String(active);item.setAttribute('aria-disabled',String(!active));
  });
  document.querySelectorAll('[data-point]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.point===selectedPoint)));
  $('comparison-note').textContent='같은 효과 조합에서 왼쪽은 형태만으로, 오른쪽은 침착과 접촉 위치를 반영해 흔적을 배치해요.';
  $('compare').setAttribute('aria-pressed',String(state.compare));
  for(const id of ['compare-labels','compare-line','compare-scrub'])$(id).hidden=!state.compare;
  for(const [name,value] of Object.entries(getEffectUniforms(state)))shared[name].value=value;
  shared.uContact.value=CONTACT_MODES[state.contact];shared.uPlastic.value=state.material==='plastic'?1:0;
  observe();invalidate();
}
function resetView(){cameraMotion.reset();}
function focusObservation(name){
  cameraMotion.focus(name);
  if(getComputedStyle(stage).position==='sticky')return;
  const bounds=stage.getBoundingClientRect(),header=document.querySelector('.site-header').getBoundingClientRect();
  if(bounds.top<header.bottom||bounds.bottom>innerHeight)stage.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
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
  document.querySelectorAll('[data-effect]').forEach(button=>button.addEventListener('click',()=>{
    const id=button.dataset.effect;if(button.disabled)return;
    state.effects[id]=!state.effects[id];
    if(state.effects[id]&&state[id]===0)state[id]=EFFECTS[id].amount;
    sync();
  }));
  document.querySelectorAll('button[data-view]').forEach(button=>button.addEventListener('click',()=>{state.view=button.dataset.view;sync();}));
  $('inspect-layer').addEventListener('change',()=>{state.inspect=$('inspect-layer').value;sync();});
  document.querySelectorAll('[data-point]').forEach(b=>b.addEventListener('click',()=>{selectedPoint=b.dataset.point;sync();focusObservation(selectedPoint);}));
  for(const id of Object.keys(EFFECTS))$(id).addEventListener('input',()=>{state[id]=+$(id).value/100;sync();});
  $('contact').addEventListener('change',()=>{state.contact=$('contact').value;selectedPoint={handle:'handle',edges:'edge',base:'base'}[state.contact];sync();focusObservation(selectedPoint);});
  $('material').addEventListener('change',()=>{state.material=$('material').value;sync();});
  $('compare').addEventListener('click',()=>{state.compare=!state.compare;sync();});
  $('comparison').addEventListener('input',()=>updateSplit(+$('comparison').value));
  const handle=$('compare-handle');
  handle.addEventListener('pointerdown',event=>{if(event.button!==0)return;handle.setPointerCapture(event.pointerId);event.preventDefault();});
  handle.addEventListener('pointermove',event=>{if(!handle.hasPointerCapture(event.pointerId))return;const bounds=stage.getBoundingClientRect();updateSplit((event.clientX-bounds.left)/bounds.width*100);});
  handle.addEventListener('pointerup',event=>{if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);});
  handle.addEventListener('keydown',event=>{const changes={ArrowLeft:-1,ArrowDown:-1,ArrowRight:1,ArrowUp:1,PageDown:-10,PageUp:10};if(event.key in changes){event.preventDefault();updateSplit(split+changes[event.key]);}else if(event.key==='Home'||event.key==='End'){event.preventDefault();updateSplit(event.key==='Home'?0:100);}});
  $('reset-view').addEventListener('click',resetView);
  $('reset-all').addEventListener('click',()=>{Object.assign(state,DEFAULT_STATE,{effects:{...DEFAULT_STATE.effects}});selectedPoint='top';lightMotion.reset();updateSplit(50);sync();resetView();});
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
    if((kind===0||kind===1)&&hit.point.x>1.1&&hit.point.z>.55&&hit.point.y>.75)selectedPoint='edge';else if(kind===2)selectedPoint='handle';else if(kind===1)selectedPoint='top';else if(kind===0&&hit.point.y<-.69)selectedPoint='base';else if(kind===0&&hit.point.z>.60&&Math.abs(Math.abs(hit.point.x)-.89)<.16&&hit.point.y<.45)selectedPoint='runoff';else return;sync();focusObservation(selectedPoint);
  });
}
function init(){
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(35,1,.1,60);controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.12;controls.minDistance=3.7;controls.maxDistance=10;controls.enablePan=false;controls.addEventListener('change',invalidate);
  cameraMotion=createWeatheringCamera({camera,controls,stage,invalidate,onViewChange:name=>{stage.dataset.view=name;$('view-help').textContent=name==='overview'?'드래그 회전 · 스크롤 확대':({top:'윗면',handle:'손잡이',edge:'위 꼭짓점',base:'아랫면',runoff:'물길'}[name]+' 확대 · 드래그 회전');}});
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(renderer),env=pmrem.fromScene(room,.04);scene.environment=env.texture;resources.push(env);room.dispose();pmrem.dispose();
  const key=new THREE.DirectionalLight(0xfff6e4,1.8);key.position.set(-4.5,4,5.5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-2.4,right:2.4,top:2.4,bottom:-2.4,near:.1,far:16});key.shadow.normalBias=.022;key.shadow.bias=-.0003;scene.add(key,key.target);
  const fill=new THREE.DirectionalLight(0xbccada,.65);fill.position.set(4,1,-3);scene.add(fill);scene.add(new THREE.HemisphereLight(0xe5e7df,0x33382f,.4));
  buildCase();renderer.shadowMap.needsUpdate=true;cameraMotion.reset({animate:false});
  lightMotion=createWeatheringLight({camera,controls,stage,light:key,handle:$('light-handle'),resetButton:$('reset-light'),output:$('light-position'),note:$('light-note'),invalidate,onStart:()=>cameraMotion.cancel(),onLightChange:()=>{renderer.shadowMap.needsUpdate=true;}});
  installUI();sync();
  const observer=new ResizeObserver(invalidate);observer.observe(stage);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)invalidate();else if(frame){cancelAnimationFrame(frame);frame=0;}});intersection.observe(stage);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0;}else invalidate();});window.addEventListener('resize',invalidate);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lightMotion.setMaskMode(true);disposed=true;if(frame)cancelAnimationFrame(frame);$('render-error').hidden=false;});
  window.addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();cameraMotion.dispose();lightMotion.dispose();controls.dispose();for(const mesh of meshes)mesh.geometry.dispose();for(const resource of [...materials,...resources])resource.dispose();renderer.dispose();},{once:true});
  // Keep the newly selected lab discoverable in the shared mobile nav's overflow.
  const active=document.querySelector('.lab-navigation [aria-current="page"]');
  if(active)active.parentElement.scrollLeft=Math.max(0,active.offsetLeft-active.parentElement.offsetLeft-active.parentElement.clientWidth+active.offsetWidth+18);
}
$('retry').addEventListener('click',()=>location.reload());
try{init();}catch(error){console.error('Weathering Lab initialization failed',error);$('render-error').hidden=false;}
