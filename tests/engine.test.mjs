import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {DEFAULTS,recipe,validateRecipe,processPixels,curveValue,toLinear,toSrgb} from '../engine.mjs';
const fixtures=Uint8ClampedArray.from(Array.from({length:256},(_,i)=>[i,(i*73)%256,(i*151)%256,i%3===0?0:255]).flat());
test('neutral recipe preserves all byte values and alpha',()=>assert.deepEqual(processPixels(fixtures,DEFAULTS).pixels,fixtures));
test('linear-light exposure doubles radiance before encoding',()=>{const p=processPixels(new Uint8ClampedArray([64,64,64,255]),{...DEFAULTS,exposure:1}).pixels;assert.equal(p[0],Math.round(toSrgb(2*toLinear(64/255))*255));assert.notEqual(p[0],128);});
test('zero saturation produces neutral pixels; histogram counts nontransparent pixels',()=>{const {pixels,histogram}=processPixels(fixtures,{...DEFAULTS,saturation:-100});for(let i=0;i<pixels.length;i+=4){assert.equal(pixels[i],pixels[i+1]);assert.equal(pixels[i+1],pixels[i+2]);}assert.equal(histogram.reduce((x,y)=>x+y,0),170);});
test('curves preserve monotonic order at every byte',()=>{const curve=[0,.1,.5,.9,1];let previous=-1;for(let i=0;i<256;i++){const v=curveValue(i/255,curve);assert.ok(v>=previous);previous=v;}assert.equal(curveValue(1,curve),1);});
test('recipe rejects nonfinite, unknown, missing and nonmonotonic values',()=>{for(const adjustments of [{...DEFAULTS,exposure:4},{...DEFAULTS,contrast:NaN},{...DEFAULTS,tint:'5'},{...DEFAULTS,extra:true},{...DEFAULTS,curve:[0,.8,.2,.9,1]}])assert.throws(()=>recipe(adjustments));assert.throws(()=>validateRecipe({...recipe(),hidden:true}));assert.throws(()=>validateRecipe({schema:'working-print',version:2,adjustments:DEFAULTS}));});
test('recipe validator does not alias incoming curve',()=>{const a=recipe();const validated=validateRecipe(a);a.adjustments.curve[1]=.8;assert.equal(validated.adjustments.curve[1],.25);});
test('extreme supported values remain bounded and deterministic',()=>{const a={...DEFAULTS,exposure:3,contrast:70,warmth:100,tint:-100,saturation:100,curve:[0,0,.4,1,1]};const x=processPixels(fixtures,a),y=processPixels(fixtures,a);assert.deepEqual(x,y);assert.equal(x.pixels.length,fixtures.length);});
test('Python reference matches JavaScript across colored, transparent and boundary fixtures',{skip:!process.env.WORKING_PRINT_PYTHON},()=>{
 const params=[DEFAULTS,{...DEFAULTS,exposure:1.3,contrast:24,warmth:42,tint:-17,saturation:-35,curve:[0,.18,.56,.83,1]},{...DEFAULTS,exposure:-3,contrast:-70,warmth:-100,tint:100,saturation:100}];
 for(const a of params){const script="import sys,json,numpy as np;sys.path.insert(0,'python');from render import render_rgba;d=json.load(sys.stdin);print(json.dumps(render_rgba(np.array(d['pixels'],dtype=np.uint8).reshape(1,-1,4),d['a']).ravel().tolist()))";const p=spawnSync(process.env.WORKING_PRINT_PYTHON,['-c',script],{input:JSON.stringify({pixels:[...fixtures],a}),encoding:'utf8'});assert.equal(p.status,0,p.stderr);assert.deepEqual(JSON.parse(p.stdout),[...processPixels(fixtures,a).pixels]);}
});
