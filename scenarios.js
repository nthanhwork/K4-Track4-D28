// Trial configs: suite-v1 (19 trials) and calibrationFailure preset.
// Self-tests run when URL contains ?test=1 and log to console.

window.DC = window.DC || {};
window.DC.scenarios = (function () {
  const SUITE_VERSION = 'v1';
  const SEEDS = [101, 202, 303, 404, 505];
  const DEFAULT_CAL = { scale: 6, offsetX: 20, offsetY: 20 };
  const DURATION_MS = 5000;
  const SAMPLE_MS = 50;

  // C4 occlusion: missing head mark when (t mod 300) is in [250, 300)
  // t = 250, 550, 850, 1150, 1450, 1750, 2050, 2350, 2650, 2950, 3250, 3550, 3850, 4150, 4450, 4750
  function c4Schedule(tMs) {
    return (tMs % 300) >= 250 && (tMs % 300) < 300;
  }

  // N3 occlusion: missing head mark during [1000,1800) and [3000,3800)
  function n3Schedule(tMs) {
    return (tMs >= 1000 && tMs < 1800) || (tMs >= 3000 && tMs < 3800);
  }

  function makeTrial(id, world, noiseAmplitudePx, occlusionFn, seed) {
    return {
      id: id,
      world: world,
      noiseAmplitudePx: noiseAmplitudePx,
      occlusionSchedule: occlusionFn ? occlusionFn.toString() : null,
      occlusionFn: occlusionFn,
      calibration: Object.assign({}, DEFAULT_CAL),
      seed: seed,
      durationMs: DURATION_MS,
      sampleMs: SAMPLE_MS,
      suiteVersion: SUITE_VERSION,
    };
  }

  // Build suite per plan section 6.
  // C1–C4 run once with seed 101; N1–N3 run 5 times each with SEEDS.
  const suite = [];

  // C1: (50,30,0°), no noise, no occlusion — PASS
  suite.push(makeTrial('C1', { x: 50, y: 30, theta: 0 }, 0, null, 101));

  // C2: (54.5,30,0°) — FAIL_POSITION (right corner at 60.5 > 59)
  suite.push(makeTrial('C2', { x: 54.5, y: 30, theta: 0 }, 0, null, 101));

  // C3: (50,30,8°) — FAIL_ORIENTATION
  suite.push(makeTrial('C3', { x: 50, y: 30, theta: 8 * Math.PI / 180 }, 0, null, 101));

  // C4: (50,30,0°), periodic head-mark occlusion — PASS but B has trouble
  suite.push(makeTrial('C4', { x: 50, y: 30, theta: 0 }, 0, c4Schedule, 101));

  // N1: (52.7,30,0°), noise 3 — PASS, near boundary
  for (let i = 0; i < SEEDS.length; i++) {
    suite.push(makeTrial('N1_' + SEEDS[i], { x: 52.7, y: 30, theta: 0 }, 3, null, SEEDS[i]));
  }

  // N2: (53.3,30,0°), noise 3 — FAIL_POSITION, near boundary
  for (let i = 0; i < SEEDS.length; i++) {
    suite.push(makeTrial('N2_' + SEEDS[i], { x: 53.3, y: 30, theta: 0 }, 3, null, SEEDS[i]));
  }

  // N3: (50,30,0°), noise 3, two occlusion windows — PASS but with gaps
  for (let i = 0; i < SEEDS.length; i++) {
    suite.push(makeTrial('N3_' + SEEDS[i], { x: 50, y: 30, theta: 0 }, 3, n3Schedule, SEEDS[i]));
  }

  // calibration-bias-v1: 54.5,30,0°; offsetX=32 (vs correct 20); no noise
  const calibrationFailure = {
    id: 'calibration-bias-v1',
    world: { x: 54.5, y: 30, theta: 0 },
    noiseAmplitudePx: 0,
    occlusionSchedule: null,
    occlusionFn: null,
    calibration: { scale: 6, offsetX: 32, offsetY: 20 },
    seed: 101,
    durationMs: DURATION_MS,
    sampleMs: SAMPLE_MS,
    suiteVersion: SUITE_VERSION + '-calib',
  };

  // ----------------- self-test -----------------
  function selfTest() {
    const results = [];
    function assert(name, cond, detail) {
      results.push({ name: name, pass: !!cond, detail: detail || '' });
    }

    assert('S1: suite has 19 trials', suite.length === 19, 'got ' + suite.length);

    // count by group
    const counts = { C1: 0, C2: 0, C3: 0, C4: 0, N1: 0, N2: 0, N3: 0 };
    const seedSet = {};
    suite.forEach(function (t) {
      const g = t.id.split('_')[0];
      if (counts.hasOwnProperty(g)) counts[g]++;
      seedSet[t.seed] = true;
    });
    assert('S2: C1 count = 1', counts.C1 === 1, 'got ' + counts.C1);
    assert('S3: C2 count = 1', counts.C2 === 1);
    assert('S4: C3 count = 1', counts.C3 === 1);
    assert('S5: C4 count = 1', counts.C4 === 1);
    assert('S6: N1 count = 5', counts.N1 === 5, 'got ' + counts.N1);
    assert('S7: N2 count = 5', counts.N2 === 5, 'got ' + counts.N2);
    assert('S8: N3 count = 5', counts.N3 === 5, 'got ' + counts.N3);
    assert('S9: 5 distinct seeds used', Object.keys(seedSet).length === 5,
      'seeds used: ' + Object.keys(seedSet).join(','));

    // sample count math: 5000ms / 50ms = 100 steps + t=0 → 101 samples
    assert('S10: durationMs=5000, sampleMs=50 → 101 samples per trial',
      Math.floor(suite[0].durationMs / suite[0].sampleMs) + 1 === 101);
    assert('S11: 19 * 101 = 1919 total samples',
      suite.length * 101 === 1919, 'got ' + (suite.length * 101));

    // schedule functions
    assert('S12: c4Schedule(250) → true', c4Schedule(250) === true);
    assert('S13: c4Schedule(299) → true', c4Schedule(299) === true);
    assert('S14: c4Schedule(300) → false (mod 300=0)', c4Schedule(300) === false);
    assert('S15: c4Schedule(550) → true', c4Schedule(550) === true);
    assert('S16: c4Schedule(549) → false', c4Schedule(549) === false);

    assert('S17: n3Schedule(999) → false', n3Schedule(999) === false);
    assert('S18: n3Schedule(1000) → true', n3Schedule(1000) === true);
    assert('S19: n3Schedule(1799) → true', n3Schedule(1799) === true);
    assert('S20: n3Schedule(1800) → false', n3Schedule(1800) === false);
    assert('S21: n3Schedule(2999) → false', n3Schedule(2999) === false);
    assert('S22: n3Schedule(3000) → true', n3Schedule(3000) === true);
    assert('S23: n3Schedule(3799) → true', n3Schedule(3799) === true);
    assert('S24: n3Schedule(3800) → false', n3Schedule(3800) === false);

    // calibration failure preset
    assert('S25: calibrationFailure has offsetX=32', calibrationFailure.calibration.offsetX === 32);
    assert('S26: calibrationFailure world is (54.5, 30, 0)', calibrationFailure.world.x === 54.5);
    assert('S27: calibrationFailure has no noise/occlusion', calibrationFailure.noiseAmplitudePx === 0 && !calibrationFailure.occlusionFn);

    // each trial has required fields
    let missingFields = 0;
    suite.forEach(function (t) {
      if (!t.id || !t.world || t.calibration === undefined || t.seed === undefined ||
          t.durationMs === undefined || t.sampleMs === undefined) {
        missingFields++;
      }
    });
    assert('S28: all trials have required fields', missingFields === 0, missingFields + ' trials missing fields');

    // trueLabel count check (using computeTrueLabel)
    if (window.DC && window.DC.evaluation) {
      let pass = 0, fail = 0;
      suite.forEach(function (t) {
        const lbl = window.DC.evaluation.computeTrueLabel(t.world);
        if (lbl === 'PASS') pass++;
        else fail++;
      });
      assert('S29: 12 PASS labels in suite', pass === 12, 'got ' + pass);
      assert('S30: 7 FAIL labels in suite', fail === 7, 'got ' + fail);
    } else {
      assert('S29: evaluation module not loaded — skipping label count', false,
        'load evaluation.js before scenarios.js for full self-test');
    }

    // occlusion schedule preserved on trial
    assert('S31: C4 trial has occlusionFn that triggers at t=250',
      suite[3].occlusionFn && suite[3].occlusionFn(250) === true);
    assert('S32: N3 trial has occlusionFn that triggers at t=1000',
      suite[14].occlusionFn && suite[14].occlusionFn(1000) === true);

    let pass = 0;
    let fail = 0;
    const lines = ['[scenarios self-test]'];
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
    suite: suite,
    calibrationFailure: calibrationFailure,
    seeds: SEEDS,
    suiteVersion: SUITE_VERSION,
    selfTest: selfTest,
  };
})();
