import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../home-horizon.js', import.meta.url), 'utf8');
function harness({enabled=true, fail=false, meadow=false}={}) {
  const window=new EventTarget(), document=new EventTarget(), canvas=new EventTarget();
  const timers=new Map(), meadowFrames=[];
  const frames=new Map(), meshes=[], groups=[], classes=new Set();
  let seq=0, created=0, draws=0, ratio=0, contactBottom=400, change;
  class Vector3 {
    constructor(x=0,y=0,z=0) { this.set(x,y,z); }
    set(x,y,z) { Object.assign(this,{x,y,z}); return this; }
    copy(v) { return this.set(v.x,v.y,v.z); }
    normalize() { return this; }
  }
  const THREE={Vector3,Vector2:Vector3,
    WebGLRenderer:class {
      constructor() { created++; if(fail) throw Error('WebGL unavailable'); }
      setClearColor() {} getPixelRatio(){return ratio;} setPixelRatio(v) { ratio=v; } setSize() {} dispose() {}
      render() { draws++; }
    },
    Scene:class { add() {} },
    Group:class { position=new Vector3(); rotation={}; scale={setScalar(v){this.value=v;}}; children=[];
      constructor(){groups.push(this);} add(...items){this.children.push(...items);}},
    BoxGeometry:class {}, CylinderGeometry:class {}, PlaneGeometry:class {},
    MeshStandardMaterial:class {constructor(o){Object.assign(this,o);}},
    MeshBasicMaterial:class {constructor(o){Object.assign(this,o);}},
    HemisphereLight:class {}, DirectionalLight:class {position=new Vector3();},
    OrthographicCamera:class { position=new Vector3(); updateProjectionMatrix() {} },
    SphereGeometry:class {}, ShaderMaterial:class { constructor(o) { Object.assign(this,o); } },
    Mesh:class { position=new Vector3(); rotation={}; scale={setScalar(v){ this.value=v; }};
      constructor(g,m) { this.material=m; meshes.push(this); }
    }
  };
  canvas.style={};
  const contact={getBoundingClientRect:()=>({bottom:contactBottom})};
  const about={offsetHeight:800,querySelector:()=>contact};
  const landing={offsetHeight:300,classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)}};
  Object.assign(window,{THREE,innerWidth:1200,innerHeight:800,devicePixelRatio:3,scrollY:0,
    penumbraPlanetShaders:{bodyVertex:'',bodyFragment:'max(lum,0.)',atmosphereVertex:'',atmosphereFragment:''},
    penumbraMotion:{enabled,subscribe(fn){change=fn;}}
  });
  if(meadow) window.createPenumbraMeadow=(T,renderer,scene)=>({
    update(value){meadowFrames.push(value);},render(camera){renderer.render(scene,camera);}
  });
  Object.assign(document,{hidden:false,body:{},documentElement:{scrollHeight:10000,dataset:{}},
    getElementById:id=>id==='about'?about:canvas,querySelector:()=>landing});
  vm.runInNewContext(source,{window,document,performance:{now:()=>1000},
    setTimeout(fn){timers.set(++seq,fn);return seq;},clearTimeout(id){timers.delete(id);},MutationObserver:class {observe(){}},
    requestAnimationFrame(fn){frames.set(++seq,fn);return seq;},cancelAnimationFrame(id){frames.delete(id);}});
  return {window,document,canvas,frames,timers,meadowFrames,meshes,groups,classes,created:()=>created,draws:()=>draws,ratio:()=>ratio,
    flush(){for(const [id,fn] of [...frames]){frames.delete(id);fn();}},
    scroll(y){window.scrollY=y;window.dispatchEvent(new Event('scroll'));},
    contact(v){contactBottom=v;},motion(v){change(v);}};
}
test('allocates no renderer before the final section; batches scroll without an idle loop',()=>{
  const h=harness(); h.flush(); assert.equal(h.created(),0);
  h.scroll(8500); h.scroll(8600); assert.equal(h.frames.size,1); h.flush();
  assert.equal(h.created(),1); assert.equal(h.draws(),1); assert.equal(h.frames.size,0);
  assert.equal(h.ratio(),1.5);
  h.scroll(0); h.flush(); assert.equal(h.canvas.style.opacity,'0'); assert.equal(h.draws(),1);
});
test('approach enlarges the same sphere and reverses deterministically; its outer rim clears contact copy',()=>{
  const h=harness(); h.scroll(8400); h.flush(); const early=h.meshes[0].scale.value;
  const earlyDetail=h.meshes[0].material.uniforms.uGround.value;
  assert.ok(earlyDetail<.1);
  h.contact(730); h.scroll(9200); h.flush();
  const globe=h.meshes[0], atmo=h.meshes[1], radius=globe.scale.value;
  assert.ok(radius>early);
  const top=400-globe.position.y-atmo.material.uniforms.uRs.value;
  assert.ok(top>=778-.001);
  assert.ok(atmo.material.uniforms.uRp.value>radius);
  assert.ok(atmo.material.uniforms.uRp.value<atmo.material.uniforms.uRs.value);
  const edgeDrop=radius-Math.sqrt(radius*radius-600*600);
  assert.ok(edgeDrop<25, "The visible horizon should read as a much larger planet");
  assert.equal(globe.material.uniforms.uGround.value,1);
  h.scroll(8400); h.flush(); assert.equal(globe.scale.value,early);
  assert.equal(globe.material.uniforms.uGround.value,earlyDetail);
});
test('motion off uses the static landing; hidden tabs do not render and mobile caps resolution',()=>{
  const h=harness({enabled:false}); h.scroll(9200); h.flush(); assert.equal(h.created(),0);
  h.window.innerWidth=390; h.motion(true); h.flush(); assert.equal(h.ratio(),1);
  h.motion(false); h.flush(); assert.equal(h.canvas.style.opacity,'0');
  h.motion(true); h.document.hidden=true; h.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(h.frames.size,0);
  const draws=h.draws(); h.scroll(9000); assert.equal(h.draws(),draws);
  h.document.hidden=false; h.document.dispatchEvent(new Event('visibilitychange')); h.flush();
  assert.equal(h.draws(),draws+1);
});
test('WebGL failure keeps the fallback and does not repeatedly allocate renderers',()=>{
  const h=harness({fail:true}); h.scroll(9200); h.flush();
  h.scroll(9100); h.flush(); assert.equal(h.created(),1);
  assert.equal(h.classes.has('has-planet-renderer'),false);
  assert.equal(h.canvas.style.opacity,'0');
});

