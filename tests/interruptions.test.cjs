const {test}=require('node:test');
const assert=require('node:assert/strict');
const load=require('./helpers/load-page.cjs');
test('world preview pause discards 400ms candidate and clears READY',()=>{
 const p=load(),S=p.window.DockCheckSim,DC=p.window.DC;
 for(let t=50;t<=400;t+=50)S.captureFrame(t);
 p.element('pause').onclick();assert.equal(DC.integration.getSnapshot(),null);
 p.element('pause').onclick();
 for(let t=450;t<950;t+=50){S.captureFrame(t);assert.equal(DC.integration.getSnapshot().policies.B.ready,false);}
 S.captureFrame(950);assert.equal(DC.integration.getSnapshot().policies.B.ready,true);
 p.element('pause').onclick();assert.equal(DC.integration.getSnapshot(),null);
});
test('main preview pause resets candidate and clears displayed READY',()=>{
 const p=load('index.html'),A=p.window.DC.app;
 for(let t=50;t<=400;t+=50)A.stepInteractive(t);
 p.element('btnPause').onclick();assert.equal(p.element('badgePolicyB').textContent,'UNKNOWN');
 p.element('btnPause').onclick();
 for(let t=450;t<950;t+=50){A.stepInteractive(t);assert.notEqual(p.element('badgePolicyB').textContent,'READY');}
 A.stepInteractive(950);assert.equal(p.element('badgePolicyB').textContent,'READY');
 p.element('btnPause').onclick();assert.equal(p.element('badgePolicyB').textContent,'UNKNOWN');
});
test('hidden tab cancels batch even if visible again before next frame; rerun starts clean',async()=>{
 const p=load('index.html'),DC=p.window.DC;
 const pending=DC.app.runBatchSuite([DC.scenarios.suite[0]]);
 p.hide(true);p.hide(false);await pending;
 assert.equal(DC.app.state.suiteResults.length,0);assert.match(p.element('batchStatusText').textContent,/hủy/);
 assert.equal(p.element('sliderX').disabled,false);assert.equal(p.element('btnExportCSV').disabled,true);
 await DC.app.runBatchSuite([DC.scenarios.suite[0]]);
 assert.equal(DC.app.state.suiteResults[0].B.timeToReadyMs,500);
 assert.equal(DC.app.state.suiteResults[0].sampleCount,101);
});
test('auto impact is locked during batch and does not publish fake duration',async()=>{
 const p=load('index.html'),DC=p.window.DC;
 const pending=DC.app.runBatchSuite([DC.scenarios.suite[0]]);
 const locked=p.element('btnRunAutoImpact').disabled;
 await p.element('btnRunAutoImpact').onclick();
 await new Promise(r=>setTimeout(r,0));
 assert.equal(DC.app.state.impact.autoDurationSec,null);
 await pending;assert.equal(locked,true);assert.equal(p.element('btnRunAutoImpact').disabled,false);
});
test('interrupted auto impact produces no duration and unlocks runner',async()=>{
 const p=load('index.html'),DC=p.window.DC;
 const pending=p.element('btnRunAutoImpact').onclick();p.hide(true);p.hide(false);
 await pending;await new Promise(r=>setTimeout(r,70));
 assert.equal(DC.app.state.impact.autoDurationSec,null);
 assert.match(p.element('autoTimerStatus').textContent,/hủy/);
 assert.equal(p.element('btnRunAutoImpact').disabled,false);
});
test('both offline bundles contain the interruption fixes without external scripts',async()=>{
 const world=load('dockcheck-demo.html',false);world.element('pause').onclick();
 assert.equal(world.window.DC.integration.getSnapshot(),null);
 const p=load('dockcheck-app-demo.html',false),DC=p.window.DC;
 const pending=DC.app.runBatchSuite([DC.scenarios.suite[0]]);p.hide(true);p.hide(false);
 await pending;assert.equal(DC.app.state.suiteResults.length,0);
 assert.equal(p.element('btnRunAutoImpact').disabled,false);
});
