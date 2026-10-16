// Current integration evidence; real Canvas pixels with a stub DOM, not browser E2E.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {window:w} = require('./helpers/load-page.cjs')('dockcheck-demo.html', false);
const S = w.DockCheckSim, DC = w.DC;
function run(trial) {
  const metrics = DC.evaluation.create(trial);
  S.beginTrial(trial);
  try {
    for (let t = 0; t <= trial.durationMs; t += trial.sampleMs) {
      S.captureTrialFrame(t);
      const {observation, policies} = DC.integration.getSnapshot();
      metrics.record(observation, policies);
    }
    return metrics.finish();
  } finally { S.endTrial(); }
}
const suite = S.trials.map(run);
const repeated = run(S.trials.find(t => t.id === 'N2-101'));
assert.deepEqual(repeated, suite.find(t => t.trialId === 'N2-101'));
const moduleChecks = w.DockCheckChecks.runSelfChecks();
assert.ok(moduleChecks.every(t => t.pass));
assert.equal(suite.length, 19);
assert.equal(suite.reduce((n,t) => n + t.sampleCount, 0), 1919);
const result = {
  engine: 'Node + @napi-rs/canvas (Skia); stub DOM, not browser E2E',
  sourceHashes: Object.fromEntries(['dockcheck-demo.html','perception.js','policies.js','evaluation.js','scenarios.js','integration.js'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',file))).digest('hex')])),
  moduleChecks, suite, calibrationChallenge: run(S.calibrationBias),
  reproducibleN2: true
};
fs.writeFileSync(path.join(__dirname,'parts-1-2-review-results.json'), JSON.stringify(result,null,2)+'\n');
console.log(`Renderer ${moduleChecks.length}/${moduleChecks.length}; suite 19 trials / 1919 frames; N2 repeat identical; calibration challenge recorded.`);