test('observatory appears only on approach and stays below the contact copy',()=>{
  const h=harness(); h.contact(730); h.scroll(8400); h.flush();
  assert.equal(h.groups[0].visible,false);
  h.scroll(9200); h.flush();
  assert.equal(h.groups.length,1, "Path lamps are removed");
  const station=h.groups[0];
  assert.equal(station.visible,true);
  assert.ok(station.rotation.x<=.09, "Keep the observation angle near grass level");
  assert.equal(station.rotation.z,0);
  // Allow the entire dome (26 local units) above its foot, not just its anchor.
  const stationTop=400-station.position.y-26*station.scale.value;
  assert.ok(stationTop>730+48);
  h.scroll(8400); h.flush(); assert.equal(station.visible,false);
});

test('breeze runs only over the visible meadow and stops offscreen, hidden, or with motion off',()=>{
  const h=harness({meadow:true});h.flush();assert.equal(h.timers.size,0);
  h.scroll(9200);h.flush();assert.equal(h.timers.size,1);
  assert.equal(h.meadowFrames.at(-1).reveal,1);
  h.scroll(0);h.flush();assert.equal(h.timers.size,0);
  h.scroll(9200);h.flush();h.motion(false);assert.equal(h.timers.size,0);h.flush();
  h.motion(true);h.flush();assert.equal(h.timers.size,1);
  h.document.hidden=true;h.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(h.timers.size,0);assert.equal(h.frames.size,0);
});
