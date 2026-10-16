/* DockCheck Sim v2: classic script, no renderer/world dependencies. */
(function (DC) {
  'use strict';

  function estimate(imageData, calibration, tMs) {
    const invalid = (reason) => ({
      tMs, valid: false, reason, pose: null, footprint: null, geometryPass: false
    });
    if (!calibration || !Number.isFinite(calibration.scale) || calibration.scale <= 0 ||
        !Number.isFinite(calibration.offsetX) || !Number.isFinite(calibration.offsetY)) {
      return invalid('invalid-calibration');
    }
    if (!imageData || !Number.isInteger(imageData.width) || imageData.width <= 0 ||
        !Number.isInteger(imageData.height) || imageData.height <= 0 ||
        !imageData.data || imageData.data.length !== imageData.width * imageData.height * 4) {
      return invalid('invalid-image');
    }

    const { data, width, height } = imageData;
    let redCount = 0, redX = 0, redY = 0;
    let blueCount = 0, blueX = 0, blueY = 0;
    for (let y = 0, i = 0; y < height; y++) {
      for (let x = 0; x < width; x++, i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        // Canvas pixel (x,y) covers [x,x+1) × [y,y+1); use its center.
        if (r > 180 && g < 100 && b < 100) {
          redCount++; redX += x + 0.5; redY += y + 0.5;
        } else if (b > 180 && r < 100 && g < 160) {
          blueCount++; blueX += x + 0.5; blueY += y + 0.5;
        }
      }
    }
    if (redCount < 25) return invalid('missing-red');
    if (blueCount < 25) return invalid('missing-blue');

    const { scale, offsetX, offsetY } = calibration;
    const front = { x: (redX / redCount - offsetX) / scale, y: (redY / redCount - offsetY) / scale };
    const rear = { x: (blueX / blueCount - offsetX) / scale, y: (blueY / blueCount - offsetY) / scale };
    const dx = front.x - rear.x, dy = front.y - rear.y;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance < 6.4 || distance > 9.6) return invalid('marker-distance');

    let theta = Math.atan2(dy, dx);
    if (theta >= Math.PI) theta -= 2 * Math.PI;
    const pose = { x: (front.x + rear.x) / 2, y: (front.y + rear.y) / 2, theta };
    const cos = Math.cos(theta), sin = Math.sin(theta);
    const footprint = [[6, 4], [-6, 4], [-6, -4], [6, -4]].map(([x, y]) => ({
      x: pose.x + x * cos - y * sin,
      y: pose.y + x * sin + y * cos
    }));
    const geometryPass = Math.abs(theta) <= 5 * Math.PI / 180 && footprint.every(
      (p) => p.x >= 41 && p.x <= 59 && p.y >= 21 && p.y <= 39
    );
    return { tMs, valid: true, reason: null, pose, footprint, geometryPass };
  }

  DC.perception = { estimate };
})(window.DC = window.DC || {});
