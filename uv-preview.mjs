import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export function islandColor(id) { return `hsl(${(id*137.508+164)%360}, 38%, 65%)`; }
export function metricColor(mode,island) {
  if(mode==='stretch') {
    const t=Math.min(1,Math.log2(Math.max(1,island.stretch||1))/2);
    return new THREE.Color('#818d87').lerp(new THREE.Color('#e37662'),t).getStyle();
  }
  const d=Math.log2(Math.max(.01,island.densityRatio||1));
  return new THREE.Color('#aaa99d').lerp(new THREE.Color(d<0?'#6698ca':'#e4aa66'),Math.min(1,Math.abs(d))).getStyle();
}

// Generate the same artwork in each demo chart before sampling it at the chosen resolution.
export function makeAtlas(model,resolution,target=document.createElement('canvas'),checker=false) {
  const source=document.createElement('canvas');source.width=source.height=Math.max(2048,resolution);
  const c=source.getContext('2d');c.scale(source.width/2048,source.height/2048);c.fillStyle='#22262a';c.fillRect(0,0,2048,2048);
  if(model.demo&&!checker) {
    for(const [i,chart] of model.demo.charts.entries()) {
      const [u,v,w,h]=chart.rect;c.save();c.translate(u*2048,(1-v-h)*2048);c.scale(w*2048,h*2048);
      c.fillStyle='#a8aaa5';c.fillRect(0,0,1,1);
      c.strokeStyle='#3e4446';c.lineWidth=.014;c.strokeRect(.035,.035,.93,.93);
      c.fillStyle='#303739';c.fillRect(.08,.1,.84,.12);
      for(let k=0;k<16;k++) {c.fillStyle=k%2?'#c1c5bf':'#3c4446';c.fillRect(.08+k*.0525,.7,.0525,.18);}
      c.fillStyle='#252c2e';c.textAlign='left';c.font='bold .25px sans-serif';c.fillText('P / '+String(i+1).padStart(2,'0'),.08,.53);
      c.font='.055px monospace';c.fillText(chart.label+' · PENUMBRA',.08,.62);
      c.fillStyle='#d4d6cf';for(const [x,y] of [[.05,.05],[.95,.05],[.05,.95],[.95,.95]]) {c.beginPath();c.arc(x,y,.012,0,Math.PI*2);c.fill();}
      c.restore();
    }
  } else {
    const n=16,s=2048/n;
    for(let y=0;y<n;y++) for(let x=0;x<n;x++) {
      c.fillStyle=(x+y)%2?'#384248':'#c4c7bf';c.fillRect(x*s,y*s,s,s);
      c.fillStyle=(x+y)%2?'#c4c7bf':'#384248';c.font='24px monospace';c.textAlign='center';c.fillText(String.fromCharCode(65+y)+(x+1),x*s+s/2,y*s+s*.59);
    }
  }
  target.width=target.height=resolution;
  const t=target.getContext('2d');t.imageSmoothingEnabled=true;t.imageSmoothingQuality='high';t.drawImage(source,0,0,resolution,resolution);
  return target;
}

