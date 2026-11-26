import {ROOM_REFLECTANCE,roomBounce,transferWeights,integrateBounce} from './room-indirect.mjs?v=72495e7f07aa';
import * as THREE from './vendor/three/build/three.module.js';
import {SOURCES,balancedColor} from './light-sources.mjs';
import {roomContributions} from './room-physics.mjs?v=1a6c0b79da70';
import {RECEIVER,ROOM_BOXES,ROOM_SPHERE,lampPosition,positionSettings} from './room-geometry.mjs?v=5748b1b55a40';

// One scene and camera, two viewports. Only the local light changes between renders.
export function createRoomRenderer(canvases,onResize,onError){
 const scene=new THREE.Scene();scene.background=new THREE.Color(.008,.009,.012);
 const camera=new THREE.PerspectiveCamera(43,1.5,.05,80);
 const target=new THREE.Vector3(0,.6,-.25);
 const resources=[];const keep=r=>(resources.push(r),r);
 const bounceUniforms={roomWindowColor:{value:new THREE.Color()},roomLampColor:{value:new THREE.Color()},roomLampVisible:{value:0}};
 const receivers=[];
 const matte=value=>{
  const material=keep(new THREE.MeshLambertMaterial({color:new THREE.Color(value,value,value)}));
  material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,bounceUniforms);
   shader.vertexShader='attribute vec2 roomIndirect; varying vec2 vRoomIndirect;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRoomIndirect=roomIndirect;');
   shader.fragmentShader='varying vec2 vRoomIndirect; uniform vec3 roomWindowColor; uniform vec3 roomLampColor; uniform float roomLampVisible;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.indirectDiffuse += (roomWindowColor*vRoomIndirect.x+roomLampColor*vRoomIndirect.y*roomLampVisible)*BRDF_Lambert(diffuseColor.rgb);');
  };
  material.customProgramCacheKey=()=> 'room-one-bounce-v1';return material;
 };
 const floorMaterial=matte(ROOM_REFLECTANCE.floor), wallMaterial=matte(ROOM_REFLECTANCE.wall), objectMaterial=matte(.42);
 function mesh(geometry,material,position){const m=new THREE.Mesh(keep(geometry),material);m.position.fromArray(position);m.castShadow=true;m.receiveShadow=true;scene.add(m);if(material.isMeshLambertMaterial)receivers.push(m);return m;}
 mesh(new THREE.BoxGeometry(6,.1,6,20,1,20),floorMaterial,[0,-.05,0]);
 const walls=[mesh(new THREE.BoxGeometry(6,2.8,.08,20,10,1),wallMaterial,[0,1.4,-3]),mesh(new THREE.BoxGeometry(.08,2.8,6,1,10,20),wallMaterial,[-3,1.4,0])];
 for(const box of ROOM_BOXES)mesh(new THREE.BoxGeometry(...box.size,6,6,6),objectMaterial,box.center);
 mesh(new THREE.SphereGeometry(ROOM_SPHERE.radius,40,24),objectMaterial,ROOM_SPHERE.center);
 // A narrow ring leaves the actual sampled point on the floor unobscured.
 const ring=mesh(new THREE.RingGeometry(.16,.18,48),matte(.65),[0,.004,0]);ring.rotation.x=-Math.PI/2;ring.castShadow=false;
 const windowMat=keep(new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}));
 const windowMesh=mesh(new THREE.PlaneGeometry(1.3,1.5),windowMat,[-2.949,1.9,-1.3]);windowMesh.rotation.y=Math.PI/2;windowMesh.castShadow=false;
 const windowLight=new THREE.DirectionalLight(0xffffff,1);windowLight.position.set(-3,5,-3);windowLight.target.position.fromArray(RECEIVER);scene.add(windowLight,windowLight.target);
 // Window illumination is directional; diffuse bounce is evaluated separately below.
 windowLight.castShadow=true;windowLight.shadow.mapSize.set(1024,1024);Object.assign(windowLight.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:20});windowLight.shadow.normalBias=.012;
 const lamp=new THREE.PointLight(0xffffff,1,0,2);lamp.castShadow=true;lamp.shadow.mapSize.set(512,512);lamp.shadow.camera.near=.02;lamp.shadow.camera.far=24;lamp.shadow.normalBias=.008;scene.add(lamp);
 const bulb=mesh(new THREE.SphereGeometry(.045,16,12),keep(new THREE.MeshBasicMaterial({color:0xffe6bd})),[0,1,0]);bulb.castShadow=false;
 const postScene=new THREE.Scene(),postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 const post=keep(new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{image:{value:null},pixel:{value:new THREE.Vector2()},exposure:{value:1},bloom:{value:1}},vertexShader:'varying vec2 uvOut; void main(){uvOut=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`
  uniform sampler2D image; uniform vec2 pixel; uniform float exposure; uniform float bloom; varying vec2 uvOut;
  vec3 highlight(vec2 uv){vec3 c=min(texture2D(image,clamp(uv,vec2(0.),vec2(1.))).rgb,vec3(60000.))*exposure;float y=dot(c,vec3(.2126,.7152,.0722));return c/max(y,1.)*min(max(y-1.,0.),2.);}
  void main(){vec3 c=min(texture2D(image,uvOut).rgb,vec3(60000.))*exposure;
   if(bloom>.5){vec3 glow=vec3(0.);for(int i=0;i<8;i++){float a=float(i)*.785398;vec2 d=vec2(cos(a),sin(a))*pixel;glow+=highlight(uvOut+d*4.)+highlight(uvOut+d*10.)*.5;}c+=glow*.014;}
   gl_FragColor=vec4(c/(1.+c),1.);
   #include <colorspace_fragment>
  }`}));
 postScene.add(new THREE.Mesh(keep(new THREE.PlaneGeometry(2,2)),post));
 const views=[];
 try{for(const canvas of canvases){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const buffer=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});
  buffer.samples=renderer.capabilities.isWebGL2?Math.min(4,renderer.capabilities.maxSamples):0;
  const lost=e=>{e.preventDefault();onError('3D 화면이 일시 중단됐어요. 페이지를 새로고침해 주세요.');};canvas.addEventListener('webglcontextlost',lost);
  views.push({canvas,renderer,buffer,lost});
 }}catch(error){dispose();throw error;}
 // Cache geometry-to-patch visibility once. Camera rotation does not change lighting.
 scene.updateMatrixWorld(true);
 for(const mesh of receivers){
  const positions=mesh.geometry.attributes.position,normals=mesh.geometry.attributes.normal,normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const weights=[];for(let i=0;i<positions.count;i++){
   const p=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
   const n=new THREE.Vector3().fromBufferAttribute(normals,i).applyMatrix3(normalMatrix).normalize();
   weights.push(transferWeights(p.toArray(),n.toArray()));
  }
  mesh.geometry.setAttribute('roomIndirect',new THREE.BufferAttribute(new Float32Array(positions.count*2),2));mesh.userData.bounceWeights=weights;
 }
 let lastBounce;
 function updateBounce(s){
  const solution=roomBounce(s);if(solution===lastBounce)return;lastBounce=solution;
  for(const mesh of receivers){const a=mesh.geometry.attributes.roomIndirect;
   mesh.userData.bounceWeights.forEach((weights,i)=>a.setXY(i,integrateBounce(weights,solution.window),integrateBounce(weights,solution.lamp)));a.needsUpdate=true;
  }
 }
 const observer=new ResizeObserver(onResize);canvases.forEach(c=>observer.observe(c));
 const raycaster=new THREE.Raycaster();let current;
 function setCamera(s){const yaw=s.viewYaw*Math.PI/180,pitch=s.viewPitch*Math.PI/180,r=9;camera.position.set(Math.sin(yaw)*Math.cos(pitch)*r,target.y+Math.sin(pitch)*r,Math.cos(yaw)*Math.cos(pitch)*r+target.z);camera.lookAt(target);camera.updateMatrixWorld();}
 function overlay(view,selector,point){
  const el=view.canvas.parentElement.querySelector(selector),p=point.clone().project(camera);
  el.hidden=p.z>1||p.z< -1||Math.abs(p.x)>.93||Math.abs(p.y)>.9;
  el.style.left=((p.x+1)*50)+'%';el.style.top=((1-p.y)*50)+'%';
 }
 function render(s){
  current=s;setCamera(s);updateBounce(s);const r=roomContributions(s),pos=lampPosition(s);lamp.position.fromArray(pos);bulb.position.copy(lamp.position);
  lamp.color.fromArray(s.color?balancedColor(SOURCES[s.lamp].color):[1,1,1]);windowLight.color.fromArray(s.color?balancedColor(SOURCES[s.outside].color):[1,1,1]);
  bounceUniforms.roomWindowColor.value.copy(windowLight.color);bounceUniforms.roomLampColor.value.copy(lamp.color);
  windowLight.intensity=r.windowLux/(5/Math.sqrt(43));windowMat.color.setScalar(s.windowOn?.6:0.02);
  // Remove the wall closest to the viewer, so orbiting never hides the experiment.
  walls[0].visible=camera.position.z>target.z;walls[1].visible=camera.position.x>target.x;windowMesh.visible=walls[1].visible;
  // Walls are cutaway scenery, not artificial blockers for the outside-light approximation.
  walls.forEach(w=>w.castShadow=false);
  post.uniforms.exposure.value=Math.PI/(100000*.82)*2**s.exposure;post.uniforms.bloom.value=+s.bloom;
  for(const [i,view] of views.entries()){
   const {canvas,renderer,buffer}=view,rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)continue;
   const scale=Math.min(window.devicePixelRatio||1,1.5),w=Math.round(rect.width*scale),h=Math.round(rect.height*scale);
   if(canvas.width!==w||canvas.height!==h){renderer.setSize(w,h,false);buffer.setSize(w,h);}
   camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();
   lamp.intensity=i===1&&s.lampOn?SOURCES[s.lamp].intensity*s.count:0;
   bulb.visible=i===1&&s.lampOn;bounceUniforms.roomLampVisible.value=i===1?1:0;
   renderer.setRenderTarget(buffer);renderer.render(scene,camera);
   post.uniforms.image.value=buffer.texture;post.uniforms.pixel.value.set(1/w,1/h);
   renderer.setRenderTarget(null);renderer.render(postScene,postCamera);
   overlay(view,'.room-lamp-handle',lamp.position);overlay(view,'.room-sensor-label',new THREE.Vector3(...RECEIVER));
   canvas.parentElement.querySelector('.room-lamp-handle').classList.toggle('is-off',i===0||!s.lampOn);
  }
 }
 function beginLampDrag(canvas,x,y){
  if(!current)return null;setCamera(current);const rect=canvas.getBoundingClientRect();camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();
  const point=new THREE.Vector3(...lampPosition(current));const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),point);
  const hit=(cx,cy)=>{raycaster.setFromCamera(new THREE.Vector2((cx-rect.left)/rect.width*2-1,1-(cy-rect.top)/rect.height*2),camera);return raycaster.ray.intersectPlane(plane,new THREE.Vector3());};
  const start=hit(x,y);if(!start)return null;
  return (cx,cy)=>{const end=hit(cx,cy);return end?positionSettings(point.clone().add(end.sub(start)).toArray()):null;};
 }
 function dispose(){views.forEach(v=>{v.canvas.removeEventListener('webglcontextlost',v.lost);v.buffer.dispose();v.renderer.dispose();});resources.forEach(r=>r.dispose());windowLight.shadow.dispose();lamp.shadow.dispose();}
 return {render,beginLampDrag,dispose(){observer.disconnect();dispose();}};
}
