/**
 * SmartOMR Pro — Mô-đun nghiệp vụ nâng cao
 *  1) Duyệt bài & sửa nhận diện song song với ảnh chụp (chạm trực tiếp lên ô tròn)
 *  2) Thống kê phổ điểm, xếp loại, tỉ lệ chọn đáp án, độ khó/độ phân hóa
 *  3) Xuất Excel / PDF ảnh bài thi / ZIP minh chứng, liên kết tra cứu & mã QR
 *  4) Nạp đáp án đa kênh (Excel/CSV/văn bản/QR/phiếu mẫu GV), trọng số & xử lý câu lỗi
 *  5) Quét liên tục (auto-capture), đồng bộ đám mây, chấm thử tự tạo phiếu
 */
(function () {
  "use strict";

  const A = () => window.SmartApp;
  const S = window.SmartScoring;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const Pro = {};
  window.SmartPro = Pro;

  const ui = { view: "review", filterMade: "", filterLevel: "all", search: "", statsMade: "" };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function subs() { return A().state.submissions; }
  function cfgOf(sub) { return (A().keyFor(sub.made).key.scoring_config) || {}; }
  function counts(sub) {
    const c = cfgOf(sub);
    return {
      p1: c.enable_part1 === false ? 0 : (c.part1_count == null ? 40 : c.part1_count),
      p2: c.enable_part2 === false ? 0 : (c.part2_count == null ? 8 : c.part2_count),
      p3: c.enable_part3 === false ? 0 : (c.part3_count == null ? 6 : c.part3_count)
    };
  }
  function lvlIcon(l) { return l === "error" ? "🔴" : l === "warn" ? "🟠" : "🟢"; }
  function fmt(n, d) { return (typeof n === "number" ? n : 0).toFixed(d == null ? 2 : d); }
  function toast(msg) {
    let t = $("pro-toast");
    if (!t) { t = document.createElement("div"); t.id = "pro-toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600);
  }

  // ======================================================================
  // 1. TAB KẾT QUẢ
  // ======================================================================
  function renderResults() {
    const root = $("results-root"); if (!root) return;
    root.innerHTML = `
      <div class="seg-tabs">
        <button class="seg-btn ${ui.view === "review" ? "active" : ""}" data-view="review">📋 Duyệt bài</button>
        <button class="seg-btn ${ui.view === "stats" ? "active" : ""}" data-view="stats">📊 Thống kê</button>
        <button class="seg-btn ${ui.view === "export" ? "active" : ""}" data-view="export">📤 Xuất &amp; Chia sẻ</button>
      </div>
      <div id="results-body"></div>`;
    root.querySelectorAll(".seg-btn").forEach((b) => b.addEventListener("click", () => { ui.view = b.dataset.view; renderResults(); }));
    const body = $("results-body");
    if (ui.view === "review") renderReviewView(body);
    else if (ui.view === "stats") renderStatsView(body);
    else renderExportView(body);
  }

  function filteredSubs() {
    const q = ui.search.trim().toLowerCase();
    return subs().filter((s) => {
      if (ui.filterMade && String(s.made) !== ui.filterMade) return false;
      if (ui.filterLevel === "review" && s.level === "ok") return false;
      if (ui.filterLevel === "error" && s.level !== "error") return false;
      if (ui.filterLevel === "ok" && s.level !== "ok") return false;
      if (q && !(String(s.sbd).toLowerCase().includes(q) || String(s.student_name || "").toLowerCase().includes(q))) return false;
      return true;
    });
  }

  function renderReviewView(body) {
    const all = subs();
    const nErr = all.filter((s) => s.level === "error").length;
    const nWarn = all.filter((s) => s.level === "warn").length;
    const mades = [...new Set(all.map((s) => String(s.made)))];
    body.innerHTML = `
      <div class="card">
        <div class="card-header flex-between"><h3>📋 Duyệt &amp; hậu kiểm bài đã chấm</h3>
          <span class="badge-count">${all.length} bài</span></div>
        <div class="rv-badges">
          <span class="rv-pill lv-error">🔴 ${nErr} lỗi</span>
          <span class="rv-pill lv-warn">🟠 ${nWarn} cảnh báo</span>
          <span class="rv-pill lv-ok">🟢 ${all.length - nErr - nWarn} ổn</span>
        </div>
        <div class="rv-filters">
          <input id="rv-search" class="form-input" placeholder="Tìm SBD / tên…" value="${esc(ui.search)}" />
          <select id="rv-filter-level" class="form-select">
            <option value="all">Tất cả</option><option value="review">Cần xem lại</option><option value="error">Chỉ lỗi</option><option value="ok">Chỉ bài ổn</option>
          </select>
          <select id="rv-filter-made" class="form-select"><option value="">Mọi mã đề</option>${mades.map((m) => `<option value="${esc(m)}">Đề ${esc(m)}</option>`).join("")}</select>
        </div>
        <div class="rv-actions">
          <button class="btn btn-sm btn-outline" id="rv-btn-recalc">🔄 Tính lại tất cả</button>
          <button class="btn btn-sm btn-danger" id="rv-btn-clear">🗑 Xóa toàn bộ</button>
        </div>
        <div id="rv-list" class="rv-list"></div>
      </div>`;
    $("rv-filter-level").value = ui.filterLevel;
    $("rv-filter-made").value = ui.filterMade;
    $("rv-search").addEventListener("input", (e) => { ui.search = e.target.value; updateReviewList(); });
    $("rv-filter-level").addEventListener("change", (e) => { ui.filterLevel = e.target.value; updateReviewList(); });
    $("rv-filter-made").addEventListener("change", (e) => { ui.filterMade = e.target.value; updateReviewList(); });
    $("rv-btn-recalc").addEventListener("click", () => { A().recalcAll(); A().persistState(); renderResults(); toast("Đã tính lại điểm toàn bộ bài"); });
    $("rv-btn-clear").addEventListener("click", async () => {
      if (!all.length || !confirm("Xóa TOÀN BỘ bài đã chấm (kể cả ảnh minh chứng)? Không thể hoàn tác.")) return;
      A().state.submissions.length = 0; A().state.batchItems.length = 0;
      await A().ImgStore.clear(); A().persistState(); A().renderBatchCards(); renderResults();
    });
    updateReviewList();
  }

  function updateReviewList() {
    const list = $("rv-list"); if (!list) return;
    const arr = filteredSubs();
    if (!arr.length) { list.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div>Không có bài nào phù hợp.</div></div>`; return; }
    list.innerHTML = arr.map((s) => `
      <div class="rv-row lv-${s.level || "ok"}" data-id="${esc(s.id)}">
        <div class="rv-dot">${lvlIcon(s.level)}</div>
        <div class="rv-main">
          <div class="rv-name">${esc(s.student_name)}</div>
          <div class="rv-meta">SBD <b>${esc(s.sbd)}</b> · Đề <b>${esc(s.made)}</b> · ${esc(s.student_class || "-")} · ${esc(s.timestamp || "")}</div>
          ${(s.issues || []).filter((i) => i.level !== "info").slice(0, 2).map((i) => `<div class="rv-issue ${i.level}">${esc(i.text)}</div>`).join("")}
        </div>
        <div class="rv-score">${fmt(s.total_score)}<small>/${fmt(s.max_possible_score, 0)}</small></div>
        <button class="btn btn-sm btn-ghost rv-del" data-del="${esc(s.id)}" title="Xóa bài này">🗑</button>
      </div>`).join("");
    list.querySelectorAll(".rv-row").forEach((row) => row.addEventListener("click", (e) => {
      if (e.target.closest("[data-del]")) return;
      Pro.openReview(row.dataset.id);
    }));
    list.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => deleteSub(b.dataset.del)));
  }

  async function deleteSub(id) {
    const s = subs().find((x) => x.id === id); if (!s) return;
    if (!confirm(`Xóa bài của ${s.student_name} (SBD ${s.sbd})?`)) return;
    const st = A().state;
    st.submissions.splice(st.submissions.indexOf(s), 1);
    const bi = st.batchItems.findIndex((b) => b.id === id); if (bi >= 0) st.batchItems.splice(bi, 1);
    await A().ImgStore.del(id);
    A().recalcAll(); A().persistState(); A().renderBatchCards();
    if ($("rv-list")) renderResults();
  }

  // ======================================================================
  // 2. REVIEW SONG SONG + SỬA NHẬN DIỆN
  // ======================================================================
  const rv = { sub: null, snap: null, img: null, open: false };

  function ensureReviewModal() {
    if ($("review-modal")) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div id="review-modal" class="modal-overlay pro-full" style="display:none">
        <div class="review-box">
          <div class="review-top">
            <div class="rv-top-info"><div id="rv-title" class="rv-title"></div><div id="rv-method" class="rv-method"></div></div>
            <div id="rv-score" class="rv-bigscore"></div>
            <button class="modal-close" id="rv-close">✕</button>
          </div>
          <div class="review-body">
            <div class="review-left">
              <div class="rv-imgwrap"><canvas id="rv-canvas"></canvas><div id="rv-noimg" class="rv-noimg" style="display:none">Không có ảnh lưu cho bài này — sửa bằng bảng đáp án bên cạnh.</div></div>
              <div class="rv-hint">👆 Chạm trực tiếp vào ô tròn trên ảnh để sửa đáp án. Vòng cam = ô cần xem lại.</div>
            </div>
            <div class="review-right" id="rv-panel"></div>
          </div>
          <div class="review-bottom">
            <button class="btn btn-sm btn-outline" id="rv-prev">◀</button>
            <button class="btn btn-sm btn-outline" id="rv-next">▶</button>
            <button class="btn btn-sm btn-outline" id="rv-dl">⬇️ Ảnh minh chứng</button>
            <button class="btn btn-sm btn-danger" id="rv-delete">🗑</button>
            <span style="flex:1"></span>
            <button class="btn btn-sm btn-ghost" id="rv-cancel">Hủy sửa</button>
            <button class="btn btn-sm btn-success" id="rv-save">💾 Lưu</button>
          </div>
        </div>
      </div>`;
    $("pro-modals").appendChild(wrap.firstElementChild);
    $("rv-close").addEventListener("click", () => closeReview(true));
    $("rv-cancel").addEventListener("click", () => closeReview(true));
    $("rv-save").addEventListener("click", saveReview);
    $("rv-prev").addEventListener("click", () => stepReview(-1));
    $("rv-next").addEventListener("click", () => stepReview(1));
    $("rv-delete").addEventListener("click", async () => { const id = rv.sub && rv.sub.id; closeReview(false); if (id) await deleteSub(id); });
    $("rv-dl").addEventListener("click", () => {
      if (!rv.sub) return;
      const s = rv.sub;
      const url = rv.img && s.H ? A().drawOverlay(s, rv.img, {}) : (rv.img ? rv.img.toDataURL("image/jpeg", 0.9) : null);
      if (url) A().downloadImageFile(url, `MinhChung_SBD_${s.sbd}_De_${s.made}_${s.total_score}d.jpg`);
    });
    $("rv-canvas").addEventListener("click", onReviewCanvasTap);
    $("rv-panel").addEventListener("click", onPanelClick);
    $("rv-panel").addEventListener("change", onPanelChange);
  }

  Pro.openReview = async function (id) {
    const s = subs().find((x) => x.id === id);
    if (!s) return;
    if (!s.reads) { // bài từ máy chủ cũ: chỉ xem ảnh
      const it = A().state.batchItems.find((b) => b.id === id);
      if (it) { const img = $("viewer-target-img"); if (img) { img.src = it.graded_bgr || it.orig_bgr; $("image-viewer-modal").style.display = "flex"; } }
      return;
    }
    ensureReviewModal();
    rv.sub = s;
    rv.snap = JSON.parse(JSON.stringify({ reads: s.reads, sbd: s.sbd, made: s.made, flags: s.flags, edited: s.edited }));
    rv.img = null;
    $("review-modal").style.display = "flex"; rv.open = true;
    const dataUrl = await A().ImgStore.get(id);
    if (dataUrl) { try { rv.img = await A().loadImageToCanvas(dataUrl, 4000); } catch (e) { rv.img = null; } }
    redrawReview();
  };

  function closeReview(restore) {
    if (restore && rv.sub && rv.snap) {
      Object.assign(rv.sub, JSON.parse(JSON.stringify(rv.snap)));
      A().applyScoring(rv.sub);
    }
    $("review-modal").style.display = "none"; rv.open = false;
    renderResultsIfVisible();
  }

  function renderResultsIfVisible() {
    if ($("tab-results") && $("tab-results").classList.contains("active")) { if (ui.view === "review") updateReviewList(); else renderResults(); }
    A().renderBatchCards();
  }

  function stepReview(d) {
    const arr = filteredSubs(); if (!arr.length) return;
    let i = arr.findIndex((x) => x.id === (rv.sub && rv.sub.id));
    i = (i + d + arr.length) % arr.length;
    if (rv.sub && rv.snap) { saveQuiet(); }
    Pro.openReview(arr[i].id);
  }

  function redrawReview() {
    const s = rv.sub; if (!s) return;
    A().applyScoring(s);
    const cv = $("rv-canvas");
    if (rv.img) {
      const out = s.H ? A().drawOverlay(s, rv.img, { asCanvas: true, showFlags: true, noBanner: true }) : rv.img;
      cv.width = out.width; cv.height = out.height; cv.getContext("2d").drawImage(out, 0, 0);
      cv.style.display = "block"; $("rv-noimg").style.display = "none";
    } else { cv.style.display = "none"; $("rv-noimg").style.display = "block"; }
    $("rv-title").textContent = `${s.student_name} — SBD ${s.sbd} — Đề ${s.made}`;
    $("rv-method").textContent = s.method || "";
    $("rv-score").innerHTML = `${fmt(s.total_score)}<small>/${fmt(s.max_possible_score, 0)}</small>`;
    renderPanel();
  }

  function renderPanel() {
    const s = rv.sub; const panel = $("rv-panel"); if (!s || !panel) return;
    const n = counts(s); const det = (s.result && s.result.detail) || { p1: {}, p2: {}, p3: {} };
    const LY = window.SmartOMREngine.LAYOUTS[s.template];
    const sbdLen = LY ? LY.sbd_len : 8, madeLen = LY ? LY.made_len : 4;
    const flagSet = {};
    (s.flags || []).forEach((f) => { flagSet[flagKey(f)] = f.type; });
    let h = `<div class="rp-ids">
      <label>SBD <input id="rp-sbd" class="form-input" maxlength="${sbdLen}" value="${esc(s.sbd)}" inputmode="numeric" /></label>
      <label>Mã đề <input id="rp-made" class="form-input" maxlength="${madeLen}" value="${esc(s.made)}" inputmode="numeric" /></label></div>`;
    const iss = (s.issues || []).filter((i) => i.level !== "info");
    if (iss.length) h += `<div class="rp-issues">${iss.map((i) => `<div class="rv-issue ${i.level}">${i.level === "error" ? "🔴" : "🟠"} ${esc(i.text)}</div>`).join("")}</div>`;
    if (s.keyMatched === false) h += `<div class="rv-issue error">Mã đề ${esc(s.made)} chưa có đáp án — đang chấm tạm theo đề ${esc(s.keyMade)}.</div>`;
    if (n.p1) {
      h += `<div class="rp-title">Phần I — Trắc nghiệm A/B/C/D</div><div class="rp-p1">`;
      for (let q = 1; q <= n.p1; q++) {
        const d = det.p1[q] || {}; const ans = (s.reads.part1 || {})[q] || "";
        const fl = flagSet["I." + q] ? " flagged" : "";
        h += `<div class="q1${fl}"><span class="qn">${q}</span>${["A", "B", "C", "D"].map((L) => {
          const on = ans === L; const cls = on ? (d.correct ? "sel good" : "sel bad") : (d.key === L && !d.correct ? "keyhint" : "");
          return `<button class="opt ${cls}" data-p1="${q}:${L}">${L}</button>`;
        }).join("")}</div>`;
      }
      h += `</div>`;
    }
    if (n.p2) {
      h += `<div class="rp-title">Phần II — Đúng / Sai</div><div class="rp-p2">`;
      for (let q = 1; q <= n.p2; q++) {
        const d = det.p2[q] || { subs: {} };
        h += `<div class="q2"><div class="q2h">Câu ${q} <small>(${d.n || 0}/4 ý đúng)</small></div>${["a", "b", "c", "d"].map((k) => {
          const ans = (((s.reads.part2 || {})[q]) || {})[k] || ""; const fl = flagSet["II." + q + "." + k] ? " flagged" : "";
          const ok = d.subs && d.subs[k];
          return `<div class="q2r${fl}"><span>${k})</span>${["Đ", "S"].map((v) => `<button class="opt ${ans === v ? (ok ? "sel good" : "sel bad") : ""}" data-p2="${q}:${k}:${v}">${v}</button>`).join("")}</div>`;
        }).join("")}</div>`;
      }
      h += `</div>`;
    }
    if (n.p3) {
      h += `<div class="rp-title">Phần III — Trả lời ngắn <small>(tối đa 4 ký tự; ví dụ -1,5)</small></div><div class="rp-p3">`;
      for (let q = 1; q <= n.p3; q++) {
        const d = det.p3[q] || {}; const ans = (s.reads.part3 || {})[q] || "";
        h += `<label class="q3 ${ans ? (d.correct ? "good" : "bad") : ""}${flagSet["III." + q] ? " flagged" : ""}"><span>Câu ${q}</span><input class="form-input" data-p3="${q}" maxlength="4" value="${esc(ans)}" /><small>ĐA: ${esc(d.key || "")}</small></label>`;
      }
      h += `</div>`;
    }
    panel.innerHTML = h;
  }

  function flagKey(f) { return f.part === "I" ? "I." + f.q : f.part === "II" ? "II." + f.q + "." + f.sub : f.part === "III" ? "III." + f.q : f.part + "." + f.pos; }

  function touch(s) {
    s.edited = true; s.updatedAt = Date.now();
    redrawReview();
  }
  function clearFlag(s, key) { s.flags = (s.flags || []).filter((f) => flagKey(f) !== key); }

  function onPanelClick(e) {
    const b = e.target.closest("button.opt"); if (!b) return;
    const s = rv.sub;
    if (b.dataset.p1) {
      const [q, L] = b.dataset.p1.split(":"); s.reads.part1 = s.reads.part1 || {};
      s.reads.part1[q] = s.reads.part1[q] === L ? "" : L; clearFlag(s, "I." + q); touch(s);
    } else if (b.dataset.p2) {
      const [q, k, v] = b.dataset.p2.split(":"); s.reads.part2 = s.reads.part2 || {}; s.reads.part2[q] = s.reads.part2[q] || {};
      s.reads.part2[q][k] = s.reads.part2[q][k] === v ? "" : v; clearFlag(s, "II." + q + "." + k); touch(s);
    }
  }
  function onPanelChange(e) {
    const s = rv.sub; const t = e.target;
    if (t.id === "rp-sbd") { s.sbd = t.value.replace(/\D/g, ""); (s.flags = (s.flags || []).filter((f) => f.part !== "SBD")); touch(s); }
    else if (t.id === "rp-made") { s.made = t.value.replace(/\D/g, ""); (s.flags = (s.flags || []).filter((f) => f.part !== "Mã đề")); touch(s); }
    else if (t.dataset.p3) { s.reads.part3 = s.reads.part3 || {}; s.reads.part3[t.dataset.p3] = t.value.trim().replace(".", ","); clearFlag(s, "III." + t.dataset.p3); touch(s); }
  }

  // Chạm lên ảnh -> tìm ô tròn gần nhất -> sửa
  function onReviewCanvasTap(ev) {
    const s = rv.sub; if (!s || !s.H) return;
    const LY = window.SmartOMREngine.LAYOUTS[s.template]; if (!LY) return;
    const cv = $("rv-canvas"); const rect = cv.getBoundingClientRect();
    const x = (ev.clientX - rect.left) * cv.width / rect.width, y = (ev.clientY - rect.top) * cv.height / rect.height;
    const E = window.SmartOMREngine;
    let best = null;
    LY.groups.forEach((g) => g.pts.forEach((p, i) => {
      const c = E.project(s.H, p[0], p[1]); const r = (g.r || LY.r) * E.pxPerPt(s.H, p[0], p[1]);
      const d = Math.hypot(c[0] - x, c[1] - y);
      if (d <= r * 1.5 && (!best || d < best.d)) best = { d: d, id: g.id, i: i };
    }));
    if (!best) return;
    applyBubbleTap(s, best.id, best.i);
  }

  function applyBubbleTap(s, id, i) {
    const p = id.split(".");
    s.reads = s.reads || { part1: {}, part2: {}, part3: {} };
    if (p[0] === "sbd" || p[0] === "made") {
      const LY = window.SmartOMREngine.LAYOUTS[s.template];
      const len = p[0] === "sbd" ? LY.sbd_len : LY.made_len; const pos = +p[1];
      const arr = String(s[p[0]] || "").split(""); while (arr.length < len) arr.push("?");
      arr[pos] = arr[pos] === String(i) ? "?" : String(i); s[p[0]] = arr.join("");
      s.flags = (s.flags || []).filter((f) => !(f.part === (p[0] === "sbd" ? "SBD" : "Mã đề") && f.pos === pos + 1));
    } else if (p[0] === "p1") {
      const L = "ABCD"[i]; s.reads.part1[p[1]] = s.reads.part1[p[1]] === L ? "" : L; clearFlag(s, "I." + p[1]);
    } else if (p[0] === "p2") {
      const v = i === 0 ? "Đ" : "S"; s.reads.part2[p[1]] = s.reads.part2[p[1]] || {};
      s.reads.part2[p[1]][p[2]] = s.reads.part2[p[1]][p[2]] === v ? "" : v; clearFlag(s, "II." + p[1] + "." + p[2]);
    } else if (p[0] === "p3") {
      const q = p[1]; const slots = ["", "", "", ""]; Array.from(String(s.reads.part3[q] || "")).slice(0, 4).forEach((ch, k) => { slots[k] = ch; });
      if (p[2] === "minus") slots[0] = slots[0] === "-" ? "" : "-";
      else if (p[2] === "comma") slots[i + 1] = slots[i + 1] === "," ? "" : ",";
      else { const c = +p[2].slice(1); slots[c] = slots[c] === String(i) ? "" : String(i); }
      s.reads.part3[q] = slots.join(""); clearFlag(s, "III." + q);
    }
    touch(s);
  }

  function saveQuiet() {
    const s = rv.sub; if (!s) return;
    A().applyScoring(s);
    const it = A().state.batchItems.find((b) => b.id === s.id);
    if (it && rv.img && s.H) { it.graded_bgr = A().drawOverlay(s, rv.img, {}); }
    A().persistState();
  }
  function saveReview() { saveQuiet(); closeReview(false); toast("Đã lưu chỉnh sửa & tính lại điểm"); }

  // ======================================================================
  // 3. THỐNG KÊ
  // ======================================================================
  function renderStatsView(body) {
    const all = subs().filter((s) => s.result);
    if (!all.length) { body.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-icon">📊</div><div>Chưa có bài chấm để thống kê.</div></div></div>`; return; }
    const st = S.statistics(all);
    const mades = [...new Set(all.map((s) => s.keyMade || s.made))];
    if (!ui.statsMade || mades.indexOf(ui.statsMade) < 0) ui.statsMade = mades[0];
    const cls = st.classes;
    body.innerHTML = `
      <div class="card">
        <div class="card-header"><h3>📊 Phổ điểm &amp; xếp loại (${st.n} bài)</h3></div>
        <div class="stat-cards">
          <div class="stat-card"><b>${fmt(st.mean)}</b><span>Điểm TB</span></div>
          <div class="stat-card"><b>${fmt(st.median)}</b><span>Trung vị</span></div>
          <div class="stat-card"><b>${fmt(st.max)}</b><span>Cao nhất</span></div>
          <div class="stat-card"><b>${fmt(st.min)}</b><span>Thấp nhất</span></div>
          <div class="stat-card"><b>${fmt(st.sd)}</b><span>Độ lệch chuẩn</span></div>
        </div>
        <div class="class-bars">
          ${[["Giỏi", "#16a34a", "≥ 8,0"], ["Khá", "#2563eb", "6,5 – 7,9"], ["Đạt", "#d97706", "5,0 – 6,4"], ["Chưa đạt", "#dc2626", "< 5,0"]].map(([k, c, r]) => `
            <div class="cb-row"><span class="cb-k">${k}<small>${r}</small></span><div class="cb-track"><div class="cb-fill" style="width:${st.n ? cls[k] / st.n * 100 : 0}%;background:${c}"></div></div><span class="cb-v">${cls[k]} (${st.n ? Math.round(cls[k] / st.n * 100) : 0}%)</span></div>`).join("")}
        </div>
        <canvas id="hist-canvas" width="640" height="260" class="hist-canvas"></canvas>
      </div>
      <div class="card" style="margin-top:12px">
        <div class="card-header flex-between"><h3>🧪 Phân tích câu hỏi</h3>
          <select id="stats-made" class="form-select" style="max-width:160px">${mades.map((m) => `<option value="${esc(m)}">Mã đề ${esc(m)}</option>`).join("")}</select></div>
        <p class="card-desc">Tỉ lệ chọn từng phương án; <b>độ khó</b> = % học sinh làm đúng; <b>độ phân hóa</b> = (% đúng nhóm 27% cao) − (% đúng nhóm 27% thấp), ≥ 0,3 là tốt.</p>
        <div id="item-tables"></div>
      </div>`;
    $("stats-made").value = ui.statsMade;
    $("stats-made").addEventListener("change", (e) => { ui.statsMade = e.target.value; renderItemTables(all); });
    drawHistogram($("hist-canvas"), st.histogram);
    renderItemTables(all);
  }

  function drawHistogram(cv, hist) {
    const ctx = cv.getContext("2d"); const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const max = Math.max(1, Math.max.apply(null, hist));
    const padL = 30, padB = 34, padT = 20, bw = (W - padL - 10) / hist.length;
    ctx.font = "13px sans-serif"; ctx.textAlign = "center";
    ctx.strokeStyle = "#cbd5e1"; ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - 6, H - padB); ctx.stroke();
    hist.forEach((v, i) => {
      const hh = (H - padB - padT) * v / max; const x = padL + i * bw + 4;
      ctx.fillStyle = i >= 8 ? "#16a34a" : i >= 6.5 ? "#2563eb" : i >= 5 ? "#d97706" : "#dc2626";
      ctx.fillRect(x, H - padB - hh, bw - 8, hh);
      ctx.fillStyle = "#334155"; if (v) ctx.fillText(String(v), x + (bw - 8) / 2, H - padB - hh - 5);
      ctx.fillStyle = "#64748b"; ctx.fillText(i === 10 ? "10" : i + "–" + (i + 1), x + (bw - 8) / 2, H - padB + 16);
    });
    ctx.textAlign = "left"; ctx.fillStyle = "#64748b"; ctx.fillText("Số bài", 2, 12);
  }

  function remark(p, d) {
    const r = [];
    if (p < 0.3) r.push("Khó"); else if (p > 0.85) r.push("Dễ");
    if (d < 0.2) r.push("Phân hóa kém"); else if (d >= 0.4) r.push("Phân hóa tốt");
    return r.join(" · ");
  }
  const pc = (v) => Math.round(v * 100) + "%";

  function renderItemTables(all) {
    const made = ui.statsMade; const group = all.filter((s) => (s.keyMade || s.made) === made);
    const k = A().state.answerKeys[made]; const box = $("item-tables"); if (!box) return;
    if (!k || !group.length) { box.innerHTML = "<div class='card-desc'>Chưa có dữ liệu cho mã đề này.</div>"; return; }
    const it = S.itemAnalysis(group, k);
    let h = "";
    if (it.p1.length) {
      h += `<div class="rp-title">Phần I (${group.length} bài)</div><div class="tbl-wrap"><table class="stat-tbl"><thead><tr><th>Câu</th><th>ĐA</th><th>A</th><th>B</th><th>C</th><th>D</th><th>Trống</th><th>% đúng</th><th>Phân hóa</th><th>Nhận xét</th></tr></thead><tbody>`;
      it.p1.forEach((r) => {
        const cell = (L) => { const v = r.pct[L]; return `<td class="${r.key === L ? "keycell" : ""}" style="background:rgba(37,99,235,${(v * 0.5).toFixed(2)})">${pc(v)}</td>`; };
        h += `<tr class="${r.status !== "ok" ? "voidrow" : ""}"><td><b>${r.q}</b></td><td><b>${esc(r.key)}</b></td>${cell("A")}${cell("B")}${cell("C")}${cell("D")}<td>${pc(r.pct.blank)}</td><td>${pc(r.p)}</td><td>${r.d.toFixed(2)}</td><td>${r.status === "free" ? "Câu luôn đúng" : r.status === "void" ? "Đã loại" : remark(r.p, r.d)}</td></tr>`;
      });
      h += `</tbody></table></div>`;
    }
    if (it.p2.length) {
      h += `<div class="rp-title">Phần II — theo từng ý</div><div class="tbl-wrap"><table class="stat-tbl"><thead><tr><th>Câu</th><th>Ý</th><th>ĐA</th><th>% chọn Đ</th><th>% chọn S</th><th>% đúng</th><th>Phân hóa</th></tr></thead><tbody>`;
      it.p2.forEach((r) => ["a", "b", "c", "d"].forEach((kk) => { const x = r.subs[kk]; h += `<tr><td>${r.q}</td><td>${kk})</td><td><b>${esc(x.key)}</b></td><td>${pc(x.pctD)}</td><td>${pc(x.pctS)}</td><td>${pc(x.p)}</td><td>${x.d.toFixed(2)}</td></tr>`; }));
      h += `</tbody></table></div>`;
    }
    if (it.p3.length) {
      h += `<div class="rp-title">Phần III</div><div class="tbl-wrap"><table class="stat-tbl"><thead><tr><th>Câu</th><th>ĐA</th><th>% đúng</th><th>Phân hóa</th><th>Đáp án sai phổ biến</th></tr></thead><tbody>`;
      it.p3.forEach((r) => { h += `<tr><td>${r.q}</td><td><b>${esc(r.key)}</b></td><td>${pc(r.p)}</td><td>${r.d.toFixed(2)}</td><td>${esc(r.commonWrong.join(", "))}</td></tr>`; });
      h += `</tbody></table></div>`;
    }
    box.innerHTML = h;
  }

  // ======================================================================
  // 4. XUẤT BÁO CÁO & CHIA SẺ
  // ======================================================================
  function shareUrl(sub) {
    const examName = (A().keyFor(sub.made).key.exam_name) || "";
    const token = S.resultToShareToken(sub, examName);
    return new URL("tracuu.html", location.href).href + "#d=" + token;
  }

  function renderExportView(body) {
    const all = subs().filter((s) => s.result);
    body.innerHTML = `
      <div class="card">
        <div class="card-header"><h3>📤 Xuất báo cáo (${all.length} bài)</h3></div>
        <p class="card-desc">Excel gồm: Bảng điểm, Chi tiết đáp án từng câu theo cột, Đáp án các mã đề, Thống kê câu hỏi và một sheet gọn để copy sang VnEdu / SMAS.</p>
        <div class="exp-grid">
          <button class="btn btn-success btn-block" id="ex-xlsx">📗 Xuất Excel đầy đủ</button>
          <button class="btn btn-primary btn-block" id="ex-pdf">📕 PDF ảnh bài thi cả lớp (1 học sinh / trang)</button>
          <button class="btn btn-outline btn-block" id="ex-zip">🗂️ ZIP ảnh minh chứng (đã đè điểm, vết chấm)</button>
        </div>
        <div id="ex-progress" class="card-desc" style="margin-top:8px"></div>
      </div>
      <div class="card" style="margin-top:12px">
        <div class="card-header"><h3>🔗 Trả kết quả cho học sinh / phụ huynh</h3></div>
        <p class="card-desc">Tạo liên kết tra cứu điểm cá nhân (dữ liệu nằm ngay trong liên kết, không cần máy chủ) kèm mã QR. Gửi qua Zalo, email hoặc in mã QR. <b>Lưu ý:</b> ai có liên kết đều xem được kết quả của học sinh đó.</p>
        <select id="sh-student" class="form-select">${all.map((s) => `<option value="${esc(s.id)}">${esc(s.student_name)} — SBD ${esc(s.sbd)} — ${fmt(s.total_score)}đ</option>`).join("")}</select>
        <button class="btn btn-primary btn-block" id="sh-make" style="margin-top:8px">🔗 Tạo liên kết &amp; mã QR</button>
        <div id="sh-out" style="display:none;margin-top:10px">
          <input id="sh-url" class="form-input" readonly />
          <div class="rv-actions" style="margin-top:8px">
            <button class="btn btn-sm btn-outline" id="sh-copy">📋 Sao chép</button>
            <button class="btn btn-sm btn-outline" id="sh-share">📲 Gửi (Zalo/…)</button>
            <a class="btn btn-sm btn-outline" id="sh-mail" href="#">✉️ Email</a>
          </div>
          <canvas id="sh-qr" class="sh-qr"></canvas>
        </div>
      </div>`;
    $("ex-xlsx").addEventListener("click", () => Pro.exportExcel());
    $("ex-pdf").addEventListener("click", () => Pro.exportPdf());
    $("ex-zip").addEventListener("click", () => Pro.exportZip());
    $("sh-make").addEventListener("click", () => {
      const s = subs().find((x) => x.id === $("sh-student").value); if (!s) return alert("Chưa có bài nào.");
      const url = shareUrl(s);
      $("sh-out").style.display = "block"; $("sh-url").value = url;
      drawQr($("sh-qr"), url, 4);
      const msg = `Kết quả bài thi của ${s.student_name} (SBD ${s.sbd}): ${fmt(s.total_score)}/${fmt(s.max_possible_score, 0)} điểm. Xem chi tiết: ${url}`;
      $("sh-mail").href = "mailto:?subject=" + encodeURIComponent("Kết quả bài thi - " + s.student_name) + "&body=" + encodeURIComponent(msg);
      $("sh-copy").onclick = async () => { try { await navigator.clipboard.writeText(url); toast("Đã sao chép liên kết"); } catch (e) { $("sh-url").select(); document.execCommand("copy"); toast("Đã sao chép"); } };
      $("sh-share").onclick = async () => { if (navigator.share) { try { await navigator.share({ title: "Kết quả bài thi", text: msg, url: url }); } catch (e) {} } else { alert("Thiết bị chưa hỗ trợ chia sẻ trực tiếp — hãy dùng nút Sao chép rồi dán vào Zalo."); } };
    });
  }

  function drawQr(canvas, text, cell) {
    const qr = window.qrcode(0, "L"); qr.addData(text); qr.make();
    const n = qr.getModuleCount(); const q = 3; const px = cell || 4;
    canvas.width = canvas.height = (n + q * 2) * px;
    const g = canvas.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, canvas.width, canvas.height); g.fillStyle = "#000";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect((c + q) * px, (r + q) * px, px, px);
  }

  Pro.exportExcel = function () {
    if (!window.XLSX) return alert("Chưa tải được thư viện Excel.");
    const arr = subs().filter((s) => s.result);
    if (!arr.length) return alert("Chưa có kết quả bài chấm nào để xuất file Excel!");
    const wb = XLSX.utils.book_new();
    const rows = [["STT", "SBD", "Họ và tên", "Lớp", "Ngày sinh", "Mã đề", "Điểm", "Xếp loại", "Điểm P.I", "Điểm P.II", "Điểm P.III", "P.I đúng (câu)", "P.II đúng (ý)", "P.III đúng (câu)", "Cảnh báo", "Đã sửa tay", "Thời gian chấm", "Link tra cứu"]];
    arr.forEach((s, i) => rows.push([i + 1, s.sbd, s.student_name, s.student_class, s.student_dob || "", s.made, s.total_score, S.classify(s.total_score, s.max_possible_score),
      s.part1_summary.score, s.part2_summary.score, s.part3_summary.score, s.part1_summary.correct, s.part2_summary.total_sub_correct, s.part3_summary.correct,
      (s.issues || []).filter((x) => x.level !== "info").map((x) => x.text).join("; "), s.edited ? "Có" : "", s.timestamp || "", shareUrl(s)]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "BangDiem");

    let m1 = 0, m2 = 0, m3 = 0;
    arr.forEach((s) => { const n = counts(s); m1 = Math.max(m1, n.p1); m2 = Math.max(m2, n.p2); m3 = Math.max(m3, n.p3); });
    const head = ["SBD", "Họ và tên", "Lớp", "Mã đề", "Điểm"];
    for (let q = 1; q <= m1; q++) head.push("C" + q);
    for (let q = 1; q <= m2; q++) ["a", "b", "c", "d"].forEach((k) => head.push("II." + q + k));
    for (let q = 1; q <= m3; q++) head.push("III." + q);
    const det = [head];
    arr.forEach((s) => {
      const r = [s.sbd, s.student_name, s.student_class, s.made, s.total_score];
      for (let q = 1; q <= m1; q++) r.push((s.reads.part1 || {})[q] || "");
      for (let q = 1; q <= m2; q++) ["a", "b", "c", "d"].forEach((k) => r.push((((s.reads.part2 || {})[q]) || {})[k] || ""));
      for (let q = 1; q <= m3; q++) r.push((s.reads.part3 || {})[q] || "");
      det.push(r);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(det), "ChiTietDapAn");

    const keysUsed = [...new Set(arr.map((s) => s.keyMade || s.made))].filter((m) => A().state.answerKeys[m]);
    const kh = ["Mã đề", "Thang điểm"]; for (let q = 1; q <= m1; q++) kh.push("C" + q);
    for (let q = 1; q <= m2; q++) ["a", "b", "c", "d"].forEach((k) => kh.push("II." + q + k)); for (let q = 1; q <= m3; q++) kh.push("III." + q);
    const keyRows = [kh];
    keysUsed.forEach((m) => { const k = A().state.answerKeys[m]; const r = [m, (k.scoring_config && k.scoring_config.score_scale) || 10];
      for (let q = 1; q <= m1; q++) r.push((k.part1 || {})[q] || ""); for (let q = 1; q <= m2; q++) ["a", "b", "c", "d"].forEach((kk) => r.push((((k.part2 || {})[q]) || {})[kk] || "")); for (let q = 1; q <= m3; q++) r.push((k.part3 || {})[q] || ""); keyRows.push(r); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(keyRows), "DapAn");

    const stat = [];
    keysUsed.forEach((m) => {
      const g = arr.filter((s) => (s.keyMade || s.made) === m); const it = S.itemAnalysis(g, A().state.answerKeys[m]);
      stat.push(["MÃ ĐỀ " + m, g.length + " bài"]); stat.push(["Phần", "Câu", "Đáp án", "%A", "%B", "%C", "%D", "%Trống", "Độ khó (% đúng)", "Độ phân hóa"]);
      it.p1.forEach((r) => stat.push(["I", r.q, r.key, r.pct.A, r.pct.B, r.pct.C, r.pct.D, r.pct.blank, r.p, r.d]));
      it.p2.forEach((r) => ["a", "b", "c", "d"].forEach((k) => { const x = r.subs[k]; stat.push(["II", r.q + k, x.key, "Đ:" + x.pctD, "S:" + x.pctS, "", "", "", x.p, x.d]); }));
      it.p3.forEach((r) => stat.push(["III", r.q, r.key, "", "", "", "", "", r.p, r.d, r.commonWrong.join(", ")]));
      stat.push([]);
    });
    if (stat.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stat), "ThongKeCau");

    const vn = [["STT", "Mã HS / SBD", "Họ và tên", "Lớp", "Ngày sinh", "Điểm"]];
    arr.slice().sort((a, b) => String(a.sbd).localeCompare(String(b.sbd))).forEach((s, i) => vn.push([i + 1, s.sbd, s.student_name, s.student_class, s.student_dob || "", s.total_score]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vn), "VnEdu_SMAS");
    XLSX.writeFile(wb, `Ket_Qua_SmartOMR_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  async function evidenceCanvas(sub) {
    const W = 1240, H = 1754; const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.textBaseline = "top";
    g.fillStyle = "#0f172a"; g.font = "bold 40px sans-serif"; g.fillText("KẾT QUẢ CHẤM PHIẾU TRẮC NGHIỆM", 60, 48);
    g.font = "28px sans-serif";
    g.fillText(`Họ tên: ${sub.student_name}    Lớp: ${sub.student_class || "-"}`, 60, 110);
    g.fillText(`SBD: ${sub.sbd}    Mã đề: ${sub.made}    Chấm lúc: ${sub.timestamp || ""}`, 60, 152);
    g.fillText(`P.I: ${sub.part1_summary.correct}/${sub.part1_summary.total_questions} câu · P.II: ${sub.part2_summary.total_sub_correct} ý · P.III: ${sub.part3_summary.correct}/${sub.part3_summary.total_questions} câu`, 60, 194);
    g.textAlign = "right"; g.fillStyle = "#b91c1c"; g.font = "bold 92px sans-serif"; g.fillText(fmt(sub.total_score), W - 150, 70);
    g.font = "30px sans-serif"; g.fillStyle = "#475569"; g.fillText("/" + fmt(sub.max_possible_score, 0), W - 60, 118); g.textAlign = "left";
    const top = 250, bottom = 190;
    const data = await A().ImgStore.get(sub.id);
    if (data) {
      try {
        const img = await A().loadImageToCanvas(data, 4000);
        const over = sub.H ? A().drawOverlay(sub, img, { asCanvas: true, noBanner: true }) : img;
        const sc = Math.min((W - 120) / over.width, (H - top - bottom) / over.height);
        const w = over.width * sc, h = over.height * sc;
        g.drawImage(over, (W - w) / 2, top + (H - top - bottom - h) / 2, w, h);
      } catch (e) {}
    }
    const d = (sub.result && sub.result.detail) || { p1: {}, p2: {}, p3: {} };
    const w1 = Object.keys(d.p1).filter((q) => !d.p1[q].correct && d.p1[q].status === "ok");
    const w2 = Object.keys(d.p2).filter((q) => d.p2[q].n < 4 && d.p2[q].status === "ok");
    const w3 = Object.keys(d.p3).filter((q) => !d.p3[q].correct && d.p3[q].status === "ok");
    g.fillStyle = "#0f172a"; g.font = "24px sans-serif";
    const y0 = H - bottom + 20;
    g.fillText("Câu sai — P.I: " + (w1.join(", ") || "không") + "   |   P.II (chưa đủ 4 ý): " + (w2.join(", ") || "không") + "   |   P.III: " + (w3.join(", ") || "không"), 60, y0, W - 120);
    g.fillStyle = "#64748b"; g.font = "20px sans-serif";
    g.fillText("Nhận diện: " + (sub.method || "") + (sub.edited ? " · đã được giáo viên chỉnh sửa" : "") + " · Xanh = đúng, đỏ = sai, khoanh xanh = đáp án đúng", 60, y0 + 46, W - 120);
    return c;
  }

  Pro.exportPdf = async function () {
    const arr = subs().filter((s) => s.result);
    if (!arr.length) return alert("Chưa có bài chấm nào!");
    if (!window.jspdf) return alert("Chưa tải được thư viện PDF.");
    const prog = $("ex-progress");
    const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
    for (let i = 0; i < arr.length; i++) {
      if (prog) prog.textContent = `Đang tạo PDF… ${i + 1}/${arr.length}`;
      if (i) doc.addPage();
      const cv = await evidenceCanvas(arr[i]);
      doc.addImage(cv.toDataURL("image/jpeg", 0.8), "JPEG", 0, 0, 210, 297);
      await sleep(0);
    }
    doc.save(`Bai_Thi_Ca_Lop_${new Date().toISOString().slice(0, 10)}.pdf`);
    if (prog) prog.textContent = `✅ Đã xuất PDF ${arr.length} trang.`;
  };

  Pro.exportZip = async function () {
    const arr = subs().filter((s) => s.result);
    if (!arr.length) return alert("Chưa có bài chấm nào!");
    if (!window.JSZip) return alert("Chưa tải được thư viện ZIP.");
    const prog = $("ex-progress"); const zip = new window.JSZip(); let n = 0;
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i]; if (prog) prog.textContent = `Đang nén ảnh… ${i + 1}/${arr.length}`;
      const data = await A().ImgStore.get(s.id); if (!data) continue;
      const img = await A().loadImageToCanvas(data, 4000);
      const url = s.H ? A().drawOverlay(s, img, {}) : data;
      zip.file(`SBD_${s.sbd}_De_${s.made}_${s.total_score}d.jpg`, url.split(",")[1], { base64: true }); n++; await sleep(0);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `Minh_Chung_${new Date().toISOString().slice(0, 10)}.zip`; a.click();
    if (prog) prog.textContent = `✅ Đã nén ${n} ảnh minh chứng.`;
  };

  // ======================================================================
  // 5. NẠP ĐÁP ÁN ĐA KÊNH, THANG ĐIỂM, TRỌNG SỐ, CÂU LỖI
  // ======================================================================
  function activeKey() { const st = A().state; return st.answerKeys[st.activeMade] || Object.values(st.answerKeys)[0]; }
  function baseCfg() { const k = activeKey(); return Object.assign({}, (k && k.scoring_config) || A().DEFAULT_STRUCTURE); }

  function mergeKeys(keys) {
    const ids = Object.keys(keys);
    if (!ids.length) return alert("Không đọc được đáp án nào. Kiểm tra lại định dạng (xem file mẫu).");
    const st = A().state; let done = [];
    ids.forEach((id) => {
      if (st.answerKeys[id] && !confirm(`Mã đề ${id} đã có đáp án. Ghi đè bằng đáp án vừa nạp?`)) return;
      const old = st.answerKeys[id]; const k = keys[id];
      k.scoring_config = Object.assign({}, old && old.scoring_config, k.scoring_config);
      if (old) { k.weights = old.weights; k.qstatus = old.qstatus; }
      st.answerKeys[id] = k; done.push(id);
    });
    if (!done.length) return;
    st.activeMade = done[0];
    A().persistState(); A().renderKeysManager(); Pro.refreshKeyTools();
    toast(`Đã nạp ${done.length} mã đề: ${done.join(", ")} — điểm các bài đã chấm tự động cập nhật`);
  }

  async function importKeysFile(file) {
    const name = file.name.toLowerCase(); let keys;
    if (/\.(xlsx|xls|csv)$/.test(name)) {
      if (!window.XLSX) return alert("Chưa tải được thư viện Excel.");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      let rows = [];
      wb.SheetNames.forEach((n) => { rows = rows.concat(XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: "" })); });
      keys = S.keysFromRows(rows, baseCfg());
    } else keys = S.keysFromText(await file.text(), baseCfg());
    mergeKeys(keys);
  }

  function readFileDataUrl(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }

  async function scanTeacherSheet(file) {
    const url = await readFileDataUrl(file);
    const res = await A().readSheetLocally([url], { template: "auto" });
    if (!res.ok) return alert("Không đọc được phiếu mẫu giáo viên:\n" + res.reason);
    let made = res.data.made;
    if (/\?/.test(made)) { made = (prompt(`Chưa đọc đủ mã đề (${made}). Nhập mã đề cho đáp án này:`, "") || "").trim(); if (!made) return; }
    const key = S.keyFromReads(res.data, made, baseCfg());
    const multi = res.flags.filter((f) => f.type === "multi").length;
    const msg = `Đọc từ phiếu mẫu (${res.templateName}):\n• Mã đề: ${made}\n• Phần I: ${key.scoring_config.part1_count} câu\n• Phần II: ${key.scoring_config.part2_count} câu\n• Phần III: ${key.scoring_config.part3_count} câu` + (multi ? `\n⚠️ ${multi} câu bị tô 2 ô (sẽ để trống)` : "") + "\n\nNạp làm đáp án?";
    if (confirm(msg)) mergeKeys({ [made]: key });
  }

  function openQrScanner() {
    let modal = $("qr-scan-modal");
    if (!modal) {
      modal = document.createElement("div"); modal.id = "qr-scan-modal"; modal.className = "modal-overlay"; modal.style.display = "none";
      modal.innerHTML = `<div class="modal-card"><div class="modal-header"><h3>📷 Quét mã QR đáp án</h3><button class="modal-close" id="qrs-close">✕</button></div>
        <div class="modal-body"><video id="qrs-video" playsinline muted style="width:100%;border-radius:10px;background:#000"></video>
        <div id="qrs-status" class="card-desc" style="margin-top:8px">Đưa mã QR vào khung hình…</div>
        <label class="btn btn-sm btn-outline" style="margin-top:6px">🖼️ Chọn ảnh chứa mã QR<input type="file" id="qrs-file" accept="image/*" hidden /></label></div></div>`;
      $("pro-modals").appendChild(modal);
    }
    modal.style.display = "flex";
    let stream = null, timer = null;
    const stop = () => { clearInterval(timer); if (stream) stream.getTracks().forEach((t) => t.stop()); modal.style.display = "none"; };
    const handle = (text) => {
      const key = S.keyFromQrPayload(text, baseCfg());
      if (!key) { $("qrs-status").textContent = "Mã QR không phải đáp án SmartOMR — thử lại."; return false; }
      stop(); mergeKeys({ [key.made]: key }); return true;
    };
    $("qrs-close").onclick = stop;
    $("qrs-file").onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const cv = await A().loadImageToCanvas(await readFileDataUrl(f), 1600);
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height); const code = window.jsQR(d.data, d.width, d.height);
      if (code) handle(code.data); else $("qrs-status").textContent = "Không tìm thấy mã QR trong ảnh.";
    };
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((s) => {
      stream = s; const v = $("qrs-video"); v.srcObject = s; v.play();
      const cv = document.createElement("canvas"); const ctx = cv.getContext("2d", { willReadFrequently: true });
      timer = setInterval(() => {
        if (!v.videoWidth) return; const sc = Math.min(1, 640 / v.videoWidth); cv.width = v.videoWidth * sc; cv.height = v.videoHeight * sc;
        ctx.drawImage(v, 0, 0, cv.width, cv.height); const d = ctx.getImageData(0, 0, cv.width, cv.height); const code = window.jsQR(d.data, d.width, d.height);
        if (code && code.data) handle(code.data);
      }, 250);
    }).catch(() => { $("qrs-status").textContent = "Không mở được camera — dùng nút chọn ảnh QR bên dưới."; });
  }

  function showKeyQr() {
    const k = activeKey(); if (!k) return;
    const payload = S.keyToQrPayload(k);
    let modal = $("qr-make-modal");
    if (!modal) {
      modal = document.createElement("div"); modal.id = "qr-make-modal"; modal.className = "modal-overlay"; modal.style.display = "none";
      modal.innerHTML = `<div class="modal-card"><div class="modal-header"><h3>🔳 Mã QR đáp án</h3><button class="modal-close" id="qrm-close">✕</button></div>
        <div class="modal-body" style="text-align:center"><canvas id="qrm-canvas" class="sh-qr"></canvas><div id="qrm-title" class="card-desc"></div>
        <a id="qrm-dl" class="btn btn-sm btn-outline" download="QR_DapAn.png">⬇️ Tải ảnh QR</a></div></div>`;
      $("pro-modals").appendChild(modal);
      $("qrm-close").onclick = () => { modal.style.display = "none"; };
    }
    modal.style.display = "flex"; drawQr($("qrm-canvas"), payload, 5);
    $("qrm-title").textContent = `Mã đề ${k.made} — quét bằng nút "Quét mã QR" ở thiết bị khác để nạp đáp án.`;
    $("qrm-dl").href = $("qrm-canvas").toDataURL("image/png"); $("qrm-dl").download = `QR_DapAn_${k.made}.png`;
  }

  function openWeightsModal() {
    const k = activeKey(); if (!k) return;
    const cfg = k.scoring_config || {};
    const n = { p1: cfg.enable_part1 === false ? 0 : (cfg.part1_count == null ? 40 : cfg.part1_count), p2: cfg.enable_part2 === false ? 0 : (cfg.part2_count == null ? 8 : cfg.part2_count), p3: cfg.enable_part3 === false ? 0 : (cfg.part3_count == null ? 6 : cfg.part3_count) };
    let modal = $("weights-modal");
    if (!modal) { modal = document.createElement("div"); modal.id = "weights-modal"; modal.className = "modal-overlay"; modal.style.display = "none"; $("pro-modals").appendChild(modal); }
    const rows = (part, label, cnt) => { let h = ""; for (let q = 1; q <= cnt; q++) {
      const st = (k.qstatus && k.qstatus[part] && k.qstatus[part][q]) || "ok"; const w = (k.weights && k.weights[part] && k.weights[part][q]);
      h += `<tr><td>${label} ${q}</td><td><select data-st="${part}:${q}"><option value="ok"${st === "ok" ? " selected" : ""}>Bình thường</option><option value="free"${st === "free" ? " selected" : ""}>Luôn đúng (cả lớp được điểm)</option><option value="void"${st === "void" ? " selected" : ""}>Loại bỏ câu</option></select></td><td><input type="number" step="0.1" min="0" data-w="${part}:${q}" value="${w == null ? 1 : w}" /></td></tr>`; } return h; };
    modal.innerHTML = `<div class="modal-card" style="max-width:520px"><div class="modal-header"><h3>⚖️ Trọng số &amp; xử lý câu lỗi — Đề ${esc(k.made)}</h3><button class="modal-close" id="wm-close">✕</button></div>
      <div class="modal-body"><p class="card-desc"><b>Hệ số</b>: nhân điểm của câu (mặc định 1). <b>Luôn đúng</b>: tính đủ điểm cho cả lớp (đề in sai câu). <b>Loại bỏ</b>: bỏ câu khỏi bài, điểm tổng tự quy lại thang ${(cfg.score_scale == null || cfg.score_scale === "") ? 10 : cfg.score_scale} nên không xáo trộn kết quả chung.</p>
      <div class="tbl-wrap" style="max-height:52vh;overflow:auto"><table class="stat-tbl"><thead><tr><th>Câu</th><th>Trạng thái</th><th>Hệ số</th></tr></thead><tbody>${rows("p1", "I.", n.p1)}${rows("p2", "II.", n.p2)}${rows("p3", "III.", n.p3)}</tbody></table></div>
      <div class="rv-actions" style="margin-top:10px"><button class="btn btn-sm btn-ghost" id="wm-reset">Đặt lại mặc định</button><span style="flex:1"></span><button class="btn btn-sm btn-success" id="wm-save">💾 Lưu &amp; tính lại</button></div></div></div>`;
    modal.style.display = "flex";
    $("wm-close").onclick = () => { modal.style.display = "none"; };
    $("wm-reset").onclick = () => { delete k.weights; delete k.qstatus; A().persistState(); modal.style.display = "none"; toast("Đã đặt lại trọng số"); };
    $("wm-save").onclick = () => {
      const weights = { p1: {}, p2: {}, p3: {} }, qstatus = { p1: {}, p2: {}, p3: {} };
      modal.querySelectorAll("[data-st]").forEach((el) => { const [p, q] = el.dataset.st.split(":"); if (el.value !== "ok") qstatus[p][q] = el.value; });
      modal.querySelectorAll("[data-w]").forEach((el) => { const [p, q] = el.dataset.w.split(":"); const v = parseFloat(el.value); if (isFinite(v) && v !== 1) weights[p][q] = v; });
      k.weights = weights; k.qstatus = qstatus; A().persistState(); modal.style.display = "none"; toast("Đã lưu — điểm các bài của mã đề này tự động cập nhật");
    };
  }

  function injectKeyTools() {
    const host = document.querySelector("#tab-keys .view-content");
    if (!host || $("key-tools-card")) return;
    const card = document.createElement("div"); card.id = "key-tools-card"; card.className = "card";
    card.innerHTML = `
      <div class="card-header"><h3>📥 Nạp đáp án đa kênh</h3></div>
      <p class="card-desc">Ngoài nhập tay bên dưới, thầy có thể nạp nhiều mã đề cùng lúc bằng một trong các cách sau.</p>
      <div class="kt-grid">
        <label class="btn btn-sm btn-outline">📄 Import Excel/CSV/TXT<input type="file" id="kt-file" accept=".xlsx,.xls,.csv,.txt" hidden /></label>
        <button class="btn btn-sm btn-outline" id="kt-template">⬇️ Tải file mẫu</button>
        <button class="btn btn-sm btn-outline" id="kt-qr-scan">📷 Quét mã QR</button>
        <label class="btn btn-sm btn-outline">🧑‍🏫 Quét phiếu mẫu GV<input type="file" id="kt-sheet" accept="image/*" capture="environment" hidden /></label>
        <button class="btn btn-sm btn-outline" id="kt-qr-make">🔳 Tạo QR đáp án đề đang chọn</button>
      </div>
      <details class="kt-details"><summary>📝 Dán văn bản (mỗi dòng một mã đề)</summary>
        <textarea id="kt-text" class="form-input" rows="4" placeholder="0101: ABCDABCD… | ĐSĐS SSĐĐ… | 2025;-1,5;0,25&#10;0102: …"></textarea>
        <div class="card-desc">Định dạng: <code>mãđề: Phần I | Phần II (4 ký tự/câu: Đ hoặc S) | Phần III (ngăn cách bằng ;)</code></div>
        <button class="btn btn-sm btn-primary" id="kt-text-go">Nạp từ văn bản</button></details>
      <div class="rp-title">⚖️ Thang điểm &amp; trọng số</div>
      <div class="kt-scale">
        <label>Quy về thang <input type="number" id="kt-scale" min="0" step="0.5" class="form-input-sm" /> <small>(0 = giữ nguyên tổng điểm các câu)</small></label>
        <label>Đ/S lũy tiến — đúng 1 / 2 / 3 / 4 ý được: 
          <input type="number" id="kt-s1" step="0.05" min="0" class="form-input-sm" /> <input type="number" id="kt-s2" step="0.05" min="0" class="form-input-sm" />
          <input type="number" id="kt-s3" step="0.05" min="0" class="form-input-sm" /> <input type="number" id="kt-s4" step="0.05" min="0" class="form-input-sm" /> <small>(× điểm tối đa của câu)</small></label>
        <label class="checkbox-pill"><input type="checkbox" id="kt-all" checked /> <span>Áp dụng cho mọi mã đề</span></label>
      </div>
      <div class="kt-grid"><button class="btn btn-sm btn-success" id="kt-save-scale">💾 Lưu thang điểm</button>
        <button class="btn btn-sm btn-outline" id="kt-weights">⚖️ Trọng số / câu lỗi…</button></div>`;
    host.insertBefore(card, host.firstChild);

    $("kt-file").addEventListener("change", async (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) { try { await importKeysFile(f); } catch (err) { alert("Lỗi đọc file: " + err.message); } } });
    $("kt-template").addEventListener("click", () => {
      if (!window.XLSX) return;
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(S.keyTemplateRows(activeKey() && activeKey().made)), "DapAn");
      XLSX.writeFile(wb, "Mau_Nhap_Dap_An_SmartOMR.xlsx");
    });
    $("kt-qr-scan").addEventListener("click", openQrScanner);
    $("kt-sheet").addEventListener("change", async (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) { try { await scanTeacherSheet(f); } catch (err) { alert("Lỗi: " + err.message); } } });
    $("kt-qr-make").addEventListener("click", showKeyQr);
    $("kt-text-go").addEventListener("click", () => mergeKeys(S.keysFromText($("kt-text").value, baseCfg())));
    $("kt-weights").addEventListener("click", openWeightsModal);
    $("kt-save-scale").addEventListener("click", () => {
      const sv = $("kt-scale").value; const steps = ["kt-s1", "kt-s2", "kt-s3", "kt-s4"].map((id) => parseFloat($(id).value));
      if (steps.some((v) => !isFinite(v) || v < 0 || v > 1)) return alert("Điểm lũy tiến Đ/S phải là số từ 0 đến 1 (tỉ lệ so với điểm tối đa của câu).");
      const targets = $("kt-all").checked ? Object.values(A().state.answerKeys) : [activeKey()];
      targets.forEach((k) => { k.scoring_config = k.scoring_config || {}; k.scoring_config.score_scale = sv === "" ? 10 : parseFloat(sv); k.scoring_config.part2_steps = steps; });
      A().persistState(); toast("Đã lưu thang điểm — điểm các bài đã chấm tự động cập nhật");
    });
    $("tab-keys").addEventListener("click", () => setTimeout(Pro.refreshKeyTools, 60));
    $("tab-keys").addEventListener("change", () => setTimeout(Pro.refreshKeyTools, 60));
    Pro.refreshKeyTools();
  }

  Pro.refreshKeyTools = function () {
    if (!$("kt-scale")) return;
    const k = activeKey(); const cfg = (k && k.scoring_config) || {};
    const act = document.activeElement && document.activeElement.id && document.activeElement.id.indexOf("kt-") === 0;
    if (act) return;
    $("kt-scale").value = cfg.score_scale == null || cfg.score_scale === "" ? 10 : cfg.score_scale;
    const steps = Array.isArray(cfg.part2_steps) && cfg.part2_steps.length === 4 ? cfg.part2_steps : S.DEFAULT_P2_STEPS;
    ["kt-s1", "kt-s2", "kt-s3", "kt-s4"].forEach((id, i) => { $(id).value = steps[i]; });
  };

  // ======================================================================
  // 6. QUÉT LIÊN TỤC (AUTO-CAPTURE)
  // ======================================================================
  const auto = { on: false, timer: null, busy: false, stable: 0, last: null, locked: false, missing: 0, lastSig: "", lastAt: 0, canvas: null };

  function setAutoStatus(msg) { const el = $("auto-status"); if (el) { el.textContent = msg; el.style.display = auto.on ? "block" : "none"; } }
  function beep() {
    try { const C = window.AudioContext || window.webkitAudioContext; const ctx = new C(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.08; o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 130); } catch (e) {}
    if (navigator.vibrate) navigator.vibrate(60);
  }
  function camTemplate() { const el = $("cam-template-select"); return el ? el.value : "auto"; }

  async function autoTick() {
    if (auto.busy || !auto.on) return;
    const video = $("camera-stream"); if (!video || video.readyState < 2 || !video.videoWidth) return;
    auto.busy = true;
    try {
      const vw = video.videoWidth, vh = video.videoHeight; const sc = Math.min(1, 960 / Math.max(vw, vh));
      const c = auto.canvas || (auto.canvas = document.createElement("canvas")); c.width = Math.round(vw * sc); c.height = Math.round(vh * sc);
      const ctx = c.getContext("2d", { willReadFrequently: true }); ctx.drawImage(video, 0, 0, c.width, c.height);
      const det = window.SmartOMREngine.quickDetect(ctx.getImageData(0, 0, c.width, c.height));
      if (!det.found) {
        auto.missing++; auto.stable = 0; auto.last = null;
        if (auto.missing >= 3) auto.locked = false;
        setAutoStatus(auto.locked ? "✅ Đã chấm — đưa phiếu kế tiếp vào khung" : "🔍 Đang tìm phiếu…"); return;
      }
      auto.missing = 0;
      if (auto.locked) { setAutoStatus("✅ Đã chấm — đưa phiếu kế tiếp vào khung"); return; }
      let disp = 1;
      if (auto.last) disp = Math.max.apply(null, det.corners.map((p, i) => Math.hypot(p[0] - auto.last[i][0], p[1] - auto.last[i][1])));
      auto.last = det.corners;
      if (disp < 0.015) auto.stable++; else auto.stable = 0;
      if (auto.stable < 1) { setAutoStatus("📄 Thấy phiếu — giữ yên máy…"); return; }
      setAutoStatus("⏳ Đang chấm…");
      const fc = document.createElement("canvas"); fc.width = vw; fc.height = vh; fc.getContext("2d").drawImage(video, 0, 0, vw, vh);
      const url = fc.toDataURL("image/jpeg", 0.9);
      const probe = await A().readSheetLocally([url], { template: camTemplate() });
      if (!probe.ok) { setAutoStatus("⚠️ Chưa đọc rõ — giữ yên, đủ sáng, thấy đủ 4 góc"); auto.stable = 0; return; }
      if (/\?/.test(probe.data.sbd) || /\?/.test(probe.data.made)) { setAutoStatus("⚠️ Chưa đọc đủ SBD/Mã đề — chỉnh góc chụp"); auto.stable = 0; return; }
      const sig = probe.data.sbd + "|" + probe.data.made;
      if (sig === auto.lastSig && Date.now() - auto.lastAt < 8000) { auto.locked = true; return; }
      const res = await A().processGradingRequest({ base64Data: url, rawBase64: url, templateId: camTemplate(), useGemini: false, sourceName: "Quét_liên_tục_" + new Date().toLocaleTimeString("vi-VN"), isCameraCapture: true, silent: true });
      auto.locked = true; auto.lastSig = sig; auto.lastAt = Date.now(); auto.stable = 0;
      if (res && res.result) { beep(); setAutoStatus(`✅ ${res.result.student_name} — ${fmt(res.result.total_score)} điểm`); }
      else setAutoStatus("⚠️ Không chấm được — thử lại");
    } catch (e) { console.warn("[Auto]", e); } finally { auto.busy = false; }
  }

  Pro.startAuto = function () {
    auto.on = true; auto.locked = false; auto.stable = 0; auto.missing = 0; auto.last = null;
    clearInterval(auto.timer); auto.timer = setInterval(autoTick, 450);
    const b = $("btn-auto-capture"); if (b) b.classList.add("on");
    setAutoStatus("🔍 Đang tìm phiếu…");
  };
  Pro.stopAuto = function () {
    if (!auto.on) return; auto.on = false; clearInterval(auto.timer);
    const b = $("btn-auto-capture"); if (b) b.classList.remove("on");
    setAutoStatus("");
  };

  function injectCameraAuto() {
    const aux = document.querySelector(".cam-aux-controls"); if (!aux || $("btn-auto-capture")) return;
    const b = document.createElement("button"); b.className = "cam-tool-btn"; b.id = "btn-auto-capture"; b.title = "Tự động chụp & chấm liên tục, không cần bấm từng tờ";
    b.textContent = "⚡ Quét liên tục"; aux.appendChild(b);
    b.addEventListener("click", () => { if (auto.on) Pro.stopAuto(); else Pro.startAuto(); });
    const wrap = $("viewfinder-wrapper");
    if (wrap) { const st = document.createElement("div"); st.id = "auto-status"; st.className = "auto-status"; st.style.display = "none"; wrap.appendChild(st); }
    const dis = $("btn-dismiss-continue-cam"); if (dis) dis.addEventListener("click", () => { auto.locked = false; });
    const row = document.querySelector("#camera-result-sheet .result-actions-row");
    if (row && !$("btn-edit-cam")) {
      const e = document.createElement("button"); e.className = "btn btn-sm btn-outline"; e.id = "btn-edit-cam"; e.textContent = "✏️ Xem & sửa";
      e.addEventListener("click", () => { const it = A().state.currentViewerItem; if (it && it.result) Pro.openReview(it.result.id); });
      row.insertBefore(e, row.firstChild);
    }
  }

  // ======================================================================
  // 7. ĐỒNG BỘ ĐÁM MÂY (Firestore)
  // ======================================================================
  function cloudCtx() {
    const SA = window.SmartAuth; if (!SA || !SA.isFirebaseConfigured || !SA.isFirebaseConfigured()) return null;
    const db = SA.getFirestore && SA.getFirestore(); const uid = SA.getUid && SA.getUid();
    return db && uid ? { db: db, uid: uid } : null;
  }
  function syncEnabled() { return localStorage.getItem("smartomr_auto_sync") !== "false"; }
  function setSyncStatus(msg) { const el = $("sync-status"); if (el) el.textContent = msg; }
  function serSub(s) { const c = Object.assign({}, s); delete c.result; delete c.issues; delete c.level; return JSON.stringify(c); }

  Pro.pushCloud = async function (manual) {
    const ctx = cloudCtx();
    if (!ctx) { if (manual) alert("Cần đăng nhập tài khoản (Firebase) để đồng bộ đám mây."); return false; }
    try {
      setSyncStatus("⏳ Đang đồng bộ lên đám mây…");
      const st = A().state; const base = ctx.db.collection("users").doc(ctx.uid);
      await base.collection("omr").doc("keys").set({ json: JSON.stringify(st.answerKeys), updatedAt: Date.now() });
      await base.collection("omr").doc("students").set({ json: JSON.stringify(st.students), updatedAt: Date.now() });
      const dirty = st.submissions.filter((s) => s.reads && (!s.syncedAt || s.syncedAt < (s.updatedAt || s.ts)));
      for (let i = 0; i < dirty.length; i += 200) {
        const batch = ctx.db.batch();
        dirty.slice(i, i + 200).forEach((s) => batch.set(base.collection("omr_subs").doc(s.id), { json: serSub(s), ts: s.ts, updatedAt: Date.now() }));
        await batch.commit();
      }
      if (dirty.length) { const now = Date.now(); dirty.forEach((s) => { s.syncedAt = now; }); A().persistState(); }
      localStorage.setItem("smartomr_last_sync", new Date().toLocaleString("vi-VN"));
      setSyncStatus(`✅ Đã đồng bộ lúc ${localStorage.getItem("smartomr_last_sync")} (${dirty.length} bài mới)`);
      return true;
    } catch (e) { console.warn("[Sync]", e); setSyncStatus("⚠️ Đồng bộ lỗi: " + (e.code || e.message) + " — kiểm tra Firestore Rules cho users/{uid}/…"); return false; }
  };

  Pro.pullCloud = async function (manual) {
    const ctx = cloudCtx();
    if (!ctx) { if (manual) alert("Cần đăng nhập tài khoản (Firebase) để tải dữ liệu."); return false; }
    try {
      setSyncStatus("⏳ Đang tải dữ liệu từ đám mây…");
      const st = A().state; const base = ctx.db.collection("users").doc(ctx.uid);
      const kd = await base.collection("omr").doc("keys").get();
      if (kd.exists) { const keys = JSON.parse(kd.data().json); Object.keys(keys).forEach((m) => { if (!st.answerKeys[m]) st.answerKeys[m] = keys[m]; }); }
      const sd = await base.collection("omr").doc("students").get();
      if (sd.exists) { const list = JSON.parse(sd.data().json); list.forEach((x) => { if (!st.students.some((y) => y.sbd === x.sbd)) st.students.push(x); }); }
      const snap = await base.collection("omr_subs").get(); let added = 0;
      snap.forEach((d) => { const s = JSON.parse(d.data().json); if (!st.submissions.some((x) => x.id === s.id)) { s.syncedAt = Date.now(); s.hasImage = false; st.submissions.push(s); added++; } });
      st.submissions.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      A().recalcAll(); A().persistState(); A().renderKeysManager();
      setSyncStatus(`✅ Đã tải về ${added} bài mới từ đám mây`);
      return true;
    } catch (e) { console.warn("[Pull]", e); setSyncStatus("⚠️ Tải lỗi: " + (e.code || e.message)); return false; }
  };

  let syncTimer = null;
  function scheduleSync() {
    if (!syncEnabled() || !navigator.onLine || !cloudCtx()) return;
    clearTimeout(syncTimer); syncTimer = setTimeout(() => Pro.pushCloud(false), 5000);
  }

  function injectSyncCard() {
    const host = document.querySelector("#tab-settings .view-content"); if (!host || $("sync-card")) return;
    const card = document.createElement("div"); card.id = "sync-card"; card.className = "card"; card.style.marginTop = "12px";
    card.innerHTML = `<div class="card-header"><h3>☁️ Đồng bộ đám mây</h3></div>
      <p class="card-desc">Chấm bài hoàn toàn offline trên thiết bị. Khi có mạng và đã đăng nhập, kết quả, đáp án và danh sách lớp tự đồng bộ để thầy xem/tải trên máy tính. (Ảnh minh chứng chỉ lưu trên thiết bị đã chấm.)</p>
      <label class="checkbox-pill"><input type="checkbox" id="sync-auto" /> <span>Tự động đồng bộ khi có mạng</span></label>
      <div class="kt-grid" style="margin-top:8px"><button class="btn btn-sm btn-primary" id="sync-push">⬆️ Đồng bộ lên ☁️</button><button class="btn btn-sm btn-outline" id="sync-pull">⬇️ Tải về từ ☁️</button></div>
      <div id="sync-status" class="card-desc" style="margin-top:8px"></div>`;
    host.appendChild(card);
    $("sync-auto").checked = syncEnabled();
    $("sync-auto").addEventListener("change", (e) => localStorage.setItem("smartomr_auto_sync", e.target.checked ? "true" : "false"));
    $("sync-push").addEventListener("click", () => Pro.pushCloud(true));
    $("sync-pull").addEventListener("click", () => Pro.pullCloud(true));
    Pro.refreshSyncCard();
    window.addEventListener("online", scheduleSync);
  }
  Pro.refreshSyncCard = function () {
    const el = $("sync-status"); if (!el) return;
    if (!cloudCtx()) el.textContent = "Chưa đăng nhập tài khoản Firebase — đang chạy hoàn toàn cục bộ.";
    else el.textContent = localStorage.getItem("smartomr_last_sync") ? "Lần đồng bộ gần nhất: " + localStorage.getItem("smartomr_last_sync") : "Sẵn sàng đồng bộ.";
  };

  // ======================================================================
  // 8. CHẤM THỬ: TỰ TẠO PHIẾU TÔ SẴN RỒI CHẤM THẬT QUA TOÀN BỘ QUY TRÌNH
  // ======================================================================
  function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Không tải được " + src)); i.src = src; }); }

  async function makeDemoSheet(tpl, idx) {
    const E = window.SmartOMREngine; const LY = E.LAYOUTS[tpl];
    const img = await loadImg(tpl === "qm2025" ? "templates/phieu_qm_2025_a4.png" : "templates/phieu_tltn_40_cau.png");
    const sc = img.naturalWidth / LY.page[0];
    const W = img.naturalWidth + 160, H = img.naturalHeight + 160;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
    g.fillStyle = "#556b7f"; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, H / 2); g.rotate(((idx % 2 ? 1 : -1) * 1.8 * Math.PI) / 180); g.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2); g.restore();
    // vẽ ô tô trên một canvas phẳng riêng rồi xoay cùng
    const flat = document.createElement("canvas"); flat.width = img.naturalWidth; flat.height = img.naturalHeight; const f = flat.getContext("2d"); f.drawImage(img, 0, 0);
    const G = {}; LY.groups.forEach((x) => { G[x.id] = x; });
    const dot = (id, i) => { const gr = G[id]; if (!gr || !gr.pts[i]) return; const p = gr.pts[i]; f.beginPath(); f.arc(p[0] * sc + (Math.random() - 0.5), p[1] * sc + (Math.random() - 0.5), (gr.r || LY.r) * sc * 0.82, 0, Math.PI * 2); f.fillStyle = "#1f2430"; f.fill(); };
    const st = A().state; const key = activeKey(); const stu = st.students[idx % st.students.length] || { sbd: "1234567" };
    String(stu.sbd).replace(/\D/g, "").padStart(LY.sbd_len, "0").slice(-LY.sbd_len).split("").forEach((d, i) => dot("sbd." + i, +d));
    String((key && key.made) || "0101").replace(/\D/g, "").padStart(LY.made_len, "0").slice(-LY.made_len).split("").forEach((d, i) => dot("made." + i, +d));
    const cfg = (key && key.scoring_config) || {};
    const n1 = cfg.part1_count == null ? 40 : cfg.part1_count, n2 = cfg.part2_count == null ? 8 : cfg.part2_count, n3 = cfg.part3_count == null ? 6 : cfg.part3_count;
    for (let q = 1; q <= n1; q++) { const kv = (key.part1 || {})[q]; let L = "ABCD".indexOf(kv); if (L < 0 || Math.random() < 0.15) L = Math.floor(Math.random() * 4); dot("p1." + q, L); }
    for (let q = 1; q <= n2; q++) ["a", "b", "c", "d"].forEach((k) => { const kv = (((key.part2 || {})[q]) || {})[k]; let v = kv === "Đ" ? 0 : 1; if (Math.random() < 0.2) v = 1 - v; dot("p2." + q + "." + k, v); });
    for (let q = 1; q <= n3; q++) { const kv = String((key.part3 || {})[q] || ""); if (!kv || Math.random() < 0.2) continue; Array.from(kv.replace(".", ",").slice(0, 4)).forEach((ch, c) => { if (ch === "-") dot("p3." + q + ".minus", 0); else if (ch === ",") dot("p3." + q + ".comma", c - 1); else dot("p3." + q + ".c" + c, +ch); }); }
    g.save(); g.translate(W / 2, H / 2); g.rotate(((idx % 2 ? 1 : -1) * 1.8 * Math.PI) / 180); g.drawImage(flat, -flat.width / 2, -flat.height / 2); g.restore();
    return cv;
  }

  Pro.runDemo = async function () {
    const prog = $("batch-progress-card"), txt = $("batch-progress-text");
    if (prog) prog.style.display = "block";
    const tpls = ["bgd40", "qm2025", "bgd40", "qm2025"]; let ok = 0;
    for (let i = 0; i < tpls.length; i++) {
      if (txt) txt.textContent = `🧪 Đang tạo & chấm phiếu thử ${i + 1}/${tpls.length} (${tpls[i] === "qm2025" ? "QM 2025" : "Bộ GD&ĐT"})…`;
      try {
        const cv = await makeDemoSheet(tpls[i], i);
        const r = await A().processGradingRequest({ base64Data: cv.toDataURL("image/jpeg", 0.9), templateId: "auto", useGemini: false, sourceName: `Phiếu_Thử_${i + 1}_${tpls[i]}`, isCameraCapture: false });
        if (r && r.result) ok++;
      } catch (e) { console.warn("[Demo]", e); }
      A().renderBatchCards(); await sleep(0);
    }
    if (txt) txt.textContent = `✅ Đã tự tạo và chấm ${ok}/${tpls.length} phiếu thử qua đúng quy trình thật (đọc ảnh → nhận diện → tính điểm).`;
    setTimeout(() => { if (prog) prog.style.display = "none"; }, 6000);
  };

  // ======================================================================
  // 9. MÓC NỐI VỚI ỨNG DỤNG
  // ======================================================================
  Pro.refresh = renderResults;
  Pro.onDataChanged = function () { if (rv.open) redrawReview(); renderResultsIfVisible(); };
  Pro.onPersist = scheduleSync;
  Pro.onNewSubmission = function () { if ($("tab-results") && $("tab-results").classList.contains("active")) renderResults(); };

  function bindPrintTemplate() {
    const sel = $("sel-print-template"); if (!sel) return;
    const apply = () => {
      const qm = sel.value === "qm2025";
      const base = qm ? "templates/phieu_qm_2025_a4" : "templates/phieu_tltn_40_cau";
      const name = qm ? "Phieu_QM_2025_A4" : "Phieu_TLTN_Chuan_BGDDT_A4";
      const pdf = $("btn-download-pdf-link"), png = $("btn-download-png-link");
      if (pdf) { pdf.href = base + ".pdf"; pdf.download = name + ".pdf"; }
      if (png) { png.href = base + ".png"; png.download = name + ".png"; }
    };
    sel.addEventListener("change", apply); apply();
  }

  function init() {
    injectKeyTools(); injectCameraAuto(); injectSyncCard(); bindPrintTemplate();
    renderResults();
    if (cloudCtx() && syncEnabled()) setTimeout(() => Pro.pullCloud(false).then(() => scheduleSync()), 2500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
