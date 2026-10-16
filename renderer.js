'use strict';
/**
 * DockCheck Sim v2 - renderer.js
 * Người 1 sở hữu: Camera tổng hợp 640 × 400 px, xorshift32 PRNG, nhiễu và che dấu theo lịch.
 * Output thuần ImageData sạch không nhãn trước khi đưa sang perception.
 * Namespace: window.DC.renderer
 */
window.DC = window.DC || {};

(() => {
  const C = window.DC.config;
  const W = window.DC.world;
  const finite = window.DC.finite;

  // Khởi tạo xorshift32 PRNG
  function createRng(initialSeed = 101) {
    let state = (initialSeed >>> 0) || 101;

    function setSeed(value) {
      if (!Number.isInteger(value) || value <= 0 || value > 4294967295) {
        throw new RangeError('Seed phải là số nguyên trong [1, 4294967295]');
      }
      state = value >>> 0;
    }

    function random() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state / 4294967296;
    }

    setSeed(initialSeed);

    return {
      setSeed,
      random,
      getSeed: () => state
    };
  }

  // Kiểm tra lịch che dấu tại thời điểm tMs
  function isMarkerOccluded(schedule, tMs) {
    if (!schedule || schedule.type === 'none') return false;
    if (typeof schedule === 'function') return schedule(tMs);
    if (schedule && typeof schedule.occlusionFn === 'function') return schedule.occlusionFn(tMs);
    if (schedule.type === 'periodic') {
      const phase = tMs % schedule.periodMs;
      return phase >= schedule.startMs && phase < schedule.endMs;
    }
    if (schedule.type === 'intervals' && Array.isArray(schedule.intervals)) {
      return schedule.intervals.some(([start, end]) => tMs >= start && tMs < end);
    }
    return false;
  }

  /**
   * Render camera 640 x 400 px
   * @param {CanvasRenderingContext2D} ctx 
   * @param {Object} pose {x, y, theta}
   * @param {Object} sensorConfig { noiseAmplitudePx, occlusionSchedule, hideFront, hideRear }
   * @param {number} tMs Thời điểm timestamp tính bằng ms
   * @param {Object} rng Đối tượng PRNG
   * @returns {ImageData}
   */
  function render(ctx, pose, sensorConfig = {}, tMs = 0, rng = null) {
    pose = W.validatePose(pose);
    const width = C.camera.width;
    const height = C.camera.height;
    const s = C.trueCalibration.scale; // Luôn dùng 6 px/u thật để vẽ

    const noiseAmplitudePx = sensorConfig.noiseAmplitudePx || 0;
    finite(noiseAmplitudePx, 'noiseAmplitudePx');
    if (noiseAmplitudePx < 0 || noiseAmplitudePx > 20) {
      throw new RangeError('Nhiễu phải nằm trong [0, 20] px');
    }

    // Xác định cờ che dấu: kết hợp cờ thủ công và lịch che dấu
    const hideFront = Boolean(
      sensorConfig.hideFront ||
      isMarkerOccluded(sensorConfig.occlusionSchedule, tMs)
    );
    const hideRear = Boolean(sensorConfig.hideRear);

    // Luôn tiêu thụ đúng 4 số PRNG độc lập: [frontX, frontY, rearX, rearY]
    // Ngay cả khi dấu bị che hoặc noise = 0, để giữ chuỗi ngẫu nhiên đồng bộ và tái lập
    let offsets = [0, 0, 0, 0];
    if (rng && typeof rng.random === 'function') {
      offsets = [
        (2 * rng.random() - 1) * noiseAmplitudePx,
        (2 * rng.random() - 1) * noiseAmplitudePx,
        (2 * rng.random() - 1) * noiseAmplitudePx,
        (2 * rng.random() - 1) * noiseAmplitudePx
      ];
    }

    // Đảm bảo kích thước canvas
    if (ctx.canvas.width !== width) ctx.canvas.width = width;
    if (ctx.canvas.height !== height) ctx.canvas.height = height;

    // Nền camera (xám nhạt #eeeeee như thực tế ánh sáng trạm dock)
    ctx.fillStyle = '#eeeeee';
    ctx.fillRect(0, 0, width, height);

    // Dock trên nền camera
    const d = C.dock;
    const dockPixel = W.toPixel({ x: d.left, y: d.top });
    const dockW = (d.right - d.left) * s;
    const dockH = (d.bottom - d.top) * s;
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(dockPixel.x, dockPixel.y, dockW, dockH);
    ctx.strokeStyle = '#777777';
    ctx.lineWidth = 1;
    ctx.strokeRect(dockPixel.x, dockPixel.y, dockW, dockH);

    // Thân robot vẽ màu xám #666666 (không trùng với màu dấu đỏ/xanh)
    const center = W.toPixel(pose);
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(pose.theta);
    ctx.fillStyle = '#666666';
    ctx.fillRect(-C.robot.length * s / 2, -C.robot.width * s / 2, C.robot.length * s, C.robot.width * s);
    ctx.restore();

    // Dấu đầu (đỏ) và dấu sau (xanh)
    // Front marker ở (+4, 0)
    if (!hideFront) {
      const frontPt = W.toPixel(W.point(pose, C.markers.frontOffset, 0));
      ctx.fillStyle = C.markers.frontColor; // rgb(240,40,40)
      ctx.beginPath();
      ctx.arc(frontPt.x + offsets[0], frontPt.y + offsets[1], C.markers.radius * s, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Rear marker ở (-4, 0)
    if (!hideRear) {
      const rearPt = W.toPixel(W.point(pose, C.markers.rearOffset, 0));
      ctx.fillStyle = C.markers.rearColor; // rgb(40,80,240)
      ctx.beginPath();
      ctx.arc(rearPt.x + offsets[2], rearPt.y + offsets[3], C.markers.radius * s, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Không vẽ bất kỳ văn bản, chữ, khung debug nào vào camera ImageData!
    return ctx.getImageData(0, 0, width, height);
  }

  // Wrapper tạo renderer gắn với canvas
  function create(ctx, seed = 101) {
    const rng = createRng(seed);
    return {
      setSeed: (s) => rng.setSeed(s),
      render: (pose, effects = {}, debug = false) => {
        if (debug) {
          W.draw(ctx, pose);
          return;
        }
        return render(ctx, pose, effects, 0, rng);
      },
      renderTrial: (pose, sensorConfig, tMs) => {
        return render(ctx, pose, sensorConfig, tMs, rng);
      },
      rng
    };
  }

  window.DC.renderer = Object.freeze({
    createRng,
    isMarkerOccluded,
    render,
    create
  });

  // Tương thích ngược với DockCheckRenderer
  window.DockCheckRenderer = Object.freeze({
    create
  });
})();
