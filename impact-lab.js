(() => {
  'use strict';
  const tr = (key, values) => window.impactI18n.t(key, values);
  const canvas = document.getElementById('arena');
  const ctx = canvas.getContext('2d', { alpha: false });
  const W = 1100, H = 740, TAU = Math.PI * 2;
  const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
  const lerp = (a,b,t) => a+(b-a)*t;
  const defaults = {hitstop:60,shake:7,recoil:12,knockback:35,particles:25,flash:80,sound:35};
  const limits = {hitstop:140,shake:16,recoil:24,knockback:70,particles:50,flash:180,sound:100};
  const effects = Object.fromEntries(Object.entries(defaults).map(([id,value])=>[id,{on:true,value}]));
  const keys = new Set(), pointerKeys = new Map();
  let auto=false, paused=false, reduced=false, reducedCache=null, applyingReduced=false, shooting=false;
  let player, targets, bullets, motes, rings, texts, hits, shots, destroyed, combo, lastHit;
  let elapsed=0, realTime=0, freeze=0, shake=0, shotCooldown=0, slashCooldown=0, slash=0, recoil=0;
  let aim={x:800,y:370}, aimAngle=0, pointerInside=false, lastFrame=0, view={scale:1,x:0,y:0};
  let audio=null, master=null, noiseBuffer=null, soundReady=false, lastStats=0;
  let cssW=1,cssH=1,dpr=1;
  const enabled = id => effects[id].on && effects[id].value>0;
  const value = id => enabled(id)?effects[id].value:0;
  const event = (name,detail) => window.dispatchEvent(new CustomEvent(name,{detail}));
  const getState = () => ({effects:structuredClone(effects),auto,paused,reduced,hits,shots,destroyed,combo,
    player:{x:player.x,y:player.y},targets:targets.map(t=>({x:t.x+t.ox,y:t.y+t.oy,hp:t.hp,respawn:t.respawn})),
    bullets:bullets.length,particles:motes.length,freeze,shake,soundReady});
  const settings = () => event('impact:settings', getState());
  function stats(){event('impact:stats',{hits,shots,combo,destroyed,active:Object.values(effects).filter(e=>e.on&&e.value>0).length,paused,auto});}
  function reset(){
    player={x:295,y:385,vx:0,vy:0};
    targets=[{x:795,y:210},{x:825,y:385},{x:755,y:560}].map((t,i)=>({...t,i,ox:0,oy:0,vx:0,vy:0,hp:100,respawn:0,flash:0,wobble:0}));
    bullets=[];motes=[];rings=[];texts=[];hits=0;shots=0;destroyed=0;combo=0;lastHit=-20;
    elapsed=0;freeze=0;shake=0;shotCooldown=0;slashCooldown=0;slash=0;recoil=0;
    stats();
  }
  function setEffect(id,on,n){
    if(!effects[id])return;
    if(reduced&&!applyingReduced){reduced=false;reducedCache=null;}
    effects[id].on=!!on;
    if(Number.isFinite(Number(n)))effects[id].value=clamp(Number(n),0,limits[id]);
    if(id==='shake'&&!on)shake=0;
    if(id==='particles'&&!on){motes=[];rings=[];texts=[];}
    if(id==='recoil'&&!on)recoil=0;
    if(id==='knockback'&&!on)targets.forEach(t=>{t.ox=0;t.oy=0;t.vx=0;t.vy=0;t.wobble=0;});
    if(id==='hitstop'&&!on)freeze=0;
    if(id==='flash'&&!on)targets.forEach(t=>t.flash=0);
    if(id==='sound'&&master)master.gain.setTargetAtTime(on?effects.sound.value/100*.42:0,audio.currentTime,.025);
    settings();stats();
  }
  function setAll(on){Object.keys(effects).forEach(id=>setEffect(id,on,effects[id].value));}
  function setPaused(v){paused=!!v;shooting=false;keys.clear();pointerKeys.clear();if(master)master.gain.setTargetAtTime(paused?0:value('sound')/100*.42,audio.currentTime,.025);settings();stats();}
  function setReduced(v){
    if(v===reduced)return;
    reduced=!!v;
    applyingReduced=true;
    if(reduced){reducedCache=structuredClone(effects);['shake','hitstop','flash'].forEach(id=>setEffect(id,false,effects[id].value));setEffect('particles',true,10);}
    else if(reducedCache){for(const [id,e] of Object.entries(reducedCache))setEffect(id,e.on,e.value);reducedCache=null;}
    applyingReduced=false;settings();
  }
  function unlockAudio(){
    try{
      if(!audio){
        const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
        audio=new AC();master=audio.createGain();master.gain.value=value('sound')/100*.42;master.connect(audio.destination);
        noiseBuffer=audio.createBuffer(1,audio.sampleRate*.3,audio.sampleRate);
        const data=noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      }
      if(audio.state==='suspended')audio.resume().then(()=>{soundReady=audio.state==='running';});
      soundReady=audio.state==='running';
    }catch{}
  }
  function tone(freq,end,duration,gain,type='sine'){
    const t=audio.currentTime,osc=audio.createOscillator(),g=audio.createGain();
    osc.type=type;osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    osc.connect(g);g.connect(master);osc.start(t);osc.stop(t+duration+.02);
  }
  function sound(kind){
    if(!enabled('sound')||!audio||audio.state!=='running'||paused)return;
    if(kind==='shot'){tone(260,80,.065,.11,'triangle');return;}
    const heavy=kind==='break'||kind==='melee';
    tone(heavy?110:170,42,heavy?.22:.12,heavy?.45:.27);
    tone(heavy?540:900,heavy?170:340,.065,.1,'triangle');
    const t=audio.currentTime,src=audio.createBufferSource(),filter=audio.createBiquadFilter(),g=audio.createGain();
    src.buffer=noiseBuffer;filter.type='lowpass';filter.frequency.value=heavy?2000:3800;
    g.gain.setValueAtTime(heavy?.32:.2,t);g.gain.exponentialRampToValueAtTime(.0001,t+.12);
    src.connect(filter);filter.connect(g);g.connect(master);src.start(t);src.stop(t+.15);
  }
  function burst(x,y,angle,heavy=false){
    if(!enabled('particles'))return;
    const n=Math.round(value('particles')*(heavy?1.6:1));
    for(let i=0;i<n;i++){
      const a=angle+Math.PI+(Math.random()-.5)*3.4,speed=90+Math.random()*330;
      motes.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:.16+Math.random()*.42,max:.6,size:1.5+Math.random()*3.5,color:i%3===0?'#5bd6ff':i%3===1?'#ffbb58':'#ff7735',type:i%4===0?'line':'square'});
    }
    rings.push({x,y,life:.25,max:.25,size:heavy?82:48});
    if(motes.length>900)motes.splice(0,motes.length-900);
  }
  function hit(t,damage,a,x,y){
    if(t.respawn>0||t.hp<=0)return;
    t.hp=Math.max(0,t.hp-damage);hits++;combo=realTime-lastHit<1.8?combo+1:1;lastHit=realTime;
    if(enabled('hitstop'))freeze=Math.max(freeze,value('hitstop')/1000);
    shake=Math.max(shake,value('shake')*(damage>10?1.3:1));
    if(enabled('knockback')){t.vx+=Math.cos(a)*value('knockback')*12;t.vy+=Math.sin(a)*value('knockback')*12;t.wobble=.2;}
    t.flash=value('flash')/1000;burst(x,y,a,damage>10);
    if(enabled('particles'))texts.push({x:t.x+t.ox,y:t.y+t.oy-55,life:.7,text:damage.toString()});
    if(t.hp===0){destroyed++;t.respawn=1.3;burst(t.x+t.ox,t.y+t.oy,a,true);sound('break');}
    else sound(damage>10?'melee':'hit');
    stats();
  }
  function attack(kind='shoot'){
    if(paused||freeze>0)return false;
    if(kind==='melee'){
      if(slashCooldown>0)return false;
      slashCooldown=.55;slash=.23;recoil=value('recoil')*.6;shots++;sound('shot');
      for(const t of targets){const dx=t.x+t.ox-player.x,dy=t.y+t.oy-player.y,dist=Math.hypot(dx,dy);const diff=Math.atan2(Math.sin(Math.atan2(dy,dx)-aimAngle),Math.cos(Math.atan2(dy,dx)-aimAngle));if(dist<175&&Math.abs(diff)<1.1)hit(t,25,Math.atan2(dy,dx),t.x+t.ox-20*Math.cos(aimAngle),t.y+t.oy-20*Math.sin(aimAngle));}
      stats();return true;
    }
    if(shotCooldown>0)return false;
    shotCooldown=.2;recoil=value('recoil');shots++;
    const x=player.x+Math.cos(aimAngle)*41,y=player.y+Math.sin(aimAngle)*41;
    bullets.push({x,y,px:x,py:y,vx:Math.cos(aimAngle)*930,vy:Math.sin(aimAngle)*930,life:1.4,a:aimAngle});
    sound('shot');stats();return true;
  }
  function moveAxis(positive,negative){return [...positive].some(k=>keys.has(k))-[...negative].some(k=>keys.has(k));}
  function update(dt){
    realTime+=dt;
    shake=Math.max(0,shake-dt*35);
    if(realTime-lastHit>1.8)combo=0;
    if(freeze>0){freeze=Math.max(0,freeze-dt);return;}
    elapsed+=dt;shotCooldown=Math.max(0,shotCooldown-dt);slashCooldown=Math.max(0,slashCooldown-dt);slash=Math.max(0,slash-dt);recoil=lerp(recoil,0,Math.min(1,dt*24));
    const mx=moveAxis(['d','arrowright'],['a','arrowleft']),my=moveAxis(['s','arrowdown'],['w','arrowup']),len=Math.hypot(mx,my)||1;
    const speed=290;player.x=clamp(player.x+mx/len*speed*dt,72,W-72);player.y=clamp(player.y+my/len*speed*dt,130,H-95);player.vx=mx/len;player.vy=my/len;
    if(auto){const active=targets.filter(t=>t.respawn<=0);if(active.length){const nearest=active.reduce((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)<Math.hypot(b.x-player.x,b.y-player.y)?a:b);aim={x:nearest.x+nearest.ox,y:nearest.y+nearest.oy};}}
    aimAngle=Math.atan2(aim.y-player.y,aim.x-player.x);
    if(auto||shooting)attack('shoot');if(keys.has(' '))attack('melee');
    for(const t of targets){
      if(t.respawn>0){t.respawn-=dt;if(t.respawn<=0){t.hp=100;t.ox=0;t.oy=0;t.vx=0;t.vy=0;}continue;}
      t.flash=Math.max(0,t.flash-dt);t.wobble=Math.max(0,t.wobble-dt);
      t.vx+=(-t.ox*140-t.vx*16)*dt;t.vy+=(-t.oy*140-t.vy*16)*dt;t.ox+=t.vx*dt;t.oy+=t.vy*dt;
    }
    for(const b of bullets){
      b.px=b.x;b.py=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
      for(const t of targets){
        if(t.respawn>0)continue;
        const tx=t.x+t.ox,ty=t.y+t.oy,dx=b.x-b.px,dy=b.y-b.py;
        const q=clamp(((tx-b.px)*dx+(ty-b.py)*dy)/(dx*dx+dy*dy||1),0,1),cx=b.px+dx*q,cy=b.py+dy*q;
        if(Math.hypot(cx-tx,cy-ty)<30){hit(t,10,b.a,cx,cy);b.life=-1;break;}
      }
    }
    bullets=bullets.filter(b=>b.life>0&&b.x>10&&b.x<W-10&&b.y>100&&b.y<H-60);
    for(const p of motes){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.max(0,1-dt*3);p.vy*=Math.max(0,1-dt*3);p.life-=dt;}
    motes=motes.filter(p=>p.life>0);
    for(const r of rings)r.life-=dt;rings=rings.filter(r=>r.life>0);
    for(const t of texts){t.y-=dt*44;t.life-=dt;}texts=texts.filter(t=>t.life>0);
  }
  function round(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
  function line(x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  function circle(x,y,r,fill,stroke,width=1){ctx.beginPath();ctx.arc(x,y,r,0,TAU);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
  function label(text,x,y,size,color,align='left',weight=500){ctx.font=`${weight} ${size}px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(text,x,y);}
  function polygon(points,fill,stroke,width=1){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
  function floor(){
    ctx.fillStyle='#080f24';ctx.fillRect(0,0,W,H);
    // Floor panels give the test space a fixed reference for camera motion.
    for(let y=100;y<H-60;y+=64)for(let x=34;x<W-34;x+=64){ctx.fillStyle=((x-34)/64+(y-100)/64)%2?'#0b1835':'#0c1a38';ctx.fillRect(x+1,y+1,62,62);}
    ctx.save();ctx.strokeStyle='#16315a';ctx.lineWidth=1;
    ctx.strokeRect(34,100,W-68,H-160);
    for(let y=100;y<=H-60;y+=64){ctx.beginPath();ctx.moveTo(34,y);ctx.lineTo(W-34,y);ctx.stroke();}
    for(let x=34;x<W-34;x+=64){ctx.beginPath();ctx.moveTo(x,100);ctx.lineTo(x,H-60);ctx.stroke();}
    ctx.restore();
    for(const [x,y,sx,sy] of [[52,118,1,1],[W-52,118,-1,1],[52,H-78,1,-1],[W-52,H-78,-1,-1]]){line(x,y,x+22*sx,y,'#4d76a7',2);line(x,y,x,y+22*sy,'#4d76a7',2);}
    ctx.save();ctx.setLineDash([5,11]);line(590,125,590,H-85,'#23426c');ctx.restore();
    label(tr('canvas.start'),150,H-112,13,'#819ac1');label(tr('canvas.zone'),W-160,H-112,13,'#819ac1','center');
    ctx.save();ctx.globalAlpha=.45;label('IMPACT',W/2,H/2-45,88,'#23416d','center',800);label('TRAINING ROOM',W/2,H/2+18,19,'#3e6396','center',600);ctx.restore();
    line(36,83,W-36,83,'#1c355b');label(tr('canvas.practice'),38,44,20,'#deebff','left',700);
    label(tr('canvas.damage'),W-38,42,14,'#a0b8dc','right');
  }
  function drawTarget(t){
    const x=t.x+t.ox,y=t.y+t.oy;
    circle(t.x,t.y+26,45,null,'#284978',1);
    line(t.x-50,t.y+26,t.x-42,t.y+26,'#6385b4');line(t.x+42,t.y+26,t.x+50,t.y+26,'#6385b4');
    if(t.respawn>0){
      ctx.save();ctx.setLineDash([4,6]);circle(t.x,t.y,25,null,'#3766a1',1.5);ctx.restore();
      label(tr('canvas.respawning'),t.x,t.y+60,13,'#92afd6','center');return;
    }
    ctx.save();ctx.translate(x,y);ctx.scale(1, .45);circle(0,63,30,'#030920');ctx.restore();
    ctx.save();ctx.translate(x,y);if(t.wobble>0)ctx.rotate(Math.sin(elapsed*60)*t.wobble*.32);
    const flash=t.flash>0&&enabled('flash');
    round(-30,-17,60,48,12,flash?'#ffeacc':'#b54324');
    polygon([[-27,-20],[-17,-31],[17,-31],[27,-20],[27,17],[17,27],[-17,27],[-27,17]],flash?'#fff2dd':'#f7823c','#ffb86c',1.5);
    round(-20,-13,40,22,6,flash?'#fff7e5':'#2b1b22');
    line(-12,-3,-5,-3,'#ffcd89',3);line(5,-3,12,-3,'#ffcd89',3);
    line(-10,17,10,17,'#a74626',3);
    round(-34,-7,6,23,3,'#6d352c');round(28,-7,6,23,3,'#6d352c');
    ctx.restore();
    for(let i=0;i<5;i++)round(x-29+i*12,y-47,9,3,1,i<t.hp/20?'#ffad60':'#293653');
    label(tr('canvas.target', {name:String.fromCharCode(65+t.i)}),t.x,t.y+67,13,'#92acd2','center');
  }
  function drawPlayer(){
    const x=player.x,y=player.y;
    ctx.save();ctx.translate(x,y);ctx.scale(1,.45);circle(0,65,28,'#030a20');ctx.restore();
    ctx.save();ctx.translate(x,y);ctx.rotate(aimAngle);
    // The barrel moves independently: recoil never changes movement speed.
    round(12-recoil,-10,38,20,5,'#173765','#538fce');
    round(39-recoil,-7,11,14,2,'#b5eaff');
    ctx.save();ctx.rotate(-aimAngle);
    round(-25,-16,50,45,13,'#1656aa');
    round(-25,-26,50,44,13,'#32b9f6','#8ee8ff');
    round(-19,-15,38,20,7,'#092147');
    const ex=Math.cos(aimAngle)*4,ey=Math.sin(aimAngle)*2;
    round(-11+ex,-9+ey,6,7,2,'#c0f7ff');round(5+ex,-9+ey,6,7,2,'#c0f7ff');
    line(-8,23,8,23,'#247cce',3);
    round(-32,-7,7,20,3,'#2274c2');round(25,-7,7,20,3,'#2274c2');
    ctx.restore();ctx.restore();
    if(slash>0){
      const t=1-slash/.23,a=aimAngle-1.2+t*2.4;
      ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.globalAlpha=1-t;
      ctx.beginPath();ctx.arc(0,0,145,-.6,.12);ctx.strokeStyle='#bcf5ff';ctx.lineWidth=12*(1-t)+3;ctx.stroke();
      ctx.beginPath();ctx.arc(0,0,128,-.8,0);ctx.strokeStyle='#28bbff';ctx.lineWidth=3;ctx.stroke();ctx.restore();
    }
    if(!shots&&!auto){label(tr('canvas.you'),x,y+61,13,'#62cfff','center',700);}
  }
  function draw(){
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#070f24';ctx.fillRect(0,0,cssW,cssH);
    ctx.save();ctx.translate(view.x,view.y);ctx.scale(view.scale,view.scale);
    if(shake>0&&enabled('shake'))ctx.translate(Math.sin(realTime*139)*shake,Math.cos(realTime*113)*shake*.7);
    floor();
    [...targets.map(t=>({y:t.y+t.oy,draw:()=>drawTarget(t)})),{y:player.y,draw:drawPlayer}].sort((a,b)=>a.y-b.y).forEach(o=>o.draw());
    for(const b of bullets){
      ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.a);
      round(-13,-3,20,6,3,'#b3f4ff');
      if(enabled('particles')){ctx.globalAlpha=.35;round(-31,-2,20,4,2,'#2d98f4');}ctx.restore();
    }
    for(const r of rings){const t=1-r.life/r.max;circle(r.x,r.y,r.size*t,null,`rgba(255,197,126,${(1-t)*.8})`,(1-t)*3+1);}
    for(const p of motes){ctx.globalAlpha=clamp(p.life/.15,0,1);ctx.fillStyle=p.color;if(p.type==='line')line(p.x,p.y,p.x-p.vx*.025,p.y-p.vy*.025,p.color,p.size*.5);else ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);}
    ctx.globalAlpha=1;
    for(const t of texts){ctx.globalAlpha=clamp(t.life/.25,0,1);label(t.text,t.x,t.y,20,'#ffd38b','center',800);}ctx.globalAlpha=1;
    if(pointerInside&&!auto){circle(aim.x,aim.y,10,null,'#85d8ff',1);line(aim.x-16,aim.y,aim.x-7,aim.y,'#85d8ff');line(aim.x+7,aim.y,aim.x+16,aim.y,'#85d8ff');line(aim.x,aim.y-16,aim.x,aim.y-7,'#85d8ff');line(aim.x,aim.y+7,aim.x,aim.y+16,'#85d8ff');}
    ctx.restore();
    // HUD is outside the shaken scene so controls and statistics remain stable.
    ctx.save();ctx.translate(view.x,view.y);ctx.scale(view.scale,view.scale);
    label(String(hits).padStart(3,'0'),40,H-30,30,'#e5efff','left',750);label(tr('canvas.hits'),108,H-27,14,'#a1b7d8');
    label(tr('canvas.destroyed', {count:destroyed}),W-40,H-27,14,'#a1b7d8','right');
    if(combo>1){label(tr('canvas.combo', {count:combo}),W/2,H-30,21,'#ffad63','center',750);}
    if(!shots&&!auto&&!paused){round(290,137,520,44,22,'#133267','#3769a0');label(tr('canvas.hint'),550,159,16,'#d9ebff','center');}
    if(auto){round(W/2-57,42,114,25,12,'#153c78');label(tr('canvas.auto'),W/2,55,12,'#8fdaff','center');}
    if(paused){ctx.fillStyle='rgba(3,8,25,.76)';ctx.fillRect(0,0,W,H);label(tr('canvas.paused'),W/2,H/2-18,40,'#e7f0ff','center',700);label(tr('canvas.resume'),W/2,H/2+33,17,'#aac3e7','center');}
    ctx.restore();
  }
  function resize(){const r=canvas.getBoundingClientRect();cssW=r.width;cssH=r.height;dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(cssW*dpr));canvas.height=Math.max(1,Math.round(cssH*dpr));view.scale=Math.min(cssW/W,cssH/H);view.x=(cssW-W*view.scale)/2;view.y=(cssH-H*view.scale)/2;draw();}
  function aimFrom(e){const r=canvas.getBoundingClientRect();aim.x=clamp((e.clientX-r.left-view.x)/view.scale,0,W);aim.y=clamp((e.clientY-r.top-view.y)/view.scale,0,H);aimAngle=Math.atan2(aim.y-player.y,aim.x-player.x);}
  const editing=e=>e.target.closest('input,select,textarea,[contenteditable="true"]');
  document.addEventListener('pointerdown',unlockAudio,{capture:true});
  document.addEventListener('keydown',e=>{
    if(editing(e)||e.metaKey||e.ctrlKey||e.altKey)return;
    const k=e.key.toLowerCase();
    if(e.target.closest('button')&&(k===' '||k==='enter'))return;
    if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
    if(k==='p'&&!e.repeat)setPaused(!paused);
    if(k==='r'&&!e.repeat)reset();
    if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)){keys.add(k);unlockAudio();}
  });
  document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  canvas.addEventListener('pointermove',e=>{if(e.pointerType!=='touch'||shooting)aimFrom(e);pointerInside=true;});
  canvas.addEventListener('pointerleave',()=>pointerInside=false);
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);aimFrom(e);shooting=true;unlockAudio();attack('shoot');});
  const stopPointer=()=>{shooting=false;};canvas.addEventListener('pointerup',stopPointer);canvas.addEventListener('pointercancel',stopPointer);canvas.addEventListener('lostpointercapture',stopPointer);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  document.querySelectorAll('[data-move]').forEach(button=>{
    const key={up:'w',down:'s',left:'a',right:'d'}[button.dataset.move];
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(key);pointerKeys.set(e.pointerId,key);});
    for(const n of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(n,e=>{keys.delete(pointerKeys.get(e.pointerId));pointerKeys.delete(e.pointerId);});
  });
  const touchFire=document.getElementById('touch-fire');
  if(touchFire){touchFire.addEventListener('pointerdown',e=>{e.preventDefault();touchFire.setPointerCapture(e.pointerId);const live=targets.filter(t=>t.respawn<=0);if(live.length){const nearest=live.reduce((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)<Math.hypot(b.x-player.x,b.y-player.y)?a:b);aim={x:nearest.x+nearest.ox,y:nearest.y+nearest.oy};aimAngle=Math.atan2(aim.y-player.y,aim.x-player.x);}shooting=true;unlockAudio();attack();});for(const n of ['pointerup','pointercancel','lostpointercapture'])touchFire.addEventListener(n,stopPointer);}
  document.getElementById('touch-melee')?.addEventListener('pointerdown',e=>{e.preventDefault();unlockAudio();attack('melee');});
  window.addEventListener('blur',()=>{keys.clear();shooting=false;pointerKeys.clear();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)setPaused(true);});
  reset();
  window.impactGame={setEffect,setAll,reset,setAuto:v=>{auto=!!v;unlockAudio();settings();stats();},setPaused,setReduced,attack,getState};
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)setReduced(true);
  new ResizeObserver(resize).observe(canvas);resize();
  function frame(time){const dt=Math.min((time-lastFrame)/1000||.016,.033);lastFrame=time;if(!paused)update(dt);draw();if(time-lastStats>250){stats();lastStats=time;}requestAnimationFrame(frame);}
  requestAnimationFrame(frame);event('impact:ready',getState());
})();
