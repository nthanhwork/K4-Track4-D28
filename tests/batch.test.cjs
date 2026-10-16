const {test}=require('node:test');
const assert=require('node:assert/strict');
const loadPage=require('./helpers/load-page.cjs');
test('batch runs real suite, shows denominators, exports all rows and keeps challenge separate',async()=>{
 const p=loadPage(),B=p.window.DC.batch;
 assert.ok(B,'batch UI bridge must be loaded');
 await p.element('runSuite').onclick();
 const r=B.getResults();assert.equal(r.length,19);assert.equal(r.reduce((n,t)=>n+t.sampleCount,0),1919);
 assert.match(p.element('batchSummary').textContent,/5\/7/);assert.match(p.element('batchSummary').textContent,/9\/12/);
 assert.equal(B.toCSV().trim().split('\r\n').length,20);assert.match(B.toCSV(),/timeout/);
 await p.element('runChallenge').onclick();
 assert.equal(B.getResults().length,19);assert.match(p.element('challengeResult').textContent,/500/);
 assert.equal(p.element('exportCsv').disabled,false);assert.equal(p.element('x').disabled,false);
});
test('stop and hidden tab discard partial suite, unlock controls and allow restart',async()=>{
 for(const hidden of [false,true]){
  const p=loadPage(),B=p.window.DC.batch;assert.ok(B);
  const pending=B.runSuite();assert.equal(p.element('runSuite').disabled,true);
  await assert.rejects(B.runSuite(),/đang chạy/);
  if(hidden)p.hide(true);else p.element('stopBatch').onclick();
  await pending;assert.equal(B.getResults().length,0);assert.equal(p.element('exportCsv').disabled,true);
  assert.equal(p.element('x').disabled,false);assert.match(p.element('batchStatus').textContent,/hủy/);
  p.hide(false);await B.runChallenge();assert.match(p.element('challengeResult').textContent,/500/);
 }
});
test('standalone demo includes working batch runner without adjacent files',async()=>{
 const p=loadPage('dockcheck-demo.html',false);assert.ok(p.window.DC.batch);
 await p.window.DC.batch.runChallenge();assert.match(p.element('challengeResult').textContent,/FAIL_POSITION/);assert.match(p.element('challengeResult').textContent,/500 ms/);
});
