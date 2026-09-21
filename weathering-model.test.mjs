import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_STATE, EFFECTS, getEffectUniforms, sampleWeather, sampleCornerContact, sampleCurrentWetness} from './weathering-model.mjs';

const body={center:[0,0,0],half:[1.25,.77,.65],kind:0};
const lid={center:[0,.87,0],half:[1.32,.1,.72],kind:1};

test('switching current moisture off leaves authored traces and their amounts intact',()=>{
  const state={...DEFAULT_STATE,effects:Object.fromEntries(Object.keys(EFFECTS).map(key=>[key,true]))};
  const wet=getEffectUniforms(state);
  const dry=getEffectUniforms({...state,effects:{...state.effects,wet:false}});
  assert(wet.uWet>0);assert.equal(dry.uWet,0);
  for(const key of ['uDust','uWear','uRust','uMoss','uRunoff'])assert.equal(wet[key],dry[key]);
  assert.equal(state.wet,EFFECTS.wet.amount);
});

test('rust is unavailable on plastic, without losing the chosen steel amount',()=>{
  const state={...DEFAULT_STATE,effects:{...DEFAULT_STATE.effects,rust:true},rust:.42};
  assert.equal(getEffectUniforms({...state,material:'plastic'}).uRust,0);
  assert.equal(getEffectUniforms(state).uRust,.42);
});

test('settled dust fades over the entire rounded corner instead of stopping on its side',()=>{
  const values=[0,15,30,45,60,75,90].map(degrees=>{
    const a=degrees*Math.PI/180;
    return sampleWeather([0,.95,.67],[0,Math.cos(a),Math.sin(a)],lid,{dust:1,wear:0}).dust;
  });
  for(let i=1;i<values.length;i++)assert(values[i]<values[i-1]);
  assert(values.at(-1)<1e-20);
});

test('corner wear spans the top, front and right with decreasing contact down the case',()=>{
  for(const p of [[1.23,.97,.63],[1.25,.74,.64],[1.24,.74,.65]])assert(sampleCornerContact(p,p[1]>.8?lid:body)>.4);
  const levels=[.74,.5,.25,0,-.4].map(y=>sampleCornerContact([1.24,y,.64],body));
  for(let i=1;i<levels.length;i++)assert(levels[i]<=levels[i-1]);
  assert.equal(levels.at(-1),0);
  assert.equal(sampleCornerContact([-1.24,.74,.64],body),0);
  assert.equal(sampleCornerContact([.5,1.19,.08],{center:[0,1.19,0],half:[.53,.09,.09],kind:2}),0);
});

test('current water coverage remains bounded, normalized and independent of trace history',()=>{
  assert.equal(sampleCurrentWetness([0,1,0],0),0);
  assert.equal(sampleCurrentWetness([0,1,0],1),1);
  assert.equal(sampleCurrentWetness([0,2,0],.5),.5);
  assert(sampleCurrentWetness([1,0,0],1)<sampleCurrentWetness([0,1,0],1));
  assert(sampleCurrentWetness([0,1,0],1,1)<sampleCurrentWetness([0,1,0],1,0));
  for(const normal of [[0,0,0],[NaN,Infinity,-1],[0,-1,0]]){
    const value=sampleCurrentWetness(normal,Infinity,NaN);assert(Number.isFinite(value));assert(value>=0&&value<=1);
  }
});
