import test from 'node:test';
import assert from 'node:assert/strict';
import {roomDefaults,roomContributions,configureRoom} from '../room-physics.mjs';
import {roomBounce,transferWeights,integrateBounce} from '../room-indirect.mjs';
import {positionSettings,ROOM_BOXES} from '../room-geometry.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('switch removes only indirect light; totals add the two sources once',()=>{
 const s=roomDefaults(),on=roomContributions(s),off=roomContributions({...s,indirect:false});
 assert.ok(on.indirectLux>0);close(off.indirectLux,0);
 close(on.windowLux,off.windowLux);close(on.lampLux,off.lampLux);
 close(on.totalLux,on.windowLux+on.lampLux+on.indirectLux);
 close(on.totalLux,on.windowTotalLux+on.lampTotalLux);
});
test('blocked direct light can still reach the sensor by a wall bounce',()=>{
 const s={...roomDefaults(),windowOn:false,lamp:'incandescent',lampAzimuth:-90,lampElevation:25,distance:2.5};
 const on=roomContributions(s),off=roomContributions({...s,indirect:false});
 assert.equal(on.lampBlocked,true);close(on.lampLux,0);assert.ok(on.lampIndirectLux>0);close(off.totalLux,0);
});
test('window floor bounce lights a wall, without inventing a coplanar floor bounce',()=>{
 const s={...roomDefaults(),lampOn:false};const b=roomBounce(s);
 assert.ok(integrateBounce(transferWeights([0,1,-2.95],[0,0,1]),b.window)>0);
 close(b.windowLux,0);close(b.lampLux,0);
});
test('moving the lamp redistributes reflection; lamp count scales it linearly',()=>{
 const s={...roomDefaults(),windowOn:false,lampElevation:50,lampAzimuth:170,distance:2.8};
 const a=roomContributions(s),b=roomContributions({...s,count:3});
 close(b.lampIndirectLux,a.lampIndirectLux*3);assert.ok(a.indirectLux>roomContributions({...s,lampAzimuth:0}).indirectLux);
});
test('all light off is black; a lamp enclosed in an object cannot leak bounce',()=>{
 const s={...roomDefaults(),windowOn:false};close(roomContributions({...s,lampOn:false}).totalLux,0);
 const enclosed={...s,...positionSettings(ROOM_BOXES[0].center)};
 const bounce=roomBounce(enclosed);assert.ok(bounce.lamp.every(v=>v===0));close(roomContributions(enclosed).totalLux,0);
});
test('camera, colour, exposure and bloom leave physical estimates and cache intact',()=>{
 const s=roomDefaults(),a=roomBounce(s),r=roomContributions(s);
 const changed=configureRoom(s,{viewYaw:150,viewPitch:70,color:false,bloom:false,exposure:30});
 assert.equal(roomBounce(changed),a);assert.deepEqual(roomContributions(changed),r);
 assert.throws(()=>configureRoom(s,{indirect:'yes'}));
});
test('near-surface and high intensity cases stay finite and nonnegative',()=>{
 for(const distance of [.1,10])for(const lampElevation of [2,90]){
  const b=roomBounce({...roomDefaults(),distance,lampElevation,lamp:'fluorescent',count:100});
  assert.ok([...b.window,...b.lamp,b.windowLux,b.lampLux].every(v=>Number.isFinite(v)&&v>=0));
 }
});
