import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {LENS,SUBJECTS} from './focus-optics.mjs?v=fbf860ce43e1';
// The photo Focus Lab's lens takes: a cute desk seen from the lens, 50 mm on full frame.
// The scene does not depend on focus or aperture, so it is rendered once (with depth) per size.
// Every change of focus or aperture only re-runs the blur, which reads the same thin-lens
// formula as the rest of the lab: disc = f² / (N (s − f)) · (s − d) / d, per pixel.

const VFOV=2*Math.atan(LENS.sensorHeight/2/(LENS.focal*1000))*180/Math.PI;
const EYE_HEIGHT=.075;

// ---------------------------------------------------------------- the desk
function mat(color,roughness=.7,extra={}){return new THREE.MeshStandardMaterial({color,roughness,metalness:0,...extra});}
function glow(color,strength){return new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(strength)});}
function place(mesh,x,y,z,parent){mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function face(group,{y,z,r,eye=.0042,gap,smile=true,blush='#f4a7b0'}){
 const black=mat('#2b2521',.4);
 for(const s of [-1,1]){
  place(new THREE.Mesh(new THREE.SphereGeometry(eye,12,10),black),s*gap,y,z,group);
  const cheek=place(new THREE.Mesh(new THREE.CircleGeometry(eye*1.35,16),mat(blush,.9,{transparent:true,opacity:.85})),s*gap*1.55,y-eye*2.1,z+.0005,group);cheek.castShadow=false;
 }
 if(smile){const arc=place(new THREE.Mesh(new THREE.TorusGeometry(eye*1.3,eye*.28,6,16,Math.PI),black),0,y-eye*1.2,z,group);arc.rotation.z=Math.PI;}
}
function cactus(){
 const g=new THREE.Group(),green=mat('#7cc47f',.75),pot=mat('#d98a64',.8);
 place(new THREE.Mesh(new THREE.CylinderGeometry(.031,.024,.036,28),pot),0,.018,0,g);
 place(new THREE.Mesh(new THREE.CylinderGeometry(.033,.033,.007,28),mat('#e59d78',.8)),0,.037,0,g);
 place(new THREE.Mesh(new THREE.CylinderGeometry(.029,.029,.004,28),mat('#8a6a52',1)),0,.039,0,g);
 place(new THREE.Mesh(new THREE.CapsuleGeometry(.022,.04,8,20),green),0,.075,0,g);
 for(const s of [-1,1]){
  const arm=place(new THREE.Mesh(new THREE.CapsuleGeometry(.0085,.016,6,12),green),s*.029,.082,0,g);
  const tip=place(new THREE.Mesh(new THREE.CapsuleGeometry(.0085,.012,6,12),green),s*.037,.094,0,g);arm.rotation.z=s*Math.PI/2.3;tip.rotation.z=0;
 }
 for(let i=0;i<5;i++)place(new THREE.Mesh(new THREE.SphereGeometry(.0075,12,10),mat(i%2?'#ff9fb8':'#ffc4d3',.6)),Math.cos(i*1.256)*.007,.118,Math.sin(i*1.256)*.007,g);
 place(new THREE.Mesh(new THREE.SphereGeometry(.0048,10,8),mat('#ffe27a',.6)),0,.121,0,g);
 face(g,{y:.08,z:.0215,gap:.0085});
 return g;
}
function mug(){
 const g=new THREE.Group(),cream=mat('#f6efe2',.45),band=mat('#8fc3e8',.5);
 place(new THREE.Mesh(new THREE.CylinderGeometry(.041,.038,.092,40),cream),0,.046,0,g);
 place(new THREE.Mesh(new THREE.CylinderGeometry(.0415,.0415,.012,40),band),0,.077,0,g);
 place(new THREE.Mesh(new THREE.CylinderGeometry(.036,.036,.002,32),mat('#6b4632',.3)),0,.088,0,g);
 const handle=place(new THREE.Mesh(new THREE.TorusGeometry(.021,.0065,12,24),cream),.043,.048,0,g);handle.rotation.y=Math.PI/2;handle.rotation.x=0;
 place(new THREE.Mesh(new THREE.TorusGeometry(.006,.0022,8,16),mat('#f7c0cb',.6)),.004,.098,.004,g).rotation.x=Math.PI/2;
 face(g,{y:.05,z:.0405,gap:.012,eye:.0048});
 return g;
}
function bear(){
 const g=new THREE.Group(),fur=mat('#c99462',.95),light=mat('#f0d2ad',.95);
 place(new THREE.Mesh(new THREE.SphereGeometry(.105,32,24),fur),0,.105,0,g).scale.set(1,1.05,.9);
 place(new THREE.Mesh(new THREE.SphereGeometry(.06,24,18),light),0,.1,.07,g).scale.set(1,1.1,.5);
 place(new THREE.Mesh(new THREE.SphereGeometry(.085,32,24),fur),0,.265,.005,g);
 for(const s of [-1,1]){
  place(new THREE.Mesh(new THREE.SphereGeometry(.032,20,16),fur),s*.065,.335,0,g);
  place(new THREE.Mesh(new THREE.SphereGeometry(.018,16,12),light),s*.065,.337,.018,g);
  place(new THREE.Mesh(new THREE.SphereGeometry(.038,20,16),fur),s*.1,.13,.045,g);
  place(new THREE.Mesh(new THREE.SphereGeometry(.042,20,16),fur),s*.065,.035,.07,g).scale.set(1,.75,1.2);
 }
 place(new THREE.Mesh(new THREE.SphereGeometry(.036,20,16),light),0,.245,.075,g).scale.set(1.1,.85,.8);
 place(new THREE.Mesh(new THREE.SphereGeometry(.011,14,10),mat('#3a2a22',.35)),0,.258,.104,g);
 face(g,{y:.285,z:.078,gap:.03,eye:.009,smile:false});
 const bow=mat('#ef8fa6',.6);for(const s of [-1,1])place(new THREE.Mesh(new THREE.ConeGeometry(.022,.04,16),bow),s*.022,.19,.07,g).rotation.z=s*Math.PI/2;
 place(new THREE.Mesh(new THREE.SphereGeometry(.011,12,10),bow),0,.19,.075,g);
 return g;
}
function books(){
 const g=new THREE.Group(),colors=['#f2c572','#9fc9a5','#e8a0a8','#a9b8e8'];let y=0;
 colors.forEach((c,i)=>{const h=.022+(i%2)*.006;const b=place(new THREE.Mesh(new THREE.BoxGeometry(.2-i*.012,h,.14),mat(c,.8)),(i%2-.5)*.01,y+h/2,0,g);b.rotation.y=(i-1.5)*.06;y+=h;});
 return g;
}
function pencilCup(){
 const g=new THREE.Group();
 place(new THREE.Mesh(new THREE.CylinderGeometry(.036,.034,.1,28,1,true),mat('#b9a3e3',.6,{side:THREE.DoubleSide})),0,.05,0,g);
 ['#f28b82','#fbd46d','#8ecae6','#90d49b'].forEach((c,i)=>{const p=place(new THREE.Mesh(new THREE.CylinderGeometry(.0045,.0045,.16,8),mat(c,.5)),Math.cos(i*1.6)*.014,.09,Math.sin(i*1.6)*.014,g);p.rotation.z=(i-1.5)*.12;p.rotation.x=(i%2-.5)*.18;});
 return g;
}
function mat3(){
 const c=document.createElement('canvas');c.width=512;c.height=1024;const x=c.getContext('2d');
 x.fillStyle='#3f6f63';x.fillRect(0,0,512,1024);x.strokeStyle='rgba(235,245,235,.45)';
 for(let i=0;i<=512;i+=32){x.lineWidth=i%160===0?2.2:1;x.beginPath();x.moveTo(i,0);x.lineTo(i,1024);x.stroke();}
 for(let j=0;j<=1024;j+=32){x.lineWidth=j%160===0?2.2:1;x.beginPath();x.moveTo(0,j);x.lineTo(512,j);x.stroke();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
function buildScene(){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#2a2530');
 const desk=place(new THREE.Mesh(new THREE.BoxGeometry(4,.04,3.6),mat('#d8b48a',.55)),0,-.02,-1.6,scene);desk.castShadow=false;
 const cutting=place(new THREE.Mesh(new THREE.PlaneGeometry(.64,1.28),mat('#ffffff',.85,{map:mat3()})),.02,.0012,-.86,scene);cutting.rotation.x=-Math.PI/2;cutting.castShadow=false;
 const wall=place(new THREE.Mesh(new THREE.PlaneGeometry(6,3),mat('#e9dccf',.95)),0,1.3,-3.35,scene);wall.castShadow=false;
 const frame=place(new THREE.Mesh(new THREE.BoxGeometry(.5,.36,.02),mat('#f7f2ea',.8)),.62,.62,-3.33,scene);frame.castShadow=false;
 place(new THREE.Mesh(new THREE.CircleGeometry(.1,32),mat('#f4b183',.9)),.62,.64,-3.318,scene).castShadow=false;
 const [c,m,b]=SUBJECTS;
 place(cactus(),-.068,0,-c.distance,scene).rotation.y=.25;
 place(mug(),.125,0,-m.distance,scene).rotation.y=-.35;
 place(bear(),-.2,0,-b.distance,scene).rotation.y=.28;
 place(books(),.42,0,-1.35,scene).rotation.y=-.3;
 place(pencilCup(),-.36,0,-1.15,scene);
 // A garland of warm bulbs on the back wall: the photo turns each one into a disc of the iris.
 const bulbMat=glow('#ffd9a0',9),wire=[],N=27;
 for(let i=0;i<N;i++){const t=i/(N-1),x=-1.25+2.5*t,y=.88-.2*Math.sin(Math.PI*t*2)**2-.05*Math.sin(Math.PI*t);wire.push(new THREE.Vector3(x,y,-3.3));
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(.014,10,8),bulbMat);bulb.position.set(x,y-.02,-3.28);scene.add(bulb);}
 scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.CatmullRomCurve3(wire).getPoints(160)),new THREE.LineBasicMaterial({color:'#5b4d45'})));
 // A small desk lamp glow near the bear, for one bright near-background highlight.
 const lamp=new THREE.Mesh(new THREE.SphereGeometry(.03,16,12),glow('#fff1d6',6));lamp.position.set(.55,.42,-2.3);scene.add(lamp);
 const key=new THREE.DirectionalLight('#fff4e6',2.6);key.position.set(-1.6,2.4,1.2);key.target.position.set(0,0,-1.2);key.castShadow=true;
 key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-2,right:2,top:2,bottom:-2,near:.5,far:8});key.shadow.bias=-.0004;key.shadow.radius=3;
 scene.add(key,key.target,new THREE.HemisphereLight('#fdf2ff','#8a6f58',.9));
 const warm=new THREE.PointLight('#ffcf94',1.4,4,1.6);warm.position.set(.5,.45,-2.2);scene.add(warm);
 return scene;
}

