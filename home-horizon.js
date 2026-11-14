// Approach the opening planet only in the closing section. Render on demand.
(function () {
  'use strict';
  const canvas = document.getElementById('planet-horizon');
  const about = document.getElementById('about');
  const landing = document.querySelector('.planet-landing');
  const contact = about?.querySelector('.contact-links');
  const shaders = window.penumbraPlanetShaders;
  const T = window.THREE;
  if (!canvas || !about || !landing || !contact || !shaders || !T) return;
  const motion = window.penumbraMotion;
  let enabled = motion ? motion.enabled : !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer, scene, camera, globe, atmosphere, light, day, observatory, meadow;
  let breezeTimer = 0, windTime = 0, lastWind = 0;
  let pending = 0, failed = false, width = 0, height = 0;
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

  // Keep the original broad bands; reveal uneven ground only during the close approach.
  const groundNoise = `
    float groundHeight(vec3 p){
      float hills=fbm(p*9.0);
      float sand=noise3(p*38.0+vec3(hills));
      return (hills-.5)*.006 + (sand-.5)*.00025;
    }
  `;
  const noiseStart = shaders.bodyFragment.indexOf('mat2 rot(');
  const noiseEnd = shaders.bodyFragment.indexOf('void main()');
  const noiseFunctions = shaders.bodyFragment.slice(noiseStart, noiseEnd);
  const groundVertex = shaders.bodyVertex
    .replace('void main(){', `uniform float uGround; uniform float uHeightScale; varying vec3 vGroundView;
      ${noiseFunctions} ${groundNoise}
      void main(){`)
    .replace('vec4 mv = modelViewMatrix * vec4(position,1.0);', `
      vec3 displaced=position*(1.0+groundHeight(normalize(position))*uGround*uHeightScale);
      vec4 mv=modelViewMatrix*vec4(displaced,1.0);
      vGroundView=mv.xyz;`);
  const groundFragment = shaders.bodyFragment
    .replace('void main(){', `uniform float uGround; uniform float uRadius; uniform float uHeightScale;
      varying vec3 vGroundView;
      ${groundNoise}
      vec3 groundNormal(vec3 point, vec3 normal, float height){
        vec3 dx=dFdx(point), dy=dFdy(point);
        vec3 r1=cross(dy,normal), r2=cross(normal,dx);
        float det=dot(dx,r1);
        vec3 gradient=sign(det)*(dFdx(height)*r1+dFdy(height)*r2);
        return normalize(abs(det)*normal-gradient);
      }
      void main(){`)
    .replace('float drift=uTime*.004;', `
      float groundFacing=clamp(dot(n,v),.0,1.);
      float nearGround=uGround*smoothstep(.04,.42,groundFacing);
      n=groundNormal(vGroundView,n,groundHeight(normalize(vP))*uRadius*uHeightScale*nearGround*.32);
      float drift=uTime*.004;`)
    .replace('float ndl=dot(n,L), mu=clamp(dot(n,v),.035,1.);',
      'float ndl=dot(n,L), mu=clamp(groundFacing,.035,1.);')
    .replace('}else{ gl_FragColor=vec4(vec3(max(lum,0.)),1.); }', `}else{
      float grains=noise3(normalize(vP)*120.0);
      float turf=fbm(normalize(vP)*95.0);
      float groundLight=(.042+surface*.14)*mix(.87,1.07,turf)*mix(.97,1.03,grains);
      float haze=exp(-groundFacing*13.0)*.65;
      float closeLight=mix(groundLight,.065,haze);
      lum=mix(lum*.20,closeLight,uGround);
      vec3 groundColor=vec3(max(lum,0.))*mix(vec3(1.),vec3(.997,1.,.996),uGround*.85);
      gl_FragColor=vec4(groundColor,1.);
    }`);

  function buildObservatory() {
    const building = new T.Group();
    function surface(color,roughness,metalness,metal=false) {
      const material=new T.MeshStandardMaterial({color,roughness,metalness});
      material.onBeforeCompile=shader=>{
        shader.vertexShader='varying vec3 vSurface;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\n vSurface=position;');
        shader.fragmentShader=`varying vec3 vSurface;
          float grain(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
          float mottling(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
            return mix(mix(mix(grain(i),grain(i+vec3(1,0,0)),f.x),mix(grain(i+vec3(0,1,0)),grain(i+vec3(1,1,0)),f.x),f.y),
              mix(mix(grain(i+vec3(0,0,1)),grain(i+vec3(1,0,1)),f.x),mix(grain(i+vec3(0,1,1)),grain(i+vec3(1,1,1)),f.x),f.y),f.z);}
          `+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>', `
          #include <color_fragment>
          float weather=mottling(vSurface*.32);
          float pores=mottling(vSurface*3.5);
          float streak=mottling(vSurface*vec3(1.4,.07,1.4));
          diffuseColor.rgb*=mix(.72,1.08,weather)*mix(.90,1.04,pores)*mix(.90,1.,streak);
          ${metal ? 'float seam=pow(.5+.5*cos(atan(vSurface.x,vSurface.z)*18.),36.);diffuseColor.rgb*=1.-seam*.18;' : ''}
          // Soft ambient occlusion at the foundation and beneath the eaves.
          diffuseColor.rgb*=mix(.72,1.,smoothstep(-6.,-2.,vSurface.y));
        `);
        shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',
          '#include <roughnessmap_fragment>\n roughnessFactor=clamp(roughnessFactor+(pores-.5)*.18,.28,1.);');
        shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>', `
          #include <normal_fragment_maps>
          vec3 qx=dFdx(-vViewPosition),qy=dFdy(-vViewPosition);
          vec3 rx=cross(qy,normal),ry=cross(normal,qx);
          float det=dot(qx,rx);
          normal=normalize(abs(det)*normal-sign(det)*(dFdx(pores)*rx+dFdy(pores)*ry)*.035);
        `);
      };
      material.customProgramCacheKey=()=>metal?'station-metal':'station-stone';
      return material;
    }
    const wall = surface(0x777a75,.92,.02);
    const roof = surface(0x68716e,.48,.42,true);
    const trim = surface(0x303936,.76,.15);
    const windowLight = new T.MeshBasicMaterial({color:0xffc47c});
    function box(w,h,d,x,y,z,material) {
      const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);
      mesh.position.set(x,y,z); building.add(mesh); return mesh;
    }
    box(58,2,29,-5,1,0,trim);
    box(32,13,22,-17,8,0,wall);
    box(35,1.5,25,-17,15,0,roof);
    const drum=new T.Mesh(new T.CylinderGeometry(11,11,12,32),wall);
    drum.position.set(10,8,0); building.add(drum);
    const dome=new T.Mesh(new T.SphereGeometry(11.5,32,20,0,Math.PI*2,0,Math.PI/2),roof);
    dome.position.set(10,14,0); building.add(dome);
    // A narrow dark shutter makes this read as an observatory dome, not another house.
    box(2,9,1,10,18,10,trim);
    // Recesses, sills and narrow mullions break up the flat luminous rectangles.
    for (const x of [-27,-20,-13]) {
      box(4.9,5.4,.65,x,9,11.2,trim);
      box(3.8,4.3,.15,x,9,11.58,windowLight);
      box(.22,4.5,.2,x,9,11.72,trim);
      box(5.2,.45,1.2,x,6.6,11.7,roof);
    }
    box(4.5,8,.6,-5,5.5,11.3,trim);
    box(3.2,6.8,.15,-5,5.5,11.65,windowLight);
    box(35,.6,1,-17,13.9,11.5,trim);
    const rim=new T.Mesh(new T.CylinderGeometry(11.7,11.7,.7,48),trim);
    rim.position.set(10,14,0);building.add(rim);
    box(4,1,4,-5,1,14,roof);
    box(6,1,4,-5,.5,17,trim);
    const glow = new T.ShaderMaterial({
      transparent:true, depthWrite:false,
      vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader:'varying vec2 vUv; void main(){ float r=length((vUv-.5)*2.); float a=pow(max(0.,1.-r),2.)*.32; gl_FragColor=vec4(.82,.43,.12,a); }'
    });
    function pool(parent,size,x,z) {
      const mesh=new T.Mesh(new T.PlaneGeometry(size,size),glow);
      mesh.rotation.x=-Math.PI/2; mesh.position.set(x,.1,z); parent.add(mesh);
    }
    pool(building,65,-14,20);
    scene.add(building);
    // Broad contact shadow grounds the base without hard graphic outlines.
    const contactShadow=new T.Mesh(new T.PlaneGeometry(86,55),new T.ShaderMaterial({
      transparent:true,depthWrite:false,
      vertexShader:glow.vertexShader,
      fragmentShader:'varying vec2 vUv;void main(){float r=length((vUv-.5)*2.);gl_FragColor=vec4(.025,.03,.026,pow(max(0.,1.-r),1.6)*.48);}'
    }));
    contactShadow.rotation.x=-Math.PI/2;contactShadow.position.set(-5,.06,3);building.add(contactShadow);
    scene.add(new T.HemisphereLight(0xdce3eb,0x252522,.62));
    const sun=new T.DirectionalLight(0xe4e9ed,1.15);
    sun.position.set(-100,200,100); scene.add(sun);
    return building;
  }
  // Anchor each object to the sphere's front surface and tilt it along the local slope.
  function placeOnGround(object,px,py,scale,radius,cx,cy) {
    const dx=px-cx, dy=py-cy;
    const z=Math.sqrt(Math.max(0,radius*radius-dx*dx-dy*dy));
    object.position.set(px,py,z+Math.min(radius*.0015,4));
    object.rotation.x=Math.atan2(z,dy);
    object.rotation.z=-Math.atan2(dx,dy);
    object.scale.setScalar(scale);
  }

  function initialise() {
    try {
      renderer = new T.WebGLRenderer({ canvas, alpha:true, antialias:true });
      renderer.setClearColor(0x000000, 0);
      scene = new T.Scene();
      camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 100000);
      camera.position.z = 30000;
      light = { value:new T.Vector3(-.55, .75, -.38).normalize() };
      day = { value:0 };
      globe = new T.Mesh(new T.SphereGeometry(1, window.innerWidth < 700 ? 160 : 256, 160), new T.ShaderMaterial({
        vertexShader:groundVertex, fragmentShader:groundFragment,
        extensions:{derivatives:true},
        uniforms:{ uGround:{value:0}, uHeightScale:{value:1}, uRadius:{value:1}, uTime:{value:32}, uLight:light, uDay:day, uAtmo:{value:1},
          uPen:{value:.06}, uTurb:{value:0}, uBand:{value:1} }
      }));
      globe.rotation.z = -.12;
      atmosphere = new T.Mesh(new T.SphereGeometry(1.008, 128, 64), new T.ShaderMaterial({
        vertexShader:shaders.atmosphereVertex,
        fragmentShader:shaders.atmosphereFragment.replace('vec3 c=ray*dot(vCen,ray)-vCen;', 'vec3 c=vec3(vMV.xy-vCen.xy,0.);'),
        uniforms:{uLight:light, uDay:day, uDens:{value:.45}, uFwd:{value:0}, uRp:{value:1}, uRs:{value:1.008}},
        side:T.BackSide, transparent:true, depthWrite:false, blending:T.AdditiveBlending
      }));
      scene.add(globe, atmosphere);
      observatory = buildObservatory();
      meadow = window.createPenumbraMeadow?.(T,renderer,scene);
      landing.classList.add('has-planet-renderer');
      return true;
    } catch (_) {
      renderer?.dispose(); renderer = null; failed = true;
      return false; // The landing's CSS silhouette remains available without WebGL.
    }
  }
  function draw() {
    pending = 0;
    clearTimeout(breezeTimer); breezeTimer = 0;
    if (document.hidden) return;
    const w = window.innerWidth, h = window.innerHeight;
    const remaining = Math.max(0, document.documentElement.scrollHeight - window.scrollY - h);
    const distance = Math.max(h, about.offsetHeight + landing.offsetHeight);
    const progress = clamp(1 - remaining / distance);
    if (!enabled || !progress || failed) { canvas.style.opacity = '0'; lastWind = 0; return; }
    if (!renderer && !initialise()) return;
    if (w !== width || h !== height) {
      width = w; height = h;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 700 ? 1 : 1.5));
      renderer.setSize(w, h, false);
      camera.left = -w / 2; camera.right = w / 2;
      camera.top = h / 2; camera.bottom = -h / 2;
      camera.updateProjectionMatrix();
    }
    const approach = smooth(progress);
    const radius = w * (.32 + 7.8 * approach * approach);
    const heightScale = (.32 + 2.3 * approach * approach) / (.32 + 7.8 * approach * approach);
    const atmosphereWidth = Math.min(18,w*.02);
    // The luminous limb always stays below the last contact link, even after reflow.
    const contactBottom = contact.getBoundingClientRect().bottom;
    const apex = Math.max(h * (1.12 - .50 * approach), contactBottom + 48 + atmosphereWidth);
    const x = w * (.76 - .20 * approach) - w / 2;
    const y = h / 2 - apex - radius;
    globe.scale.setScalar(radius); atmosphere.scale.setScalar((radius+atmosphereWidth)/1.008);
    globe.material.uniforms.uHeightScale.value = heightScale;
    globe.material.uniforms.uGround.value = smooth((approach - .3) / .7);
    globe.material.uniforms.uRadius.value = radius;
    atmosphere.material.uniforms.uRp.value = radius * (1 + .0004 * heightScale * globe.material.uniforms.uGround.value);
    atmosphere.material.uniforms.uRs.value = radius + atmosphereWidth;
    globe.position.set(x, y, 0); atmosphere.position.copy(globe.position);
    const settlement = smooth((approach - .45) / .55);
    observatory.visible = settlement > .01;
    const buildingScale = Math.min(2, Math.max(1.05, w / 620)) * (.55 + .45 * settlement);
    const baseX = w * .73 - w/2;
    const baseY = h/2 - apex - 42;
    placeOnGround(observatory,baseX,baseY,buildingScale*settlement,radius,x,y);
    // Match the low meadow viewpoint: show less roof and keep the facade level.
    observatory.rotation.x = Math.min(observatory.rotation.x,.09);
    observatory.rotation.z = 0;
    const isDay = document.documentElement.dataset.theme === 'day';
    day.value = isDay ? 1 : 0;
    atmosphere.material.blending = isDay ? T.NormalBlending : T.AdditiveBlending;
    canvas.style.opacity = String(smooth(progress / .2));
    const now = performance.now();
    windTime += lastWind ? Math.min(.1,(now-lastWind)/1000) : 0;
    lastWind = now;
    if (meadow) {
      meadow.update({w,h,apex,radius,center:x+w/2,reveal:settlement,time:windTime});
      meadow.render(camera);
      // A gentle 30 Hz breeze only while the actual meadow is on screen.
      if (settlement > .05 && apex < h-24) breezeTimer = setTimeout(schedule,33);
    } else renderer.render(scene,camera);
  }
  function schedule() {
    if (!pending && !document.hidden) pending = requestAnimationFrame(draw);
  }
  window.addEventListener('scroll', schedule, {passive:true});
  window.addEventListener('resize', schedule, {passive:true});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(pending); pending = 0; clearTimeout(breezeTimer); breezeTimer = 0; lastWind = 0; }
    else schedule();
  });
  motion?.subscribe(value => { enabled = value; clearTimeout(breezeTimer); breezeTimer = 0; lastWind = 0; schedule(); });
  new MutationObserver(schedule).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
  if ('ResizeObserver' in window) {
    const resize = new ResizeObserver(schedule);
    resize.observe(document.body);
    resize.observe(contact);
  }
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); failed = true; canvas.style.opacity = '0';
    landing.classList.remove('has-planet-renderer');
  });
  schedule();
})();
