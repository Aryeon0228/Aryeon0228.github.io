import {bloomLinear} from './room-bloom.mjs';
import {srgb} from './lighting-physics.mjs';
import {SOURCES,balancedColor} from './light-sources.mjs';
import {roomContributions} from './room-physics.mjs';
const EPS=1e-4;
const normalize=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);};
const sun=normalize([-1,.5,-.3]);
export function roomCamera(s){
 const yaw=(s.viewYaw??0)*Math.PI/180,pitch=(s.viewPitch??Math.atan(.12)*180/Math.PI)*Math.PI/180,r=13*Math.hypot(1,.12);
 const cam=[Math.sin(yaw)*r*Math.cos(pitch),1.24+r*Math.sin(pitch),8-Math.cos(yaw)*r*Math.cos(pitch)];
 const forward=normalize([-cam[0],1.24-cam[1],8-cam[2]]),right=[Math.cos(yaw),0,Math.sin(yaw)];
 const up=[forward[1]*right[2],forward[2]*right[0]-forward[0]*right[2],-forward[1]*right[0]];
 return {cam,forward,right,up};
}
const receiver=[0,.9,8],cubeMin=[-.85,0,8],cubeMax=[.85,1.8,9.5];
const sampleWindow=.08-sun[2];
// Both panes share a camera and one geometry cache; light settings never move the view.
let geometry,geometryKey;
function cubeBlocks(p,d,limit=Infinity){
 let near=-Infinity,far=Infinity;
 for(let k=0;k<3;k++){
  if(Math.abs(d[k])<1e-9){if(p[k]<cubeMin[k]||p[k]>cubeMax[k])return false;continue;}
  let a=(cubeMin[k]-p[k])/d[k],b=(cubeMax[k]-p[k])/d[k];if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);
 }
 return far>=Math.max(near,EPS)&&near<limit-EPS&&far>EPS;
}
function buildGeometry(W,H,camera){
 const N=W*H,{cam,forward,right,up}=camera;
 const positions=new Float32Array(N*3),normals=new Float32Array(N*3),day=new Float32Array(N),rho=new Float32Array(N),kind=new Uint8Array(N);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=y*W+x,dx=(2*(x+.5)/W-1)*.9,dy=(1-2*(y+.5)/H)*.6;
  const ray=normalize(forward.map((v,k)=>v+dx*right[k]+dy*up[k]));let best=Infinity,hit=null,n=null,type=0;
  function plane(axis,value,normal,bounds,t){
   // Hide only camera-facing outer walls to keep the room visible as a cutaway.
   if(t===2&&(cam[axis]-value)*normal[axis]<=0)return;
   const distance=(value-cam[axis])/ray[axis];if(distance<EPS||distance>=best||!Number.isFinite(distance))return;
   const p=cam.map((v,k)=>v+ray[k]*distance);if(!bounds(p))return;best=distance;hit=p;n=normal;type=t;
  }
  plane(1,0,[0,1,0],p=>Math.abs(p[0])<=5&&p[2]>=-3&&p[2]<=12,1);
  for(const side of [-1,1])plane(0,5*side,[-side,0,0],p=>p[1]>=0&&p[1]<=4.5&&p[2]>=-3&&p[2]<=12,2);
  plane(2,12,[0,0,-1],p=>Math.abs(p[0])<=5&&p[1]>=0&&p[1]<=4.5,2);
  plane(2,8,[0,0,-1],p=>Math.abs(p[0])<=.85&&p[1]>=0&&p[1]<=1.8,3);
  plane(2,9.5,[0,0,1],p=>Math.abs(p[0])<=.85&&p[1]>=0&&p[1]<=1.8,3);
  for(const side of [-1,1])plane(0,.85*side,[side,0,0],p=>p[1]>=0&&p[1]<=1.8&&p[2]>=8&&p[2]<=9.5,3);
  plane(1,1.8,[0,1,0],p=>Math.abs(p[0])<=.85&&p[2]>=8&&p[2]<=9.5,3);
  if(!hit)continue;
  if(hit[0]<-4.999&&hit[1]>1.2&&hit[1]<4.2&&hit[2]>3.5&&hit[2]<8.5){
   const mullion=Math.abs(hit[1]-2.7)<.06||Math.abs(hit[2]-6)<.08;type=mullion?2:4;
  }
  const start=hit.map((v,k)=>v+n[k]*EPS),t=(-5-start[0])/sun[0],wy=start[1]+t*sun[1],wz=start[2]+t*sun[2];
  const through=t>0&&wy>1.2&&wy<4.2&&wz>3.5&&wz<8.5&&!cubeBlocks(start,sun,t);
  day[i]=(.08+(through?Math.max(0,n.reduce((v,a,k)=>v+a*sun[k],0)):0))/sampleWindow;
  rho[i]=type===1?((Math.floor(hit[0]*1.3)+Math.floor(hit[2]*1.3))%2===0?.16:.22):.18;
  // The framed reference patch is a uniform sample at its center, the reported receiver.
  if(type===3&&Math.abs(hit[2]-8)<EPS&&Math.abs(hit[0])<.28&&Math.abs(hit[1]-.9)<.28){type=5;day[i]=1;rho[i]=.18;}
  kind[i]=type;positions.set(hit,i*3);normals.set(n,i*3);
 }
 return {positions,normals,day,rho,kind};
}
export function renderRoomPair(leftCanvas,rightCanvas,s,interactive=false){
 const W=interactive?240:480,H=interactive?160:320,N=W*H,camera=roomCamera(s),{cam,forward,right,up}=camera;
 const contexts=[leftCanvas,rightCanvas].map(c=>c.getContext?.('2d'));if(contexts.some(c=>!c))return;
 const key=[W,H,s.viewYaw,s.viewPitch].join(',');
 if(key!==geometryKey){geometry=buildGeometry(W,H,camera);geometryKey=key;}
 for(const c of [leftCanvas,rightCanvas]){if(c.width!==W)c.width=W;if(c.height!==H)c.height=H;}
 const {positions,normals,day,rho,kind}=geometry,amount=roomContributions(s);
 const windowRGB=s.color?balancedColor(SOURCES[s.outside].color):[1,1,1],lampRGB=s.color?balancedColor(SOURCES[s.lamp].color):[1,1,1];
 const lamp=[0,.9,8-s.distance],power=s.lampOn?SOURCES[s.lamp].intensity*s.count:0;
 const frames=contexts.map(ctx=>ctx.createImageData(W,H));
 const hdr=[new Float32Array(N*3),new Float32Array(N*3)],exposureScale=2**s.exposure/100000*(.18/.82);
 for(let i=0;i<N;i++){
  const j=i*3,k=i*4;let local=0;
  if(kind[i]&&kind[i]!==4&&power){
   if(kind[i]===5)local=amount.lampLux;
   else{const p=[positions[j],positions[j+1],positions[j+2]],n=[normals[j],normals[j+1],normals[j+2]],v=lamp.map((a,q)=>a-p[q]),r=Math.hypot(...v),d=v.map(a=>a/r),cos=Math.max(0,n.reduce((a,b,q)=>a+b*d[q],0));
    if(cos>0&&!cubeBlocks(p.map((a,q)=>a+n[q]*EPS),d,r))local=power*cos/(r*r);
   }
  }
  const win=kind[i]===4?(s.windowOn?s.outdoorLux*.3:0):amount.windowLux*day[i];
  for(let side=0;side<2;side++){
   for(let c=0;c<3;c++){const light=win*windowRGB[c]+(side===1?local*lampRGB[c]:0);hdr[side][j+c]=kind[i]?light*((rho[i]||.18)/.18)*exposureScale:(7/255/12.92)/(1-7/255/12.92);}
   frames[side].data[k+3]=255;
  }
 }
 for(let side=0;side<2;side++){
  const linear=s.bloom?bloomLinear(hdr[side],W,H):hdr[side];
  for(let i=0;i<N;i++)for(let c=0;c<3;c++){const x=linear[i*3+c];frames[side].data[i*4+c]=Math.round(255*Math.min(1,srgb(x/(1+x))));}
 }
 const project=p=>{const v=p.map((a,i)=>a-cam[i]),depth=v.reduce((a,b,i)=>a+b*forward[i],0);return [W/2+(v.reduce((a,b,i)=>a+b*right[i],0)/depth)/.9*W/2,H/2-(v.reduce((a,b,i)=>a+b*up[i],0)/depth)/.6*H/2];};
 const corners=[[-.28,.62,8],[.28,.62,8],[.28,1.18,8],[-.28,1.18,8]].map(project);
 const hidden=cubeBlocks(cam,normalize(receiver.map((v,k)=>v-cam[k])),Math.hypot(...receiver.map((v,k)=>v-cam[k])));
 contexts.forEach((ctx,side)=>{
  ctx.putImageData(frames[side],0,0);
  // Draw an actual projected patch outline, with a dashed locator when the block hides it.
  const scale=W/480,[x,y]=project(receiver);ctx.lineWidth=1.5*scale;ctx.strokeStyle='#b9e8ff';ctx.setLineDash(hidden?[4*scale,3*scale]:[]);
  ctx.beginPath();corners.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.stroke();ctx.setLineDash([]);
  const label=hidden?'측정면 · 반대편 (점선)':'측정면 · 18%',lx=Math.max(6*scale,Math.min(W-154*scale,x-45*scale)),ly=Math.min(H-42*scale,Math.max(...corners.map(p=>p[1]))+20*scale);
  ctx.font=12*scale+'px sans-serif';ctx.fillStyle='rgba(10,17,28,.85)';ctx.fillRect(lx-4*scale,ly-13*scale,158*scale,19*scale);ctx.fillStyle='#d5e2ff';ctx.fillText(label,lx,ly);
  ctx.fillStyle='rgba(10,17,28,.85)';ctx.fillRect(12*scale,H-33*scale,(side?150:110)*scale,23*scale);ctx.fillStyle='#e0e8f6';ctx.fillText(side?(s.lampOn?SOURCES[s.lamp].name+' '+s.count+'개 · '+s.distance.toFixed(1)+' m':'실내 조명 꺼짐'):'창빛만',20*scale,H-17*scale);
 });
}
