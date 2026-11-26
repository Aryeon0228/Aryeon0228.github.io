import {roomBounce} from './room-indirect.mjs?v=72495e7f07aa';
import {lampPosition,blockedBetween,RECEIVER} from './room-geometry.mjs?v=5748b1b55a40';
import {SOURCES} from './light-sources.mjs';
export const roomDefaults=()=>({outside:'sun',outdoorLux:100000,reach:.00003,windowOn:true,lamp:'candle',count:1,distance:1,lampOn:true,exposure:Math.log2(25000),bloom:true,indirect:true,color:true,lampAzimuth:0,lampElevation:90,viewYaw:24,viewPitch:28});
export const roomSchema={type:'object',properties:{indirect:{type:'boolean'},lampAzimuth:{type:'number',minimum:-180,maximum:180},lampElevation:{type:'number',minimum:2,maximum:90},bloom:{type:'boolean'},viewYaw:{type:'number',minimum:-180,maximum:180},viewPitch:{type:'number',minimum:2,maximum:75},outside:{type:'string',enum:['sun','moon']},outdoorLux:{type:'number',minimum:.01,maximum:100000},reach:{type:'number',minimum:.00001,maximum:1},windowOn:{type:'boolean'},lamp:{type:'string',enum:['candle','incandescent','fluorescent']},count:{type:'integer',minimum:1,maximum:100},distance:{type:'number',minimum:.1,maximum:10},lampOn:{type:'boolean'},exposure:{type:'number',minimum:-6,maximum:42},color:{type:'boolean'}},additionalProperties:false};
export function configureRoom(state,input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Expected room settings');
 for(const [key,value] of Object.entries(input)){
  const rule=roomSchema.properties[key];if(!rule)throw new Error('Unknown room setting: '+key);
  if(rule.enum){if(!rule.enum.includes(value))throw new Error('Invalid '+key);}
  else if(rule.type==='boolean'){if(typeof value!=='boolean')throw new Error('Invalid '+key);}
  else if(typeof value!=='number'||!Number.isFinite(value)||value<rule.minimum||value>rule.maximum||(rule.type==='integer'&&!Number.isInteger(value)))throw new Error('Invalid '+key);
 }
 const next={...state,...input};if(input.outside!==undefined&&input.outdoorLux===undefined)next.outdoorLux=SOURCES[input.outside].lux;
 return next;
}
export function roomContributions(s){
 const windowLux=s.windowOn?s.outdoorLux*s.reach:0;
 const lampBlocked=blockedBetween(RECEIVER,lampPosition(s));
 const incidenceCosine=Math.sin((s.lampElevation??90)*Math.PI/180);
 const lampLux=s.lampOn&&!lampBlocked?SOURCES[s.lamp].intensity*s.count/s.distance**2*incidenceCosine:0;
 const bounce=roomBounce(s);
 const windowIndirectLux=bounce.windowLux,lampIndirectLux=bounce.lampLux;
 const windowTotalLux=windowLux+windowIndirectLux,lampTotalLux=lampLux+lampIndirectLux;
 const indirectLux=windowIndirectLux+lampIndirectLux,totalLux=windowTotalLux+lampTotalLux;
 return {windowLux,lampLux,windowIndirectLux,lampIndirectLux,windowTotalLux,lampTotalLux,indirectLux,totalLux,lampBlocked,incidenceCosine,increasePercent:windowTotalLux>0?lampTotalLux/windowTotalLux*100:null,stopsAdded:windowTotalLux>0?Math.log2(totalLux/windowTotalLux):null,lampShare:totalLux>0?lampTotalLux/totalLux:0};
}
