// Thin-lens optics for Focus Lab. Distances in metres, blur in millimetres on the sensor.
// A 50 mm lens on a full-frame (36 × 24 mm) sensor, acceptable circle of confusion 0.03 mm.
export const LENS={focal:.05,sensorHeight:24,coc:.03};
export const APERTURES=[2,2.8,4,5.6,8,11,16];
export const FOCUS_MIN=.25,FOCUS_MAX=10;
// The desk: the three subjects the lab names, nearest first.
export const SUBJECTS=[
 {id:'cactus',name:'선인장',distance:.4},
 {id:'mug',name:'머그컵',distance:.8},
 {id:'bear',name:'곰 인형',distance:2}
];

// Blur-disc diameter on the sensor (mm) for a point at distance d when focused at s, aperture N.
// Positive when the point is nearer than the plane (its rays meet behind the sensor).
export function blurDisc(d,s,N,f=LENS.focal){
 const mm=f*1000;return mm*mm/(N*(s-f)*1000)*(s-d)/d;
}
export const hyperfocal=(N,f=LENS.focal,c=LENS.coc)=>(f*1000)**2/(N*c)/1000+f;
// Near and far limits of acceptable sharpness; far is Infinity at or beyond the hyperfocal distance.
export function sharpZone(s,N,f=LENS.focal,c=LENS.coc){
 const H=hyperfocal(N,f,c),near=s*(H-f)/(H+s-2*f),far=s<H?s*(H-f)/(H-s):Infinity;
 return {near,far,depth:far-near,hyperfocal:H};
}
export const isSharp=(d,s,N)=>Math.abs(blurDisc(d,s,N))<=LENS.coc+1e-9;
// Each full stop multiplies the f-number by √2 and halves the light.
export const stopsBetween=(from,to)=>2*Math.log2(to/from);
// Where the image of a point at d forms behind the lens (m), for drawing the ray cone.
export const imageDistance=(d,f=LENS.focal)=>1/(1/f-1/d);
// The focus ring's scale is logarithmic: equal turns near the lens cover less distance.
export const focusToScale=d=>Math.log(d/FOCUS_MIN)/Math.log(FOCUS_MAX/FOCUS_MIN);
export const scaleToFocus=x=>FOCUS_MIN*(FOCUS_MAX/FOCUS_MIN)**Math.min(1,Math.max(0,x));

export function formatLength(m){
 if(!Number.isFinite(m))return '∞';
 if(m>=1)return (Math.round(m*100)/100).toFixed(2).replace(/0$/,'').replace(/\.0$/,'')+' m';
 const cm=m*100;return (cm>=10?cm.toFixed(0):cm.toFixed(1))+' cm';
}
export const formatAperture=N=>'f/'+(Number.isInteger(N)?N:N.toFixed(1));