// ---------------------------------------------------------------- the blur
const quadVS='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const fs=(fragmentShader,uniforms)=>new FullScreenQuad(new THREE.ShaderMaterial({uniforms,vertexShader:quadVS,fragmentShader,depthTest:false,depthWrite:false}));
// Signed blur radius in pixels of the target: negative in front of the focus plane.
const PRE=`uniform sampler2D tColor;uniform sampler2D tDepth;uniform vec2 uTexel;uniform float uNear,uFar,uS,uN,uF,uPx,uMax;varying vec2 vUv;
 void main(){vec2 o=uTexel*.5;vec3 c=(texture2D(tColor,vUv+vec2(-o.x,-o.y)).rgb+texture2D(tColor,vUv+vec2(o.x,-o.y)).rgb+texture2D(tColor,vUv+vec2(-o.x,o.y)).rgb+texture2D(tColor,vUv+o).rgb)*.25;
  float z=texture2D(tDepth,vUv).x;float d=uNear*uFar/(uFar-z*(uFar-uNear));
  float disc=uF*uF/(uN*(uS*1000.-uF))*(uS-d)/d;           // mm on the sensor (uF in mm, uS and d in m); > 0 nearer than the plane
  gl_FragColor=vec4(min(c,vec3(60.)),clamp(-disc*uPx*.5,-uMax,uMax));}`;
