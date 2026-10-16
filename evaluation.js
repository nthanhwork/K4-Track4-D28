// Evaluation: compute true label from WorldState, accumulate per-trial metrics for A and B.
// Self-tests run when URL contains ?test=1 and log to console.

window.DC = window.DC || {};
window.DC.evaluation = (function () {
  // Geometry constants from plan section 3
  const ROBOT_HALF_LEN = 6;  // 12 / 2
  const ROBOT_HALF_WID = 4;  // 8 / 2
  const DOCK = { xMin: 40, xMax: 60, yMin: 20, yMax: 40, thetaMaxDeg: 5 };
  const ALLOW = { xMin: 41, xMax: 59, yMin: 21, yMax: 39 };

  // Returns array of 4 footprint corners in world coords from pose (x, y, thetaRad).
  function footprintCorners(x, y, theta) {
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const local = [
      [ROBOT_HALF_LEN,  ROBOT_HALF_WID],
      [ROBOT_HALF_LEN, -ROBOT_HALF_WID],
      [-ROBOT_HALF_LEN, -ROBOT_HALF_WID],
      [-ROBOT_HALF_LEN,  ROBOT_HALF_WID],
    ];
    const out = [];
    for (let i = 0; i < local.length; i++) {
      const lx = local[i][0];
      const ly = local[i][1];
      out.push({ x: x + lx * cos - ly * sin, y: y + lx * sin + ly * cos });
    }
    return out;
  }

  // Compute true label from WorldState and (optional) calibration.
  // Label is one of: 'PASS' | 'FAIL_POSITION' | 'FAIL_ORIENTATION'
  // 'PASS' = all 4 corners inside allow zone AND |theta| <= 5°
  function computeTrueLabel(world) {
    const turn = 2 * Math.PI;
    const theta = ((world.theta + Math.PI) % turn + turn) % turn - Math.PI;
    const orientOk = Math.abs(theta) <= DOCK.thetaMaxDeg * Math.PI / 180 + 1e-12;
    const corners = footprintCorners(world.x, world.y, world.theta);
    let posOk = true;
    for (let i = 0; i < corners.length; i++) {
      const c = corners[i];
      if (c.x < ALLOW.xMin || c.x > ALLOW.xMax || c.y < ALLOW.yMin || c.y > ALLOW.yMax) {
        posOk = false;
        break;
      }
    }
    if (posOk && orientOk) return 'PASS';
    if (!orientOk && posOk) return 'FAIL_ORIENTATION';
    if (orientOk && !posOk) return 'FAIL_POSITION';
    return 'FAIL_POSITION';  // both fail; bucket as position-fail
  }

  // Create a metrics recorder for a single trial.
  // Returns object with .record(obs, policyResults) and .finish() -> TrialResult
  function create(trialConfig) {
    const trueLabel = computeTrueLabel(trialConfig.world);
    let firstReadyA = null;
    let firstReadyB = null;
    let lastReadyA = false;
    let lastReadyB = false;
    let transitionsA = 0;
    let transitionsB = 0;
    let sampleCount = 0;
    let invalidCount = 0;
    let stateCountsA = { NOT_READY: 0, CHECKING: 0, READY: 0, UNKNOWN: 0 };
    let stateCountsB = { NOT_READY: 0, CHECKING: 0, READY: 0, UNKNOWN: 0 };

    return {
      record: function (obs, policyResults) {
        sampleCount++;
        if (!obs.valid) {
          invalidCount++;
        }
        const a = policyResults.A;
        const b = policyResults.B;
        if (a && a.state && stateCountsA.hasOwnProperty(a.state)) {
          stateCountsA[a.state]++;
        }
        if (b && b.state && stateCountsB.hasOwnProperty(b.state)) {
          stateCountsB[b.state]++;
        }
        if (a && a.ready && firstReadyA === null) {
          firstReadyA = obs.tMs;
        }
        if (b && b.ready && firstReadyB === null) {
          firstReadyB = obs.tMs;
        }
        if (sampleCount > 1) {
          if (a.ready !== lastReadyA) transitionsA++;
          if (b.ready !== lastReadyB) transitionsB++;
        }
        lastReadyA = !!(a && a.ready);
        lastReadyB = !!(b && b.ready);
      },
      setTrueLabel: function (label) {
        if (label !== trueLabel) throw new Error('Ground truth must match trialConfig.world');
      },
      finish: function () {
        const label = trueLabel;
        const result = {
          trialId: trialConfig.id,
          seed: trialConfig.seed,
          suiteVersion: trialConfig.suiteVersion || 'v1',
          config: {
            x: trialConfig.world.x,
            y: trialConfig.world.y,
            theta: trialConfig.world.theta,
            noiseAmplitudePx: trialConfig.noiseAmplitudePx,
            occlusionSchedule: trialConfig.occlusionSchedule,
            calibration: trialConfig.calibration,
          },
          trueLabel: label,
          sampleCount: sampleCount,
          invalidCount: invalidCount,
          A: {
            firstReadyTMs: firstReadyA,
            transitions: transitionsA,
            stateCounts: stateCountsA,
          },
          B: {
            firstReadyTMs: firstReadyB,
            transitions: transitionsB,
            stateCounts: stateCountsB,
          },
        };
        return result;
      },
      getSampleCount: function () { return sampleCount; },
    };
  }

  // ----------------- self-test -----------------
  function makeTrialConfig(id, world) {
    return {
      id: id,
      world: world,
      noiseAmplitudePx: 0,
      occlusionSchedule: null,
      calibration: { scale: 6, offsetX: 20, offsetY: 20 },
      seed: 101,
      durationMs: 5000,
      sampleMs: 50,
      suiteVersion: 'v1-test',
    };
  }

  function selfTest() {
    const results = [];
    function assert(name, cond, detail) {
      results.push({ name: name, pass: !!cond, detail: detail || '' });
    }

    // computeTrueLabel
    assert('TL1: center, theta=0 → PASS', computeTrueLabel({ x: 50, y: 30, theta: 0 }) === 'PASS');
    assert('TL2: 54.5,30,0° → FAIL_POSITION', computeTrueLabel({ x: 54.5, y: 30, theta: 0 }) === 'FAIL_POSITION',
      'meant to be 4cm outside right boundary; foot +6u = 60.5 > 59');
    assert('TL3: 50,30,8° → FAIL_ORIENTATION', computeTrueLabel({ x: 50, y: 30, theta: 8 * Math.PI / 180 }) === 'FAIL_ORIENTATION');
    assert('TL4: 52.7,30,0° → PASS (near edge but inside allow zone)',
      computeTrueLabel({ x: 52.7, y: 30, theta: 0 }) === 'PASS',
      'meant to be inside allow zone [41,59]×[21,39]');
    assert('TL5: 53.3,30,0° → FAIL_POSITION',
      computeTrueLabel({ x: 53.3, y: 30, theta: 0 }) === 'FAIL_POSITION',
      'meant to be 4cm outside right edge of allow zone');
    assert('TL6: negative theta -8° → FAIL_ORIENTATION',
      computeTrueLabel({ x: 50, y: 30, theta: -8 * Math.PI / 180 }) === 'FAIL_ORIENTATION');
    assert('TL7: large offset both axes → FAIL_POSITION',
      computeTrueLabel({ x: 70, y: 50, theta: 0 }) === 'FAIL_POSITION');
    assert('TL8: at x=47,y=30,0° (smallest x fitting all corners) → PASS',
      computeTrueLabel({ x: 47, y: 30, theta: 0 }) === 'PASS',
      'leftmost corner at 47-6=41 is exactly at allow-zone boundary, inclusive → PASS');
    assert('TL8b: at x=46.9,y=30,0° → FAIL_POSITION (just outside left edge)',
      computeTrueLabel({ x: 46.9, y: 30, theta: 0 }) === 'FAIL_POSITION');

    // metrics recording
    {
      const tc = makeTrialConfig('T1', { x: 50, y: 30, theta: 0 });
      const m = create(tc);
      m.setTrueLabel('PASS');
      for (let t = 0; t <= 5000; t += 50) {
        m.record({ tMs: t, valid: true, geometryPass: true, footprint: [], pose: {} },
          { A: { state: t >= 0 ? 'READY' : 'NOT_READY', ready: true },
            B: { state: t >= 500 ? 'READY' : 'CHECKING', ready: t >= 500 } });
      }
      const r = m.finish();
      assert('M1: 101 samples', r.sampleCount === 101, 'got ' + r.sampleCount);
      assert('M2: 0 invalid', r.invalidCount === 0);
      assert('M3: A.firstReadyTMs = 0', r.A.firstReadyTMs === 0);
      assert('M4: B.firstReadyTMs = 500', r.B.firstReadyTMs === 500);
      assert('M5: A.transitions = 0 (always ready)', r.A.transitions === 0);
      assert('M6: B.transitions >= 1 (CHECKING → READY once)', r.B.transitions >= 1);
      assert('M7: trueLabel echoed', r.trueLabel === 'PASS');
      assert('M8: B stateCounts has READY>0', r.B.stateCounts.READY > 0);
    }

    // metrics recording with invalid
    {
      const tc = makeTrialConfig('T2', { x: 50, y: 30, theta: 0 });
      const m = create(tc);
      m.setTrueLabel('PASS');
      const states = { A: 'READY', B: 'CHECKING' };
      for (let t = 0; t <= 5000; t += 50) {
        const isInvalid = (t >= 200 && t < 300);
        m.record({ tMs: t, valid: !isInvalid, geometryPass: !isInvalid, footprint: [], pose: {} },
          isInvalid
            ? { A: { state: 'UNKNOWN', ready: false }, B: { state: 'UNKNOWN', ready: false } }
            : { A: { state: 'READY', ready: true }, B: { state: t >= 500 ? 'READY' : 'CHECKING', ready: t >= 500 } });
      }
      const r = m.finish();
      assert('M9: 101 samples', r.sampleCount === 101);
      assert('M10: 2 invalid samples (t=200, t=250 in [200,300))', r.invalidCount === 2,
        'got ' + r.invalidCount);
      assert('M11: A stateCounts UNKNOWN = 2', r.A.stateCounts.UNKNOWN === 2, 'got ' + r.A.stateCounts.UNKNOWN);
    }

    // transitions counted correctly
    {
      const tc = makeTrialConfig('T3', { x: 50, y: 30, theta: 0 });
      const m = create(tc);
      m.setTrueLabel('PASS');
      // pattern: F F T T F F (2 transitions, 6 samples)
      const readySeq = [false, false, true, true, false, false];
      for (let i = 0; i < readySeq.length; i++) {
        m.record({ tMs: i * 50, valid: true, geometryPass: true, footprint: [], pose: {} },
          { A: { state: readySeq[i] ? 'READY' : 'NOT_READY', ready: readySeq[i] },
            B: { state: readySeq[i] ? 'READY' : 'NOT_READY', ready: readySeq[i] } });
      }
      const r = m.finish();
      assert('M12: 2 transitions (F→T, T→F, ignore first init)', r.A.transitions === 2, 'got ' + r.A.transitions);
    }

    let pass = 0;
    let fail = 0;
    const lines = ['[evaluation self-test]'];
    results.forEach(function (r) {
      if (r.pass) {
        pass++;
        lines.push('  PASS  ' + r.name);
      } else {
        fail++;
        lines.push('  FAIL  ' + r.name + (r.detail ? '  -- ' + r.detail : ''));
      }
    });
    lines.push('  ----');
    lines.push('  ' + pass + ' pass, ' + fail + ' fail, ' + results.length + ' total');
    console.log(lines.join('\n'));
    return { pass: pass, fail: fail, total: results.length };
  }

  return {
    create: create,
    computeTrueLabel: computeTrueLabel,
    footprintCorners: footprintCorners,
    selfTest: selfTest,
    constants: { ROBOT_HALF_LEN: ROBOT_HALF_LEN, ROBOT_HALF_WID: ROBOT_HALF_WID, DOCK: DOCK, ALLOW: ALLOW },
  };
})();
