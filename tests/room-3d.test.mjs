import test from 'node:test';
import assert from 'node:assert/strict';
import {roomDefaults,configureRoom,roomContributions} from '../room-physics.mjs';
import {lampPosition,positionSettings,blockedBetween,RECEIVER,ROOM_BOXES,ROOM_SPHERE} from '../room-geometry.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('baseline is 3 lx window + 1 lx candle; distance follows inverse square',()=>{
 const s=roomDefaults();close(roomContributions(s).totalLux,4);
 close(roomContributions(configureRoom(s,{distance:2})).lampLux,.25);
});
test('grazing incidence reduces lux at the fixed floor sensor',()=>{
 const s=configureRoom(roomDefaults(),{distance:2,lampElevation:30,lampAzimuth:0});
 const r=roomContributions(s);assert.equal(r.lampBlocked,false);close(r.lampLux,.125);
});
test('box and sphere each occlude the sensor and restored height clears the shadow',()=>{
 for(const center of [ROOM_BOXES[0].center,ROOM_SPHERE.center]){
  const p=center.map((v,i)=>RECEIVER[i]+2*(v-RECEIVER[i]));
  assert.equal(blockedBetween(RECEIVER,p),true);
  const s=configureRoom(roomDefaults(),positionSettings(p));
  assert.equal(roomContributions(s).lampLux,0);
  assert.equal(roomContributions(s).totalLux,3);
  assert.ok(roomContributions(configureRoom(s,{lampElevation:90})).lampLux>0);
 }
});
test('camera, exposure, bloom and colour do not change measured lux',()=>{
 const s=configureRoom(roomDefaults(),{lampAzimuth:25,lampElevation:40,distance:3});
 const r=roomContributions(s);
 for(const viewYaw of [-180,0,180])assert.deepEqual(roomContributions(configureRoom(s,{viewYaw,viewPitch:75,exposure:42,bloom:false,color:false})),r);
});
test('light switches and count only affect the expected contribution',()=>{
 const s=roomDefaults();close(roomContributions({...s,count:3}).lampLux,3);
 close(roomContributions({...s,lampOn:false}).totalLux,3);
 close(roomContributions({...s,windowOn:false}).totalLux,1);
 close(roomContributions({...s,windowOn:false,lampOn:false}).totalLux,0);
});
test('drag conversion stays bounded and round trips above the floor',()=>{
 for(const distance of [.1,1,10])for(const lampElevation of [2,30,90])for(const lampAzimuth of [-150,0,150]){
  const s={distance,lampElevation,lampAzimuth},p=lampPosition(s);
  // Dragging enforces a small floor clearance; non-clamped positions round trip.
  if(p[1]-RECEIVER[1]<.02)continue;
  const back=lampPosition(positionSettings(p));p.forEach((v,i)=>close(v,back[i]));
 }
 const clamped=positionSettings([100,-20,0]);assert.equal(clamped.distance,10);assert.ok(clamped.lampElevation>=2);
 assert.throws(()=>configureRoom(roomDefaults(),{lampElevation:0}));
 assert.throws(()=>configureRoom(roomDefaults(),{lampAzimuth:Infinity}));
});
