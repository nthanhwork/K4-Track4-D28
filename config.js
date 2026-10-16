'use strict';
/**
 * DockCheck Sim v2 - config.js
 * Người 4 sở hữu: Cấu hình hệ thống, thông số hình học, camera và quy ước chung.
 * Namespace: window.DC
 */
window.DC = window.DC || {};

(() => {
  const freeze = (o) => {
    Object.values(o).forEach((v) => {
      if (v && typeof v === 'object') freeze(v);
    });
    return Object.freeze(o);
  };

  const config = freeze({
    version: '2.0.0',
    name: 'DockCheck Sim',
    unit: 'u',
    randomAlgorithm: 'xorshift32',
    
    // Kích thước canvas
    camera: {
      width: 640,
      height: 400
    },
    
    // Tọa độ thế giới 100 x 60 u
    world: {
      width: 100,
      height: 60
    },
    
    // Hiệu chuẩn thật: px = offsetX + scale * x; py = offsetY + scale * y
    trueCalibration: {
      scale: 6,
      offsetX: 20,
      offsetY: 20
    },
    
    // Kích thước robot: dài 12 u, rộng 8 u
    robot: {
      length: 12,
      width: 8
    },
    
    // Hai dấu màu
    markers: {
      frontOffset: 4,  // (+4, 0) u
      rearOffset: -4,  // (-4, 0) u
      radius: 1,       // 1 u = 6 px
      frontColor: 'rgb(240,40,40)',  // Đỏ
      rearColor: 'rgb(40,80,240)',   // Xanh
      minPixelCount: 25,
      expectedDistanceU: 8.0,
      distanceToleranceU: [6.4, 9.6] // [6.4, 9.6] u
    },
    
    // Dock mục tiêu và vùng cho phép
    dock: {
      left: 40,
      right: 60,
      top: 20,
      bottom: 40,
      margin: 1, // Vùng cho phép: [41, 59] x [21, 39]
      targetTheta: 0,
      toleranceRad: 5 * Math.PI / 180 // ±5°
    },
    
    // Quy ước thời gian bộ thử
    timing: {
      trialDurationMs: 5000,
      sampleIntervalMs: 50,
      samplesPerTrial: 101, // t = 0, 50, ..., 5000 ms
      policyBRequiredMs: 500, // Cần 500 ms đạt liên tiếp
      policyBMaxGapMs: 150    // Ngắt quá 150 ms thì reset
    }
  });

  function finite(v, name) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new TypeError(name + ' phải là số hữu hạn');
    }
  }

  // Chuẩn hóa góc về [-π, π)
  function wrap(a) {
    finite(a, 'theta');
    const turn = 2 * Math.PI;
    return ((a + Math.PI) % turn + turn) % turn - Math.PI;
  }

  // Đổi rad sang độ và ngược lại
  function radToDeg(rad) {
    return wrap(rad) * 180 / Math.PI;
  }
  
  function degToRad(deg) {
    return wrap(deg * Math.PI / 180);
  }

  window.DC.config = config;
  window.DC.finite = finite;
  window.DC.wrap = wrap;
  window.DC.radToDeg = radToDeg;
  window.DC.degToRad = degToRad;
})();
