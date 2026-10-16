const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function modules(){const s={console:{log(){}}};s.window=s;vm.createContext(s);for(const f of ['policies.js','evaluation.js','scenarios.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),s);return s.DC;}
const obs=t=>({tMs:t,valid:true,geometryPass:true});
test('policy discards a reversed or duplicated timestamp after READY',()=>{
  for(const badTime of [900,1000]){
    const p=modules().policies.create();for(let t=0;t<=1000;t+=50)p.step(obs(t));
    const bad=p.step(obs(badTime));assert.equal(bad.A.state,'UNKNOWN');assert.equal(bad.B.state,'UNKNOWN');
    const start=badTime+50;for(let t=start;t<start+500;t+=50)assert.equal(p.step(obs(t)).B.ready,false);
    assert.equal(p.step(obs(start+500)).B.ready,true);
  }
});
test('invalid timestamp cannot produce READY or poison the next sequence',()=>{
  for(const tMs of [undefined,NaN,Infinity,-1]){const p=modules().policies.create();const r=p.step(obs(tMs));assert.equal(r.A.ready,false);assert.equal(r.B.state,'UNKNOWN');for(let t=0;t<500;t+=50)p.step(obs(t));assert.equal(p.step(obs(500)).B.ready,true);}
});
test('evaluator derives immutable ground truth directly from trial world',()=>{
  const d=modules();const m=d.evaluation.create(d.scenarios.suite[0]);assert.equal(m.finish().trueLabel,'PASS');assert.throws(()=>m.setTrueLabel('FAIL_POSITION'));
});
test('ground truth normalizes full rotations and includes exactly ±5 degrees',()=>{
  const e=modules().evaluation;
  for(const theta of [0,2*Math.PI,-2*Math.PI,5*Math.PI/180,-5*Math.PI/180])assert.equal(e.computeTrueLabel({x:50,y:30,theta}),'PASS');
  assert.equal(e.computeTrueLabel({x:50,y:30,theta:5.001*Math.PI/180}),'FAIL_ORIENTATION');
});
test('suite exports serializable schedules and canonical IDs matching the renderer',()=>{
  const s=modules().scenarios;assert.equal(s.suiteVersion,'suite-v1');
  const c4=s.suite.find(t=>t.id==='C4');assert.equal(c4.occlusionSchedule.type,'periodic');assert.equal(c4.occlusionSchedule.periodMs,300);
  assert.equal(s.suite.find(t=>t.id==='N3-101').occlusionSchedule.intervals.length,2);
  assert.equal(JSON.stringify(s.suite).includes('function'),false);
});
test('all supplied part3 self-tests remain green',()=>{const d=modules();for(const n of ['policies','evaluation','scenarios'])assert.equal(d[n].selfTest().fail,0,n);});
