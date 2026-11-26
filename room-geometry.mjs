// Shared metre-scale geometry: the renderer and lux calculation use the same blockers.
export const RECEIVER = [0, 0, 0];
export const ROOM_BOXES = [
 {center:[-1.05,.55,-.1],size:[.8,1.1,.8]},
 {center:[.55,.2,-1.65],size:[1.2,.4,.6]}
];
export const ROOM_SPHERE = {center:[1.1,.55,-.25],radius:.55};
export function lampPosition(s){
 const a=(s.lampAzimuth??0)*Math.PI/180, e=(s.lampElevation??90)*Math.PI/180;
 return [Math.sin(a)*Math.cos(e)*s.distance,RECEIVER[1]+Math.sin(e)*s.distance,Math.cos(a)*Math.cos(e)*s.distance];
}
export function positionSettings(p){
 const x=p[0],y=Math.max(.02,p[1]-RECEIVER[1]),z=p[2];
 return {distance:Math.max(.1,Math.min(10,Math.hypot(x,y,z))),lampAzimuth:Math.atan2(x,z)*180/Math.PI,lampElevation:Math.max(2,Math.min(90,Math.atan2(y,Math.hypot(x,z))*180/Math.PI))};
}
export function blockedBetween(a,b){
 const d=b.map((v,i)=>v-a[i]);
 for(const box of ROOM_BOXES){
  let lo=.0001,hi=.9999;
  for(let i=0;i<3;i++){
   const min=box.center[i]-box.size[i]/2,max=box.center[i]+box.size[i]/2;
   if(Math.abs(d[i])<1e-10){if(a[i]<min||a[i]>max){hi=-1;break;}}
   else {const t1=(min-a[i])/d[i],t2=(max-a[i])/d[i];lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));}
  }
  if(lo<=hi)return true;
 }
 const q=a.map((v,i)=>v-ROOM_SPHERE.center[i]);
 const A=d.reduce((v,n)=>v+n*n,0), B=2*d.reduce((v,n,i)=>v+n*q[i],0), C=q.reduce((v,n)=>v+n*n,0)-ROOM_SPHERE.radius**2;
 const delta=B*B-4*A*C;
 if(A>0&&delta>=0){const near=(-B-Math.sqrt(delta))/(2*A),far=(-B+Math.sqrt(delta))/(2*A);if(near<.9999&&far>.0001)return true;}
 return false;
}
