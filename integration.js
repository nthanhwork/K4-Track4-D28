/* Connect rendered pixels to perception and both policies; no truth enters perception. */
(function (DC) {
  'use strict';
  const policyPair = DC.policies.create();
  let snapshot = null;
  const labels = {
    READY: 'ĐẠT', CHECKING: 'ĐANG XÁC NHẬN',
    NOT_READY: 'CHƯA ĐẠT', UNKNOWN: 'CHƯA ĐỦ DỮ LIỆU'
  };
  const reasons = {
    'missing-red': 'Không thấy dấu đầu đỏ', 'missing-blue': 'Không thấy dấu sau xanh',
    'marker-distance': 'Khoảng cách hai dấu không hợp lệ',
    'invalid-calibration': 'Hiệu chuẩn không hợp lệ', 'invalid-image': 'Ảnh không hợp lệ'
  };
  function text(id,value) { document.getElementById(id).textContent=value; }
  function reset() {
    policyPair.reset(); snapshot=null;
    text('estimatedPose','Chưa có quan sát mới.');
    text('geometryState','Chưa đủ dữ liệu để kiểm tra hình học.');
    text('policyA','A — CHƯA ĐỦ DỮ LIỆU');
    text('policyB','B — CHƯA ĐỦ DỮ LIỆU');
  }
  function processFrame(frame) {
    const observation=DC.perception.estimate(frame.imageData,window.DockCheckSim.getCalibration(),frame.tMs);
    const policies=policyPair.step(observation);
    snapshot={observation,policies};
    if(observation.valid){
      const {x,y,theta}=observation.pose;
      text('estimatedPose',`Ước lượng từ ảnh: x=${x.toFixed(3)} u · y=${y.toFixed(3)} u · góc=${(theta*180/Math.PI).toFixed(2)}° · t=${observation.tMs.toFixed(0)} ms`);
      text('geometryState',observation.geometryPass?'Hình học ước lượng: trong vùng và đúng hướng.':'Hình học ước lượng: thân vượt vùng hoặc sai hướng.');
    }else{
      text('estimatedPose',`Chưa đủ dữ liệu: ${reasons[observation.reason]||observation.reason}.`);
      text('geometryState','Không dùng lại tư thế cũ khi mất quan sát.');
    }
    text('policyA',`A — ${labels[policies.A.state]} (một ảnh)`);
    text('policyB',`B — ${labels[policies.B.state]} (500 ms liên tiếp)`);
    window.dispatchEvent(new CustomEvent('dockcheck:observation',{detail:snapshot}));
    return snapshot;
  }
  DC.integration={getSnapshot:()=>snapshot,reset};
  window.addEventListener('dockcheck:frame',event=>processFrame(event.detail));
  window.addEventListener('dockcheck:reset',reset);
  window.addEventListener('dockcheck:interruption',reset);
  reset();
  const initial=window.DockCheckSim.getFrame();
  if(initial)processFrame(initial);
})(window.DC=window.DC||{});
