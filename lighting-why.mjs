import {fitExposure,linearDisplay} from './lighting-physics.mjs';
import {SOURCES,comparison} from './light-sources.mjs';
// One or two sentences on why the two views look the way they do right now.
// Returns segments ({text, strong}) so the page can bold numbers without innerHTML.

const BLACK=.001,WHITE=.95;
const hasBatchim=word=>{const code=word.charCodeAt(word.length-1)-0xac00;return code>=0&&code<=11171&&code%28!==0;};
const josa=(word,withBatchim,without)=>word+(hasBatchim(word)?withBatchim:without);
const num=x=>x>=1000?Math.round(x).toLocaleString('ko-KR'):x>=100?Math.round(x).toString():x>=10?x.toFixed(1).replace(/\.0$/,''):x.toFixed(2).replace(/0$/,'').replace(/\.0$/,'');
const stops=x=>Math.abs(x).toFixed(1);
const label=(state,side)=>(side==='left'?'왼쪽 ':'오른쪽 ')+SOURCES[state[side].source].name;

function inverseSquare(state){
 for(const side of ['left','right']){
  const slot=state[side],src=SOURCES[slot.source];
  if(src.kind!=='point'||(slot.count===1&&Math.abs(slot.distance-1)<.005))continue;
  const factor=slot.count/slot.distance**2;
  return [{text:`${josa(src.name,'을','를')} ${slot.count}개, ${slot.distance.toFixed(2)} m에 두면 조도는 개수 ÷ 거리²라서 1개·1 m일 때의 `},{text:num(factor)+'배',strong:true},{text:'가 됩니다.'}];
 }
 return [];
}

export function explain(state){
 const r=comparison(state.left,state.right,state.mode,state.exposure,state.offsets),a=r.left.lux,b=r.right.lux;
 const diff=Math.log2(b/a),tail=inverseSquare(state),space=tail.length?[{text:' '}]:[];
 if(Math.abs(diff)<.01){
  const same=state.mode==='shared'&&state.offsets.left===state.offsets.right;
  if(same&&linearDisplay(a,state.rho,r.left.exposure)<BLACK)return [{text:'두 빛이 측정면에 주는 조도가 같지만, 지금 노출에서는 둘 다 너무 약해 거의 검게 보입니다. 노출을 약 '},{text:stops(fitExposure(a)-r.left.exposure)+' stops',strong:true},{text:' 올리면 같은 밝기로 드러납니다.'},...space,...tail];
  return [{text:'두 빛이 측정면에 주는 조도가 같습니다. '},{text:same?'같은 노출이라 화면 밝기도 같습니다.':'화면의 밝기 차이는 노출 보정에서 생긴 것입니다.'},...space,...tail];
 }
 const strong=diff>0?'right':'left',weak=diff>0?'left':'right',S=label(state,strong),W=label(state,weak);
 const sName=SOURCES[state[strong].source].name,wName=SOURCES[state[weak].source].name;
 const ratio=[{text:`${josa(S,'이','가')} ${W}보다 `},{text:num(2**Math.abs(diff))+'배',strong:true},{text:` (${stops(diff)} stops) 밝습니다. `}];
 if(state.mode==='individual'){
  const extra=r[weak].exposure-r[strong].exposure;
  return [...ratio,{text:'각 화면의 노출을 따로 맞춰 비슷해 보일 뿐, 카메라가 '},{text:`${wName} 쪽에 노출을 ${stops(extra)} stops 더 준 것`,strong:true},{text:'입니다.'},...space,...tail];
 }
 const lw=linearDisplay(r[weak].lux,state.rho,r[weak].exposure),ls=linearDisplay(r[strong].lux,state.rho,r[strong].exposure);
 if(ls<BLACK){
  const need=fitExposure(r[strong].lux)-r[strong].exposure;
  return [...ratio,{text:'다만 지금 노출에서는 둘 다 너무 약해 거의 검게 보입니다. 노출을 약 '},{text:stops(need)+' stops',strong:true},{text:` 올리면 ${sName} 쪽부터 드러납니다.`},...space,...tail];
 }
 if(lw<BLACK){
  const need=fitExposure(r[weak].lux)-r[weak].exposure,burns=linearDisplay(r[strong].lux,state.rho,r[strong].exposure+need)>WHITE;
  return [...ratio,{text:`같은 노출에서는 ${wName} 쪽 반사광이 너무 약해 거의 검게 보입니다. 이 빛을 보려면 노출을 약 `},{text:stops(need)+' stops',strong:true},{text:burns?` 올려야 하고, 그러면 ${sName} 쪽은 하얗게 날아갑니다.`:' 올리면 됩니다.'},...space,...tail];
 }
 if(ls>WHITE)return [...ratio,{text:`${sName} 쪽은 하이라이트가 흰색으로 포화돼, 화면에서는 실제 차이보다 작아 보입니다.`},...space,...tail];
 const offsets=state.offsets.left!==state.offsets.right;
 return [...ratio,{text:offsets?'개별 노출 보정이 더해져 화면의 밝기 차이는 실제 조도 차이와 다릅니다.':'같은 노출이라 그 차이가 화면 밝기 차이로 그대로 보입니다.'},...space,...tail];
}