const GATHER=`uniform sampler2D tHalf;uniform vec2 uTexel;uniform float uMax,uPoly,uRot;varying vec2 vUv;
 float iris(float a){const float n=7.,seg=6.2831853/n;float w=mod(a+uRot,seg)-seg*.5;return mix(1.,cos(seg*.5)/cos(w),uPoly);}
 void main(){vec4 c0=texture2D(tHalf,vUv);float cc=abs(c0.a);vec3 col=c0.rgb;float tot=1.,near=0.;
  float ang=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)*6.2831853,r=.6+fract(sin(dot(gl_FragCoord.xy,vec2(39.35,11.13)))*24634.63)*.8;
  for(int i=0;i<420;i++){if(r>=uMax)break;vec4 s=texture2D(tHalf,vUv+vec2(cos(ang),sin(ang))*uTexel*r);float sc=abs(s.a);
   if(s.a>c0.a)sc=min(sc,cc*2.);                               // what is behind may not spill over a sharper subject
   float m=smoothstep(r-1.,r+1.,sc*iris(ang));col+=mix(col/tot,s.rgb,m);tot+=1.;if(s.a<0.)near=max(near,m*sc);ang+=2.39996;r+=1.05/r;}
  gl_FragColor=vec4(col/tot,max(cc,near));}`;
