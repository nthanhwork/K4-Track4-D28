const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const window = { DC: { sentinel: true } };
const sourcePath = path.join(__dirname, '../perception.js');
if (fs.existsSync(sourcePath)) vm.runInNewContext(fs.readFileSync(sourcePath, 'utf8'), { window });
const calibration = { scale: 6, offsetX: 20, offsetY: 20 };
const estimate = (image, cal = calibration, t = 0) => {
  assert.equal(typeof window.DC.perception?.estimate, 'function', 'perception API must exist');
  return window.DC.perception.estimate(image, cal, t);
};
function image() { return { width: 640, height: 400, data: new Uint8ClampedArray(640 * 400 * 4) }; }
function dot(img, cx, cy, rgb, radius = 6) {
  for (let y = Math.max(0, Math.floor(cy-radius)); y < Math.min(img.height, Math.ceil(cy+radius)); y++) {
    for (let x = Math.max(0, Math.floor(cx-radius)); x < Math.min(img.width, Math.ceil(cx+radius)); x++) {
      if ((x+.5-cx)**2 + (y+.5-cy)**2 <= radius**2) img.data.set([...rgb, 255], 4*(y*img.width+x));
    }
  }
}
function fixture(x=50, y=30, theta=0, hide='') {
  const img = image();
  for (const [name, offset, color] of [['red',4,[240,40,40]],['blue',-4,[40,80,240]]]) {
    if (hide !== name) dot(img, 20+6*(x+offset*Math.cos(theta)), 20+6*(y+offset*Math.sin(theta)), color);
  }
  return img;
}
function invalid(result, reason) {
  assert.equal(result.valid, false);
  assert.equal(result.reason, reason);
  assert.equal(result.pose, null);
  assert.equal(result.footprint, null);
  assert.equal(result.geometryPass, false);
}
test('C1: reads pixels into centered pose and complete footprint; preserves namespace and t=0', () => {
  const r = estimate(fixture());
  assert.equal(r.valid, true); assert.equal(r.geometryPass, true); assert.equal(r.tMs, 0);
  assert.equal(r.pose.x, 50); assert.equal(r.pose.y, 30); assert.equal(r.pose.theta, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(r.footprint)), [{x:56,y:34},{x:44,y:34},{x:44,y:26},{x:56,y:26}]);
  assert.equal(window.DC.sentinel, true);
});
test('C2: rejects footprint overhang even though center is inside dock', () => {
  const r = estimate(fixture(54.5)); assert.equal(r.valid, true); assert.equal(r.geometryPass, false);
});
test('C3: rejects 8 degree heading and measures rasterization error', () => {
  const r = estimate(fixture(50,30,8*Math.PI/180));
  assert.equal(r.valid, true); assert.equal(r.geometryPass, false);
  // A one-pixel transverse error over the 48px marker baseline is about 1.2 degrees.
  assert.ok(Math.abs(r.pose.theta - 8*Math.PI/180) < 1.2*Math.PI/180);
  console.log('C3 heading error (degrees):', (r.pose.theta-8*Math.PI/180)*180/Math.PI);
});
test('missing either marker invalidates result without reusing previous pose', () => {
  estimate(fixture());
  invalid(estimate(fixture(50,30,0,'red')), 'missing-red');
  invalid(estimate(fixture(50,30,0,'blue')), 'missing-blue');
});
test('25 pixels is accepted, 24 is rejected; strict color thresholds apply', () => {
  const img=image();
  for (let y=198; y<203; y++) for (let x=342; x<347; x++) img.data.set([181,99,99,255],4*(y*640+x));
  for (let y=198; y<203; y++) for (let x=294; x<299; x++) img.data.set([99,159,181,255],4*(y*640+x));
  assert.equal(estimate(img).valid,true);
  img.data[4*(198*640+342)]=180;
  invalid(estimate(img),'missing-red');
});
test('marker distance rejects too close and too far, includes both bounds', () => {
  const img=fixture();
  for (const scale of [48/6.4,48/9.6]) assert.equal(estimate(img,{...calibration,scale}).valid,true);
  for (const scale of [8,4]) invalid(estimate(img,{...calibration,scale}),'marker-distance');
});
test('dock boundary is inclusive and a half-pixel overhang fails', () => {
  assert.equal(estimate(fixture(53)).geometryPass,true);
  assert.equal(estimate(fixture(53+1/12)).geometryPass,false);
  assert.equal(estimate(fixture(50,35)).geometryPass,true);
  assert.equal(estimate(fixture(50,35+1/12)).geometryPass,false);
});
test('reversed markers yield normalized -pi heading and fail orientation', () => {
  const r=estimate(fixture(50,30,Math.PI));
  assert.equal(r.pose.theta,-Math.PI); assert.equal(r.geometryPass,false);
});
test('calibration-bias-v1 reproduces false geometric acceptance from pixels', () => {
  const img=fixture(54.5);
  assert.equal(estimate(img).geometryPass,false);
  const r=estimate(img,{scale:6,offsetX:32,offsetY:20},123);
  assert.equal(r.pose.x,52.5); assert.equal(r.geometryPass,true); assert.equal(r.tMs,123);
});
test('bad calibration and malformed image fail closed', () => {
  for (const scale of [0,-1,NaN,Infinity]) invalid(estimate(fixture(),{...calibration,scale}),'invalid-calibration');
  invalid(estimate(fixture(),{scale:6,offsetX:NaN,offsetY:20}),'invalid-calibration');
  invalid(estimate({width:640,height:400,data:[]}), 'invalid-image');
});
