import {SOURCES} from './light-sources.mjs';
export const roomDefaults=()=>({outside:'sun',outdoorLux:100000,reach:.01,windowOn:true,lamp:'candle',count:1,distance:1,lampOn:true,exposure:Math.log2(100),color:true});
export const roomSchema={type:'object',properties:{outside:{type:'string',enum:['sun','moon']},outdoorLux:{type:'number',minimum:.01,maximum:100000},reach:{type:'number',minimum:.00001,maximum:1},windowOn:{type:'boolean'},lamp:{type:'string',enum:['candle','incandescent','fluorescent']},count:{type:'integer',minimum:1,maximum:100},distance:{type:'number',minimum:.1,maximum:10},lampOn:{type:'boolean'},exposure:{type:'number',minimum:-6,maximum:42},color:{type:'boolean'}},additionalProperties:false};
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
 const lampLux=s.lampOn?SOURCES[s.lamp].intensity*s.count/s.distance**2:0;
 const totalLux=windowLux+lampLux;
 return {windowLux,lampLux,totalLux,increasePercent:windowLux>0?lampLux/windowLux*100:null,stopsAdded:windowLux>0?Math.log2(totalLux/windowLux):null,lampShare:totalLux>0?lampLux/totalLux:0};
}
