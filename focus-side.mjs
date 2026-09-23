import {SUBJECTS,blurDisc,isSharp,sharpZone,focusToScale,formatLength} from './focus-optics.mjs?v=fbf860ce43e1';
// The side view: subjects on a logarithmic distance axis, the lens and its iris, the sensor.
// Behind the lens everything is only millimetres apart, so the drawing is exaggerated: each disc on
// the sensor is drawn in proportion to its true size (DISC_SCALE px per mm, capped), and the rays
// simply run from the iris edges to the disc edges, crossing before the sensor for far subjects.

export const SUBJECT_COLORS={cactus:'#7cc47f',mug:'#8fc3e8',bear:'#e0a46a'};
const NS='http://www.w3.org/2000/svg',AXIS=130,LENS_X=440,SENSOR_X=560,NEAR_X=375,FAR_X=24,DISC_SCALE=30,DISC_MAX=86;
const xOf=d=>NEAR_X-(NEAR_X-FAR_X)*Math.min(1,Math.max(0,focusToScale(d)));
function el(name,attrs,parent){const e=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);parent?.append(e);return e;}

export function createSideView(svg){
 svg.replaceChildren();
 const zone=el('rect',{class:'sv-zone',y:36,height:188},svg);
 const axis=el('g',{class:'sv-axis'},svg);
 el('line',{x1:FAR_X-10,x2:SENSOR_X+100,y1:AXIS,y2:AXIS},axis);
 for(const [d,label] of [[.25,'25 cm'],[.5,'50 cm'],[1,'1 m'],[2,'2 m'],[5,'5 m'],[10,'10 m']]){
  el('line',{x1:xOf(d),x2:xOf(d),y1:AXIS-4,y2:AXIS+4},axis);el('text',{x:xOf(d),y:250,'text-anchor':'middle'},axis).textContent=label;
 }
 const rays=el('g',{class:'sv-rays'},svg);
 const plane=el('line',{class:'sv-plane',y1:30,y2:230},svg),planeLabel=el('text',{class:'sv-plane-label',y:24,'text-anchor':'middle'},svg);
 el('ellipse',{class:'sv-lens',cx:LENS_X,cy:AXIS,rx:9,ry:92},svg);
 const irisTop=el('rect',{class:'sv-iris',x:LENS_X-3,width:6,y:30},svg),irisBottom=el('rect',{class:'sv-iris',x:LENS_X-3,width:6},svg);
 el('line',{class:'sv-sensor',x1:SENSOR_X,x2:SENSOR_X,y1:40,y2:220},svg);
 el('text',{class:'sv-caption',x:SENSOR_X,y:24,'text-anchor':'middle'},svg).textContent='상면(센서)';
 el('text',{class:'sv-caption',x:LENS_X,y:24,'text-anchor':'middle'},svg).textContent='렌즈 · 조리개';
 const marks=el('g',{},svg),discs=el('g',{},svg);
 const subjects=SUBJECTS.map((S,i)=>{
  const g=el('g',{class:'sv-subject'},marks);el('circle',{cx:xOf(S.distance),cy:AXIS,r:4.5,fill:SUBJECT_COLORS[S.id]},g);
  el('text',{x:xOf(S.distance),y:AXIS+22+i*14,'text-anchor':'middle',fill:SUBJECT_COLORS[S.id]},g).textContent=`${S.name} ${formatLength(S.distance)}`;
  const dx=SENSOR_X+(i-1)*6;   // side by side on the sensor so a small disc is never hidden behind a larger one
  const disc=el('line',{class:'sv-disc',x1:dx,x2:dx,stroke:SUBJECT_COLORS[S.id]},discs);
  const label=el('text',{class:'sv-disc-label',x:SENSOR_X+12,y:60+i*16,fill:SUBJECT_COLORS[S.id]},discs);
  return {S,disc,label};
 });
 return function update(s,N){
  const a=88*2/N,z=sharpZone(s,N),farX=Number.isFinite(z.far)?xOf(z.far):FAR_X-10;
  zone.setAttribute('x',farX);zone.setAttribute('width',Math.max(1.5,xOf(z.near)-farX));
  plane.setAttribute('x1',xOf(s));plane.setAttribute('x2',xOf(s));planeLabel.setAttribute('x',xOf(s));planeLabel.textContent='초점면 '+formatLength(s);
  irisTop.setAttribute('height',Math.max(0,AXIS-a-30));irisBottom.setAttribute('y',AXIS+a);irisBottom.setAttribute('height',Math.max(0,230-AXIS-a));
  rays.replaceChildren();
  for(const {S,disc,label} of subjects){
   const color=SUBJECT_COLORS[S.id],sharp=isSharp(S.distance,s,N),x0=xOf(S.distance),mmSigned=blurDisc(S.distance,s,N);
   const half=Math.min(DISC_MAX,Math.abs(mmSigned)*DISC_SCALE/2),opacity=sharp?.95:.5,sign=mmSigned>=0?1:-1;
   for(const side of [-1,1]){
    const ya=AXIS+side*a,ys=AXIS+side*sign*half;       // nearer subjects meet behind the sensor: same side; farther ones cross first
    el('line',{x1:x0,y1:AXIS,x2:LENS_X,y2:ya,stroke:color,'stroke-opacity':opacity*.7},rays);
    el('line',{x1:LENS_X,y1:ya,x2:SENSOR_X,y2:ys,stroke:color,'stroke-opacity':opacity},rays);
   }
   disc.setAttribute('y1',AXIS-Math.max(1.5,half));disc.setAttribute('y2',AXIS+Math.max(1.5,half));disc.classList.toggle('is-point',sharp);
   label.textContent=`${S.name} ${sharp?'· 점':Math.abs(mmSigned).toFixed(2)+' mm'}`;
  }
 };
}
