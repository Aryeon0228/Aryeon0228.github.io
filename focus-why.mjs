import {SUBJECTS,blurDisc,isSharp,sharpZone,formatLength,formatAperture} from './focus-optics.mjs?v=fbf860ce43e1';
// The one-to-three sentences under the photo: which subject lands as a point, where the others'
// rays meet and how big their discs are, and how deep the sharp zone is. Segments carry `strong`
// so the page can bold numbers without innerHTML.

const hasBatchim=word=>{const code=word.charCodeAt(word.length-1)-0xac00;return code>=0&&code<=11171&&code%28!==0;};
const topic=word=>word+(hasBatchim(word)?'은':'는');
const and=word=>word+(hasBatchim(word)?'과':'와');
const mm=x=>Math.abs(x).toFixed(2)+' mm';
// 'f/16' is read 에프 십육: the particle follows the last digit as spoken (0 영, 3 삼, 6 육 take 으로).
const withRo=N=>formatAperture(N)+('036'.includes(String(N).slice(-1))?'으로':'로');

export function explain(s,N){
 const discs=SUBJECTS.map(S=>({...S,disc:blurDisc(S.distance,s,N),sharp:isSharp(S.distance,s,N)}));
 const sharp=discs.filter(d=>d.sharp),soft=discs.filter(d=>!d.sharp),zone=sharpZone(s,N),out=[];
 if(sharp.length===SUBJECTS.length)out.push({text:'세 물체가 모두 선명 범위 안에 있어 한 점으로 맺힙니다. '});
 else if(sharp.length>1)out.push({text:`${and(sharp[0].name)} ${sharp[1].name}${hasBatchim(sharp[1].name)?'이':'가'} 선명 범위 안에 있어 한 점으로 맺힙니다. `});
 else if(sharp.length===1)out.push({text:`${sharp[0].name}만 초점면에 걸려 한 점으로 맺힙니다. `});
 else out.push({text:`초점면(${formatLength(s)})에 걸린 물체가 없어 셋 다 원반으로 맺힙니다. `});
 soft.forEach((d,i)=>{
  out.push({text:`${topic(d.name)} 상면 ${d.disc>0?'뒤':'앞'}에서 모여 `},{text:mm(d.disc),strong:true});
  out.push({text:i<soft.length-1?', ':' 원반이 됩니다. '});
 });
 out.push({text:'선명 범위는 '},{text:Number.isFinite(zone.far)?`${formatLength(zone.near)}–${formatLength(zone.far)} (깊이 ${formatLength(zone.depth)})`:`${formatLength(zone.near)}부터 ∞`,strong:true},{text:'입니다.'});
 if(N>2&&soft.length&&s<3)out.push({text:` ${withRo(N)} 조여 원반은 f/2일 때보다 ${(N/2).toFixed(1).replace(/\.0$/,'')}배 작아졌지만, 이렇게 가까운 거리에서는 선명 범위가 여전히 얕습니다.`});
 return out;
}
