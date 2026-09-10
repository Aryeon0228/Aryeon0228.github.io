import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {TGALoader} from 'three/addons/loaders/TGALoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {presets,presetCategories} from './pbr-presets.mjs';
const $=id=>document.getElementById(id),container=$('canvas-container');
const parameters=['roughness','metallic','specular','clearcoat','clearcoatRoughness','transmission','sheen','sheenRoughness','iridescence','iridescenceIOR','envMapIntensity'];
const envFiles={studio:'studio_small_03_1k.hdr',sunset:'kloofendal_48d_partly_cloudy_puresky_1k.hdr',night:'moonlit_golf_1k.hdr',forest:'forest_slope_1k.hdr',warehouse:'empty_warehouse_01_1k.hdr'};
let scene,camera,renderer,controls,material,mesh,composer,ao,mainLight,fillLight,backLight,ambientLight;
let dirty=true,disposed=false,frame=0,previousTime=0,activeEnvironment,environmentSerial=0,modelSerial=0,normalSerial=0;
let currentPreset='brass';const envCache=new Map(),envTargets=[];
const status=message=>$('pbrStatus').textContent=message;
let pendingLoads=0;const loading=delta=>{pendingLoads=Math.max(0,pendingLoads+delta);$('loading').hidden=pendingLoads===0;};
function fill(input){input.style.setProperty('--fill',((+input.value-+input.min)/(+input.max-+input.min)*100)+'%');}
function updateMaterial(custom=true){
 const v=Object.fromEntries(parameters.map(id=>[id,+$(id).value]));
 material.color.set($('baseColor').value);material.roughness=v.roughness;material.metalness=v.metallic;
 // Three r160 reflectivity is the supported dielectric IOR mapping; avoid assigning it twice.
 material.reflectivity=v.specular;material.specularIntensity=$('iorToggle').checked?1:0;
 material.clearcoat=v.clearcoat;material.clearcoatRoughness=v.clearcoatRoughness;material.transmission=v.transmission;material.thickness=v.transmission>0?.65:0;
 material.sheen=v.sheen;material.sheenRoughness=v.sheenRoughness;material.iridescence=v.iridescence;material.iridescenceIOR=v.iridescenceIOR;material.envMapIntensity=v.envMapIntensity;material.needsUpdate=true;
 for(const id of parameters){const out=$(id==='envMapIntensity'?'envMapValue':id+'Value');if(out)out.textContent=(+$(id).value).toFixed(2);fill($(id));}
 $('colorReading').textContent=$('baseColor').value;$('roughnessReading').textContent=v.roughness.toFixed(2);$('metalReading').textContent=v.metallic.toFixed(2);$('iorReading').textContent=material.ior.toFixed(2);
 if(custom){currentPreset='';$('presetSelect').value='';$('specimenName').textContent='CUSTOM';}
 document.querySelectorAll('[data-preset]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.preset===currentPreset)));
 dirty=true;
}
function updatePresetList(){
 $('presetSelect').replaceChildren(new Option('직접 조절 / 프리셋 선택',''));
 for(const item of presetCategories[$('presetCategory').value]||[])$('presetSelect').add(new Option(item.name,item.id));
}
function applyPreset(name){
 const preset=presets[name];if(!preset)return;
 const category=Object.keys(presetCategories).find(key=>presetCategories[key].some(p=>p.id===name));
 $('presetCategory').value=category;updatePresetList();$('presetSelect').value=name;
 $('baseColor').value=preset.color;
 for(const id of parameters){if(id==='envMapIntensity')continue;$(id).value=id==='transmission'?(['glass','soapBubble'].includes(name)?.94:0):(preset[id]??0);}
 currentPreset=name;$('specimenName').textContent=presetCategories[category].find(p=>p.id===name).name.toUpperCase();updateMaterial(false);status(presetCategories[category].find(p=>p.id===name).name+' · 조명과 거칠기를 바꾸며 비교해보세요.');
}
function disposeGeometry(object){if(!object)return;const geometries=new Set();object.traverse(child=>{if(child.geometry)geometries.add(child.geometry);});geometries.forEach(g=>g.dispose());}
function replaceModel(object,normalize=true){
 if(normalize){
  const box=new THREE.Box3().setFromObject(object),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  const max=Math.max(size.x,size.y,size.z);if(!Number.isFinite(max)||max<=0)throw Error('모델의 크기를 읽을 수 없습니다.');
  const group=new THREE.Group();object.position.sub(center);group.add(object);group.scale.setScalar(2.4/max);group.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(group);group.position.y=-1.2-bounds.min.y;object=group;
 }
 object.traverse(child=>{if(child.isMesh){child.material=material;child.castShadow=true;child.receiveShadow=true;}});
 if(mesh){scene.remove(mesh);disposeGeometry(mesh);}mesh=object;scene.add(mesh);dirty=true;
}
function createGeometry(type){
 const constructors={sphere:()=>new THREE.SphereGeometry(1.2,80,56),torusKnot:()=>new THREE.TorusKnotGeometry(.8,.3,144,32),cube:()=>new THREE.BoxGeometry(1.8,1.8,1.8,4,4,4),cylinder:()=>new THREE.CylinderGeometry(1,1,2,80),cone:()=>new THREE.ConeGeometry(1,2,80),torus:()=>new THREE.TorusGeometry(.9,.4,48,120),icosahedron:()=>new THREE.IcosahedronGeometry(1.2,0),octahedron:()=>new THREE.OctahedronGeometry(1.2,0)};
 replaceModel(new THREE.Mesh((constructors[type]||constructors.sphere)(),material));
}
function updateLighting(){
 const main=+$('mainLight').value,ambient=+$('ambientLight').value;
 mainLight.intensity=main;fillLight.intensity=main*.32;backLight.intensity=main*.48;ambientLight.intensity=ambient;
 $('mainLightValue').textContent=main.toFixed(2);$('ambientLightValue').textContent=ambient.toFixed(2);fill($('mainLight'));fill($('ambientLight'));dirty=true;
}
function setBackground(){scene.background=$('backgroundToggle').checked&&activeEnvironment?.background?activeEnvironment.background:new THREE.Color(0x0b0b0b);scene.backgroundBlurriness=.12;dirty=true;}
async function loadEnvironment(name){
 const serial=++environmentSerial;loading(1);
 try{
  if(!envCache.has(name)){
   envCache.set(name,new RGBELoader().loadAsync('assets/environments/'+envFiles[name]).then(texture=>{
    texture.mapping=THREE.EquirectangularReflectionMapping;
    const generator=new THREE.PMREMGenerator(renderer);const target=generator.fromEquirectangular(texture);generator.dispose();envTargets.push(target);return {texture:target.texture,background:texture};
   }).catch(error=>{envCache.delete(name);throw error;}));
  }
  const environment=await envCache.get(name);if(serial!==environmentSerial||disposed)return;
  activeEnvironment=environment;scene.environment=environment.texture;$('environmentName').textContent=name.toUpperCase();setBackground();status('환경 조명: '+name+' · 재질과 시점 설정은 유지됩니다.');
 }catch(error){if(serial===environmentSerial){console.error(error);status('환경 파일을 불러오지 못해 현재 스튜디오 조명을 유지합니다.');}}
 finally{loading(-1);}
}
function resize(){
 if(!renderer)return;const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);composer?.setSize(w,h);dirty=true;
}
function resetView(){controls.target.set(0,-.05,0);camera.position.set(3.4,1.65,5.2);controls.update();dirty=true;}
function animate(now){
 if(disposed)return;frame=requestAnimationFrame(animate);if(document.hidden){previousTime=now;return;}
 const delta=Math.min(.05,(now-previousTime)/1000||0);previousTime=now;
 if($('autoRotate').checked&&mesh){mesh.rotation.y+=delta*.18;dirty=true;}
 controls.update();if(dirty){composer?composer.render():renderer.render(scene,camera);dirty=false;}
}
function toggleAO(){if(ao)ao.enabled=$('ssaoToggle').checked;dirty=true;}
async function loadCustomModel(input){
 const files=Array.from(input.files||[]),file=files.find(f=>/\.(obj|glb|gltf)$/i.test(f.name));if(!file){status('OBJ, GLB 또는 GLTF 파일을 선택해주세요.');return;}
 const serial=++modelSerial,urls=new Map();const makeURL=file=>{if(!urls.has(file.name))urls.set(file.name,URL.createObjectURL(file));return urls.get(file.name);};
 loading(1);
 try{
  const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{
   if(url.startsWith('blob:')||url.startsWith('data:'))return url;
   const filename=decodeURIComponent(url.split('/').pop()),match=files.find(f=>f.name===filename);
   if(!match)throw Error('함께 선택해야 하는 참조 파일: '+filename);return makeURL(match);
  });
  let object;if(/\.obj$/i.test(file.name))object=new OBJLoader(manager).parse(await file.text());
  else{const result=await new GLTFLoader(manager).loadAsync(makeURL(file));object=result.scene;}
  if(serial!==modelSerial){disposeGeometry(object);return;}
  const oldMaterials=new Set();object.traverse(child=>{if(child.isMesh){for(const m of Array.isArray(child.material)?child.material:[child.material])oldMaterials.add(m);}});
  replaceModel(object);oldMaterials.forEach(m=>{for(const value of Object.values(m))if(value?.isTexture)value.dispose();m.dispose();});
  status(file.name+' · 현재 재질을 적용했습니다.');$('specimenName').textContent=file.name;dirty=true;
 }catch(error){console.error(error);status('모델을 읽지 못했습니다. '+(error.message||'파일 형식을 확인해주세요.'));}
 finally{for(const url of urls.values())URL.revokeObjectURL(url);loading(-1);}
}
async function loadNormalMap(input){
 const file=input.files?.[0];if(!file)return;const serial=++normalSerial,url=URL.createObjectURL(file);
 try{
  const loader=/\.tga$/i.test(file.name)?new TGALoader():new THREE.TextureLoader();const texture=await loader.loadAsync(url);
  if(serial!==normalSerial){texture.dispose();return;}
  texture.colorSpace=THREE.NoColorSpace;material.normalMap?.dispose();material.normalMap=texture;material.normalScale.set(1,1);material.needsUpdate=true;dirty=true;status(file.name+' · 노멀맵을 적용했습니다.');
 }catch(error){console.error(error);status('노멀맵을 읽지 못했습니다. PNG, JPG, WEBP 또는 TGA 파일을 확인해주세요.');}
 finally{URL.revokeObjectURL(url);}
}
function init(){
 scene=new THREE.Scene();scene.background=new THREE.Color(0x0b0b0b);scene.fog=new THREE.Fog(0x0b0b0b,12,27);
 camera=new THREE.PerspectiveCamera(38,1,.1,60);renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 container.append(renderer.domElement);renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','PBR 재질 미리보기. 드래그하여 회전하고 스크롤로 확대합니다.');
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=2.7;controls.maxDistance=14;controls.maxPolarAngle=Math.PI*.49;controls.addEventListener('change',()=>dirty=true);controls.listenToKeyEvents(renderer.domElement);resetView();
 material=new THREE.MeshPhysicalMaterial({color:0xb5a642,metalness:1,roughness:.3,reflectivity:.5,envMapIntensity:1,sheenColor:new THREE.Color(0xffffff),iridescenceThicknessRange:[100,400]});
 mainLight=new THREE.DirectionalLight(0xfff5e8,1.5);mainLight.position.set(-3.5,6,4);mainLight.castShadow=true;mainLight.shadow.mapSize.set(1024,1024);mainLight.shadow.camera.left=-4;mainLight.shadow.camera.right=4;mainLight.shadow.camera.top=4;mainLight.shadow.camera.bottom=-4;mainLight.shadow.normalBias=.02;mainLight.shadow.bias=-.0002;scene.add(mainLight);
 fillLight=new THREE.DirectionalLight(0xe7edff,.48);fillLight.position.set(5,1,2);scene.add(fillLight);backLight=new THREE.DirectionalLight(0xffffff,.72);backLight.position.set(1,4,-4);scene.add(backLight);ambientLight=new THREE.AmbientLight(0xffffff,.12);scene.add(ambientLight);
 const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(1.52,1.58,.13,96),new THREE.MeshStandardMaterial({color:0x272727,roughness:.53,metalness:.22}));pedestal.position.y=-1.265;pedestal.castShadow=true;pedestal.receiveShadow=true;scene.add(pedestal);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0x121212,roughness:.82}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.331;floor.receiveShadow=true;scene.add(floor);
 const generator=new THREE.PMREMGenerator(renderer),studio=new RoomEnvironment(renderer),target=generator.fromScene(studio,.035);envTargets.push(target);studio.dispose();generator.dispose();scene.environment=target.texture;
 createGeometry('sphere');
 // Actual SSAO, followed by a single output transform. The switch never changes exposure.
 const canAO=renderer.capabilities.isWebGL2||renderer.extensions.has('WEBGL_depth_texture');
 if(canAO){composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));ao=new SSAOPass(scene,camera,1,1,16);ao.kernelRadius=8;ao.minDistance=.005;ao.maxDistance=.07;composer.addPass(ao);composer.addPass(new OutputPass());}
 else{$('ssaoToggle').checked=false;$('ssaoToggle').disabled=true;$('aoNote').textContent='이 브라우저에서는 SSAO를 지원하지 않습니다. 기본 그림자로 표시합니다.';}
 new ResizeObserver(resize).observe(container);resize();applyPreset('brass');updateLighting();loadEnvironment('studio');frame=requestAnimationFrame(animate);
}
// Three distinct panels keep the important material controls close to the specimen.
const panelKeys=['material','lighting','import'];
function selectPanel(key,focus=false){for(const name of panelKeys){const selected=name===key;$(name+'Tab').setAttribute('aria-selected',String(selected));$(name+'Tab').tabIndex=selected?0:-1;$(name+'Panel').hidden=!selected;}if(focus)$(key+'Tab').focus();}
for(const [index,key] of panelKeys.entries()){$(key+'Tab').addEventListener('click',()=>selectPanel(key));$(key+'Tab').addEventListener('keydown',event=>{const n=event.key==='ArrowRight'?(index+1)%3:event.key==='ArrowLeft'?(index+2)%3:event.key==='Home'?0:event.key==='End'?2:-1;if(n>=0){event.preventDefault();selectPanel(panelKeys[n],true);}});}
for(const id of parameters)$(id).addEventListener('input',()=>material&&updateMaterial());$('baseColor').addEventListener('input',()=>material&&updateMaterial());
$('geometrySelect').addEventListener('change',()=>{++modelSerial;createGeometry($('geometrySelect').value);});$('presetCategory').addEventListener('change',updatePresetList);$('presetSelect').addEventListener('change',()=>applyPreset($('presetSelect').value));
document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>applyPreset(button.dataset.preset)));
for(const id of ['mainLight','ambientLight'])$(id).addEventListener('input',updateLighting);$('envMapSelect').addEventListener('change',()=>loadEnvironment($('envMapSelect').value));$('backgroundToggle').addEventListener('change',setBackground);$('iorToggle').addEventListener('change',()=>updateMaterial(false));$('ssaoToggle').addEventListener('change',toggleAO);$('resetView').addEventListener('click',resetView);
$('modelFile').addEventListener('change',event=>loadCustomModel(event.target));$('normalMapFile').addEventListener('change',event=>loadNormalMap(event.target));$('resetModel').addEventListener('click',()=>{++modelSerial;++normalSerial;createGeometry('sphere');$('geometrySelect').value='sphere';material.normalMap?.dispose();material.normalMap=null;material.needsUpdate=true;$('modelFile').value='';$('normalMapFile').value='';applyPreset(currentPreset||'brass');status('기본 구와 현재 재질로 돌아왔습니다.');});
$('openReference').addEventListener('click',()=>$('referencePanel').showModal());$('openGuide').addEventListener('click',()=>$('infoModal').showModal());document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>$(button.dataset.close).close()));for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)dirty=true;});
window.addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;cancelAnimationFrame(frame);controls?.dispose();composer?.dispose();renderer?.dispose();for(const target of envTargets)target.dispose();});
try{init();}catch(error){console.error('PBR initialization:',error);$('renderError').hidden=false;status('그래픽 미리보기를 시작하지 못했습니다.');}
