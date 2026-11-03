/**
 * SmartOMR Pro — Lõi chấm điểm & phân tích (thuần logic, không phụ thuộc giao diện)
 * - computeScore: chấm theo đáp án, trọng số từng câu, "câu luôn đúng", "loại bỏ câu", Đ/S lũy tiến, thang quy đổi
 * - collectIssues: cảnh báo hậu kiểm (SBD trùng/không có, mã đề lạ, bỏ sót, tô 2 ô...)
 * - statistics: phổ điểm, phân loại, tỉ lệ chọn đáp án, độ khó, độ phân hóa
 * - key import/export: Excel/CSV/văn bản, mã QR đáp án
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SmartScoring = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEFAULT_P2_STEPS = [0.1, 0.25, 0.5, 1.0]; // đúng 1/2/3/4 ý (tỉ lệ so với điểm tối đa của câu)

  function num(v, d) { const n = parseFloat(v); return isFinite(n) ? n : d; }
  function norm3(v) { return String(v == null ? "" : v).trim().replace(/\s+/g, "").replace(/^\+/, "").replace(".", ","); }
  function stripZeros(v) { return String(v || "").trim().replace(/^0+/, ""); }

  function sameShortAnswer(a, b) {
    const x = norm3(a), y = norm3(b);
    if (!x || !y) return false;
    if (x === y) return true;
    const fx = parseFloat(x.replace(",", ".")), fy = parseFloat(y.replace(",", "."));
    return isFinite(fx) && isFinite(fy) && Math.abs(fx - fy) < 1e-9;
  }

  function statusOf(key, part, q) {
    const s = key.qstatus && key.qstatus[part] && key.qstatus[part][q];
    return s === "free" || s === "void" ? s : "ok";
  }
  function weightOf(key, part, q) {
    const w = key.weights && key.weights[part] && key.weights[part][q];
    const n = num(w, 1);
    return n >= 0 ? n : 1;
  }

  /**
   * reads: { part1:{1:"A"}, part2:{1:{a:"Đ"...}}, part3:{1:"2025"} }
   * key:   { part1, part2, part3, scoring_config, weights?, qstatus? }
   */
  function computeScore(reads, key) {
    const cfg = key.scoring_config || {};
    const steps = Array.isArray(cfg.part2_steps) && cfg.part2_steps.length === 4 ? cfg.part2_steps.map((v) => num(v, 0)) : DEFAULT_P2_STEPS;
    const p1Pts = num(cfg.part1_points_each, 0.25);
    const p2Max = num(cfg.part2_max_points_each, 1.0);
    const p3Pts = num(cfg.part3_points_each, 0.25);
    const p1N = cfg.enable_part1 === false ? 0 : (cfg.part1_count == null ? 40 : cfg.part1_count);
    const p2N = cfg.enable_part2 === false ? 0 : (cfg.part2_count == null ? 8 : cfg.part2_count);
    const p3N = cfg.enable_part3 === false ? 0 : (cfg.part3_count == null ? 6 : cfg.part3_count);
    reads = reads || {};
    const r1 = reads.part1 || {}, r2 = reads.part2 || {}, r3 = reads.part3 || {};
    const k1 = key.part1 || {}, k2 = key.part2 || {}, k3 = key.part3 || {};

    const detail = { p1: {}, p2: {}, p3: {} };
    const parts = {
      p1: { raw: 0, max: 0, correct: 0, total: 0, voided: 0 },
      p2: { raw: 0, max: 0, correct: 0, total: 0, voided: 0 },
      p3: { raw: 0, max: 0, correct: 0, total: 0, voided: 0 }
    };

    for (let q = 1; q <= p1N; q++) {
      const st = statusOf(key, "p1", q), w = weightOf(key, "p1", q);
      const ans = String(r1[q] || "").trim().toUpperCase();
      const kv = String(k1[q] || "").trim().toUpperCase();
      const hit = !!ans && ans === kv;
      let pts = 0, mx = p1Pts * w;
      if (st === "void") { mx = 0; parts.p1.voided++; }
      else { parts.p1.total++; if (st === "free") pts = mx; else if (hit) pts = mx; if (st === "free" || hit) parts.p1.correct++; }
      parts.p1.raw += pts; parts.p1.max += mx;
      detail.p1[q] = { ans: ans, key: kv, correct: st === "free" || hit, status: st, pts: pts, max: mx };
    }

    for (let q = 1; q <= p2N; q++) {
      const st = statusOf(key, "p2", q), w = weightOf(key, "p2", q);
      const qk = k2[q] || {}, qa = r2[q] || {};
      const subs = {}; let n = 0;
      ["a", "b", "c", "d"].forEach((k) => {
        const a = String(qa[k] || "").trim().toUpperCase(), kv = String(qk[k] || "").trim().toUpperCase();
        subs[k] = !!a && a === kv;
        if (subs[k]) n++;
      });
      let pts = 0, mx = p2Max * w;
      if (st === "void") { mx = 0; parts.p2.voided++; }
      else {
        parts.p2.total++;
        if (st === "free") { pts = mx; n = 4; ["a", "b", "c", "d"].forEach((k) => { subs[k] = true; }); }
        else pts = (n > 0 ? steps[n - 1] : 0) * mx;
        parts.p2.correct += n;
      }
      parts.p2.raw += pts; parts.p2.max += mx;
      detail.p2[q] = { subs: subs, n: n, status: st, pts: pts, max: mx, ans: qa, key: qk };
    }

    for (let q = 1; q <= p3N; q++) {
      const st = statusOf(key, "p3", q), w = weightOf(key, "p3", q);
      const ans = norm3(r3[q]), kv = norm3(k3[q]);
      const hit = sameShortAnswer(ans, kv);
      let pts = 0, mx = p3Pts * w;
      if (st === "void") { mx = 0; parts.p3.voided++; }
      else { parts.p3.total++; if (st === "free" || hit) { pts = mx; parts.p3.correct++; } }
      parts.p3.raw += pts; parts.p3.max += mx;
      detail.p3[q] = { ans: ans, key: kv, correct: st === "free" || hit, status: st, pts: pts, max: mx };
    }

    const raw = parts.p1.raw + parts.p2.raw + parts.p3.raw;
    const rawMax = parts.p1.max + parts.p2.max + parts.p3.max;
    const scale = cfg.score_scale === undefined || cfg.score_scale === null || cfg.score_scale === "" ? 10 : num(cfg.score_scale, 10);
    const factor = scale > 0 && rawMax > 0 ? scale / rawMax : 1;
    const maxScore = scale > 0 ? scale : rawMax;
    const r2d = (v) => Math.round(v * 100) / 100;
    const total = r2d(raw * factor);

    return {
      total_score: total,
      max_possible_score: r2d(maxScore),
      raw_score: r2d(raw),
      raw_max: r2d(rawMax),
      scale_factor: factor,
      part1_summary: { enabled: p1N > 0, total_questions: parts.p1.total, correct: parts.p1.correct, score: r2d(parts.p1.raw * factor), voided: parts.p1.voided },
      part2_summary: { enabled: p2N > 0, total_questions: parts.p2.total, total_sub_correct: parts.p2.correct, score: r2d(parts.p2.raw * factor), voided: parts.p2.voided },
      part3_summary: { enabled: p3N > 0, total_questions: parts.p3.total, correct: parts.p3.correct, score: r2d(parts.p3.raw * factor), voided: parts.p3.voided },
      detail: detail
    };
  }

  // Tra đáp án theo mã đề đọc được (chấp nhận số 0 đầu/khác độ dài)
  function findKey(keys, madeRaw) {
    const m = String(madeRaw || "").trim();
    if (!m || m.indexOf("?") >= 0) return null;
    for (const k of Object.keys(keys)) {
      if (k === m || (stripZeros(k) && stripZeros(k) === stripZeros(m))) return { madeKey: k, key: keys[k] };
    }
    return null;
  }

  function findStudent(students, sbd) {
    const s = String(sbd || "").trim();
    if (!s || s.indexOf("?") >= 0) return null;
    const list = students || [];
    const exact = list.find((x) => x.sbd === s || (stripZeros(x.sbd) && stripZeros(x.sbd) === stripZeros(s)));
    if (exact) return exact;
    // Phiếu có ít chữ số SBD hơn danh sách (vd. phiếu QM 6 số, danh sách 8 số): khớp theo phần đuôi, chỉ nhận khi duy nhất
    const tail = list.filter((x) => { const a = String(x.sbd || "").trim(); return a.length !== s.length && a && (a.endsWith(s) || s.endsWith(a)); });
    return tail.length === 1 ? tail[0] : null;
  }

  /**
   * Hậu kiểm một bài. ctx = { keys, students, submissions, selfId }
   * Trả về [{level:'error'|'warn'|'info', code, text}]
   */
  function collectIssues(sub, ctx) {
    const out = [];
    const sbd = String(sub.sbd || "");
    const made = String(sub.made || "");
    if (!sbd || sbd.indexOf("?") >= 0) out.push({ level: "error", code: "sbd_unread", text: "SBD chưa đọc đủ (có ô trống hoặc tô 2 ô)" });
    else {
      if (ctx.students && ctx.students.length && !findStudent(ctx.students, sbd)) out.push({ level: "error", code: "sbd_unknown", text: `SBD ${sbd} không có trong danh sách lớp` });
      const dup = (ctx.submissions || []).filter((o) => o.id !== sub.id && stripZeros(o.sbd) === stripZeros(sbd));
      if (dup.length) out.push({ level: "error", code: "sbd_dup", text: `Trùng SBD ${sbd} với ${dup.length} bài khác` });
    }
    if (!made || made.indexOf("?") >= 0) out.push({ level: "error", code: "made_unread", text: "Mã đề trống hoặc chưa đọc đủ" });
    else if (!findKey(ctx.keys || {}, made)) out.push({ level: "error", code: "made_unknown", text: `Mã đề ${made} chưa được cài đáp án` });

    const reads = sub.reads || {};
    const blanks = [], multis = [];
    const flagged = (sub.flags || []);
    flagged.forEach((f) => {
      if (f.type === "multi") multis.push((f.part === "I" ? "Câu " + f.q : f.part === "II" ? "II." + f.q + (f.sub || "") : f.part === "III" ? "III." + f.q : f.part));
    });
    if (multis.length) out.push({ level: "error", code: "multi", text: "Tô 2 đáp án trên cùng một hàng: " + multis.slice(0, 8).join(", ") + (multis.length > 8 ? "…" : "") });
    const cfgKey = (findKey(ctx.keys || {}, made) || {}).key;
    const cfg = (cfgKey && cfgKey.scoring_config) || {};
    const p1N = cfg.enable_part1 === false ? 0 : (cfg.part1_count == null ? 40 : cfg.part1_count);
    const p2N = cfg.enable_part2 === false ? 0 : (cfg.part2_count == null ? 8 : cfg.part2_count);
    for (let q = 1; q <= p1N; q++) if (!(reads.part1 || {})[q] && !flagged.some((f) => f.type === "multi" && f.part === "I" && f.q === q)) blanks.push(q);
    if (blanks.length) out.push({ level: blanks.length > 5 ? "warn" : "info", code: "blank", text: `Bỏ trống ${blanks.length} câu Phần I: ` + blanks.slice(0, 10).join(", ") + (blanks.length > 10 ? "…" : "") });
    let p2blank = 0;
    for (let q = 1; q <= p2N; q++) ["a", "b", "c", "d"].forEach((k) => { if (!((reads.part2 || {})[q] || {})[k]) p2blank++; });
    if (p2blank) out.push({ level: "info", code: "blank2", text: `Bỏ trống ${p2blank} ý Phần II` });
    const faint = flagged.filter((f) => f.type === "faint" || f.type === "smudge").length;
    if (faint) out.push({ level: "warn", code: "faint", text: `${faint} ô tô mờ / có vết tẩy — nên xem lại ảnh` });
    if (sub.edited) out.push({ level: "info", code: "edited", text: "Đã được giáo viên chỉnh sửa nhận diện" });
    return out;
  }

  function worstLevel(issues) {
    if (issues.some((i) => i.level === "error")) return "error";
    if (issues.some((i) => i.level === "warn")) return "warn";
    return "ok";
  }

  // ---------------- Thống kê ----------------
  function classify(score, max) {
    const s10 = max > 0 ? (score / max) * 10 : score;
    if (s10 >= 8) return "Giỏi";
    if (s10 >= 6.5) return "Khá";
    if (s10 >= 5) return "Đạt";
    return "Chưa đạt";
  }

  function statistics(subs) {
    const n = subs.length;
    const scores = subs.map((s) => (s.result ? s.result.total_score : 0));
    const out = { n: n, mean: 0, median: 0, max: 0, min: 0, sd: 0, classes: { "Giỏi": 0, "Khá": 0, "Đạt": 0, "Chưa đạt": 0 }, histogram: new Array(11).fill(0) };
    if (!n) return out;
    const sum = scores.reduce((a, b) => a + b, 0);
    out.mean = sum / n;
    const sorted = scores.slice().sort((a, b) => a - b);
    out.median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    out.max = sorted[n - 1]; out.min = sorted[0];
    out.sd = Math.sqrt(scores.reduce((a, b) => a + (b - out.mean) * (b - out.mean), 0) / n);
    subs.forEach((s) => {
      const mx = s.result ? s.result.max_possible_score : 10;
      const sc = s.result ? s.result.total_score : 0;
      out.classes[classify(sc, mx)]++;
      const s10 = mx > 0 ? (sc / mx) * 10 : sc;
      out.histogram[Math.min(10, Math.max(0, Math.floor(s10 + 1e-9)))]++;
    });
    return out;
  }

  // Tỉ lệ chọn từng phương án, độ khó (p), độ phân hóa (D, nhóm 27% cao - 27% thấp)
  function itemAnalysis(subs, key) {
    const cfg = key.scoring_config || {};
    const p1N = cfg.enable_part1 === false ? 0 : (cfg.part1_count == null ? 40 : cfg.part1_count);
    const p2N = cfg.enable_part2 === false ? 0 : (cfg.part2_count == null ? 8 : cfg.part2_count);
    const p3N = cfg.enable_part3 === false ? 0 : (cfg.part3_count == null ? 6 : cfg.part3_count);
    const ranked = subs.slice().sort((a, b) => (b.result ? b.result.total_score : 0) - (a.result ? a.result.total_score : 0));
    const g = Math.max(1, Math.round(ranked.length * 0.27));
    const top = ranked.slice(0, g), bot = ranked.slice(-g);
    const rate = (grp, fn) => (grp.length ? grp.filter(fn).length / grp.length : 0);
    const items = { p1: [], p2: [], p3: [] };
    const n = subs.length || 1;
    for (let q = 1; q <= p1N; q++) {
      const cnt = { A: 0, B: 0, C: 0, D: 0, "": 0 };
      subs.forEach((s) => { const a = String(((s.reads || {}).part1 || {})[q] || "").toUpperCase(); cnt[cnt[a] === undefined ? "" : a]++; });
      const ok = (s) => !!(s.result && s.result.detail && s.result.detail.p1[q] && s.result.detail.p1[q].correct);
      const p = rate(subs, ok);
      items.p1.push({ q: q, key: String((key.part1 || {})[q] || ""), counts: cnt, pct: { A: cnt.A / n, B: cnt.B / n, C: cnt.C / n, D: cnt.D / n, blank: cnt[""] / n }, p: p, d: rate(top, ok) - rate(bot, ok), status: statusOf(key, "p1", q) });
    }
    for (let q = 1; q <= p2N; q++) {
      const row = { q: q, subs: {}, status: statusOf(key, "p2", q) };
      ["a", "b", "c", "d"].forEach((k) => {
        const okf = (s) => !!(s.result && s.result.detail && s.result.detail.p2[q] && s.result.detail.p2[q].subs[k]);
        let dd = 0, ss = 0;
        subs.forEach((s) => { const a = String((((s.reads || {}).part2 || {})[q] || {})[k] || "").toUpperCase(); if (a === "Đ") dd++; else if (a === "S") ss++; });
        row.subs[k] = { key: String(((key.part2 || {})[q] || {})[k] || ""), pctD: dd / n, pctS: ss / n, p: rate(subs, okf), d: rate(top, okf) - rate(bot, okf) };
      });
      items.p2.push(row);
    }
    for (let q = 1; q <= p3N; q++) {
      const ok = (s) => !!(s.result && s.result.detail && s.result.detail.p3[q] && s.result.detail.p3[q].correct);
      const wrong = {};
      subs.forEach((s) => { const a = norm3(((s.reads || {}).part3 || {})[q]); if (a && !ok(s)) wrong[a] = (wrong[a] || 0) + 1; });
      const common = Object.keys(wrong).sort((a, b) => wrong[b] - wrong[a]).slice(0, 3).map((a) => a + " (" + wrong[a] + ")");
      items.p3.push({ q: q, key: String((key.part3 || {})[q] || ""), p: rate(subs, ok), d: rate(top, ok) - rate(bot, ok), commonWrong: common, status: statusOf(key, "p3", q) });
    }
    return items;
  }

  // ---------------- Nhập/xuất đáp án ----------------
  const P2MAP = { "Đ": "Đ", "D": "Đ", "ĐÚNG": "Đ", "DUNG": "Đ", "T": "Đ", "TRUE": "Đ", "1": "Đ", "S": "S", "SAI": "S", "F": "S", "FALSE": "S", "0": "S" };
  function normP2(v) { return P2MAP[String(v || "").trim().toUpperCase()] || ""; }

  /**
   * rows: mảng các object {header: value} (từ Excel/CSV). Nhận cột:
   *   "Mã đề"; "1".."40" hoặc "C1".."C40" (Phần I); "II.1.a" / "2.1.a" / "P2_1a" (Phần II); "III.1" / "3.1" / "P3_1" (Phần III)
   */
  function keysFromRows(rows, baseCfg) {
    const keys = {};
    (rows || []).forEach((row) => {
      const get = (re) => Object.keys(row).filter((h) => re.test(String(h).trim()));
      let madeHeader = Object.keys(row).find((h) => /^m[ãa]\s*đ[ềe]$/i.test(String(h).trim()) || /^made$/i.test(String(h).trim()));
      const made = String(madeHeader ? row[madeHeader] : "").trim();
      if (!made) return;
      const key = { made: made, exam_name: "Nhập từ file", scoring_config: Object.assign({}, baseCfg || {}), part1: {}, part2: {}, part3: {} };
      let c1 = 0, c2 = 0, c3 = 0;
      Object.keys(row).forEach((h) => {
        const hs = String(h).trim(); const val = row[h];
        if (val === undefined || val === null || String(val).trim() === "") return;
        let m;
        if ((m = /^(?:c|câu|p1_?)?\s*(\d{1,2})$/i.exec(hs))) { const l = String(val).trim().toUpperCase().charAt(0); if ("ABCD".indexOf(l) >= 0) { key.part1[m[1]] = l; c1 = Math.max(c1, +m[1]); } }
        else if ((m = /^(?:ii|2|p2_?)[._\s-]*(\d)[._\s-]*([a-d])$/i.exec(hs))) { const v = normP2(val); if (v) { (key.part2[m[1]] = key.part2[m[1]] || {})[m[2].toLowerCase()] = v; c2 = Math.max(c2, +m[1]); } }
        else if ((m = /^(?:iii|3|p3_?)[._\s-]*(\d)$/i.exec(hs))) { key.part3[m[1]] = String(val).trim().replace(".", ","); c3 = Math.max(c3, +m[1]); }
      });
      key.scoring_config.enable_part1 = c1 > 0; key.scoring_config.part1_count = c1 || 0;
      key.scoring_config.enable_part2 = c2 > 0; key.scoring_config.part2_count = c2 || 0;
      key.scoring_config.enable_part3 = c3 > 0; key.scoring_config.part3_count = c3 || 0;
      keys[made] = key;
    });
    return keys;
  }

  // Bảng mẫu (header + 1 dòng ví dụ) để giáo viên tải về điền
  function keyTemplateRows(made) {
    const row = { "Mã đề": made || "0101" };
    for (let q = 1; q <= 40; q++) row[String(q)] = "ABCD"[(q - 1) % 4];
    for (let q = 1; q <= 8; q++) ["a", "b", "c", "d"].forEach((k, i) => { row["II." + q + "." + k] = (q + i) % 2 ? "Đ" : "S"; });
    ["2025", "-1,5", "0,25", "14,2", "8", "-4"].forEach((v, i) => { row["III." + (i + 1)] = v; });
    return [row];
  }

  // Văn bản: mỗi dòng "mãđề: ABCD... | ĐSĐS... | 2025;-1,5;..."  (P1 | P2 (4 ký tự/câu) | P3 phân cách ;)
  function keysFromText(text, baseCfg) {
    const keys = {};
    String(text || "").split(/\r?\n/).forEach((line) => {
      const m = /^\s*([0-9A-Za-z_-]+)\s*[:\t]\s*(.*)$/.exec(line);
      if (!m) return;
      const parts = m[2].split("|").map((s) => s.trim());
      const key = { made: m[1], exam_name: "Nhập từ văn bản", scoring_config: Object.assign({}, baseCfg || {}), part1: {}, part2: {}, part3: {} };
      const p1 = (parts[0] || "").replace(/[^A-Da-d]/g, "").toUpperCase();
      for (let i = 0; i < p1.length; i++) key.part1[i + 1] = p1[i];
      const p2 = (parts[1] || "").replace(/\s+/g, "");
      const arr = Array.from(p2).map(normP2).filter(Boolean);
      for (let i = 0; i < arr.length; i++) { const q = Math.floor(i / 4) + 1; (key.part2[q] = key.part2[q] || {})["abcd"[i % 4]] = arr[i]; }
      (parts[2] || "").split(/[;]+/).map((s) => s.trim()).filter(Boolean).forEach((v, i) => { key.part3[i + 1] = v.replace(".", ","); });
      key.scoring_config.enable_part1 = p1.length > 0; key.scoring_config.part1_count = p1.length;
      key.scoring_config.enable_part2 = arr.length > 0; key.scoring_config.part2_count = Math.ceil(arr.length / 4);
      key.scoring_config.enable_part3 = !!parts[2]; key.scoring_config.part3_count = Object.keys(key.part3).length;
      keys[m[1]] = key;
    });
    return keys;
  }

  // Mã QR đáp án: SOMR1|made|P1|P2(D/S)|P3;P3...
  function keyToQrPayload(key) {
    const cfg = key.scoring_config || {};
    const p1N = cfg.part1_count == null ? 40 : cfg.part1_count, p2N = cfg.part2_count == null ? 8 : cfg.part2_count, p3N = cfg.part3_count == null ? 6 : cfg.part3_count;
    let p1 = ""; for (let q = 1; q <= p1N; q++) p1 += (key.part1 || {})[q] || "-";
    let p2 = ""; for (let q = 1; q <= p2N; q++) ["a", "b", "c", "d"].forEach((k) => { const v = (((key.part2 || {})[q]) || {})[k]; p2 += v === "Đ" ? "D" : v === "S" ? "S" : "-"; });
    const p3 = []; for (let q = 1; q <= p3N; q++) p3.push(String((key.part3 || {})[q] || "").replace(/[;|]/g, ""));
    return ["SOMR1", key.made, p1, p2, p3.join(";")].join("|");
  }
  function keyFromQrPayload(text, baseCfg) {
    const p = String(text || "").trim().split("|");
    if (p[0] !== "SOMR1" || p.length < 5) return null;
    const key = { made: p[1], exam_name: "Nhập từ mã QR", scoring_config: Object.assign({}, baseCfg || {}), part1: {}, part2: {}, part3: {} };
    for (let i = 0; i < p[2].length; i++) if ("ABCD".indexOf(p[2][i]) >= 0) key.part1[i + 1] = p[2][i];
    for (let i = 0; i < p[3].length; i++) { const v = p[3][i] === "D" ? "Đ" : p[3][i] === "S" ? "S" : ""; if (v) (key.part2[Math.floor(i / 4) + 1] = key.part2[Math.floor(i / 4) + 1] || {})["abcd"[i % 4]] = v; }
    p[4].split(";").forEach((v, i) => { if (v.trim()) key.part3[i + 1] = v.trim(); });
    key.scoring_config.enable_part1 = p[2].length > 0; key.scoring_config.part1_count = p[2].length;
    key.scoring_config.enable_part2 = p[3].length > 0; key.scoring_config.part2_count = Math.ceil(p[3].length / 4);
    key.scoring_config.enable_part3 = Object.keys(key.part3).length > 0; key.scoring_config.part3_count = p[4].split(";").length;
    return key;
  }

  // Đáp án lấy từ "phiếu mẫu giáo viên" (reads của engine)
  function keyFromReads(reads, made, baseCfg) {
    const key = { made: made, exam_name: "Quét từ phiếu mẫu GV", scoring_config: Object.assign({}, baseCfg || {}), part1: {}, part2: {}, part3: {} };
    let c1 = 0, c2 = 0, c3 = 0;
    for (let q = 1; q <= 40; q++) if ((reads.part1 || {})[q]) { key.part1[q] = reads.part1[q]; c1 = q; }
    for (let q = 1; q <= 8; q++) { const r = (reads.part2 || {})[q] || {}; if (r.a || r.b || r.c || r.d) { key.part2[q] = { a: r.a || "", b: r.b || "", c: r.c || "", d: r.d || "" }; c2 = q; } }
    for (let q = 1; q <= 6; q++) if ((reads.part3 || {})[q]) { key.part3[q] = reads.part3[q]; c3 = q; }
    key.scoring_config.enable_part1 = c1 > 0; key.scoring_config.part1_count = c1;
    key.scoring_config.enable_part2 = c2 > 0; key.scoring_config.part2_count = c2;
    key.scoring_config.enable_part3 = c3 > 0; key.scoring_config.part3_count = c3;
    return key;
  }

  // Liên kết tra cứu điểm cá nhân (dữ liệu nằm ngay trong link, không cần máy chủ)
  function resultToShareToken(sub, examName) {
    const d = sub.result && sub.result.detail ? sub.result.detail : { p1: {}, p2: {}, p3: {} };
    const wrong1 = Object.keys(d.p1).filter((q) => !d.p1[q].correct && d.p1[q].status !== "void").map(Number);
    const wrong2 = Object.keys(d.p2).filter((q) => d.p2[q].n < 4 && d.p2[q].status !== "void").map(Number);
    const wrong3 = Object.keys(d.p3).filter((q) => !d.p3[q].correct && d.p3[q].status !== "void").map(Number);
    const payload = {
      v: 1, n: sub.student_name || "", c: sub.student_class || "", s: sub.sbd, m: sub.made,
      t: sub.result ? sub.result.total_score : 0, x: sub.result ? sub.result.max_possible_score : 10,
      p1: sub.result ? sub.result.part1_summary.correct : 0, p2: sub.result ? sub.result.part2_summary.total_sub_correct : 0, p3: sub.result ? sub.result.part3_summary.correct : 0,
      w1: wrong1, w2: wrong2, w3: wrong3, e: examName || "", d: new Date(sub.ts || Date.now()).toISOString().slice(0, 10)
    };
    const json = JSON.stringify(payload);
    const b64 = typeof Buffer !== "undefined" ? Buffer.from(json, "utf8").toString("base64") : btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function shareTokenToResult(token) {
    let b64 = String(token || "").replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json = typeof Buffer !== "undefined" ? Buffer.from(b64, "base64").toString("utf8") : decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  }

  return {
    DEFAULT_P2_STEPS: DEFAULT_P2_STEPS,
    computeScore: computeScore,
    sameShortAnswer: sameShortAnswer,
    findKey: findKey,
    findStudent: findStudent,
    collectIssues: collectIssues,
    worstLevel: worstLevel,
    classify: classify,
    statistics: statistics,
    itemAnalysis: itemAnalysis,
    keysFromRows: keysFromRows,
    keysFromText: keysFromText,
    keyTemplateRows: keyTemplateRows,
    keyToQrPayload: keyToQrPayload,
    keyFromQrPayload: keyFromQrPayload,
    keyFromReads: keyFromReads,
    resultToShareToken: resultToShareToken,
    shareTokenToResult: shareTokenToResult,
    stripZeros: stripZeros
  };
});
