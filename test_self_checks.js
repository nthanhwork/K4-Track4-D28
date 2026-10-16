const fs = require('fs');

class MockContext2D {
  constructor(w, h) {
    this.canvas = { width: w, height: h };
    this.width = w;
    this.height = h;
    this.buffer = new Uint8ClampedArray(w * h * 4);
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.stack = [];
  }
  save() { this.stack.push({ fillStyle: this.fillStyle, strokeStyle: this.strokeStyle }); }
  restore() { const s = this.stack.pop(); if (s) Object.assign(this, s); }
  translate() {}
  rotate() {}
  setLineDash() {}
  fillText() {}
  clearRect() { this.buffer.fill(0); }
  fillRect(x, y, w, h) {
    const col = this._parseColor(this.fillStyle);
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + w));
    const y1 = Math.min(this.height, Math.ceil(y + h));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const idx = (py * this.width + px) * 4;
        this.buffer[idx] = col[0];
        this.buffer[idx+1] = col[1];
        this.buffer[idx+2] = col[2];
        this.buffer[idx+3] = 255;
      }
    }
  }
  strokeRect() {}
  beginPath() { this._path = []; }
  moveTo() {}
  lineTo() {}
  stroke() {}
  arc(cx, cy, r) { this._arc = { cx, cy, r }; }
  fill() {
    if (this._arc) {
      const { cx, cy, r } = this._arc;
      const col = this._parseColor(this.fillStyle);
      const r2 = r * r;
      const x0 = Math.max(0, Math.floor(cx - r));
      const y0 = Math.max(0, Math.floor(cy - r));
      const x1 = Math.min(this.width, Math.ceil(cx + r));
      const y1 = Math.min(this.height, Math.ceil(cy + r));
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const dx = px + 0.5 - cx;
          const dy = py + 0.5 - cy;
          if (dx * dx + dy * dy <= r2) {
            const idx = (py * this.width + px) * 4;
            this.buffer[idx] = col[0];
            this.buffer[idx+1] = col[1];
            this.buffer[idx+2] = col[2];
            this.buffer[idx+3] = 255;
          }
        }
      }
      this._arc = null;
    }
  }
  _parseColor(str) {
    if (str.startsWith('#')) {
      const hex = str.slice(1);
      if (hex.length === 3) return [parseInt(hex[0]+hex[0], 16), parseInt(hex[1]+hex[1], 16), parseInt(hex[2]+hex[2], 16)];
      return [parseInt(hex.slice(0,2), 16), parseInt(hex.slice(2,4), 16), parseInt(hex.slice(4,6), 16)];
    }
    const m = str.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
    return [0, 0, 0];
  }
  getImageData(x, y, w, h) {
    const copy = new Uint8ClampedArray(this.buffer.length);
    copy.set(this.buffer);
    return { width: w, height: h, data: copy };
  }
}

global.window = global;
global.document = {
  hidden: false,
  createElement: () => ({ getContext: () => new MockContext2D(640, 400) }),
  getElementById: () => ({ textContent: '', dataset: {} })
};

eval(fs.readFileSync('config.js', 'utf8'));
eval(fs.readFileSync('world.js', 'utf8'));
eval(fs.readFileSync('renderer.js', 'utf8'));
eval(fs.readFileSync('perception.js', 'utf8'));
eval(fs.readFileSync('policies.js', 'utf8'));
eval(fs.readFileSync('scenarios.js', 'utf8'));
eval(fs.readFileSync('evaluation.js', 'utf8'));

// Run self-checks from dockcheck-world.html
const W = DC.world;
const S = {
  trials: DC.scenarios.suite,
  calibrationBias: DC.scenarios.calibrationFailure,
  hiddenAt: DC.renderer.isMarkerOccluded
};
const canvas = document.createElement('canvas');
const r = DC.renderer.create(canvas.getContext('2d'), 101);
const out = [];

const check = (name, fn) => {
  try {
    if (!fn()) throw Error('Không đúng kỳ vọng');
    out.push({ name, pass: true });
    console.log('✓ PASS:', name);
  } catch (e) {
    out.push({ name, pass: false, error: e.message });
    console.log('✗ FAIL:', name, '->', e.message);
  }
};

function centroid(img, red) {
  let n = 0, x = 0, y = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    const [R, G, B] = img.data.subarray(i, i + 3);
    if (red ? R > 180 && G < 100 && B < 100 : B > 180 && R < 100 && G < 160) {
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
  const i = r.render(p);
  return i.width === 640 && i.height === 400 && near(centroid(i, true), 344, 200) && near(centroid(i, false), 296, 200);
});

