import {SOURCES} from './light-sources.mjs';
import {RECEIVER,lampPosition,blockedBetween} from './room-geometry.mjs?v=5748b1b55a40';

// One diffuse bounce from finite floor/wall patches. Fixed geometry means visibility
// and form factors can be cached, independently of camera, exposure and bloom.
export const ROOM_REFLECTANCE={floor:.18,wall:.28};
export const BOUNCE_PATCHES=[];
for(let u=0;u<12;u++)for(let v=0;v<12;v++){
 BOUNCE_PATCHES.push({p:[-2.75+u*.5,.004,-2.75+v*.5],n:[0,1,0],area:.25,rho:ROOM_REFLECTANCE.floor});
}
for(let u=0;u<12;u++)for(let v=0;v<6;v++){
 const horizontal=-2.75+u*.5,y=(v+.5)*2.8/6,area=.5*2.8/6;
 BOUNCE_PATCHES.push({p:[horizontal,y,-2.956],n:[0,0,1],area,rho:ROOM_REFLECTANCE.wall});
 // The window is not an opaque diffuse reflector.
 if(!(y>1.15&&y<2.65&&horizontal> -1.95&&horizontal< -.65))
  BOUNCE_PATCHES.push({p:[-2.956,y,horizontal],n:[1,0,0],area,rho:ROOM_REFLECTANCE.wall});
}
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export function transferWeights(position,normal){
 const start=position.map((v,i)=>v+normal[i]*.006);
 return Float32Array.from(BOUNCE_PATCHES,patch=>{
  const d=patch.p.map((v,i)=>v-start[i]),r2=dot(d,d);if(r2<1e-8)return 0;
  const receive=dot(normal,d),send=-dot(patch.n,d);
  if(receive<=0||send<=0||blockedBetween(start,patch.p))return 0;
  // Finite-area regularization avoids point-emitter singularities near a patch.
  return receive*send/r2*patch.area/(Math.PI*r2+patch.area);
 });
}
export function integrateBounce(weights,patches){let result=0;for(let i=0;i<weights.length;i++)result+=weights[i]*patches[i];return result;}
const windowDirection=[-3/Math.sqrt(43),5/Math.sqrt(43),-3/Math.sqrt(43)];
const windowUnit=Float32Array.from(BOUNCE_PATCHES,patch=>{
 const cosine=Math.max(0,dot(patch.n,windowDirection));if(!cosine)return 0;
 const to=patch.p.map((v,i)=>v+windowDirection[i]*30);
 return blockedBetween(patch.p,to)?0:patch.rho*cosine/windowDirection[1];
});
const sensorWeights=transferWeights(RECEIVER,[0,1,0]);
let cachedKey='',cached;
export function roomBounce(s){
 const windowLux=s.windowOn?s.outdoorLux*s.reach:0,intensity=s.lampOn?SOURCES[s.lamp].intensity*s.count:0;
 const key=[s.indirect!==false,windowLux,intensity,s.distance,s.lampAzimuth,s.lampElevation].join('|');
 if(key===cachedKey)return cached;
 const p=lampPosition(s),window=new Float32Array(BOUNCE_PATCHES.length),lamp=new Float32Array(BOUNCE_PATCHES.length);
 if(s.indirect!==false)for(let i=0;i<BOUNCE_PATCHES.length;i++){
  const patch=BOUNCE_PATCHES[i];window[i]=windowUnit[i]*windowLux;
  if(!intensity)continue;
  const d=p.map((v,j)=>v-patch.p[j]),r2=dot(d,d),cosine=Math.max(0,dot(patch.n,d)/Math.sqrt(Math.max(r2,1e-8)));
  if(cosine>0&&!blockedBetween(patch.p,p))lamp[i]=patch.rho*intensity*cosine/Math.max(r2,patch.area/Math.PI);
 }
 cachedKey=key;cached={window,lamp,windowLux:integrateBounce(sensorWeights,window),lampLux:integrateBounce(sensorWeights,lamp)};return cached;
}