export function createPreview(canvas,{onSelect}) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setClearColor('#0e1112');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.01,100);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.minDistance=.4;controls.maxDistance=12;
  const root=new THREE.Group();scene.add(root);
  scene.add(new THREE.HemisphereLight(0xffffff,0x4e5765,2.5));
  const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-3,5,4);scene.add(key);
  const rim=new THREE.DirectionalLight(0xc7d6ee,1.1);rim.position.set(4,1,-3);scene.add(rim);
  const atlas=document.createElement('canvas');let texture=null,mesh=null,highlight=null,model=null,analysis=null,faceOrder=[];
  let options={resolution:128,mode:'texture',selected:-1,materialId:-1},frame=0,disposed=false;
  function render(){frame=0;if(!disposed)renderer.render(scene,camera);}
  const invalidate=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(render);};
  const resize=()=>{const box=canvas.parentElement.getBoundingClientRect();renderer.setSize(box.width,box.height,false);camera.aspect=box.width/Math.max(1,box.height);camera.updateProjectionMatrix();invalidate();};
  const observer=new ResizeObserver(resize);observer.observe(canvas.parentElement);controls.addEventListener('change',invalidate);
  function reset(){camera.position.set(3.2,2.2,3.8);controls.target.set(0,0,0);controls.update();invalidate();}
  function clearObject(object){if(!object)return;root.remove(object);object.geometry.dispose();object.material.dispose();}
  function build(){
    clearObject(mesh);clearObject(highlight);highlight=null;faceOrder=[];
    const p=[],uv=[],normals=[];
    for(let f=0;f<model.uvValid.length;f++) {
      if(options.materialId!==-1&&model.materialIds[f]!==options.materialId)continue;
      faceOrder.push(f);for(let k=0;k<9;k++){p.push(model.positions[f*9+k]);if(model.normals)normals.push(model.normals[f*9+k]);}
      for(let k=0;k<6;k++)uv.push(model.uvs[f*6+k]);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    if(normals.length)geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));else geometry.computeVertexNormals();
    if(model.demo) {
      const normal=geometry.attributes.normal,position=geometry.attributes.position,sums=new Map();
      for(let i=0;i<position.count;i++){const key=[position.getX(i),position.getY(i),position.getZ(i)].map(x=>x.toFixed(5)).join();const sum=sums.get(key)||new THREE.Vector3();sum.add(new THREE.Vector3().fromBufferAttribute(normal,i));sums.set(key,sum);}
      for(let i=0;i<position.count;i++){const key=[position.getX(i),position.getY(i),position.getZ(i)].map(x=>x.toFixed(5)).join();const n=sums.get(key).normalize();normal.setXYZ(i,n.x,n.y,n.z);}
    }
    geometry.computeBoundingBox();const center=new THREE.Vector3(),size=new THREE.Vector3();geometry.boundingBox.getCenter(center);geometry.boundingBox.getSize(size);
    geometry.translate(-center.x,-center.y,-center.z);const scale=2.6/Math.max(.00001,size.x,size.y,size.z);geometry.scale(scale,scale,scale);
    mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({roughness:.75,metalness:.05,side:THREE.DoubleSide,vertexColors:true}));root.add(mesh);
  }
  function appearance(next={}) {
    const prev=options;options={...options,...next};if(!model)return;
    if(!mesh||prev.materialId!==options.materialId)build();
    if(!texture||prev.resolution!==options.resolution||next.forceTexture||(prev.mode==='checker')!==(options.mode==='checker')) {
      makeAtlas(model,options.resolution,atlas,options.mode==='checker');texture?.dispose();texture=new THREE.CanvasTexture(atlas);texture.colorSpace=THREE.SRGBColorSpace;
      texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    }
    const colors=[],color=new THREE.Color();
    for(const f of faceOrder){const id=analysis.faceIsland[f],island=analysis.islands[id];color.set(!island?'#46484a':['texture','checker'].includes(options.mode)?'#ffffff':options.mode==='islands'?islandColor(id):metricColor(options.mode,island));for(let j=0;j<3;j++)colors.push(color.r,color.g,color.b);}
    mesh.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));mesh.material.map=['texture','checker'].includes(options.mode)?texture:null;mesh.material.needsUpdate=true;
    clearObject(highlight);highlight=null;
    if(options.selected>=0) {
      const p=[],position=mesh.geometry.attributes.position;
      faceOrder.forEach((f,index)=>{if(analysis.faceIsland[f]===options.selected)for(let j=0;j<3;j++)p.push(position.getX(index*3+j),position.getY(index*3+j),position.getZ(index*3+j));});
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
      highlight=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#d6f9db',transparent:true,opacity:.27,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));root.add(highlight);
    }
    invalidate();
  }
  const raycaster=new THREE.Raycaster();let start=null;
  function down(event){start=[event.clientX,event.clientY];}
  function up(event){if(!mesh||!start||Math.hypot(event.clientX-start[0],event.clientY-start[1])>5)return;const box=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-box.left)/box.width*2-1,1-(event.clientY-box.top)/box.height*2),camera);const hit=raycaster.intersectObject(mesh)[0];if(hit)onSelect(analysis.faceIsland[faceOrder[hit.faceIndex]]);start=null;}
  function keyboard(event){if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const v=camera.position.clone().sub(controls.target),s=new THREE.Spherical().setFromVector3(v);if(event.key==='ArrowLeft')s.theta-=.12;if(event.key==='ArrowRight')s.theta+=.12;if(event.key==='ArrowUp')s.phi-=.12;if(event.key==='ArrowDown')s.phi+=.12;s.makeSafe();camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));controls.update();invalidate();}
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointerup',up);canvas.addEventListener('keydown',keyboard);reset();resize();
  return {textureCanvas:atlas,setModel(m,a){model=m;analysis=a;options.materialId=-1;clearObject(mesh);mesh=null;appearance({forceTexture:true});reset();},setAppearance:appearance,reset,dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();clearObject(mesh);clearObject(highlight);texture?.dispose();renderer.dispose();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('keydown',keyboard);}};
}
