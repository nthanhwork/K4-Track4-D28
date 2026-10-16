/* Batch runner: one rendered frame and one shared observation for A/B. */
(function (DC) {
  'use strict';
  const S=window.DockCheckSim, $=id=>document.getElementById(id);
  let busy=false, cancelled=false, results=[];
  const yieldToUI=()=>new Promise(resolve=>setTimeout(resolve,0));
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function controls() {
    $('runSuite').disabled=busy;
    $('runChallenge').disabled=busy;
    $('stopBatch').disabled=!busy;
    $('exportCsv').disabled=busy||results.length===0;
  }
  function guard() {
    if(cancelled||document.hidden)throw new Error('Đã hủy vì dừng hoặc ẩn tab; không công bố lượt chưa hoàn tất.');
  }
  async function trial(config,index,total) {
    const recorder=DC.evaluation.create(config);
    guard();S.beginTrial(config);
    // Keep controls locked while yielding, including the interval between trials.
    for(let t=0,i=0;t<=config.durationMs;t+=config.sampleMs,i++){
      guard();S.captureTrialFrame(t);
      const {observation,policies}=DC.integration.getSnapshot();
      recorder.record(observation,policies);
      if(i%20===0){
        $('batchStatus').textContent=`Đang chạy ${index}/${total}: ${config.id}, ${t}/${config.durationMs} ms mô phỏng`;
        await yieldToUI();
      }
    }
    guard();return recorder.finish();
  }
  const readyTime=p=>p.firstReadyTMs===null?'Hết hạn':`${p.firstReadyTMs} ms`;
  function render() {
    const good=results.filter(r=>r.trueLabel==='PASS'),bad=results.filter(r=>r.trueLabel!=='PASS');
    const lines=['Bộ suite-v1 hoàn tất: 19 lượt, 1.919 frame. Mỗi lượt 5.000 ms mô phỏng.'];
    for(const key of ['A','B']){
      const confirmed=good.filter(r=>r[key].firstReadyTMs!==null).length;
      const falseReady=bad.filter(r=>r[key].firstReadyTMs!==null).length;
      lines.push(`${key}: báo đạt nhầm ${falseReady}/${bad.length}; xác nhận đúng ${confirmed}/${good.length}; lượt thật đạt hết hạn ${good.length-confirmed}/${good.length}.`);
    }
    $('batchSummary').textContent=lines.join('\n');
    $('batchRows').innerHTML=results.map(r=>'<tr>'+[
      r.trialId,r.trueLabel,`${r.invalidCount}/${r.sampleCount}`,
      readyTime(r.A),readyTime(r.B),r.A.transitions,r.B.transitions
    ].map(v=>`<td>${escape(v)}</td>`).join('')+'</tr>').join('');
  }
  async function run(challenge) {
    if(busy)throw new Error('Một bộ ca đang chạy.');
    busy=true;cancelled=false;controls();
    if(challenge)$('challengeResult').textContent='Đang đo ca hiệu chuẩn sai…';
    else{results=[];$('batchRows').innerHTML='';$('batchSummary').textContent='Chưa có bộ kết quả hoàn tất.';}
    const started=performance.now();
    try{
      if(challenge){
        const r=await trial(DC.scenarios.calibrationFailure,1,1);
        $('challengeResult').textContent=`Ngoài suite — ${r.trueLabel}; A: ${readyTime(r.A)}, B: ${readyTime(r.B)}. Chờ 500 ms không sửa được sai hiệu chuẩn.`;
      }else{
        const complete=[];
        for(const [i,config] of DC.scenarios.suite.entries())complete.push(await trial(config,i+1,DC.scenarios.suite.length));
        results=complete;render();
      }
      $('batchStatus').textContent=`Hoàn tất trong ${((performance.now()-started)/1000).toFixed(2)} giây thực trên máy này; thời gian xác nhận trong bảng là thời gian mô phỏng.`;
    }catch(error){
      $('batchStatus').textContent=error.message;
      if(challenge)$('challengeResult').textContent='Chưa có kết quả: lượt bị gián đoạn.';
      else{results=[];$('batchRows').innerHTML='';$('batchSummary').textContent='Bộ đo chưa hoàn tất; chạy lại từ đầu để so sánh đủ mẫu.';}
    }finally{S.endTrial();busy=false;controls();}
  }
  function toCSV(){
    const headers=['suiteVersion','trialId','seed','trueLabel','sampleCount','invalidCount','A_firstReadyTMs','A_timeout','A_readyTransitions','B_firstReadyTMs','B_timeout','B_readyTransitions','config_json'];
    const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const rows=results.map(r=>[r.suiteVersion,r.trialId,r.seed,r.trueLabel,r.sampleCount,r.invalidCount,r.A.firstReadyTMs,r.A.firstReadyTMs===null,r.A.transitions,r.B.firstReadyTMs,r.B.firstReadyTMs===null,r.B.transitions,JSON.stringify(r.config)]);
    return [headers,...rows].map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n';
  }
  const runSuite=()=>run(false),runChallenge=()=>run(true);
  $('runSuite').onclick=runSuite;$('runChallenge').onclick=runChallenge;
  $('stopBatch').onclick=()=>{cancelled=true;};
  document.addEventListener('visibilitychange',()=>{if(busy&&document.hidden)cancelled=true;});
  $('exportCsv').onclick=()=>{
    if(busy||!results.length)return;
    const url=URL.createObjectURL(new Blob(['\uFEFF',toCSV()],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='dockcheck-suite-v1.csv';
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  DC.batch={runSuite,runChallenge,toCSV,getResults:()=>structuredClone(results)};
  controls();
})(window.DC=window.DC||{});