check('Góc +90°: dấu đầu phía dưới, dấu sau phía trên', () => {
  const i = r.render({ ...p, theta: Math.PI / 2 });
  return near(centroid(i, true), 320, 224) && near(centroid(i, false), 320, 176);
});

const findTrial = (id) => S.trials.find(t => t.id === id || t.id === id.replace('-', '_') || (t.id.startsWith(id.split('-')[0]) && t.seed === 101));

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
  W.wrap(Math.PI) === -Math.PI
);

check('Che dấu đầu/sau loại đúng pixel màu', () =>
  !centroid(r.render(p, { hideFront: true }), true) && !centroid(r.render(p, { hideRear: true }), false)
);

check('C4: che tại 250 ms, hiện lại tại 300 ms', () => {
  const t = findTrial('C4');
  const s = t.occlusionFn || t.occlusionSchedule;
  return !S.hiddenAt(s, 249) && S.hiddenAt(s, 250) && S.hiddenAt(s, 299) && !S.hiddenAt(s, 300);
});

check('N3: khoảng che [1000,1800) và [3000,3800)', () => {
  const t = S.trials.find(tr => tr.id.startsWith('N3'));
  const s = t.occlusionFn || t.occlusionSchedule;
  return !S.hiddenAt(s, 999) && S.hiddenAt(s, 1000) && S.hiddenAt(s, 1799) && !S.hiddenAt(s, 1800) && S.hiddenAt(s, 3000) && !S.hiddenAt(s, 3800);
});

check('Seed lặp lại cho cùng ảnh; nhiễu không đổi tư thế thật', () => {
  const before = JSON.stringify(p);
  r.setSeed(101);
  const a = r.render(p, { noiseAmplitudePx: 3 });
  r.setSeed(101);
  return same(a, r.render(p, { noiseAmplitudePx: 3 })) && JSON.stringify(p) === before;
});

check('Che dấu không làm lệch chuỗi nhiễu của frame sau', () => {
  r.setSeed(202);
  r.render(p, { noiseAmplitudePx: 3, hideFront: true });
  const a = r.render(p, { noiseAmplitudePx: 3 });
  r.setSeed(202);
  r.render(p, { noiseAmplitudePx: 3 });
  return same(a, r.render(p, { noiseAmplitudePx: 3 }));
});

check('Nhiễu 0 vẫn tiêu thụ đủ bốn mẫu PRNG', () => {
  r.setSeed(303);
  r.render(p);
  const a = r.render(p, { noiseAmplitudePx: 3 });
  r.setSeed(303);
  r.render(p);
  return same(a, r.render(p, { noiseAmplitudePx: 3 }));
});

check('Bộ cấu hình: 19 lượt, 12 đạt/7 không đạt, 1919 mẫu', () =>
  S.trials.length === 19 &&
  S.trials.filter(t => W.evaluate(t.world).physicalDocked).length === 12 &&
  S.trials.reduce((n, t) => n + t.durationMs / t.sampleMs + 1, 0) === 1919
);

check('Sai hiệu chuẩn: ảnh C2 giữ nguyên, tâm ước lượng 52,5 u', () => {
  const t = S.calibrationBias;
  const img = r.render(t.world);
  const a = centroid(img, true);
  const b = centroid(img, false);
  const x = ((a.x + b.x) / 2 - t.calibration.offsetX) / t.calibration.scale;
  return Math.abs(x - 52.5) < 0.1 && !W.evaluate(t.world).physicalDocked && W.evaluate({ x, y: 30, theta: 0 }).physicalDocked;
});

check('Mỗi lần render trả buffer độc lập', () => {
  const a = r.render(p);
  const b = r.render(p);
  a.data.fill(0);
  return b.data.some(v => v !== 0);
});

check('Seed 0 và góc không hữu hạn bị từ chối', () => {
  let n = 0;
  try { r.setSeed(0); } catch { n++; }
  try { W.validatePose({ ...p, theta: NaN }); } catch { n++; }
  return n === 2;
});

const allPassed = out.every(x => x.pass);
console.log('\n=======================================');
console.log('KẾT QUẢ TỰ KIỂM (SELF-CHECKS):', allPassed ? '21/21 ĐẠT TẤT CẢ!' : 'CÓ LỖI');
console.log('=======================================');
if (!allPassed) process.exit(1);
