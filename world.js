'use strict';
/**
 * DockCheck Sim v2 - world.js
 * Người 1 sở hữu: Mô hình thế giới 2D, hình học dock, robot footprint và ground truth evaluator.
 * Namespace: window.DC.world
 */
window.DC = window.DC || {};

(() => {
  const C = window.DC.config;
  const finite = window.DC.finite;
  const wrap = window.DC.wrap;

  function validatePose(p) {
    if (!p) throw new TypeError('Tư thế robot không được rỗng');
    for (const k of ['x', 'y', 'theta']) finite(p[k], k);
    if (p.x < 0 || p.x > C.world.width || p.y < 0 || p.y > C.world.height) {
      throw new RangeError(`Tâm (${p.x}, ${p.y}) phải nằm trong thế giới ${C.world.width} × ${C.world.height} u`);
    }
    return { x: p.x, y: p.y, theta: wrap(p.theta) };
  }

  function transformPoint(p, offsetX, offsetY) {
    const c = Math.cos(p.theta);
    const s = Math.sin(p.theta);
    return {
      x: p.x + offsetX * c - offsetY * s,
      y: p.y + offsetX * s + offsetY * c
    };
  }

  // 4 góc của thân robot trong hệ tọa độ thế giới (đơn vị u)
  function footprint(p) {
    const a = C.robot.length / 2; // 6 u
    const b = C.robot.width / 2;  // 4 u
    return [
      [-a, -b],
      [ a, -b],
      [ a,  b],
      [-a,  b]
    ].map(([ox, oy]) => transformPoint(p, ox, oy));
  }

  // Đánh giá ground truth thuần từ hình học thật (chỉ evaluator được dùng)
  function evaluate(p) {
    p = validatePose(p);
    const d = C.dock;
    const corners = footprint(p);
    
    // Vùng cho phép: Dock lùi vào margin 1 u: [41, 59] x [21, 39]
    const bodyInside = corners.every((q) =>
      q.x >= d.left + d.margin &&
      q.x <= d.right - d.margin &&
      q.y >= d.top + d.margin &&
      q.y <= d.bottom - d.margin
    );
    
    const headingErrorRad = wrap(p.theta - d.targetTheta);
    const headingValid = Math.abs(headingErrorRad) <= d.toleranceRad + 1e-12;
    const physicalDocked = bodyInside && headingValid;

    return {
      bodyInside,
      headingValid,
      physicalDocked,
      headingErrorRad,
      corners
    };
  }

  // Chuyển từ u sang px bằng trueCalibration
  function toPixel(pt, calib = C.trueCalibration) {
    return {
      x: calib.offsetX + calib.scale * pt.x,
      y: calib.offsetY + calib.scale * pt.y
    };
  }

  // Vẽ thế giới nhìn từ trên xuống (visualizer debug/ground truth canvas)
  function draw(ctx, p, options = {}) {
    p = validatePose(p);
    const width = C.camera.width;
    const height = C.camera.height;
    const s = C.trueCalibration.scale;
    const d = C.dock;
    const dockPixel = toPixel({ x: d.left, y: d.top });

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Nền thế giới
    ctx.fillStyle = '#0f172a'; // Dark slate
    ctx.fillRect(0, 0, width, height);

    // Grid nhẹ
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= C.world.width; x += 10) {
      const px = toPixel({ x, y: 0 }).x;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();
    }
    for (let y = 0; y <= C.world.height; y += 10) {
      const py = toPixel({ x: 0, y }).y;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
      ctx.stroke();
    }

    // Dock vùng ngoài [40, 60] x [20, 40]
    const dockW = (d.right - d.left) * s;
    const dockH = (d.bottom - d.top) * s;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.1)';
    ctx.fillRect(dockPixel.x, dockPixel.y, dockW, dockH);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(dockPixel.x, dockPixel.y, dockW, dockH);

    // Vùng cho phép (Dock lùi 1 u: [41, 59] x [21, 39])
    const allowPixel = toPixel({ x: d.left + d.margin, y: d.top + d.margin });
    const allowW = (d.right - d.left - 2 * d.margin) * s;
    const allowH = (d.bottom - d.top - 2 * d.margin) * s;
    ctx.strokeStyle = '#22c55e'; // Green dashed
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(allowPixel.x, allowPixel.y, allowW, allowH);
    ctx.setLineDash([]);

    // Thân robot thật
    const center = toPixel(p);
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(p.theta);
    ctx.fillStyle = '#475569';
    ctx.fillRect(-C.robot.length * s / 2, -C.robot.width * s / 2, C.robot.length * s, C.robot.width * s);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-C.robot.length * s / 2, -C.robot.width * s / 2, C.robot.length * s, C.robot.width * s);
    
    // Mũi tên hướng robot
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(C.robot.length * s / 2, 0);
    ctx.lineTo(C.robot.length * s / 2 - 8, -5);
    ctx.moveTo(C.robot.length * s / 2, 0);
    ctx.lineTo(C.robot.length * s / 2 - 8, 5);
    ctx.stroke();
    ctx.restore();

    // Hai dấu màu thật trên robot
    const frontPos = toPixel(transformPoint(p, C.markers.frontOffset, 0));
    const rearPos = toPixel(transformPoint(p, C.markers.rearOffset, 0));

    // Dấu sau xanh
    ctx.fillStyle = C.markers.rearColor;
    ctx.beginPath();
    ctx.arc(rearPos.x, rearPos.y, C.markers.radius * s, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Dấu đầu đỏ
    ctx.fillStyle = C.markers.frontColor;
    ctx.beginPath();
    ctx.arc(frontPos.x, frontPos.y, C.markers.radius * s, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Tâm robot
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(center.x - 5, center.y);
    ctx.lineTo(center.x + 5, center.y);
    ctx.moveTo(center.x, center.y - 5);
    ctx.lineTo(center.x, center.y + 5);
    ctx.stroke();

    // Footprint corners nếu được yêu cầu
    if (options.showCorners) {
      const corners = footprint(p);
      corners.forEach((c) => {
        const cp = toPixel(c);
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, 3, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    // Nhãn chú thích
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Thế giới 100 × 60 u (Hình học thật)', 14, 22);
    ctx.fillText('Dock [40,60]×[20,40]', dockPixel.x, dockPixel.y - 8);

    ctx.restore();
  }

  window.DC.world = Object.freeze({
    config: C,
    wrap,
    finite,
    validatePose,
    point: transformPoint,
    footprint,
    evaluate,
    toPixel,
    draw
  });

  // Tương thích ngược với DockCheckWorld trong dockcheck-world.html
  window.DockCheckWorld = window.DC.world;
})();
