/**
 * SmartOMR Pro — Bộ nhận diện phiếu trả lời trắc nghiệm chuẩn Bộ GD&ĐT
 * Mẫu: PHIEU TLTN 40 CAU (Cục QLCL) — SBD 8 số, Mã đề 4 số, Phần I (40 câu), Phần II (8 câu Đ/S), Phần III (6 câu trả lời ngắn)
 * Tọa độ các ô tròn được trích trực tiếp từ file PDF mẫu (đơn vị pt, gốc ở góc trên-trái trang).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SmartOMREngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const LAYOUT = {"page":[589.606,841.89],"markers":{"tl":[18.95,15.55],"tr":[573.85,15.25],"bl":[18.85,816.55],"br":[574.05,816.55]},"extra_markers":[[19.8,273.3],[19.8,457.1],[18.85,574.75],[573.85,273.3],[574.05,457.1],[574.05,574.75]],"marker_size":10.7,"r":4.2,"groups":[{"id":"sbd.0","t":"digit","pts":[[413.12,96.28],[413.12,112.83],[413.12,129.39],[413.12,145.95],[413.12,162.5],[413.12,179.06],[413.12,195.62],[413.12,212.18],[413.12,228.73],[413.12,245.29]]},{"id":"sbd.1","t":"digit","pts":[[424.46,96.28],[424.46,112.83],[424.46,129.39],[424.46,145.95],[424.46,162.5],[424.46,179.06],[424.46,195.62],[424.46,212.18],[424.46,228.73],[424.46,245.29]]},{"id":"sbd.2","t":"digit","pts":[[435.91,96.28],[435.91,112.83],[435.91,129.39],[435.91,145.95],[435.91,162.5],[435.91,179.06],[435.91,195.62],[435.91,212.18],[435.91,228.73],[435.91,245.29]]},{"id":"sbd.3","t":"digit","pts":[[447.36,96.28],[447.36,112.83],[447.36,129.39],[447.36,145.95],[447.36,162.5],[447.36,179.06],[447.36,195.62],[447.36,212.18],[447.36,228.73],[447.36,245.29]]},{"id":"sbd.4","t":"digit","pts":[[458.82,96.28],[458.82,112.83],[458.82,129.39],[458.82,145.95],[458.82,162.5],[458.82,179.06],[458.82,195.62],[458.82,212.18],[458.82,228.73],[458.82,245.29]]},{"id":"sbd.5","t":"digit","pts":[[470.27,96.28],[470.27,112.83],[470.27,129.39],[470.27,145.95],[470.27,162.5],[470.27,179.06],[470.27,195.62],[470.27,212.18],[470.27,228.73],[470.27,245.29]]},{"id":"sbd.6","t":"digit","pts":[[481.72,96.28],[481.72,112.83],[481.72,129.39],[481.72,145.95],[481.72,162.5],[481.72,179.06],[481.72,195.62],[481.72,212.18],[481.72,228.73],[481.72,245.29]]},{"id":"sbd.7","t":"digit","pts":[[493.06,96.28],[493.06,112.83],[493.06,129.39],[493.06,145.95],[493.06,162.5],[493.06,179.06],[493.06,195.62],[493.06,212.18],[493.06,228.73],[493.06,245.29]]},{"id":"made.0","t":"digit","pts":[[515.93,96.31],[515.93,112.86],[515.93,129.42],[515.93,145.97],[515.93,162.52],[515.93,179.08],[515.93,195.63],[515.93,212.18],[515.93,228.74],[515.93,245.29]]},{"id":"made.1","t":"digit","pts":[[527.27,96.31],[527.27,112.86],[527.27,129.42],[527.27,145.97],[527.27,162.52],[527.27,179.08],[527.27,195.63],[527.27,212.18],[527.27,228.74],[527.27,245.29]]},{"id":"made.2","t":"digit","pts":[[538.68,96.31],[538.68,112.86],[538.68,129.42],[538.68,145.97],[538.68,162.52],[538.68,179.08],[538.68,195.63],[538.68,212.18],[538.68,228.74],[538.68,245.29]]},{"id":"made.3","t":"digit","pts":[[550.26,96.31],[550.26,112.86],[550.26,129.42],[550.26,145.97],[550.26,162.52],[550.26,179.08],[550.26,195.63],[550.26,212.18],[550.26,228.74],[550.26,245.29]]},{"id":"p1.1","t":"mc","pts":[[63.98,309.11],[87.64,309.11],[111.3,309.11],[134.69,309.11]]},{"id":"p1.2","t":"mc","pts":[[63.98,323.29],[87.64,323.29],[111.3,323.29],[134.69,323.29]]},{"id":"p1.3","t":"mc","pts":[[63.98,337.46],[87.64,337.46],[111.3,337.46],[134.69,337.46]]},{"id":"p1.4","t":"mc","pts":[[63.98,351.63],[87.64,351.63],[111.3,351.63],[134.69,351.63]]},{"id":"p1.5","t":"mc","pts":[[63.98,365.81],[87.64,365.81],[111.3,365.81],[134.69,365.81]]},{"id":"p1.6","t":"mc","pts":[[63.98,379.98],[87.64,379.98],[111.3,379.98],[134.69,379.98]]},{"id":"p1.7","t":"mc","pts":[[63.98,394.15],[87.64,394.15],[111.3,394.15],[134.69,394.15]]},{"id":"p1.8","t":"mc","pts":[[63.98,408.33],[87.64,408.33],[111.3,408.33],[134.69,408.33]]},{"id":"p1.9","t":"mc","pts":[[63.98,422.5],[87.64,422.5],[111.3,422.5],[134.69,422.5]]},{"id":"p1.10","t":"mc","pts":[[63.98,436.67],[87.64,436.67],[111.3,436.67],[134.69,436.67]]},{"id":"p1.11","t":"mc","pts":[[197.2,309.11],[220.87,309.11],[244.53,309.11],[267.91,309.11]]},{"id":"p1.12","t":"mc","pts":[[197.2,323.29],[220.87,323.29],[244.53,323.29],[267.91,323.29]]},{"id":"p1.13","t":"mc","pts":[[197.2,337.46],[220.87,337.46],[244.53,337.46],[267.91,337.46]]},{"id":"p1.14","t":"mc","pts":[[197.2,351.63],[220.87,351.63],[244.53,351.63],[267.91,351.63]]},{"id":"p1.15","t":"mc","pts":[[197.2,365.81],[220.87,365.81],[244.53,365.81],[267.91,365.81]]},{"id":"p1.16","t":"mc","pts":[[197.2,379.98],[220.87,379.98],[244.53,379.98],[267.91,379.98]]},{"id":"p1.17","t":"mc","pts":[[197.2,394.15],[220.87,394.15],[244.53,394.15],[267.91,394.15]]},{"id":"p1.18","t":"mc","pts":[[197.2,408.33],[220.87,408.33],[244.53,408.33],[267.91,408.33]]},{"id":"p1.19","t":"mc","pts":[[197.2,422.5],[220.87,422.5],[244.53,422.5],[267.91,422.5]]},{"id":"p1.20","t":"mc","pts":[[197.2,436.67],[220.87,436.67],[244.53,436.67],[267.91,436.67]]},{"id":"p1.21","t":"mc","pts":[[330.43,309.11],[354.09,309.11],[377.75,309.11],[401.14,309.11]]},{"id":"p1.22","t":"mc","pts":[[330.43,323.29],[354.09,323.29],[377.75,323.29],[401.14,323.29]]},{"id":"p1.23","t":"mc","pts":[[330.43,337.46],[354.09,337.46],[377.75,337.46],[401.14,337.46]]},{"id":"p1.24","t":"mc","pts":[[330.43,351.63],[354.09,351.63],[377.75,351.63],[401.14,351.63]]},{"id":"p1.25","t":"mc","pts":[[330.43,365.81],[354.09,365.81],[377.75,365.81],[401.14,365.81]]},{"id":"p1.26","t":"mc","pts":[[330.43,379.98],[354.09,379.98],[377.75,379.98],[401.14,379.98]]},{"id":"p1.27","t":"mc","pts":[[330.43,394.15],[354.09,394.15],[377.75,394.15],[401.14,394.15]]},{"id":"p1.28","t":"mc","pts":[[330.43,408.33],[354.09,408.33],[377.75,408.33],[401.14,408.33]]},{"id":"p1.29","t":"mc","pts":[[330.43,422.5],[354.09,422.5],[377.75,422.5],[401.14,422.5]]},{"id":"p1.30","t":"mc","pts":[[330.43,436.67],[354.09,436.67],[377.75,436.67],[401.14,436.67]]},{"id":"p1.31","t":"mc","pts":[[463.66,309.11],[487.32,309.11],[510.98,309.11],[534.37,309.11]]},{"id":"p1.32","t":"mc","pts":[[463.66,323.29],[487.32,323.29],[510.98,323.29],[534.37,323.29]]},{"id":"p1.33","t":"mc","pts":[[463.66,337.46],[487.32,337.46],[510.98,337.46],[534.37,337.46]]},{"id":"p1.34","t":"mc","pts":[[463.66,351.63],[487.32,351.63],[510.98,351.63],[534.37,351.63]]},{"id":"p1.35","t":"mc","pts":[[463.66,365.81],[487.32,365.81],[510.98,365.81],[534.37,365.81]]},{"id":"p1.36","t":"mc","pts":[[463.66,379.98],[487.32,379.98],[510.98,379.98],[534.37,379.98]]},{"id":"p1.37","t":"mc","pts":[[463.66,394.15],[487.32,394.15],[510.98,394.15],[534.37,394.15]]},{"id":"p1.38","t":"mc","pts":[[463.66,408.33],[487.32,408.33],[510.98,408.33],[534.37,408.33]]},{"id":"p1.39","t":"mc","pts":[[463.66,422.5],[487.32,422.5],[510.98,422.5],[534.37,422.5]]},{"id":"p1.40","t":"mc","pts":[[463.66,436.67],[487.32,436.67],[510.98,436.67],[534.37,436.67]]},{"id":"p2.1.a","t":"tf","pts":[[64.18,508.49],[87.44,508.49]]},{"id":"p2.1.b","t":"tf","pts":[[64.18,522.66],[87.44,522.66]]},{"id":"p2.1.c","t":"tf","pts":[[64.18,536.84],[87.44,536.84]]},{"id":"p2.1.d","t":"tf","pts":[[64.18,551.01],[87.44,551.01]]},{"id":"p2.2.a","t":"tf","pts":[[111.23,508.49],[134.92,508.49]]},{"id":"p2.2.b","t":"tf","pts":[[111.23,522.66],[134.92,522.66]]},{"id":"p2.2.c","t":"tf","pts":[[111.23,536.84],[134.92,536.84]]},{"id":"p2.2.d","t":"tf","pts":[[111.23,551.01],[134.92,551.01]]},{"id":"p2.3.a","t":"tf","pts":[[196.78,508.49],[220.76,508.49]]},{"id":"p2.3.b","t":"tf","pts":[[196.78,522.66],[220.76,522.66]]},{"id":"p2.3.c","t":"tf","pts":[[196.78,536.84],[220.76,536.84]]},{"id":"p2.3.d","t":"tf","pts":[[196.78,551.01],[220.76,551.01]]},{"id":"p2.4.a","t":"tf","pts":[[244.26,508.49],[267.96,508.49]]},{"id":"p2.4.b","t":"tf","pts":[[244.26,522.66],[267.96,522.66]]},{"id":"p2.4.c","t":"tf","pts":[[244.26,536.84],[267.96,536.84]]},{"id":"p2.4.d","t":"tf","pts":[[244.26,551.01],[267.96,551.01]]},{"id":"p2.5.a","t":"tf","pts":[[330.3,508.49],[353.85,508.49]]},{"id":"p2.5.b","t":"tf","pts":[[330.3,522.66],[353.85,522.66]]},{"id":"p2.5.c","t":"tf","pts":[[330.3,536.84],[353.85,536.84]]},{"id":"p2.5.d","t":"tf","pts":[[330.3,551.01],[353.85,551.01]]},{"id":"p2.6.a","t":"tf","pts":[[377.78,508.49],[401.18,508.49]]},{"id":"p2.6.b","t":"tf","pts":[[377.78,522.66],[401.18,522.66]]},{"id":"p2.6.c","t":"tf","pts":[[377.78,536.84],[401.18,536.84]]},{"id":"p2.6.d","t":"tf","pts":[[377.78,551.01],[401.18,551.01]]},{"id":"p2.7.a","t":"tf","pts":[[463.24,508.49],[486.93,508.49]]},{"id":"p2.7.b","t":"tf","pts":[[463.24,522.66],[486.93,522.66]]},{"id":"p2.7.c","t":"tf","pts":[[463.24,536.84],[486.93,536.84]]},{"id":"p2.7.d","t":"tf","pts":[[463.24,551.01],[486.93,551.01]]},{"id":"p2.8.a","t":"tf","pts":[[510.44,508.49],[534.37,508.49]]},{"id":"p2.8.b","t":"tf","pts":[[510.44,522.66],[534.37,522.66]]},{"id":"p2.8.c","t":"tf","pts":[[510.44,536.84],[534.37,536.84]]},{"id":"p2.8.d","t":"tf","pts":[[510.44,551.01],[534.37,551.01]]},{"id":"p3.1.minus","t":"sign","pts":[[60.92,615.59]]},{"id":"p3.1.comma","t":"sign","pts":[[75.09,631.39],[89.26,631.39]]},{"id":"p3.1.c0","t":"digit","pts":[[60.92,647.19],[60.92,662.86],[60.92,678.78],[60.92,694.58],[60.92,710.38],[60.92,726.17],[60.92,741.97],[60.92,757.77],[60.92,773.56],[60.92,789.36]]},{"id":"p3.1.c1","t":"digit","pts":[[75.09,647.19],[75.09,662.86],[75.09,678.78],[75.09,694.58],[75.09,710.38],[75.09,726.17],[75.09,741.97],[75.09,757.77],[75.09,773.56],[75.09,789.36]]},{"id":"p3.1.c2","t":"digit","pts":[[89.26,647.19],[89.26,662.86],[89.26,678.78],[89.26,694.58],[89.26,710.38],[89.26,726.17],[89.26,741.97],[89.26,757.77],[89.26,773.56],[89.26,789.36]]},{"id":"p3.1.c3","t":"digit","pts":[[103.44,647.19],[103.44,662.86],[103.44,678.78],[103.44,694.58],[103.44,710.38],[103.44,726.17],[103.44,741.97],[103.44,757.77],[103.44,773.56],[103.44,789.36]]},{"id":"p3.2.minus","t":"sign","pts":[[145.96,615.59]]},{"id":"p3.2.comma","t":"sign","pts":[[160.13,631.39],[174.3,631.39]]},{"id":"p3.2.c0","t":"digit","pts":[[145.96,647.19],[145.96,662.86],[145.96,678.78],[145.96,694.58],[145.96,710.38],[145.96,726.17],[145.96,741.97],[145.96,757.77],[145.96,773.56],[145.96,789.36]]},{"id":"p3.2.c1","t":"digit","pts":[[160.13,647.19],[160.13,662.86],[160.13,678.78],[160.13,694.58],[160.13,710.38],[160.13,726.17],[160.13,741.97],[160.13,757.77],[160.13,773.56],[160.13,789.36]]},{"id":"p3.2.c2","t":"digit","pts":[[174.3,647.19],[174.3,662.86],[174.3,678.78],[174.3,694.58],[174.3,710.38],[174.3,726.17],[174.3,741.97],[174.3,757.77],[174.3,773.56],[174.3,789.36]]},{"id":"p3.2.c3","t":"digit","pts":[[188.47,647.19],[188.47,662.86],[188.47,678.78],[188.47,694.58],[188.47,710.38],[188.47,726.17],[188.47,741.97],[188.47,757.77],[188.47,773.56],[188.47,789.36]]},{"id":"p3.3.minus","t":"sign","pts":[[231.0,615.59]]},{"id":"p3.3.comma","t":"sign","pts":[[245.17,631.39],[259.34,631.39]]},{"id":"p3.3.c0","t":"digit","pts":[[231.0,647.19],[231.0,662.86],[231.0,678.78],[231.0,694.58],[231.0,710.38],[231.0,726.17],[231.0,741.97],[231.0,757.77],[231.0,773.56],[231.0,789.36]]},{"id":"p3.3.c1","t":"digit","pts":[[245.17,647.19],[245.17,662.86],[245.17,678.78],[245.17,694.58],[245.17,710.38],[245.17,726.17],[245.17,741.97],[245.17,757.77],[245.17,773.56],[245.17,789.36]]},{"id":"p3.3.c2","t":"digit","pts":[[259.34,647.19],[259.34,662.86],[259.34,678.78],[259.34,694.58],[259.34,710.38],[259.34,726.17],[259.34,741.97],[259.34,757.77],[259.34,773.56],[259.34,789.36]]},{"id":"p3.3.c3","t":"digit","pts":[[273.51,647.19],[273.51,662.86],[273.51,678.78],[273.51,694.58],[273.51,710.38],[273.51,726.17],[273.51,741.97],[273.51,757.77],[273.51,773.56],[273.51,789.36]]},{"id":"p3.4.minus","t":"sign","pts":[[316.03,615.59]]},{"id":"p3.4.comma","t":"sign","pts":[[330.21,631.39],[344.38,631.39]]},{"id":"p3.4.c0","t":"digit","pts":[[316.03,647.19],[316.03,662.86],[316.03,678.78],[316.03,694.58],[316.03,710.38],[316.03,726.17],[316.03,741.97],[316.03,757.77],[316.03,773.56],[316.03,789.36]]},{"id":"p3.4.c1","t":"digit","pts":[[330.21,647.19],[330.21,662.86],[330.21,678.78],[330.21,694.58],[330.21,710.38],[330.21,726.17],[330.21,741.97],[330.21,757.77],[330.21,773.56],[330.21,789.36]]},{"id":"p3.4.c2","t":"digit","pts":[[344.38,647.19],[344.38,662.86],[344.38,678.78],[344.38,694.58],[344.38,710.38],[344.38,726.17],[344.38,741.97],[344.38,757.77],[344.38,773.56],[344.38,789.36]]},{"id":"p3.4.c3","t":"digit","pts":[[358.55,647.19],[358.55,662.86],[358.55,678.78],[358.55,694.58],[358.55,710.38],[358.55,726.17],[358.55,741.97],[358.55,757.77],[358.55,773.56],[358.55,789.36]]},{"id":"p3.5.minus","t":"sign","pts":[[401.07,615.59]]},{"id":"p3.5.comma","t":"sign","pts":[[415.25,631.39],[429.42,631.39]]},{"id":"p3.5.c0","t":"digit","pts":[[401.07,647.19],[401.07,662.86],[401.07,678.78],[401.07,694.58],[401.07,710.38],[401.07,726.17],[401.07,741.97],[401.07,757.77],[401.07,773.56],[401.07,789.36]]},{"id":"p3.5.c1","t":"digit","pts":[[415.25,647.19],[415.25,662.86],[415.25,678.78],[415.25,694.58],[415.25,710.38],[415.25,726.17],[415.25,741.97],[415.25,757.77],[415.25,773.56],[415.25,789.36]]},{"id":"p3.5.c2","t":"digit","pts":[[429.42,647.19],[429.42,662.86],[429.42,678.78],[429.42,694.58],[429.42,710.38],[429.42,726.17],[429.42,741.97],[429.42,757.77],[429.42,773.56],[429.42,789.36]]},{"id":"p3.5.c3","t":"digit","pts":[[443.59,647.19],[443.59,662.86],[443.59,678.78],[443.59,694.58],[443.59,710.38],[443.59,726.17],[443.59,741.97],[443.59,757.77],[443.59,773.56],[443.59,789.36]]},{"id":"p3.6.minus","t":"sign","pts":[[486.11,615.59]]},{"id":"p3.6.comma","t":"sign","pts":[[500.29,631.39],[514.46,631.39]]},{"id":"p3.6.c0","t":"digit","pts":[[486.11,647.19],[486.11,662.86],[486.11,678.78],[486.11,694.58],[486.11,710.38],[486.11,726.17],[486.11,741.97],[486.11,757.77],[486.11,773.56],[486.11,789.36]]},{"id":"p3.6.c1","t":"digit","pts":[[500.29,647.19],[500.29,662.86],[500.29,678.78],[500.29,694.58],[500.29,710.38],[500.29,726.17],[500.29,741.97],[500.29,757.77],[500.29,773.56],[500.29,789.36]]},{"id":"p3.6.c2","t":"digit","pts":[[514.46,647.19],[514.46,662.86],[514.46,678.78],[514.46,694.58],[514.46,710.38],[514.46,726.17],[514.46,741.97],[514.46,757.77],[514.46,773.56],[514.46,789.36]]},{"id":"p3.6.c3","t":"digit","pts":[[528.63,647.19],[528.63,662.86],[528.63,678.78],[528.63,694.58],[528.63,710.38],[528.63,726.17],[528.63,741.97],[528.63,757.77],[528.63,773.56],[528.63,789.36]]}]};

  // =======================================================================
  // BỘ NHẬN DIỆN PHIẾU TLTN CHUẨN BỘ GD&ĐT (40 câu + 8 câu Đ/S + 6 câu trả lời ngắn)
  // Chạy hoàn toàn trên trình duyệt: tìm 4 ô vuông định vị -> nắn phối cảnh
  // (homography) -> đo độ đậm từng ô tròn theo bản đồ tọa độ lấy từ file PDF mẫu.
  // =======================================================================

  function toGray(rgba, w, h) {
    const g = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < w * h; i++, j += 4) {
      g[i] = (rgba[j] * 0.299 + rgba[j + 1] * 0.587 + rgba[j + 2] * 0.114) | 0;
    }
    return g;
  }

  function binarize(gray, w, h) {
    const W = w + 1;
    const integ = new Float64Array(W * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) {
        row += gray[y * w + x];
        integ[(y + 1) * W + (x + 1)] = integ[y * W + (x + 1)] + row;
      }
    }
    const win = Math.max(21, Math.round(Math.min(w, h) * 0.07) | 1);
    const half = win >> 1;
    const bin = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - half), y1 = Math.min(h, y + half + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - half), x1 = Math.min(w, x + half + 1);
        const sum = integ[y1 * W + x1] - integ[y0 * W + x1] - integ[y1 * W + x0] + integ[y0 * W + x0];
        const mean = sum / ((x1 - x0) * (y1 - y0));
        const g = gray[y * w + x];
        if (g < mean * 0.72 && g < 150) bin[y * w + x] = 1;
      }
    }
    return bin;
  }

  function findBlobs(bin, w, h) {
    const seen = new Uint8Array(w * h);
    const stack = new Int32Array(w * h);
    const blobs = [];
    const maxDim = Math.max(w, h);
    const sMin = 0.006 * maxDim, sMax = 0.06 * maxDim;
    for (let s = 0; s < w * h; s++) {
      if (!bin[s] || seen[s]) continue;
      let sp = 0;
      stack[sp++] = s; seen[s] = 1;
      let minx = w, maxx = 0, miny = h, maxy = 0, area = 0, sx = 0, sy = 0;
      while (sp > 0) {
        const p = stack[--sp];
        const x = p % w, y = (p - x) / w;
        area++; sx += x; sy += y;
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
        if (x > 0 && bin[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[sp++] = p - 1; }
        if (x < w - 1 && bin[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[sp++] = p + 1; }
        if (y > 0 && bin[p - w] && !seen[p - w]) { seen[p - w] = 1; stack[sp++] = p - w; }
        if (y < h - 1 && bin[p + w] && !seen[p + w]) { seen[p + w] = 1; stack[sp++] = p + w; }
      }
      const bw = maxx - minx + 1, bh = maxy - miny + 1;
      if (bw < sMin || bh < sMin || bw > sMax || bh > sMax) continue;
      const asp = bw / bh;
      if (asp < 0.6 || asp > 1.67) continue;
      if (area / (bw * bh) < 0.55) continue;
      blobs.push({ cx: sx / area, cy: sy / area, area: area, bw: bw, bh: bh });
    }
    if (!blobs.length) return blobs;
    let maxA = 0;
    blobs.forEach((b) => { if (b.area > maxA) maxA = b.area; });
    return blobs.filter((b) => b.area >= 0.45 * maxA);
  }

  // Giải homography bằng bình phương tối thiểu: src (tọa độ mẫu, pt) -> dst (pixel ảnh)
  function solveHomography(src, dst) {
    const SS = 600;
    let maxD = 1;
    dst.forEach((p) => { maxD = Math.max(maxD, Math.abs(p[0]), Math.abs(p[1])); });
    const n = src.length;
    const AtA = []; const Atb = new Array(8).fill(0);
    for (let i = 0; i < 8; i++) AtA.push(new Array(8).fill(0));
    for (let i = 0; i < n; i++) {
      const x = src[i][0] / SS, y = src[i][1] / SS;
      const u = dst[i][0] / maxD, v = dst[i][1] / maxD;
      const r1 = [x, y, 1, 0, 0, 0, -u * x, -u * y];
      const r2 = [0, 0, 0, x, y, 1, -v * x, -v * y];
      [[r1, u], [r2, v]].forEach(([row, val]) => {
        for (let a = 0; a < 8; a++) {
          Atb[a] += row[a] * val;
          for (let b = 0; b < 8; b++) AtA[a][b] += row[a] * row[b];
        }
      });
    }
    for (let c = 0; c < 8; c++) {
      let piv = c;
      for (let r = c + 1; r < 8; r++) if (Math.abs(AtA[r][c]) > Math.abs(AtA[piv][c])) piv = r;
      if (Math.abs(AtA[piv][c]) < 1e-12) return null;
      [AtA[c], AtA[piv]] = [AtA[piv], AtA[c]];
      [Atb[c], Atb[piv]] = [Atb[piv], Atb[c]];
      for (let r = c + 1; r < 8; r++) {
        const f = AtA[r][c] / AtA[c][c];
        for (let k = c; k < 8; k++) AtA[r][k] -= f * AtA[c][k];
        Atb[r] -= f * Atb[c];
      }
    }
    const hh = new Array(8).fill(0);
    for (let r = 7; r >= 0; r--) {
      let s = Atb[r];
      for (let k = r + 1; k < 8; k++) s -= AtA[r][k] * hh[k];
      hh[r] = s / AtA[r][r];
    }
    return { h: hh, SS: SS, D: maxD };
  }

  function project(H, X, Y) {
    const x = X / H.SS, y = Y / H.SS, h = H.h;
    const den = h[6] * x + h[7] * y + 1;
    return [((h[0] * x + h[1] * y + h[2]) / den) * H.D, ((h[3] * x + h[4] * y + h[5]) / den) * H.D];
  }

  function pxPerPt(H, X, Y) {
    const a = project(H, X, Y), b = project(H, X + 10, Y), c = project(H, X, Y + 10);
    return (Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - a[0], c[1] - a[1])) / 20;
  }

  function sampleAt(gray, w, h, x, y) {
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= w || yi >= h) return 255;
    return gray[yi * w + xi];
  }

  function discMean(gray, w, h, cx, cy, rad) {
    let s = 0, n = 0;
    const x0 = Math.floor(cx - rad), x1 = Math.ceil(cx + rad), y0 = Math.floor(cy - rad), y1 = Math.ceil(cy + rad);
    const r2 = rad * rad;
    for (let y = y0; y <= y1; y++) {
      if (y < 0 || y >= h) continue;
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || x >= w) continue;
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r2) { s += gray[y * w + x]; n++; }
      }
    }
    return n ? s / n : 255;
  }

  function ringMean(gray, w, h, cx, cy, rad, count) {
    let s = 0;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      s += sampleAt(gray, w, h, cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    return s / count;
  }

  function median(arr) {
    if (!arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    return s[s.length >> 1];
  }

  // Điểm "tương phản viền ô tròn" để chọn đúng hướng đặt phiếu (0/90/180/270 độ)
  function orientationScore(gray, w, h, H) {
    let total = 0, n = 0;
    for (let gi = 0; gi < LAYOUT.groups.length; gi += 3) {
      const g = LAYOUT.groups[gi];
      for (let pi = 0; pi < g.pts.length; pi += 2) {
        const p = g.pts[pi];
        const c = project(H, p[0], p[1]);
        const ppp = pxPerPt(H, p[0], p[1]);
        const r = LAYOUT.r * ppp;
        if (r < 1.5) continue;
        const ring = Math.min(ringMean(gray, w, h, c[0], c[1], r * 0.95, 12), ringMean(gray, w, h, c[0], c[1], r * 1.05, 12));
        const out = ringMean(gray, w, h, c[0], c[1], r * 1.6, 12);
        total += out - ring; n++;
      }
    }
    return n ? total / n : 0;
  }

  function findMarkersAndHomography(gray, w, h) {
    const bin = binarize(gray, w, h);
    const blobs = findBlobs(bin, w, h);
    if (blobs.length < 4) return { ok: false, reason: "Không tìm thấy đủ 4 ô vuông đen định vị ở 4 góc phiếu. Hãy chụp rõ toàn bộ phiếu, đủ sáng, không bị cắt góc." };

    let TL = blobs[0], BR = blobs[0], TR = blobs[0], BL = blobs[0];
    blobs.forEach((b) => {
      if (b.cx + b.cy < TL.cx + TL.cy) TL = b;
      if (b.cx + b.cy > BR.cx + BR.cy) BR = b;
      if (b.cx - b.cy > TR.cx - TR.cy) TR = b;
      if (b.cx - b.cy < BL.cx - BL.cy) BL = b;
    });
    const four = [TL, TR, BR, BL];
    if (new Set(four).size < 4) return { ok: false, reason: "Chỉ phát hiện được dưới 4 ô định vị khác nhau. Hãy chụp lại cho thấy đủ 4 góc phiếu." };
    const areas = four.map((b) => b.area);
    if (Math.max.apply(null, areas) / Math.min.apply(null, areas) > 2.6) {
      return { ok: false, reason: "Các ô định vị ở 4 góc có kích thước không đồng đều — có thể phiếu bị cắt góc hoặc bị che." };
    }

    const M = LAYOUT.markers;
    const canon = [M.tl, M.tr, M.br, M.bl];
    const imgPts = four.map((b) => [b.cx, b.cy]);

    let best = null;
    for (let k = 0; k < 4; k++) {
      const dst = [0, 1, 2, 3].map((i) => imgPts[(i + k) % 4]);
      const H = solveHomography(canon, dst);
      if (!H) continue;
      const sc = orientationScore(gray, w, h, H);
      if (!best || sc > best.score) best = { H: H, score: sc, k: k };
    }
    if (!best || best.score < 10) {
      return { ok: false, reason: "Ảnh không khớp mẫu phiếu chuẩn (không thấy viền các ô tròn). Hãy dùng đúng mẫu phiếu đã tải trong ứng dụng." };
    }

    // Tinh chỉnh bằng 6 ô định vị phụ ở hai mép trái/phải
    const srcPts = canon.slice();
    const dstPts = [0, 1, 2, 3].map((i) => imgPts[(i + best.k) % 4]);
    let H = best.H;
    const tol = 12 * pxPerPt(H, 300, 400);
    let extraFound = 0;
    LAYOUT.extra_markers.forEach((e) => {
      const p = project(H, e[0], e[1]);
      let nb = null, nd = tol;
      blobs.forEach((b) => {
        const d = Math.hypot(b.cx - p[0], b.cy - p[1]);
        if (d < nd) { nd = d; nb = b; }
      });
      if (nb) { srcPts.push(e); dstPts.push([nb.cx, nb.cy]); extraFound++; }
    });
    if (extraFound >= 2) {
      const H2 = solveHomography(srcPts, dstPts);
      if (H2) H = H2;
    }
    return { ok: true, H: H, extraMarkers: extraFound, orientationScore: best.score, rotation: best.k * 90, corners: four };
  }

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function readSheet(gray, w, h) {
    const found = findMarkersAndHomography(gray, w, h);
    if (!found.ok) return { ok: false, reason: found.reason };
    const H = found.H;

    // 1) Đo độ đậm từng ô tròn
    const scores = {};
    const cls = {};
    LAYOUT.groups.forEach((g) => {
      const isCircleDigit = g.id.indexOf("sbd.") === 0 || g.id.indexOf("made.") === 0;
      scores[g.id] = g.pts.map((p) => {
        const c = project(H, p[0], p[1]);
        const rpx = LAYOUT.r * pxPerPt(H, p[0], p[1]);
        const inner = discMean(gray, w, h, c[0], c[1], Math.max(1.6, 0.55 * rpx));
        const refs = [];
        for (const f of [1.4, 1.6, 1.8]) {
          const rr = (isCircleDigit ? Math.min(f, 1.5) : f) * rpx;
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            refs.push(sampleAt(gray, w, h, c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr));
          }
        }
        const ref = Math.max(90, median(refs));
        return clamp01((ref - inner) / Math.max(40, ref - 20));
      });
      cls[g.id] = isCircleDigit ? "A" : "B";
    });

    // 2) Ngưỡng tô theo từng loại ô (ô có số in sẵn trong vòng tròn có mức nền cao hơn)
    const base = { A: [], B: [] };
    LAYOUT.groups.forEach((g) => scores[g.id].forEach((s) => base[cls[g.id]].push(s)));
    const thr = {
      A: Math.max(0.35, median(base.A) + 0.17),
      B: Math.max(0.30, median(base.B) + 0.17)
    };

    const flags = [];
    function marked(id) {
      const sc = scores[id];
      const top = Math.max.apply(null, sc);
      const t = thr[cls[id]];
      const out = [];
      sc.forEach((s, i) => { if (s >= t && s >= 0.6 * top) out.push(i); });
      return out;
    }
    function pick(id) {
      const m = marked(id);
      if (m.length === 0) return { v: null };
      if (m.length === 1) return { v: m[0] };
      return { v: null, multi: true };
    }

    const data = { sbd: "", made: "", part1: {}, part2: {}, part3: {} };

    let sbd = "";
    for (let i = 0; i < 8; i++) {
      const r = pick("sbd." + i);
      if (r.v === null) { sbd += "?"; flags.push({ part: "SBD", pos: i + 1, type: r.multi ? "multi" : "blank" }); } else sbd += String(r.v);
    }
    data.sbd = sbd;
    let made = "";
    for (let i = 0; i < 4; i++) {
      const r = pick("made." + i);
      if (r.v === null) { made += "?"; flags.push({ part: "Mã đề", pos: i + 1, type: r.multi ? "multi" : "blank" }); } else made += String(r.v);
    }
    data.made = made;

    const L4 = ["A", "B", "C", "D"];
    for (let q = 1; q <= 40; q++) {
      const r = pick("p1." + q);
      if (r.v === null) {
        data.part1[q] = "";
        if (r.multi) flags.push({ part: "I", q: q, type: "multi" });
      } else data.part1[q] = L4[r.v];
    }

    for (let q = 1; q <= 8; q++) {
      data.part2[q] = {};
      ["a", "b", "c", "d"].forEach((k) => {
        const r = pick("p2." + q + "." + k);
        if (r.v === null) {
          data.part2[q][k] = "";
          if (r.multi) flags.push({ part: "II", q: q, sub: k, type: "multi" });
        } else data.part2[q][k] = r.v === 0 ? "Đ" : "S";
      });
    }

    for (let q = 1; q <= 6; q++) {
      const minus = marked("p3." + q + ".minus");
      const comma = marked("p3." + q + ".comma"); // chỉ số 0 -> cột 2, 1 -> cột 3
      let text = "", bad = false;
      for (let c = 0; c < 4; c++) {
        const cand = [];
        if (c === 0 && minus.length) cand.push("-");
        if ((c === 1 && comma.indexOf(0) >= 0) || (c === 2 && comma.indexOf(1) >= 0)) cand.push(",");
        const d = marked("p3." + q + ".c" + c);
        d.forEach((i) => cand.push(String(i)));
        if (cand.length === 1) text += cand[0];
        else if (cand.length > 1) { bad = true; }
      }
      if (bad) { flags.push({ part: "III", q: q, type: "multi" }); text = ""; }
      data.part3[q] = text;
    }

    return {
      ok: true,
      data: data,
      flags: flags,
      H: H,
      scores: scores,
      thresholds: thr,
      markers: { extra: found.extraMarkers, rotation: found.rotation, orientationScore: found.orientationScore }
    };
  }

  // Dành cho trình duyệt: nhận canvas/ảnh -> trả kết quả đọc
  function readFromImageData(imageData) {
    const gray = toGray(imageData.data, imageData.width, imageData.height);
    return readSheet(gray, imageData.width, imageData.height);
  }

  return {
    LAYOUT: LAYOUT,
    toGray: toGray,
    readSheet: readSheet,
    readFromImageData: readFromImageData,
    project: project,
    pxPerPt: pxPerPt
  };
});
