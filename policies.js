// Policies A (single-frame) and B (500ms continuous pass with 150ms gap tolerance).
// Self-tests run when URL contains ?test=1 and log to console.

window.DC = window.DC || {};
window.DC.policies = (function () {
  const NOT_READY = 'NOT_READY';
  const CHECKING = 'CHECKING';
  const READY = 'READY';
  const UNKNOWN = 'UNKNOWN';

  const REQUIRED_MS = 500;
  const MAX_GAP_MS = 150;

  function makeObservation(tMs, valid, geometryPass) {
    return {
      tMs: tMs,
      valid: valid,
      reason: valid ? 'ok' : 'invalid',
      pose: valid ? { x: 50, y: 30, theta: 0 } : null,
      footprint: valid ? [
        { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 },
      ] : null,
      geometryPass: geometryPass,
    };
  }

  function create() {
    let candidateSince = null;
    let lastTMs = null;

    function reset() {
      candidateSince = null;
      lastTMs = null;
    }

    function step(observation) {
      const a = evaluateA(observation);
      const b = evaluateB(observation, observation.tMs, lastTMs, candidateSince);
      candidateSince = b.candidateSince;
      lastTMs = observation.tMs;
      return {
        A: { state: a.state, ready: a.ready },
        B: { state: b.state, ready: b.ready },
      };
    }

    return { step, reset };
  }

  function evaluateA(obs) {
    if (!obs.valid) {
      return { state: UNKNOWN, ready: false };
    }
    if (obs.geometryPass) {
      return { state: READY, ready: true };
    }
    return { state: NOT_READY, ready: false };
  }

  function evaluateB(obs, tMs, lastTMs, prevCandidate) {
    if (!obs.valid) {
      return { state: UNKNOWN, ready: false, candidateSince: null };
    }
    if (!obs.geometryPass) {
      return { state: NOT_READY, ready: false, candidateSince: null };
    }

    const gap = (lastTMs === null) ? 0 : (tMs - lastTMs);
    let candidateSince = prevCandidate;
    if (lastTMs !== null && gap > MAX_GAP_MS) {
      candidateSince = null;
    }
    if (candidateSince === null || candidateSince === undefined) {
      candidateSince = tMs;
    }
    const elapsed = tMs - candidateSince;
    if (elapsed >= REQUIRED_MS) {
      return { state: READY, ready: true, candidateSince: candidateSince };
    }
    return { state: CHECKING, ready: false, candidateSince: candidateSince };
  }

  // ----------------- self-test -----------------
  function selfTest() {
    const results = [];
    function assert(name, cond, detail) {
      results.push({ name: name, pass: !!cond, detail: detail || '' });
    }

    // Case 1: continuous pass for 1s (50ms step) — A ready on first sample, B ready after 500ms
    {
      const p = create();
      const samples = [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550];
      const outs = samples.map(function (t) { return p.step(makeObservation(t, true, true)); });
      assert('C1 A: first sample READY', outs[0].A.state === READY && outs[0].A.ready === true);
      assert('C1 B: at t=50 CHECKING (elapsed 50 < 500)', outs[1].B.state === CHECKING && outs[1].B.ready === false);
      assert('C1 B: at t=450 still CHECKING (elapsed 450 < 500)', outs[9].B.state === CHECKING);
      assert('C1 B: at t=500 READY (elapsed 500 >= 500)', outs[10].B.state === READY && outs[10].B.ready === true);
      assert('C1 B: still READY at t=550', outs[11].B.state === READY && outs[11].B.ready === true);
    }

    // Case 2: pass then lose mark (invalid) — B resets, UNKNOWN
    {
      const p = create();
      p.step(makeObservation(0, true, true));
      p.step(makeObservation(100, true, true));
      const out = p.step(makeObservation(200, false, false));
      assert('C2 B: invalid → UNKNOWN, ready=false', out.B.state === UNKNOWN && out.B.ready === false);
      const out2 = p.step(makeObservation(250, true, true));
      assert('C2 B: after recovering, CHECKING again (counter reset)', out2.B.state === CHECKING && out2.B.ready === false);
    }

    // Case 3: pass then geometry fail — B resets, NOT_READY
    {
      const p = create();
      p.step(makeObservation(0, true, true));
      p.step(makeObservation(100, true, true));
      const out = p.step(makeObservation(200, true, false));
      assert('C3 B: geometry fail → NOT_READY, ready=false', out.B.state === NOT_READY && out.B.ready === false);
      const out2 = p.step(makeObservation(250, true, true));
      assert('C3 B: after recovering, CHECKING again', out2.B.state === CHECKING && out2.B.ready === false);
    }

    // Case 4: 200ms gap — must reset B
    {
      const p = create();
      p.step(makeObservation(0, true, true));
      p.step(makeObservation(100, true, true));
      const out = p.step(makeObservation(300, true, true));  // gap from 100 to 300 = 200 > 150
      assert('C4 B: gap > 150ms → CHECKING (counter reset, not READY)', out.B.state === CHECKING && out.B.ready === false);
    }

    // Case 5: timestamp must be monotonic for A/B
    {
      const p = create();
      p.step(makeObservation(0, true, true));
      p.step(makeObservation(100, true, true));
      p.step(makeObservation(600, true, true));
      const out = p.step(makeObservation(500, true, true));
      assert('C5: non-monotonic tMs treated as large gap → B resets (CHECKING)', out.B.state === CHECKING);
    }

    // Case 6: A is single-frame, not affected by history
    {
      const p = create();
      p.step(makeObservation(0, true, true));
      p.step(makeObservation(100, false, false));
      const out = p.step(makeObservation(200, true, true));
      assert('C6 A: READY instantly when valid+geometryPass, no history needed', out.A.state === READY && out.A.ready === true);
    }

    // Case 7: B must not become READY before 500ms even with many samples
    {
      const p = create();
      p.step(makeObservation(0, true, true));
      p.step(makeObservation(50, true, true));
      p.step(makeObservation(100, true, true));
      p.step(makeObservation(150, true, true));
      p.step(makeObservation(200, true, true));
      p.step(makeObservation(250, true, true));
      p.step(makeObservation(300, true, true));
      p.step(makeObservation(350, true, true));
      p.step(makeObservation(400, true, true));
      const out = p.step(makeObservation(450, true, true));
      assert('C7 B: still CHECKING at t=450 (before 500)', out.B.state === CHECKING && out.B.ready === false);
      const out2 = p.step(makeObservation(500, true, true));
      assert('C7 B: READY at t=500', out2.B.state === READY && out2.B.ready === true);
    }

    // Case 8: reset() clears state
    {
      const p = create();
      p.step(makeObservation(0, true, true));
      p.step(makeObservation(100, true, true));
      p.step(makeObservation(600, true, true));
      p.reset();
      const out = p.step(makeObservation(700, true, true));
      assert('C8 B: after reset, CHECKING again at t=700', out.B.state === CHECKING && out.B.ready === false);
    }

    // Case 9: invalid → B state=UNKNOWN, A state=UNKNOWN
    {
      const p = create();
      const out = p.step(makeObservation(0, false, false));
      assert('C9 A: invalid → UNKNOWN', out.A.state === UNKNOWN);
      assert('C9 B: invalid → UNKNOWN', out.B.state === UNKNOWN);
    }

    // Case 10: t=0 is a valid sample; B should not skip it
    {
      const p = create();
      const out0 = p.step(makeObservation(0, true, true));
      const out1 = p.step(makeObservation(50, true, true));
      assert('C10 B: t=0 is candidate start → CHECKING at t=50 (elapsed 50 < 500)', out0.B.state === CHECKING && out1.B.state === CHECKING);
    }

    let pass = 0;
    let fail = 0;
    const lines = ['[policies self-test]'];
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
    selfTest: selfTest,
    states: { NOT_READY: NOT_READY, CHECKING: CHECKING, READY: READY, UNKNOWN: UNKNOWN },
    params: { REQUIRED_MS: REQUIRED_MS, MAX_GAP_MS: MAX_GAP_MS },
  };
})();
