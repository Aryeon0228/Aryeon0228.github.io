import {fitExposure,stopDifference} from './lighting-physics.mjs';
export const SOURCES={
 candle:{name:'촛불',image:'candle',kind:'point',intensity:1,lux:1,color:[1,.47,.16],condition:'1 cd · 1개 · 정면 1 m',note:'촛불 1개 ≈ 1 cd. 실제 불꽃의 크기·방향에 따라 달라집니다.'},
 moon:{name:'달빛',image:'moon',kind:'ambient',lux:.2,color:[.76,.94,1.12],condition:'보름달 · 지면의 예시 조도',note:'보름달 아래 약 0.1–0.3 lx 중 0.2 lx를 선택했습니다. 달의 고도·날씨에 따라 달라집니다.'},
 incandescent:{name:'백열등',image:'incandescent',kind:'point',intensity:800/(4*Math.PI),lux:800/(4*Math.PI),color:[1,.7,.4],condition:'800 lm · 전방향 가정 · 1 m',note:'800 lm 제품 1개를 모든 방향으로 균일하게 빛내는 점광원으로 가정한 계산값입니다. 갓·반사판·차폐는 제외합니다.'},
 fluorescent:{name:'형광등',image:'fluorescent',kind:'point',intensity:800/(4*Math.PI),lux:800/(4*Math.PI),color:[1,1,1],condition:'800 lm CFL · 전방향 가정 · 1 m',note:'800 lm 전구형 형광등(CFL) 제품의 계산 예시입니다. 백열등과 같은 광속·거리·배광을 가정해 조도도 같습니다.'},
 sun:{name:'햇빛',image:'sun',kind:'ambient',lux:100000,color:[1,1,1],condition:'한낮 직사광 · 약 100,000 lx',note:'한낮 직사광의 대표값입니다. 실내는 창·방향·차폐·날씨에 따라 조도가 달라집니다.'}
};
// Teaching presets: illustrative receiving-surface illuminance, not a weather forecast.
export const DAYLIGHT_PRESETS=[
 {id:'direct',name:'직사광',lux:100000,condition:'한낮 직사광'},
 {id:'outdoors',name:'야외',lux:10000,condition:'직사광이 없는 야외 그늘'},
 {id:'overcast',name:'흐린 날',lux:5000,condition:'구름이 낀 낮의 야외'},
 {id:'rain',name:'비 오는 날',lux:1000,condition:'두꺼운 비구름 아래 야외'},
 {id:'indoors',name:'실내',lux:100,condition:'창에서 들어온 낮빛을 받는 실내'},
 {id:'dim',name:'어두운 실내',lux:10,condition:'창에서 멀리 떨어진 어두운 실내'}
];
export const daylightPreset=lux=>DAYLIGHT_PRESETS.find(p=>Math.abs(p.lux-lux)<.001);
export function preset(id){if(!Object.hasOwn(SOURCES,id))throw new Error('Unknown source');return {source:id,count:1,distance:1,lux:SOURCES[id].lux};}
export function illuminance(slot){const source=SOURCES[slot.source];return source.kind==='point'?source.intensity*slot.count/(slot.distance**2):slot.lux;}
export function comparison(left,right,mode,exposure,offsets={left:0,right:0}){const a=illuminance(left),b=illuminance(right);return {left:{...left,lux:a,exposure:(mode==='individual'?fitExposure(a):0)+exposure+offsets.left},right:{...right,lux:b,exposure:(mode==='individual'?fitExposure(b):0)+exposure+offsets.right},stopsDifference:stopDifference(a,b),mode};}
export function validateSettings(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Expected settings object');
 const allowed=['leftSource','rightSource','leftDistance','rightDistance','leftCount','rightCount','leftLux','rightLux','mode','exposureStops','leftExposureOffset','rightExposureOffset','reflectancePercent','showColor','whiteBalance'];
 for(const [key,value] of Object.entries(input)){
  if(!allowed.includes(key))throw new Error('Unknown setting: '+key);
  if(key.endsWith('Source')){if(typeof value!=='string'||!Object.hasOwn(SOURCES,value))throw new Error('Invalid source');}
  else if(key==='mode'){if(!['shared','individual'].includes(value))throw new Error('Invalid mode');}
  else if(key==='whiteBalance'){if(!['neutral','left','right'].includes(value))throw new Error('Invalid white balance');}
  else if(key==='showColor'){if(typeof value!=='boolean')throw new Error('Expected boolean');}
  else {let min,max;if(key.endsWith('ExposureOffset'))[min,max]=[-24,24];else if(key.endsWith('Distance'))[min,max]=[.1,10];else if(key.endsWith('Count'))[min,max]=[1,100];else if(key.endsWith('Lux'))[min,max]=[.01,100000];else if(key==='exposureStops')[min,max]=[-6,24];else [min,max]=[4,80];if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(key.endsWith('Count')&&!Number.isInteger(value)))throw new Error('Invalid '+key);}
 }
 return input;
}

// Educational linear-RGB white-balance approximation. Preserve Y to isolate hue from lux.
export function balancedColor(color,reference=[1,1,1]) {
 const corrected=color.map((value,i)=>value/reference[i]);
 const Y=.2126*corrected[0]+.7152*corrected[1]+.0722*corrected[2];
 return corrected.map(value=>value/Y);
}
export function comparisonColors(left,right,whiteBalance='neutral',showColor=true){
 const reference=whiteBalance==='left'?SOURCES[left.source].color:whiteBalance==='right'?SOURCES[right.source].color:[1,1,1];
 return {left:showColor?balancedColor(SOURCES[left.source].color,reference):[1,1,1],right:showColor?balancedColor(SOURCES[right.source].color,reference):[1,1,1]};
}
