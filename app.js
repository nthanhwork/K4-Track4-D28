'use strict';
/**
 * DockCheck Sim v2 - app.js
 * Người 4 sở hữu: Điều phối tích hợp, vòng lặp tương tác, runner bộ thử nghiệm,
 * quản lý visibility/tab hidden, đo lường tác động (stopwatch 1x), hiển thị kết quả và xuất CSV.
 */
(() => {
  const DC = window.DC;
  const C = DC.config;
  const W = DC.world;
  const R = DC.renderer;
  const P = DC.perception;
  const Policies = DC.policies;
  const Scenarios = DC.scenarios;
  const Evaluation = DC.evaluation;

  // DOM Elements selector helper
  const $ = (id) => document.getElementById(id);

  // State quản lý của ứng dụng
  const state = {
    mode: 'interactive', // 'interactive' | 'batch' | 'impact_manual' | 'impact_auto'
    running: true,
    tMs: 0,
    lastWallTime: null,
    
    // Tư thế robot hiện tại (đơn vị u)
    pose: { x: 50, y: 30, theta: 0 },
    
    // Cấu hình cảm biến / nhiễu
    sensorConfig: {
      noiseAmplitudePx: 0,
      occlusionSchedule: { type: 'none' },
      hideFront: false,
      hideRear: false
    },
    
    // Hiệu chuẩn đang dùng cho perception
    calibration: { ...C.trueCalibration },
    
    // Seed PRNG
    seed: 101,
    
    // Ca hiện tại đang nạp
    activeCaseId: 'C1',

    // Bộ nhớ kết quả batch
    suiteResults: [],
    suiteSummary: null,

    // Trạng thái đo lường tác động (stopwatch)
    impact: {
      manualStartTime: null,
      manualDurationSec: null,
      manualClicks: 0,
      manualRunning: false,
      autoStartTime: null,
      autoDurationSec: null,
      autoRunning: false
    }
  };

  // Canvas contexts
  const worldCanvas = $('worldCanvas');
  const worldCtx = worldCanvas.getContext('2d');
  const cameraCanvas = $('cameraCanvas');
  const cameraCtx = cameraCanvas.getContext('2d', { willReadFrequently: true });

  // Khởi tạo các module
  const rng = R.createRng(state.seed);
  const policyPair = Policies.create();

  // Biến lưu trữ observation gần nhất
  let lastObservation = null;
  let lastPolicyResults = null;

  // ==========================================
  // 1. PIPELINE ĐƠN FRAME (Ảnh -> Perception -> Policies)
  // ==========================================
  function executePipelineStep(pose, sensorConfig, calib, tMs, currentRng) {
    // 1. Render ảnh camera thuần (không vẽ nhãn/khung debug vào đây!)
    const imageData = R.render(cameraCtx, pose, sensorConfig, tMs, currentRng);

    // 2. Perception chỉ nhận ImageData và Calibration; không nhận WorldState/seed/cờ che
    const observation = P.estimate(imageData, calib, tMs);

    // 3. Cả A và B nhận cùng một Observation tại cùng tMs
    const policyResults = policyPair.step(observation);

    // 4. Ground truth chỉ lấy cho visualizer/evaluator
    const groundTruth = W.evaluate(pose);

    return {
      imageData,
      observation,
      policyResults,
      groundTruth
    };
  }

  // ==========================================
  // 2. ĐỒNG BỘ GIAO DIỆN (UI SYNC)
  // ==========================================
  function updateUI(stepResult) {
    const { observation, policyResults, groundTruth } = stepResult;
    lastObservation = observation;
    lastPolicyResults = policyResults;

    // 1. Vẽ Canvas thế giới (Ground truth)
    W.draw(worldCtx, state.pose, { showCorners: true });

    // 2. Cập nhật các trường nhập / thanh trượt
    $('sliderX').value = state.pose.x;
    $('valX').textContent = state.pose.x.toFixed(1) + ' u';
    $('sliderY').value = state.pose.y;
    $('valY').textContent = state.pose.y.toFixed(1) + ' u';
    
    const deg = state.pose.theta * 180 / Math.PI;
    $('sliderAngle').value = deg;
    $('valAngle').textContent = deg.toFixed(1) + '°';

    $('sliderNoise').value = state.sensorConfig.noiseAmplitudePx;
    $('valNoise').textContent = state.sensorConfig.noiseAmplitudePx.toFixed(1) + ' px';

    $('chkHideFront').checked = state.sensorConfig.hideFront;
    $('chkHideRear').checked = state.sensorConfig.hideRear;
    $('inputSeed').value = state.seed;

    // 3. Hiển thị thông số thời gian
    $('clockDisplay').textContent = `${Math.round(state.tMs)} ms mô phỏng`;

    // 4. Hiển thị Trạng thái Policy A
    const aCard = $('cardPolicyA');
    const aBadge = $('badgePolicyA');
    const aState = policyResults.A.state;
    aBadge.textContent = aState;
    aBadge.className = 'status-badge ' + aState.toLowerCase();
    $('descPolicyA').textContent =
      aState === 'READY'
        ? 'Xác nhận ngay trong frame hiện tại'
        : aState === 'NOT_READY'
        ? 'Hình học ước lượng không đạt'
        : 'Dữ liệu ảnh không hợp lệ (UNKNOWN)';

    // 5. Hiển thị Trạng thái Policy B
    const bBadge = $('badgePolicyB');
    const bState = policyResults.B.state;
    bBadge.textContent = bState;
    bBadge.className = 'status-badge ' + bState.toLowerCase();

    const elapsed = policyResults.B.elapsedMs;
    const progressPct = Math.min(100, Math.round((elapsed / C.timing.policyBRequiredMs) * 100));
    $('barProgressB').style.width = progressPct + '%';
    $('descPolicyB').textContent =
      bState === 'READY'
        ? `Đã đạt liên tiếp ≥ 500 ms (tính từ ${policyResults.B.candidateSince} ms)`
        : bState === 'CHECKING'
        ? `Đang tích lũy: ${elapsed} / 500 ms`
        : bState === 'NOT_READY'
        ? 'Không đạt (đã hủy bộ đếm)'
        : 'Mất dấu/invalid (đã hủy bộ đếm)';

    // 6. Hiển thị Perception Output
    const pStatus = $('statusPerception');
    if (observation.valid) {
      pStatus.className = 'info-badge pass';
      pStatus.textContent = 'Quan sát hợp lệ';
      $('valEstimatedPose').textContent = `(${observation.pose.x.toFixed(2)}, ${observation.pose.y.toFixed(2)}, ${(observation.pose.theta * 180 / Math.PI).toFixed(1)}°)`;
      const distText = (typeof observation.distanceU === 'number')
        ? `${observation.distanceU.toFixed(2)} u (hợp lệ [6.4, 9.6])`
        : '≈ 8.00 u (hợp lệ [6.4, 9.6])';
      $('valMarkerDist').textContent = distText;
      $('valGeometryPass').textContent = observation.geometryPass ? 'ĐẠT ĐIỀU KIỆN' : 'KHÔNG ĐẠT';
      $('valGeometryPass').className = observation.geometryPass ? 'text-green font-bold' : 'text-red font-bold';
    } else {
      pStatus.className = 'info-badge fail';
      pStatus.textContent = 'Dữ liệu không hợp lệ';
      $('valEstimatedPose').textContent = '— (null)';
      $('valMarkerDist').textContent = (typeof observation.distanceU === 'number') ? `${observation.distanceU.toFixed(2)} u` : '—';
      $('valGeometryPass').textContent = 'false (invalid)';
      $('valGeometryPass').className = 'text-red font-bold';
    }
    $('valPerceptionReason').textContent = observation.reason || (observation.valid ? 'Hợp lệ (OK)' : 'Dữ liệu không hợp lệ');

    // 7. Hiển thị Ground Truth (Chỉ phục vụ đối chiếu của kỹ sư)
    const gtBadge = $('badgeGroundTruth');
    if (groundTruth.physicalDocked) {
      gtBadge.className = 'info-badge pass';
      gtBadge.textContent = 'THỰC TẾ: ĐẠT';
    } else {
      gtBadge.className = 'info-badge fail';
      gtBadge.textContent = 'THỰC TẾ: KHÔNG ĐẠT';
    }
    $('valGtDetails').textContent = `Thân trong biên: ${groundTruth.bodyInside ? 'Có' : 'KHÔNG'} · Lệch hướng: ${(groundTruth.headingErrorRad * 180 / Math.PI).toFixed(2)}° (Dung sai: ≤ 5°)`;

    // 8. Hiển thị Cảnh báo hiệu chuẩn
    $('valCalibInfo').textContent = `scale=${state.calibration.scale}, offsetX=${state.calibration.offsetX}, offsetY=${state.calibration.offsetY}${
      state.calibration.offsetX !== 20 ? ' ⚠️ [LỆCH HIỆU CHUẨN OFFSET X=32]' : ' (Chuẩn)'
    }`;
  }

  // Chạy một bước trong chế độ tương tác
  function stepInteractive(newTime) {
    state.tMs = newTime;
    const res = executePipelineStep(
      state.pose,
      state.sensorConfig,
      state.calibration,
      state.tMs,
      rng
    );
    updateUI(res);
  }

  // ==========================================
  // 3. VÒNG LẶP INTERACTIVE (WALL-CLOCK RAF)
  // ==========================================
  function tick(now) {
    if (state.mode === 'interactive' && state.running && !document.hidden) {
      if (state.lastWallTime === null) {
        state.lastWallTime = now;
      } else {
        const delta = now - state.lastWallTime;
        if (delta >= 1000 / 30) { // ~30 fps
          stepInteractive(state.tMs + delta);
          state.lastWallTime = now;
        }
      }
    }
    requestAnimationFrame(tick);
  }

  // ==========================================
  // 4. BATCH SUITE RUNNER (19 LƯỢT SUITE-V1)
  // ==========================================
  let isBatchRunning = false;
  let batchPauseRequested = false;

  async function runBatchSuite(suiteTrials, isAutoImpact = false) {
    if (isBatchRunning) return;
    isBatchRunning = true;
    state.mode = isAutoImpact ? 'impact_auto' : 'batch';
    state.running = false;

    // Khóa điều khiển tương tác
    setControlsDisabled(true);
    $('btnRunSuite').disabled = true;
    $('btnRunChallenge').disabled = true;
    $('batchProgressContainer').style.display = 'block';

    const results = [];
    const totalTrials = suiteTrials.length;

    for (let trialIdx = 0; trialIdx < totalTrials; trialIdx++) {
      const trial = suiteTrials[trialIdx];
      $('batchStatusText').textContent = `Đang chạy [${trialIdx + 1}/${totalTrials}]: ${trial.name} (Seed: ${trial.seed})...`;
      $('batchProgressBar').style.width = Math.round(((trialIdx) / totalTrials) * 100) + '%';

      // 1. Reset các thành phần trước mỗi lượt
      policyPair.reset();
      const trialRng = R.createRng(trial.seed);
      const metrics = Evaluation.create(trial);
      if (typeof metrics.setTrueLabel === 'function') {
        const lbl = typeof Evaluation.computeTrueLabel === 'function'
          ? Evaluation.computeTrueLabel(trial.world)
          : (W.evaluate(trial.world).physicalDocked ? 'PASS' : 'FAIL_POSITION');
        metrics.setTrueLabel(lbl);
      }

      // Cập nhật state mô phỏng theo trial
      state.pose = { ...trial.world };
      state.sensorConfig = {
        noiseAmplitudePx: trial.noiseAmplitudePx || 0,
        occlusionSchedule: trial.occlusionFn || trial.occlusionSchedule,
        hideFront: false,
        hideRear: false
      };
      state.calibration = { ...trial.calibration };
      state.seed = trial.seed;

      // 2. Chạy đúng 101 mẫu từ t = 0 đến t = 5000 ms, bước 50 ms
      for (let t = 0; t <= trial.durationMs; t += trial.sampleMs) {
        // Tạm dừng batch nếu tab bị ẩn (Tuân thủ ràng buộc plan v2)
        while (document.hidden || batchPauseRequested) {
          $('batchStatusText').textContent = `⏸️ Batch đang tạm dừng do tab bị ẩn hoặc người dùng yêu cầu...`;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        const res = executePipelineStep(
          trial.world,
          state.sensorConfig,
          trial.calibration,
          t,
          trialRng
        );

        metrics.record(res.observation, res.policyResults);

        // Hiển thị trực quan vài frame nếu ở chế độ auto 1x hoặc giảm tần suất để tăng tốc
        if (isAutoImpact) {
          // Auto 1x chạy đúng thời gian thực 50 ms mỗi bước
          state.tMs = t;
          updateUI(res);
          await new Promise((resolve) => setTimeout(resolve, 50));
        } else if (t % 500 === 0 || t === trial.durationMs) {
          state.tMs = t;
          updateUI(res);
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
      }

      const rawResult = metrics.finish();
      const trueLabel = (rawResult.trueLabel === 'PASS' || rawResult.trueLabel === true);
      const firstA = rawResult.A.firstReadyTMs !== undefined ? rawResult.A.firstReadyTMs : rawResult.A.timeToReadyMs;
      const firstB = rawResult.B.firstReadyTMs !== undefined ? rawResult.B.firstReadyTMs : rawResult.B.timeToReadyMs;
      const confA = firstA !== null && firstA !== undefined;
      const confB = firstB !== null && firstB !== undefined;
      const transA = rawResult.A.transitions !== undefined ? rawResult.A.transitions : (rawResult.A.stateChanges || 0);
      const transB = rawResult.B.transitions !== undefined ? rawResult.B.transitions : (rawResult.B.stateChanges || 0);

      const trialResult = {
        id: rawResult.trialId || trial.id,
        group: trial.group || (trial.id.split('_')[0]),
        name: trial.name || trial.id,
        seed: rawResult.seed || trial.seed,
        suiteVersion: rawResult.suiteVersion || 'v1',
        trueLabel: trueLabel,
        sampleCount: rawResult.sampleCount,
        invalidCount: rawResult.invalidCount,
        noiseAmplitudePx: trial.noiseAmplitudePx || 0,
        A: {
          confirmed: confA,
          timeToReadyMs: firstA,
          falseReady: !trueLabel && confA,
          correctConfirm: trueLabel && confA,
          timeout: trueLabel && !confA,
          stateChanges: transA
        },
        B: {
          confirmed: confB,
          timeToReadyMs: firstB,
          falseReady: !trueLabel && confB,
          correctConfirm: trueLabel && confB,
          timeout: trueLabel && !confB,
          stateChanges: transB
        }
      };
      results.push(trialResult);
    }

    $('batchProgressBar').style.width = '100%';
    $('batchStatusText').textContent = `Hoàn thành ${results.length} lượt!`;

    // Lưu kết quả và hiển thị bảng
    state.suiteResults = results;
    state.suiteSummary = summarizeSuite(results);
    renderResultsTable(results, state.suiteSummary);

    // Mở khóa điều khiển
    setControlsDisabled(false);
    $('btnRunSuite').disabled = false;
    $('btnRunChallenge').disabled = false;
    $('btnExportCSV').disabled = false;
    isBatchRunning = false;
    state.mode = 'interactive';
  }

  // Helper tính median mảng số
  function calcMedian(arr) {
    const valid = arr.filter((x) => typeof x === 'number' && Number.isFinite(x));
    if (valid.length === 0) return null;
    valid.sort((a, b) => a - b);
    const mid = Math.floor(valid.length / 2);
    return valid.length % 2 !== 0 ? valid[mid] : (valid[mid - 1] + valid[mid]) / 2;
  }

  // Tổng hợp chỉ số cho toàn bộ kết quả của suite
  function summarizeSuite(trialResults) {
    if (typeof Evaluation.summarizeSuite === 'function') {
      return Evaluation.summarizeSuite(trialResults);
    }
    const totalTrials = trialResults.length;
    const truePassTrials = trialResults.filter((r) => r.trueLabel);
    const trueFailTrials = trialResults.filter((r) => !r.trueLabel);

    const totalSamples = trialResults.reduce((s, r) => s + r.sampleCount, 0);
    const totalInvalidSamples = trialResults.reduce((s, r) => s + r.invalidCount, 0);

    function calcPolicySummary(policyKey) {
      const falseReadyCount = trueFailTrials.filter((r) => r[policyKey].falseReady).length;
      const correctConfirmCount = truePassTrials.filter((r) => r[policyKey].correctConfirm).length;
      const timeoutCount = truePassTrials.filter((r) => r[policyKey].timeout).length;
      const totalStateChanges = trialResults.reduce((s, r) => s + r[policyKey].stateChanges, 0);

      const confirmTimes = truePassTrials
        .filter((r) => r[policyKey].confirmed && r[policyKey].timeToReadyMs !== null)
        .map((r) => r[policyKey].timeToReadyMs);

      return {
        falseReadyCount,
        falseReadyRate: trueFailTrials.length > 0 ? falseReadyCount / trueFailTrials.length : 0,
        correctConfirmCount,
        correctConfirmRate: truePassTrials.length > 0 ? correctConfirmCount / truePassTrials.length : 0,
        timeoutCount,
        timeoutRate: truePassTrials.length > 0 ? timeoutCount / truePassTrials.length : 0,
        totalStateChanges,
        medianConfirmTimeMs: calcMedian(confirmTimes),
        confirmedCount: confirmTimes.length
      };
    }

    return {
      totalTrials,
      truePassCount: truePassTrials.length,
      trueFailCount: trueFailTrials.length,
      totalSamples,
      totalInvalidSamples,
      overallInvalidRate: totalSamples > 0 ? totalInvalidSamples / totalSamples : 0,
      A: calcPolicySummary('A'),
      B: calcPolicySummary('B')
    };
  }

  // Chuyển danh sách TrialResult sang chuỗi CSV theo hợp đồng
  function generateCSV(trialResults) {
    if (typeof Evaluation.generateCSV === 'function') {
      return Evaluation.generateCSV(trialResults);
    }
    const headers = [
      'trialId', 'group', 'seed', 'suiteVersion', 'trueLabel', 'sampleCount', 'invalidCount',
      'a_confirmed', 'a_timeToReadyMs', 'a_falseReady', 'a_correctConfirm', 'a_timeout', 'a_stateChanges',
      'b_confirmed', 'b_timeToReadyMs', 'b_falseReady', 'b_correctConfirm', 'b_timeout', 'b_stateChanges'
    ];

    const rows = trialResults.map((r) => [
      r.id,
      r.group,
      r.seed,
      r.suiteVersion,
      r.trueLabel ? 'TRUE' : 'FALSE',
      r.sampleCount,
      r.invalidCount,
      r.A.confirmed ? 'TRUE' : 'FALSE',
      r.A.timeToReadyMs !== null && r.A.timeToReadyMs !== undefined ? r.A.timeToReadyMs : 'null',
      r.A.falseReady ? 'TRUE' : 'FALSE',
      r.A.correctConfirm ? 'TRUE' : 'FALSE',
      r.A.timeout ? 'TRUE' : 'FALSE',
      r.A.stateChanges,
      r.B.confirmed ? 'TRUE' : 'FALSE',
      r.B.timeToReadyMs !== null && r.B.timeToReadyMs !== undefined ? r.B.timeToReadyMs : 'null',
      r.B.falseReady ? 'TRUE' : 'FALSE',
      r.B.correctConfirm ? 'TRUE' : 'FALSE',
      r.B.timeout ? 'TRUE' : 'FALSE',
      r.B.stateChanges
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  }

  // ==========================================
  // 5. CA THỬ THÁCH SAI HIỆU CHUẨN (CALIBRATION-BIAS-V1)
  // ==========================================
  async function runCalibrationChallenge() {
    const trial = Scenarios.calibrationFailure;
    alert(`Bắt đầu chạy Ca thử thách sai hiệu chuẩn (${trial.id}):\n- Thân robot thật ở x = 54.5 u (VƯỢT BIÊN 59 u -> Ground truth: KHÔNG ĐẠT).\n- Calibration sai đưa cho perception có offsetX = 32 thay vì 20.\n- Xem perception và Policy B phản ứng như thế nào!`);
    await runBatchSuite([trial], false);
  }

  // ==========================================
  // 6. HIỂN THỊ BẢNG KẾT QUẢ VÀ TỔNG HỢP
  // ==========================================
  function renderResultsTable(results, summary) {
    $('resultsSection').style.display = 'block';

    // 1. Cập nhật các thẻ tóm tắt số liệu
    $('summaryTotalTrials').textContent = `${summary.totalTrials} (${summary.truePassCount} Đạt / ${summary.trueFailCount} Không Đạt)`;
    $('summaryInvalidSamples').textContent = `${summary.totalInvalidSamples} / ${summary.totalSamples} (${(summary.overallInvalidRate * 100).toFixed(1)}%)`;

    // Policy A summary
    $('summaryAFalseReady').textContent = `${summary.A.falseReadyCount} / ${summary.trueFailCount} (${(summary.A.falseReadyRate * 100).toFixed(1)}%)`;
    $('summaryACorrectConfirm').textContent = `${summary.A.correctConfirmCount} / ${summary.truePassCount} (${(summary.A.correctConfirmRate * 100).toFixed(1)}%)`;
    $('summaryATimeout').textContent = `${summary.A.timeoutCount} / ${summary.truePassCount}`;
    $('summaryAMedianTime').textContent = summary.A.medianConfirmTimeMs !== null ? `${summary.A.medianConfirmTimeMs} ms` : 'N/A';
    $('summaryAChanges').textContent = summary.A.totalStateChanges;

    // Policy B summary
    $('summaryBFalseReady').textContent = `${summary.B.falseReadyCount} / ${summary.trueFailCount} (${(summary.B.falseReadyRate * 100).toFixed(1)}%)`;
    $('summaryBCorrectConfirm').textContent = `${summary.B.correctConfirmCount} / ${summary.truePassCount} (${(summary.B.correctConfirmRate * 100).toFixed(1)}%)`;
    $('summaryBTimeout').textContent = `${summary.B.timeoutCount} / ${summary.truePassCount}`;
    $('summaryBMedianTime').textContent = summary.B.medianConfirmTimeMs !== null ? `${summary.B.medianConfirmTimeMs} ms` : 'N/A';
    $('summaryBChanges').textContent = summary.B.totalStateChanges;

    // 2. Điền các dòng bảng chi tiết
    const tbody = $('resultsTableBody');
    tbody.innerHTML = '';

    results.forEach((r, idx) => {
      const tr = document.createElement('tr');

      // Tô màu dòng nếu có False READY hoặc Timeout
      if (r.A.falseReady || r.B.falseReady) {
        tr.className = 'row-false-ready';
      } else if (r.B.timeout && r.trueLabel) {
        tr.className = 'row-timeout';
      }

      tr.innerHTML = `
        <td class="font-bold">${r.id}</td>
        <td><span class="badge-label ${r.trueLabel ? 'pass' : 'fail'}">${r.trueLabel ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span></td>
        <td>${r.seed}</td>
        <td>${r.noiseAmplitudePx} px</td>
        <td>${r.invalidCount}/${r.sampleCount}</td>
        
        <!-- Policy A -->
        <td class="${r.A.confirmed ? (r.A.falseReady ? 'text-red font-bold' : 'text-green font-bold') : 'text-gray'}">
          ${r.A.confirmed ? (r.A.falseReady ? 'READY ⚠️ (SAI)' : 'READY ✓') : 'Chưa'}
        </td>
        <td>${r.A.timeToReadyMs !== null ? r.A.timeToReadyMs + ' ms' : '—'}</td>
        <td>${r.A.stateChanges}</td>

        <!-- Policy B -->
        <td class="${r.B.confirmed ? (r.B.falseReady ? 'text-red font-bold' : 'text-green font-bold') : (r.B.timeout ? 'text-amber font-bold' : 'text-gray')}">
          ${r.B.confirmed ? (r.B.falseReady ? 'READY ⚠️ (SAI)' : 'READY ✓') : (r.B.timeout ? 'TIMEOUT (0)' : 'Chưa')}
        </td>
        <td>${r.B.timeToReadyMs !== null ? r.B.timeToReadyMs + ' ms' : '—'}</td>
        <td>${r.B.stateChanges}</td>
      `;
      tbody.appendChild(tr);
    });

    // Cuộn mượt xuống phần kết quả
    $('resultsSection').scrollIntoView({ behavior: 'smooth' });
  }

  // ==========================================
  // 7. XUẤT CSV
  // ==========================================
  function exportCSV() {
    if (!state.suiteResults || state.suiteResults.length === 0) {
      alert('Chưa có kết quả để xuất. Vui lòng bấm "Chạy toàn bộ 19 lượt" trước!');
      return;
    }
    const csvContent = generateCSV(state.suiteResults);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `dockcheck-suite-v1-results-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ==========================================
  // 8. ĐO LƯỜNG TÁC ĐỘNG (STOPWATCH THỦ CÔNG VS TỰ ĐỘNG 1X)
  // ==========================================
  function startManualMeasurement() {
    state.impact.manualRunning = true;
    state.impact.manualStartTime = performance.now();
    state.impact.manualClicks = 0;
    $('btnStartManual').disabled = true;
    $('btnEndManual').disabled = false;
    $('manualTimerStatus').textContent = 'Đang đo thủ công... Hãy chọn từng ca và ghi kết quả!';
  }

  function endManualMeasurement() {
    if (!state.impact.manualRunning) return;
    const durationMs = performance.now() - state.impact.manualStartTime;
    state.impact.manualDurationSec = durationMs / 1000;
    state.impact.manualRunning = false;
    $('btnStartManual').disabled = false;
    $('btnEndManual').disabled = true;
    $('manualTimerStatus').textContent = `Thủ công: ${state.impact.manualDurationSec.toFixed(1)} giây (${state.impact.manualClicks} thao tác)`;
    updateImpactComparison();
  }

  async function runAutoImpact() {
    $('btnRunAutoImpact').disabled = true;
    $('autoTimerStatus').textContent = 'Đang chạy tự động 1× (thời gian thực)...';
    state.impact.autoStartTime = performance.now();

    // Chạy 19 ca ở tốc độ 1×
    await runBatchSuite(Scenarios.suite, true);

    const durationMs = performance.now() - state.impact.autoStartTime;
    state.impact.autoDurationSec = durationMs / 1000;
    $('btnRunAutoImpact').disabled = false;
    $('autoTimerStatus').textContent = `Tự động 1×: ${state.impact.autoDurationSec.toFixed(1)} giây (1 click duy nhất)`;
    updateImpactComparison();
  }

  function updateImpactComparison() {
    const m = state.impact.manualDurationSec;
    const a = state.impact.autoDurationSec;
    if (m && a) {
      const delta = m - a;
      const pct = (delta / m) * 100;
      $('impactResultBox').innerHTML = `
        <strong>Kết quả đo tác động (n = 1):</strong><br>
        Thời gian thủ công: <strong>${m.toFixed(1)}s</strong> | Tự động 1×: <strong>${a.toFixed(1)}s</strong><br>
        ΔT = <strong>${delta.toFixed(1)}s</strong> (${pct >= 0 ? 'Giảm ' + pct.toFixed(1) + '%' : 'Tự động chậm hơn ' + Math.abs(pct).toFixed(1) + '%'})<br>
        <em>Ghi chú: Đo cùng 19 ca, cùng tốc độ 1×. Thao tác tự động giúp loại bỏ thao tác click tay và độ trễ chuyển đổi của con người.</em>
      `;
    }
  }

  // ==========================================
  // 9. NẠP CA VÀ KHÓA ĐIỀU KHIỂN
  // ==========================================
  function loadScenario(caseId) {
    const allCases = Scenarios.allCases || [...Scenarios.suite, Scenarios.calibrationFailure];
    const sc = allCases.find((c) => c.id === caseId || c.id === caseId.replace('-', '_'));
    if (!sc) return;

    state.activeCaseId = caseId;
    state.pose = { ...sc.world };
    state.sensorConfig = {
      noiseAmplitudePx: sc.noiseAmplitudePx || 0,
      occlusionSchedule: sc.occlusionFn || sc.occlusionSchedule || { type: 'none' },
      hideFront: false,
      hideRear: false
    };
    state.calibration = { ...sc.calibration };
    state.seed = sc.seed;
    state.tMs = 0;
    state.lastWallTime = null;

    rng.setSeed(sc.seed);
    policyPair.reset();

    $('caseSelector').value = sc.id;
    const desc = sc.description || (sc.name || sc.id);
    $('caseDescriptionText').innerHTML = `<strong>${sc.name || sc.id}:</strong> ${desc}`;

    stepInteractive(0);
  }

  function setControlsDisabled(disabled) {
    ['sliderX', 'sliderY', 'sliderAngle', 'sliderNoise', 'chkHideFront', 'chkHideRear', 'inputSeed', 'btnResetSeed', 'caseSelector', 'btnLoadCase', 'btnStep50', 'btnPause'].forEach((id) => {
      const el = $(id);
      if (el) el.disabled = disabled;
    });
  }

  // ==========================================
  // 9b. TỰ KIỂM TRA 21 TIÊU CHÍ MODULE (SELF-CHECKS)
  // ==========================================
  function runSelfChecks() {
    const testCanvas = document.createElement('canvas');
    const rTest = R.create(testCanvas.getContext('2d', { willReadFrequently: true }), 101);
    const out = [];

    const check = (name, fn) => {
      try {
        if (!fn()) throw Error('Không đúng kỳ vọng');
        out.push({ name, pass: true });
      } catch (e) {
        out.push({ name, pass: false, error: e.message });
      }
    };

    function centroid(img, red) {
      let n = 0, x = 0, y = 0;
      for (let i = 0; i < img.data.length; i += 4) {
        const [Red, Green, Blue] = img.data.subarray(i, i + 3);
        if (red ? Red > 180 && Green < 100 && Blue < 100 : Blue > 180 && Red < 100 && Green < 160) {
          n++;
          x += (i / 4) % img.width + 0.5;
          y += Math.floor(i / 4 / img.width) + 0.5;
        }
      }
      return n >= 25 ? { x: x / n, y: y / n, n } : null;
    }

    const p = { x: 50, y: 30, theta: 0 };
    const near = (v, x, y) => v && Math.abs(v.x - x) < 0.5 && Math.abs(v.y - y) < 0.5;
    const same = (a, b) => a.data.every((v, i) => v === b.data[i]);

    check('Ảnh 640×400; dấu đầu (344,200), dấu sau (296,200)', () => {
      const i = rTest.render(p);
      return i.width === 640 && i.height === 400 && near(centroid(i, true), 344, 200) && near(centroid(i, false), 296, 200);
    });

    check('Góc +90°: dấu đầu phía dưới, dấu sau phía trên', () => {
      const i = rTest.render({ ...p, theta: Math.PI / 2 });
      return near(centroid(i, true), 320, 224) && near(centroid(i, false), 320, 176);
    });

    const findTrial = (id) => Scenarios.suite.find(t => t.id === id || t.id === id.replace('-', '_') || (t.id.startsWith(id.split('-')[0]) && t.seed === 101));

    for (const [id, label] of [['C1', true], ['C2', false], ['C3', false], ['C4', true], ['N1-101', true], ['N2-101', false], ['N3-101', true]]) {
      check('Nhãn thật ' + id, () => W.evaluate(findTrial(id).world).physicalDocked === label);
    }

    check('Biên thân tính cả dấu bằng, vượt 0,001 u thì loại', () =>
      W.evaluate({ x: 53, y: 30, theta: 0 }).physicalDocked && !W.evaluate({ x: 53.001, y: 30, theta: 0 }).physicalDocked
    );

    check('Hướng ±5° đạt, 5,001° bị loại; π chuẩn hóa thành −π', () =>
      W.evaluate({ ...p, theta: 5 * Math.PI / 180 }).physicalDocked &&
      W.evaluate({ ...p, theta: -5 * Math.PI / 180 }).physicalDocked &&
      !W.evaluate({ ...p, theta: 5.001 * Math.PI / 180 }).physicalDocked &&
      DC.wrap(Math.PI) === -Math.PI
    );

    check('Che dấu đầu/sau loại đúng pixel màu', () =>
      !centroid(rTest.render(p, { hideFront: true }), true) && !centroid(rTest.render(p, { hideRear: true }), false)
    );

    check('C4: che tại 250 ms, hiện lại tại 300 ms', () => {
      const t = findTrial('C4');
      const s = t.occlusionFn || t.occlusionSchedule;
      return !R.isMarkerOccluded(s, 249) && R.isMarkerOccluded(s, 250) && R.isMarkerOccluded(s, 299) && !R.isMarkerOccluded(s, 300);
    });

    check('N3: khoảng che [1000,1800) và [3000,3800)', () => {
      const t = Scenarios.suite.find(tr => tr.id.startsWith('N3'));
      const s = t.occlusionFn || t.occlusionSchedule;
      return !R.isMarkerOccluded(s, 999) && R.isMarkerOccluded(s, 1000) && R.isMarkerOccluded(s, 1799) && !R.isMarkerOccluded(s, 1800) && R.isMarkerOccluded(s, 3000) && !R.isMarkerOccluded(s, 3800);
    });

    check('Seed lặp lại cho cùng ảnh; nhiễu không đổi tư thế thật', () => {
      const before = JSON.stringify(p);
      rTest.setSeed(101);
      const a = rTest.render(p, { noiseAmplitudePx: 3 });
      rTest.setSeed(101);
      return same(a, rTest.render(p, { noiseAmplitudePx: 3 })) && JSON.stringify(p) === before;
    });

    check('Che dấu không làm lệch chuỗi nhiễu của frame sau', () => {
      rTest.setSeed(202);
      rTest.render(p, { noiseAmplitudePx: 3, hideFront: true });
      const a = rTest.render(p, { noiseAmplitudePx: 3 });
      rTest.setSeed(202);
      rTest.render(p, { noiseAmplitudePx: 3 });
      return same(a, rTest.render(p, { noiseAmplitudePx: 3 }));
    });

    check('Nhiễu 0 vẫn tiêu thụ đủ bốn mẫu PRNG', () => {
      rTest.setSeed(303);
      rTest.render(p);
      const a = rTest.render(p, { noiseAmplitudePx: 3 });
      rTest.setSeed(303);
      rTest.render(p);
      return same(a, rTest.render(p, { noiseAmplitudePx: 3 }));
    });

    check('Bộ cấu hình: 19 lượt, 12 đạt/7 không đạt, 1919 mẫu', () =>
      Scenarios.suite.length === 19 &&
      Scenarios.suite.filter(t => W.evaluate(t.world).physicalDocked).length === 12 &&
      Scenarios.suite.reduce((n, t) => n + t.durationMs / t.sampleMs + 1, 0) === 1919
    );

    check('Sai hiệu chuẩn: ảnh C2 giữ nguyên, tâm ước lượng 52,5 u', () => {
      const t = Scenarios.calibrationFailure;
      const img = rTest.render(t.world);
      const a = centroid(img, true);
      const b = centroid(img, false);
      const x = ((a.x + b.x) / 2 - t.calibration.offsetX) / t.calibration.scale;
      return Math.abs(x - 52.5) < 0.1 && !W.evaluate(t.world).physicalDocked && W.evaluate({ x, y: 30, theta: 0 }).physicalDocked;
    });

    check('Mỗi lần render trả buffer độc lập', () => {
      const a = rTest.render(p);
      const b = rTest.render(p);
      a.data.fill(0);
      return b.data.some(v => v !== 0);
    });

    check('Seed 0 và góc không hữu hạn bị từ chối', () => {
      let n = 0;
      try { rTest.setSeed(0); } catch { n++; }
      try { W.validatePose({ ...p, theta: NaN }); } catch { n++; }
      return n === 2;
    });

    const allPassed = out.every(x => x.pass);
    const pre = $('selfChecksOutput');
    if (pre) {
      pre.style.display = 'block';
      pre.textContent = out.map(x => (x.pass ? '✓ ĐẠT' : '✗ LỖI') + ' — ' + x.name + (x.error ? ': ' + x.error : '')).join('\n') +
        `\n\n=========================================\nKẾT QUẢ: ${out.filter(x => x.pass).length}/${out.length} KIỂM TRA ĐẠT TẤT CẢ!\n=========================================`;
      pre.className = allPassed ? 'text-green' : 'text-red';
    }
    return allPassed;
  }

  // ==========================================
  // 10. ĐĂNG KÝ SỰ KIỆN (EVENT LISTENERS)
  // ==========================================
  function setupEventListeners() {
    // 1. Sliders điều khiển tư thế robot
    $('sliderX').oninput = (e) => {
      state.pose.x = parseFloat(e.target.value);
      state.activeCaseId = 'custom';
      stepInteractive(state.tMs);
    };

    $('sliderY').oninput = (e) => {
      state.pose.y = parseFloat(e.target.value);
      state.activeCaseId = 'custom';
      stepInteractive(state.tMs);
    };

    $('sliderAngle').oninput = (e) => {
      state.pose.theta = DC.degToRad(parseFloat(e.target.value));
      state.activeCaseId = 'custom';
      stepInteractive(state.tMs);
    };

    // 2. Sliders cảm biến và che dấu
    $('sliderNoise').oninput = (e) => {
      state.sensorConfig.noiseAmplitudePx = parseFloat(e.target.value);
      state.activeCaseId = 'custom';
      stepInteractive(state.tMs);
    };

    $('chkHideFront').onchange = (e) => {
      state.sensorConfig.hideFront = e.target.checked;
      state.activeCaseId = 'custom';
      stepInteractive(state.tMs);
    };

    $('chkHideRear').onchange = (e) => {
      state.sensorConfig.hideRear = e.target.checked;
      state.activeCaseId = 'custom';
      stepInteractive(state.tMs);
    };

    $('btnResetSeed').onclick = () => {
      const val = parseInt($('inputSeed').value, 10);
      if (val > 0) {
        state.seed = val;
        rng.setSeed(val);
        stepInteractive(state.tMs);
      }
    };

    // 3. Tạm dừng / Tiếp tục & Bước 50 ms
    $('btnPause').onclick = () => {
      state.running = !state.running;
      $('btnPause').textContent = state.running ? '⏸️ Tạm dừng' : '▶️ Tiếp tục';
      state.lastWallTime = null;
    };

    $('btnStep50').onclick = () => {
      state.running = false;
      $('btnPause').textContent = '▶️ Tiếp tục';
      stepInteractive(state.tMs + 50);
    };

    // 4. Chọn ca mẫu
    $('caseSelector').onchange = (e) => {
      loadScenario(e.target.value);
    };

    $('btnLoadCase').onclick = () => {
      loadScenario($('caseSelector').value);
    };

    // 5. Runner bộ thử
    $('btnRunSuite').onclick = () => {
      runBatchSuite(Scenarios.suite, false);
    };

    $('btnRunChallenge').onclick = () => {
      runCalibrationChallenge();
    };

    $('btnExportCSV').onclick = () => {
      exportCSV();
    };

    // 6. Đo stopwatch
    $('btnStartManual').onclick = () => {
      startManualMeasurement();
    };

    $('btnEndManual').onclick = () => {
      endManualMeasurement();
    };

    $('btnRunAutoImpact').onclick = () => {
      runAutoImpact();
    };

    // 6b. Tự kiểm tra 21 module checks
    $('btnRunSelfChecks').onclick = () => {
      runSelfChecks();
    };

    // Đếm click nếu đang đo thủ công
    document.addEventListener('click', (e) => {
      if (state.impact.manualRunning && e.target.tagName === 'BUTTON') {
        state.impact.manualClicks++;
      }
    });

    // 7. Xử lý Visibility Change (Tab hidden) - Bắt buộc theo plan v2!
    document.addEventListener('visibilitychange', () => {
      state.lastWallTime = null;
      if (document.hidden) {
        // Tab bị ẩn: Reset Policy state và xóa READY cũ
        policyPair.reset();
        if (isBatchRunning) {
          batchPauseRequested = true;
        }
      } else {
        batchPauseRequested = false;
        if (state.mode === 'interactive') {
          stepInteractive(state.tMs);
        }
      }
    });
  }

  // ==========================================
  // 11. KHỞI TẠO ỨNG DỤNG
  // ==========================================
  function init() {
    // Đổ danh sách ca mẫu vào dropdown
    const select = $('caseSelector');
    select.innerHTML = '';
    const allCases = Scenarios.allCases || [...Scenarios.suite, Scenarios.calibrationFailure];
    allCases.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      const label = c.name ? `${c.id} — ${c.name}` : c.id;
      opt.textContent = label;
      select.appendChild(opt);
    });

    setupEventListeners();
    loadScenario('C1');
    requestAnimationFrame(tick);
  }

  // Khởi động khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.DC.app = {
    state,
    executePipelineStep,
    stepInteractive,
    runBatchSuite,
    runCalibrationChallenge,
    exportCSV
  };
})();
