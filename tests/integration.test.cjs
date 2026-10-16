const {test}=require('node:test');const assert=require('node:assert/strict');
const loadPage=require('./helpers/load-page.cjs');
function page(){const p=loadPage();assert.ok(p.window.DC?.integration,'world page must load the perception bridge');return p;}
function run(p,trial){const {DockCheckSim:S,DC}=p.window;const metrics=DC.evaluation.create(trial);S.beginTrial(trial);for(let t=0;t<=trial.durationMs;t+=trial.sampleMs){S.captureTrialFrame(t);const snapshot=DC.integration.getSnapshot();assert.equal(snapshot.observation.tMs,t);metrics.record(snapshot.observation,snapshot.policies);}const result=metrics.finish();S.endTrial();return result;}
test('world page displays pose from real rendered pixels and uses one observation for A/B',()=>{
 const p=page(),S=p.window.DockCheckSim;S.beginTrial(S.trials[0]);S.captureTrialFrame(0);
 const snapshot=p.window.DC.integration.getSnapshot();assert.equal(snapshot.observation.valid,true);assert.equal(snapshot.observation.tMs,0);assert.ok(Math.abs(snapshot.observation.pose.x-50)<0.05);assert.equal(snapshot.policies.A.ready,true);assert.equal(snapshot.policies.B.ready,false);assert.match(p.element('estimatedPose').textContent,/50/);
});
test('one canonical suite feeds full pixel→policy→metrics loop and calibration failure',()=>{
 const p=page(),S=p.window.DockCheckSim,DC=p.window.DC;assert.equal(S.trials,DC.scenarios.suite);
 const results=S.trials.map(t=>run(p,t));assert.equal(results.length,19);assert.equal(results.reduce((n,r)=>n+r.sampleCount,0),1919);assert.equal(results.filter(r=>r.trueLabel==='PASS').length,12);
 const c1=results.find(r=>r.trialId==='C1');assert.equal(c1.A.firstReadyTMs,0);assert.equal(c1.B.firstReadyTMs,500);
 for(const id of ['C2','C3']){const r=results.find(r=>r.trialId===id);assert.equal(r.A.firstReadyTMs,null);assert.equal(r.B.firstReadyTMs,null);}
 const c4=results.find(r=>r.trialId==='C4');assert.equal(c4.invalidCount,16);assert.equal(c4.B.firstReadyTMs,null);
 const bias=run(p,S.calibrationBias);assert.equal(bias.trueLabel,'FAIL_POSITION');assert.equal(bias.A.firstReadyTMs,0);assert.equal(bias.B.firstReadyTMs,500);
});
test('cloned unchanged trial is accepted, altered trial cannot silently use wrong calibration',()=>{
 const p=page(),S=p.window.DockCheckSim;S.beginTrial(structuredClone(S.trials[0]));assert.equal(S.captureTrialFrame(0).tMs,0);S.endTrial();
 const changed=structuredClone(S.trials[0]);changed.calibration.offsetX=32;assert.throws(()=>S.beginTrial(changed));
});
test('batch locks frame-mutating controls and APIs until endTrial',()=>{
 const p=page(),S=p.window.DockCheckSim;S.beginTrial(S.trials[0]);
 for(const id of ['x','y','angle','jitter','front','rear','seed','resetSeed','pause','step','case','loadCase'])assert.equal(p.element(id).disabled,true,id);
 assert.throws(()=>S.setPose({x:55}));assert.throws(()=>S.setSeed(303));assert.throws(()=>S.captureFrame(100));assert.throws(()=>S.setPreviewRunning(true));
 S.captureTrialFrame(0);S.endTrial();assert.equal(p.element('x').disabled,false);S.setPose({x:54.5});S.captureFrame(100);assert.equal(p.window.DC.integration.getSnapshot().observation.geometryPass,false);
});
test('hidden tab immediately clears displayed decision and requires a fresh 500ms sequence',()=>{
 const p=page(),S=p.window.DockCheckSim;S.beginTrial(S.trials[0]);for(let t=0;t<=500;t+=50)S.captureTrialFrame(t);assert.equal(p.window.DC.integration.getSnapshot().policies.B.ready,true);
 p.hide(true);assert.equal(p.window.DC.integration.getSnapshot(),null);assert.match(p.element('policyB').textContent,/CHƯA ĐỦ/);assert.throws(()=>S.captureTrialFrame(550));
 p.hide(false);S.captureTrialFrame(550);assert.equal(p.window.DC.integration.getSnapshot().policies.B.ready,false);
});

test('offline bundle runs without loading any adjacent script files',()=>{
 const p=loadPage('dockcheck-demo.html',false),S=p.window.DockCheckSim;
 const r=run(p,S.trials[0]);assert.equal(r.sampleCount,101);assert.equal(r.A.firstReadyTMs,0);assert.equal(r.B.firstReadyTMs,500);
});
