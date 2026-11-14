// Perspective meadow and restrained lens effects for the closing landscape only.
(function () {
  'use strict';
  window.createPenumbraMeadow = function (T, renderer, scene) {
    const uniforms = {
      uTime:{value:0}, uSize:{value:new T.Vector2(1,1)}, uApex:{value:0},
      uNear:{value:0}, uRadius:{value:1}, uCenter:{value:0}, uReveal:{value:0}, uFov:{value:42}
    };
    const geometry = new T.InstancedBufferGeometry();
    const positions=[], uvs=[], indices=[];
    const segments=7;
    for(let i=0;i<=segments;i++) {
      const t=i/segments;
      for(const side of [-1,1]) {positions.push(side*(1-t)*.5,t,0);uvs.push((side+1)/2,t);}
      if(i<segments){ const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2); }
    }
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2)); geometry.setIndex(indices);
    let seed=56473; const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const mobile=window.innerWidth<700;
    const count=mobile?18000:38000, plants=[];
    const add=(root,kind=0,offset=0,height=0,angle=0)=>plants.push({root,detail:[kind,offset,height,angle]});
    for(let i=0;i<count;i++) add([random()*1.16-.08,3+Math.pow(random(),2)*90,random(),random()]);
    // Irregular colonies, not a repeated flower-bed pattern. Everything shares one depth order.
    const colonies=Array.from({length:9},()=>({x:.08+random()*.84,depth:7+random()*35}));
    for(let i=0;i<(mobile?400:760);i++) {
      const patch=colonies[i%colonies.length];
      const root=[patch.x+(random()-.5)*.19,Math.max(5,patch.depth+(random()-.5)*9),random(),random()];
      const height=.35+random()*.42;
      add(root,3,0,height,0); // slender living stem
      add(root,1,0,height,random()*6.283);
    }
    for(let i=0;i<(mobile?14:25);i++) {
      const x=.04+random()*.92, depth=6+random()*29;
      const height=.40+random()*.48, spread=.24+random()*.28;
      for(let branch=0;branch<7;branch++) {
        const offset=(random()-.5)*spread;
        add([x,depth,random(),random()],3,offset,height*(.6+random()*.3),0);
      }
      for(let j=0;j<110;j++) {
        const a=random()*6.283, radius=Math.sqrt(random());
        const offset=Math.cos(a)*radius*spread;
        const y=.09+height*Math.sqrt(Math.max(0.,1-radius*radius))*(.55+random()*.45);
        add([x,depth+(random()-.5)*spread*2,random(),random()],2,offset,y,random()*6.283);
      }
    }
    plants.sort((a,b)=>b.root[1]-a.root[1]);
    geometry.setAttribute('aRoot',new T.InstancedBufferAttribute(new Float32Array(plants.flatMap(p=>p.root)),4));
    geometry.setAttribute('aPlant',new T.InstancedBufferAttribute(new Float32Array(plants.flatMap(p=>p.detail)),4));
    geometry.instanceCount=plants.length;
    const material = new T.ShaderMaterial({uniforms,side:T.DoubleSide,transparent:true,depthWrite:false,depthTest:false,
      vertexShader:`
        attribute vec4 aRoot,aPlant; uniform vec2 uSize; uniform float uTime,uApex,uRadius,uCenter,uReveal,uFov,uNear;
        varying vec2 vBlade; varying float vShade,vDepth,vVisible,vKind,vVariant; varying vec2 vScreen;
        void main(){
          float focal=uSize.y*.5/tan(radians(uFov)*.5);
          float rootX=aRoot.x*uSize.x;
          float curve=pow(rootX-uCenter,2.)/(2.*uRadius);
          float rootY=uApex+curve+focal*1.45/aRoot.y;
          float t=uv.y;
          float understory=1.-step(.30,aRoot.z);
          float clumpHeight=.72+.28*sin(rootX*.017+sin(aRoot.y*.42)*2.);
          float height=mix(mix(.22,.58,aRoot.z),mix(.065,.16,aRoot.w),understory)*clumpHeight;
          if(aPlant.x>2.5) height=aPlant.z;
          float bladeWidth=aPlant.x>2.5?.005:mix(.018,.042,aRoot.w);
          float wave=sin(uTime*.82+rootX*.009+aRoot.y*.21)+.35*sin(uTime*1.37+aRoot.w*9.);
          float lean=((aRoot.w-.5)*.28+wave*.075)*mix(1.,.3,understory);
          float bx=position.x*bladeWidth + lean*t*t;
          float by=t*height-height*.12*t*t*t;
          if(aPlant.x>2.5){bx=position.x*bladeWidth+aPlant.y*t+lean*height*height*t*t;by=t*height;}
          vec2 pixel=vec2(rootX+focal*bx/aRoot.y,rootY-focal*by/aRoot.y*uReveal);
          if(aPlant.x>.5 && aPlant.x<2.5){
            vec2 local=uv*2.-1.;
            float angle=aPlant.w;
            local=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*local;
            float flower=1.-step(1.5,aPlant.x);
            vec2 extent=mix(vec2(.035,.060),vec2(.0155,.01175),flower)*mix(.75,1.25,aRoot.w);
            vec2 leaf=local*extent;
            float sway=lean*aPlant.z*aPlant.z;
            pixel=vec2(rootX+focal*(aPlant.y+sway+leaf.x)/aRoot.y,
              rootY-focal*(aPlant.z+leaf.y)/aRoot.y*uReveal);
          }
          if(uNear>.5){
            float bottom=uSize.y*(1.18+aRoot.w*.22);
            float tip=max(uApex+58.,uSize.y*(.62+aRoot.z*.18));
            pixel=vec2(rootX+focal*(position.x*.095+lean*t*t*.55)/aRoot.y,
                       bottom-(bottom-tip)*t*uReveal);
          }
          float building=1.-(1.-smoothstep(24.,52.,abs(rootX-uSize.x*.73)))*(1.-smoothstep(8.,22.,abs(rootY-uApex-44.)));
          vVisible=uNear>.5?smoothstep(.45,1.,uReveal)*.85:building*uReveal;
          vShade=.72+aRoot.z*.28+.12*sin(aRoot.w*6.28+wave*.2);
          vKind=aPlant.x;vVariant=aRoot.w;
          vDepth=aRoot.y; vBlade=uv; vScreen=pixel/uSize;
          gl_Position=vec4(pixel.x/uSize.x*2.-1.,1.-pixel.y/uSize.y*2.,-.5,1.);
        }`,
      fragmentShader:`
        varying vec2 vBlade; varying float vShade,vDepth,vVisible,vKind,vVariant; varying vec2 vScreen;
        void main(){
          if(vVisible<.05) discard;
          float leaf=smoothstep(.12,.72,vBlade.y);
          float fold=.86+.14*pow(abs(vBlade.x*2.-1.),.6);
          vec3 root=vec3(.096,.102,.094), tip=vec3(.315,.33,.30);
          // At soil level, share its quiet midtone; apply blade shading above the root.
          vec3 color=mix(root,tip*vShade*fold,leaf);
          float rim=pow(vBlade.x,8.)*.045*leaf;
          color+=vec3(.83,.85,.80)*rim;
          color=mix(color,vec3(.13,.145,.15),smoothstep(18.,95.,vDepth)*.44*leaf);
          // Flowers and individual shrub leaves use soft silhouettes on the same projected plane.
          float rooted=smoothstep(.0,.25,vBlade.y);
          if(vKind>.5 && vKind<2.5){
            vec2 p=vBlade*2.-1.;
            float r=length(p);
            float alpha;
            if(vKind<1.5){
              float angle=atan(p.y,p.x);
              float petal=.66+.23*cos(angle*5.+vVariant*6.283);
              alpha=1.-smoothstep(petal-.09,petal,r);
              vec3 ivory=vec3(.64,.60,.49), blush=vec3(.49,.40,.37);
              color=mix(ivory,blush,step(.68,vVariant))*(.72+.28*vShade);
              color*=.83+.17*cos(angle*5.);
              color=mix(color,vec3(.30,.235,.13),1.-smoothstep(.12,.25,r));
            }else{
              float outline=abs(p.x)*1.15+pow(abs(p.y),1.6);
              alpha=1.-smoothstep(.82,1.,outline);
              color=mix(vec3(.105,.125,.105),vec3(.25,.285,.235),vVariant);
              color*=.77+.23*(1.-p.x);
              float vein=1.-smoothstep(.0,.045,abs(p.x));
              color+=vec3(.025,.03,.021)*vein;
            }
            color=mix(color,vec3(.13,.145,.15),smoothstep(18.,95.,vDepth)*.44);
            rooted=alpha;
            if(alpha<.02) discard;
          }
          // Keep only a trace of vegetation color; the observatory remains the warm accent.
          float luminance=dot(color,vec3(.2126,.7152,.0722));
          color=mix(vec3(luminance),color,.04);
          gl_FragColor=vec4(color,vVisible*rooted);
        }`
    });
    const grass=new T.Mesh(geometry,material); grass.frustumCulled=false; grass.renderOrder=20; scene.add(grass);
    // A separate close lens layer: large cropped blades, blurred more strongly than the distant station.
    const nearScene=new T.Scene(), nearGeometry=geometry.clone(), nearRoots=[];
    for(let i=0;i<28;i++) {
      const edge=i%2===0?-.06+random()*.28:.78+random()*.28;
      nearRoots.push(edge,.85+random()*.65,random(),random());
    }
    nearGeometry.setAttribute('aRoot',new T.InstancedBufferAttribute(new Float32Array(nearRoots),4));
    nearGeometry.setAttribute('aPlant',new T.InstancedBufferAttribute(new Float32Array(28*4),4));
    nearGeometry.instanceCount=28;
    const nearMaterial=new T.ShaderMaterial({uniforms:{...uniforms,uNear:{value:1}},
      vertexShader:material.vertexShader,fragmentShader:material.fragmentShader,
      side:T.DoubleSide,transparent:true,depthWrite:false,depthTest:false});
    const nearGrass=new T.Mesh(nearGeometry,nearMaterial);nearGrass.frustumCulled=false;nearScene.add(nearGrass);
    const nearRaw=new T.WebGLRenderTarget(1,1,{depthBuffer:false});
    const nearA=new T.WebGLRenderTarget(1,1,{depthBuffer:false});
    const nearB=new T.WebGLRenderTarget(1,1,{depthBuffer:false});
    const target=new T.WebGLRenderTarget(1,1,{depthBuffer:true});
    const bloomA=new T.WebGLRenderTarget(1,1,{depthBuffer:false});
    const bloomB=new T.WebGLRenderTarget(1,1,{depthBuffer:false});
    const screenScene=new T.Scene(), screenCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
    const vertex='varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
    const bloomMaterial=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{tInput:{value:null},uStep:{value:new T.Vector2()},uExtract:{value:1}},vertexShader:vertex,
      fragmentShader:`uniform sampler2D tInput; uniform vec2 uStep; uniform float uExtract; varying vec2 vUv;
        vec3 light(vec2 uv){ vec3 c=texture2D(tInput,uv).rgb; return uExtract>.5?c*smoothstep(.72,.99,max(c.r,max(c.g,c.b))):c; }
        void main(){ vec3 c=light(vUv)*.22;
          for(int i=1;i<=4;i++){float d=float(i);float w=exp(-d*d/8.)*.16;c+=(light(vUv+uStep*d)+light(vUv-uStep*d))*w;}
          gl_FragColor=vec4(c,1.);}`});
    const foregroundBlur=new T.ShaderMaterial({depthTest:false,depthWrite:false,
      uniforms:{tInput:{value:null},uStep:{value:new T.Vector2()}},vertexShader:vertex,
      fragmentShader:`uniform sampler2D tInput; uniform vec2 uStep; varying vec2 vUv;
        void main(){vec4 c=vec4(0.);float total=0.;
          for(int i=-6;i<=6;i++){float d=float(i);float weight=exp(-d*d/15.);
            c+=texture2D(tInput,vUv+uStep*d)*weight;total+=weight;}
          gl_FragColor=c/total;}`});
    const composite=new T.ShaderMaterial({depthTest:false,depthWrite:false,transparent:true,uniforms:{tScene:{value:target.texture},tBloom:{value:bloomB.texture},tForeground:{value:nearB.texture},uPixel:{value:new T.Vector2()},uSize:uniforms.uSize,uApex:uniforms.uApex,uRadius:uniforms.uRadius,uCenter:uniforms.uCenter,uReveal:{value:0}},vertexShader:vertex,
      fragmentShader:`uniform sampler2D tScene,tBloom,tForeground; uniform vec2 uPixel,uSize; uniform float uReveal,uApex,uRadius,uCenter; varying vec2 vUv;
        void main(){
          vec2 pixel=vec2(vUv.x,1.-vUv.y)*uSize;
          float horizon=uApex+pow(pixel.x-uCenter,2.)/(2.*uRadius);
          float below=pixel.y-horizon;
          // Analytic meadow depth (same 42-degree lens as the blades), focus at 11 m.
          float focal=uSize.y*.5/tan(radians(42.)*.5);
          float distance=focal*1.45/max(8.,below);
          float farCoc=2.2*smoothstep(16.,48.,distance);
          float nearCoc=5.4*(1.-smoothstep(3.,8.,distance));
          float landscape=smoothstep(-58.,-20.,below);
          float coc=max(farCoc,nearCoc)*uReveal*landscape;
          vec4 c=texture2D(tScene,vUv)*.20;
          for(int i=0;i<12;i++){float a=float(i)*2.399963;float r=sqrt((float(i)+.5)/12.);
            c+=texture2D(tScene,vUv+vec2(cos(a),sin(a))*uPixel*coc*r)*(.8/12.);}
          // Thin, cool air separates the distant building and turf from the foreground.
          float mist=(1.-exp(-distance*.006))*uReveal*landscape;
          c.rgb=mix(c.rgb,vec3(.13,.145,.16)*c.a,min(.28,mist));
          vec3 bloom=texture2D(tBloom,vUv).rgb*1.1;
          vec4 foreground=texture2D(tForeground,vUv);
          vec3 finalColor=(c.rgb+bloom)*(1.-foreground.a)+foreground.rgb;
          gl_FragColor=vec4(finalColor,max(c.a,max(foreground.a,min(1.,dot(bloom,vec3(1.))))));
        }`});
    const quad=new T.Mesh(new T.PlaneGeometry(2,2),bloomMaterial); screenScene.add(quad);
    let width=0,height=0;
    return {
      update({w,h,apex,radius,center,reveal,time}) {
        uniforms.uSize.value.set(w,h);uniforms.uApex.value=apex;uniforms.uRadius.value=radius;
        uniforms.uCenter.value=center;uniforms.uReveal.value=reveal;uniforms.uTime.value=time;
        composite.uniforms.uReveal.value=reveal;
        if(w!==width||h!==height){
          width=w;height=h;const dpr=renderer.getPixelRatio();
          target.setSize(Math.round(w*dpr),Math.round(h*dpr));bloomA.setSize(Math.ceil(w/3),Math.ceil(h/3));bloomB.setSize(Math.ceil(w/3),Math.ceil(h/3));
          for(const buffer of [nearRaw,nearA,nearB]) buffer.setSize(Math.ceil(w/3),Math.ceil(h/3));
          composite.uniforms.uPixel.value.set(1/(w*dpr),1/(h*dpr));
        }
      },
      render(camera) {
        renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);
        quad.material=bloomMaterial;bloomMaterial.uniforms.tInput.value=target.texture;
        bloomMaterial.uniforms.uExtract.value=1;bloomMaterial.uniforms.uStep.value.set(3/width,0);
        renderer.setRenderTarget(bloomA);renderer.render(screenScene,screenCamera);
        bloomMaterial.uniforms.tInput.value=bloomA.texture;bloomMaterial.uniforms.uExtract.value=0;
        bloomMaterial.uniforms.uStep.value.set(0,3/height);renderer.setRenderTarget(bloomB);renderer.render(screenScene,screenCamera);
        renderer.setRenderTarget(nearRaw);renderer.clear();renderer.render(nearScene,camera);
        quad.material=foregroundBlur;foregroundBlur.uniforms.tInput.value=nearRaw.texture;
        foregroundBlur.uniforms.uStep.value.set(4/width,0);renderer.setRenderTarget(nearA);renderer.render(screenScene,screenCamera);
        foregroundBlur.uniforms.tInput.value=nearA.texture;foregroundBlur.uniforms.uStep.value.set(0,5/height);
        renderer.setRenderTarget(nearB);renderer.render(screenScene,screenCamera);
        quad.material=composite;renderer.setRenderTarget(null);renderer.clear();renderer.render(screenScene,screenCamera);
      }
    };
  };
})();