const COMP=`uniform sampler2D tColor;uniform sampler2D tBlur;uniform vec2 uTexel;uniform float uExposure;uniform float uFlip;varying vec2 vUv;
 vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
 void main(){vec2 uv=vec2(vUv.x,mix(vUv.y,1.-vUv.y,uFlip));vec3 s=texture2D(tColor,uv).rgb;vec4 b=texture2D(tBlur,uv);
  vec3 bb=(b.rgb*4.+texture2D(tBlur,uv+vec2(uTexel.x,0.)).rgb+texture2D(tBlur,uv-vec2(uTexel.x,0.)).rgb+texture2D(tBlur,uv+vec2(0.,uTexel.y)).rgb+texture2D(tBlur,uv-vec2(0.,uTexel.y)).rgb)/8.;
  vec3 c=mix(s,bb,smoothstep(.35,1.4,b.a))*uExposure;
  gl_FragColor=vec4(pow(aces(c),vec3(1./2.2)),1.);}`;

export function createFocusPhoto(canvas){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:false});
 renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
 const scene=buildScene(),camera=new THREE.PerspectiveCamera(VFOV,1.5,.05,12);
 camera.position.set(0,EYE_HEIGHT,0);camera.lookAt(0,EYE_HEIGHT,-1);camera.updateMatrixWorld();
 const half={type:THREE.HalfFloatType,depthBuffer:false};
 let sceneRT=null,halfRT=new THREE.WebGLRenderTarget(1,1,half),blurRT=halfRT.clone(),w=0,h=0;
 const U={tColor:{value:null},tDepth:{value:null},tHalf:{value:halfRT.texture},tBlur:{value:blurRT.texture},uTexel:{value:new THREE.Vector2()},
  uNear:{value:camera.near},uFar:{value:camera.far},uS:{value:.8},uN:{value:2},uF:{value:LENS.focal*1000},uPx:{value:1},uMax:{value:28},uPoly:{value:0},uRot:{value:0},uExposure:{value:1},uFlip:{value:0}};
 const pre=fs(PRE,U),gather=fs(GATHER,U),comp=fs(COMP,U);
 function size(width,height){
  width=Math.max(2,Math.round(width));height=Math.max(2,Math.round(height));if(width===w&&height===h)return;w=width;h=height;
  sceneRT?.dispose();sceneRT=new THREE.WebGLRenderTarget(w,h,{type:THREE.HalfFloatType,samples:4});
  sceneRT.depthTexture=new THREE.DepthTexture(w,h);sceneRT.depthTexture.type=THREE.UnsignedIntType;
  camera.aspect=w/h;camera.updateProjectionMatrix();
  renderer.shadowMap.needsUpdate=true;renderer.setRenderTarget(sceneRT);renderer.clear();renderer.render(scene,camera);renderer.setRenderTarget(null);
  U.tColor.value=sceneRT.texture;U.tDepth.value=sceneRT.depthTexture;
 }
 // One blurred frame. `out` is null for the page canvas or a render target to read back.
 function develop(s,N,outW,outH,out,exposure=1){
  const hw=Math.max(1,Math.ceil(outW/2)),hh=Math.max(1,Math.ceil(outH/2));
  if(halfRT.width!==hw||halfRT.height!==hh){halfRT.setSize(hw,hh);blurRT.setSize(hw,hh);}
  U.uS.value=s;U.uN.value=N;U.uPx.value=hh/LENS.sensorHeight;U.uMax.value=Math.min(30,Math.max(6,hh*.07));
  U.uPoly.value=Math.min(1,Math.max(0,(N-2.8)/5.2))*.85;U.uRot.value=(16-N)*.08;U.uExposure.value=exposure;
  U.uTexel.value.set(1/w,1/h);renderer.setRenderTarget(halfRT);pre.render(renderer);
  U.uTexel.value.set(1/hw,1/hh);renderer.setRenderTarget(blurRT);gather.render(renderer);
  U.uFlip.value=out?1:0;renderer.setRenderTarget(out);comp.render(renderer);renderer.setRenderTarget(null);
 }
 const readRTs=new Map();
 function readInto(ctx,s,N,exposure=1){
  const cw=ctx.canvas.width,ch=ctx.canvas.height,key=cw+'x'+ch;
  let rt=readRTs.get(key);if(!rt){rt=new THREE.WebGLRenderTarget(cw,ch,{depthBuffer:false});readRTs.set(key,rt);}
  develop(s,N,cw,ch,rt,exposure);
  const px=new Uint8Array(cw*ch*4);renderer.readRenderTargetPixels(rt,0,0,cw,ch,px);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(px.buffer),cw,ch),0,0);
 }
 return {
  renderer,
  resize(cssW,cssH,ratio){renderer.setPixelRatio(ratio);renderer.setSize(cssW,cssH,false);const v=renderer.getDrawingBufferSize(new THREE.Vector2());size(v.x,v.y);},
  draw(s,N){if(!w)return;develop(s,N,w,h,null);},
  // Photos elsewhere on the page (film strip, aperture comparison) at their own resolution.
  drawTo(ctx,s,N,exposure){if(!w)return;readInto(ctx,s,N,exposure);},
  // Where each subject's head sits on the photo, as fractions of its width and height.
  subjectPoints(){return SUBJECTS.map(S=>{const p=new THREE.Vector3(...{cactus:[-.068,.1,-S.distance],mug:[.125,.07,-S.distance],bear:[-.2,.3,-S.distance]}[S.id]).project(camera);return {id:S.id,x:(p.x+1)/2,y:(1-p.y)/2};});},
  dispose(){sceneRT?.dispose();halfRT.dispose();blurRT.dispose();readRTs.forEach(rt=>rt.dispose());renderer.dispose();}
 };
}
