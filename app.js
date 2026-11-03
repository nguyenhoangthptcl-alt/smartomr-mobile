/**
 * SmartOMR Pro Mobile — Logic Ứng Dụng Chấm Trắc Nghiệm Di Động Chuẩn Bộ GD&ĐT
 * Bản quyền: Thầy Nguyễn Văn Hoàng - THPT Chi Lăng, Lạng Sơn
 */

(function () {
  "use strict";

  // =========================================================================
  // 1. DỮ LIỆU MẶC ĐỊNH & KHỞI TẠO STATE
  // =========================================================================
  const COPYRIGHT = "SmartOMR Pro VN được phát triển bởi thầy Nguyễn Văn Hoàng, giáo viên Trường THPT Chi Lăng, Lạng Sơn.";

  const DEFAULT_STRUCTURE = {
    enable_part1: true,
    part1_count: 40,
    part1_points_each: 0.25,
    enable_part2: true,
    part2_count: 8,
    part2_max_points_each: 1.0,
    enable_part3: true,
    part3_count: 6,
    part3_points_each: 0.25,
  };

  const DEFAULT_KEY_0101 = {
    made: "0101",
    exam_name: "Kỳ thi THPT Quốc Gia (Chuẩn Bộ GD&ĐT)",
    scoring_config: { ...DEFAULT_STRUCTURE },
    part1: {
      "1": "A", "2": "B", "3": "C", "4": "D", "5": "A", "6": "B", "7": "C", "8": "D",
      "9": "A", "10": "B", "11": "C", "12": "D", "13": "A", "14": "B", "15": "C", "16": "D",
      "17": "A", "18": "B", "19": "C", "20": "D", "21": "A", "22": "B", "23": "C", "24": "D",
      "25": "A", "26": "B", "27": "C", "28": "D", "29": "A", "30": "B", "31": "C", "32": "D",
      "33": "A", "34": "B", "35": "C", "36": "D", "37": "A", "38": "B", "39": "C", "40": "D"
    },
    part2: {
      "1": { "a": "Đ", "b": "S", "c": "Đ", "d": "S" },
      "2": { "a": "S", "b": "Đ", "c": "S", "d": "Đ" },
      "3": { "a": "Đ", "b": "Đ", "c": "S", "d": "S" },
      "4": { "a": "S", "b": "S", "c": "Đ", "d": "Đ" },
      "5": { "a": "Đ", "b": "S", "c": "Đ", "d": "S" },
      "6": { "a": "S", "b": "Đ", "c": "S", "d": "Đ" },
      "7": { "a": "Đ", "b": "Đ", "c": "S", "d": "S" },
      "8": { "a": "S", "b": "S", "c": "Đ", "d": "Đ" }
    },
    part3: {
      "1": "2025", "2": "-1,5", "3": "0,25", "4": "14,2", "5": "8", "6": "-4"
    }
  };

  const DEFAULT_STUDENTS = [
    { sbd: "24012345", full_name: "Nguyễn Văn Minh", class_name: "12A1", dob: "15/05/2007" },
    { sbd: "24012346", full_name: "Trần Thị Ngọc Ánh", class_name: "12A1", dob: "22/08/2007" },
    { sbd: "24012347", full_name: "Lê Hoàng Nam", class_name: "12A1", dob: "10/01/2007" },
    { sbd: "24012348", full_name: "Phạm Thu Hà", class_name: "12A2", dob: "03/11/2007" },
    { sbd: "24012349", full_name: "Vũ Đức Duy", class_name: "12A2", dob: "19/07/2007" },
    { sbd: "24012350", full_name: "Đặng Khánh Linh", class_name: "12A3", dob: "28/02/2007" }
  ];

  const state = {
    activeTab: "tab-camera",
    sessionName: localStorage.getItem("smartomr_session_name") || "Phiên chấm ngày " + new Date().toLocaleDateString("vi-VN"),
    answerKeys: JSON.parse(localStorage.getItem("smartomr_keys") || "null") || { "0101": DEFAULT_KEY_0101 },
    activeMade: "0101",
    students: JSON.parse(localStorage.getItem("smartomr_students") || "null") || DEFAULT_STUDENTS,
    submissions: JSON.parse(localStorage.getItem("smartomr_submissions") || "[]"),
    geminiKey: localStorage.getItem("smartomr_gemini_key") || "",
    geminiModel: localStorage.getItem("smartomr_gemini_model") || "gemini-1.5-flash",
    autoGemini: localStorage.getItem("smartomr_auto_gemini") === "true",
    autoDownloadGradedCam: localStorage.getItem("smartomr_auto_download_cam") !== "false",
    cameraFacing: "environment", // "environment" (sau) hoặc "user" (trước)
    cameraStream: null,
    cameraTorch: false,
    cameraAnchors: JSON.parse(localStorage.getItem("smartomr_camera_anchors") || "null") || {
      tl: { x: 0.12, y: 0.10 },
      tr: { x: 0.88, y: 0.10 },
      br: { x: 0.88, y: 0.86 },
      bl: { x: 0.12, y: 0.86 }
    },
    cameraAnchorLock: localStorage.getItem("smartomr_anchor_locked") === "true",
    cameraA4Mode: localStorage.getItem("smartomr_a4_mode") || "portrait", // "portrait" or "landscape"
    cameraA4Scale: parseFloat(localStorage.getItem("smartomr_a4_scale") || "0.82"),
    batchPendingFiles: [], // Danh sách các file/trang PDF đang chờ chấm trong hàng đợi
    batchItems: [], // Danh sách các bài đã chấm trong phiên hiện tại
    currentViewerItem: null,
    deferredPrompt: null,
    isOnline: navigator.onLine,
    pcBaseUrl: localStorage.getItem("smartomr_pc_url") || "",
    currentUser: null
  };

  // ---- Bộ nhớ ảnh bài thi (IndexedDB) — lưu ảnh gốc làm minh chứng, không giới hạn như localStorage ----
  const ImgStore = {
    _db: null,
    open() {
      if (this._db) return Promise.resolve(this._db);
      return new Promise((resolve) => {
        try {
          const req = indexedDB.open("smartomr_images", 1);
          req.onupgradeneeded = () => req.result.createObjectStore("img");
          req.onsuccess = () => { this._db = req.result; resolve(this._db); };
          req.onerror = () => resolve(null);
        } catch (e) { resolve(null); }
      });
    },
    async put(id, dataUrl) {
      const db = await this.open(); if (!db) return false;
      return new Promise((res) => { const tx = db.transaction("img", "readwrite"); tx.objectStore("img").put(dataUrl, id); tx.oncomplete = () => res(true); tx.onerror = () => res(false); });
    },
    async get(id) {
      const db = await this.open(); if (!db) return null;
      return new Promise((res) => { const rq = db.transaction("img").objectStore("img").get(id); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); });
    },
    async del(id) {
      const db = await this.open(); if (!db) return false;
      return new Promise((res) => { const tx = db.transaction("img", "readwrite"); tx.objectStore("img").delete(id); tx.oncomplete = () => res(true); tx.onerror = () => res(false); });
    },
    async clear() {
      const db = await this.open(); if (!db) return false;
      return new Promise((res) => { const tx = db.transaction("img", "readwrite"); tx.objectStore("img").clear(); tx.oncomplete = () => res(true); tx.onerror = () => res(false); });
    }
  };

  // ---- Mô hình bài chấm: lưu ĐÁP ÁN ĐỌC ĐƯỢC (reads) để duyệt, sửa, tính lại điểm bất cứ lúc nào ----
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function keyFor(made) {
    const found = SmartScoring.findKey(state.answerKeys, made);
    if (found) return { key: found.key, madeKey: found.madeKey, matched: true };
    const fb = state.answerKeys[state.activeMade] || Object.values(state.answerKeys)[0] || DEFAULT_KEY_0101;
    return { key: fb, madeKey: fb.made || state.activeMade, matched: false };
  }

  function applyScoring(sub) {
    if (!sub.reads) return sub;
    const k = keyFor(sub.made);
    const res = SmartScoring.computeScore(sub.reads, k.key);
    sub.keyMatched = k.matched;
    sub.keyMade = k.madeKey;
    sub.result = res;
    sub.total_score = res.total_score;
    sub.max_possible_score = res.max_possible_score;
    sub.part1_summary = res.part1_summary;
    sub.part2_summary = res.part2_summary;
    sub.part3_summary = res.part3_summary;
    const st = SmartScoring.findStudent(state.students, sub.sbd);
    sub.student_name = st ? st.full_name : "Chưa khớp danh sách";
    sub.student_class = st ? (st.class_name || "-") : "-";
    sub.student_dob = st ? (st.dob || "") : "";
    sub.issues = SmartScoring.collectIssues(sub, { keys: state.answerKeys, students: state.students, submissions: state.submissions });
    sub.level = SmartScoring.worstLevel(sub.issues);
    return sub;
  }

  function recalcAll() {
    state.submissions.forEach((s) => { if (s.reads) applyScoring(s); });
    if (window.SmartPro && window.SmartPro.onDataChanged) window.SmartPro.onDataChanged();
  }

  function serializeSubs() {
    return state.submissions.map((s) => {
      const c = Object.assign({}, s);
      delete c.result; delete c.issues; delete c.level;
      return c;
    });
  }

  let lastDataSig = null;
  function dataSignature() {
    return JSON.stringify(state.answerKeys) + "|" + JSON.stringify(state.students.map((x) => [x.sbd, x.full_name, x.class_name]));
  }

  // Lưu state vào LocalStorage (đồng thời TỰ ĐỘNG TÍNH LẠI điểm khi đáp án / danh sách lớp thay đổi)
  function persistState() {
    const sig = dataSignature();
    if (lastDataSig !== null && sig !== lastDataSig) recalcAll();
    lastDataSig = sig;
    localStorage.setItem("smartomr_session_name", state.sessionName);
    localStorage.setItem("smartomr_keys", JSON.stringify(state.answerKeys));
    localStorage.setItem("smartomr_students", JSON.stringify(state.students));
    try { localStorage.setItem("smartomr_submissions", JSON.stringify(serializeSubs())); } catch (e) { console.warn("Hết dung lượng localStorage", e); }
    localStorage.setItem("smartomr_gemini_key", state.geminiKey);
    localStorage.setItem("smartomr_gemini_model", state.geminiModel);
    localStorage.setItem("smartomr_auto_gemini", state.autoGemini ? "true" : "false");
    localStorage.setItem("smartomr_auto_download_cam", state.autoDownloadGradedCam ? "true" : "false");
    localStorage.setItem("smartomr_pc_url", state.pcBaseUrl);
    localStorage.setItem("smartomr_camera_anchors", JSON.stringify(state.cameraAnchors));
    localStorage.setItem("smartomr_anchor_locked", state.cameraAnchorLock ? "true" : "false");
    localStorage.setItem("smartomr_a4_mode", state.cameraA4Mode);
    localStorage.setItem("smartomr_a4_scale", state.cameraA4Scale.toString());
    if (window.SmartPro && window.SmartPro.onPersist) window.SmartPro.onPersist();
  }

  // Khởi tạo lại điểm cho các bài đã lưu từ phiên trước
  state.submissions.forEach((s) => { if (s.reads) applyScoring(s); });
  lastDataSig = dataSignature();

  // Tiện ích tải file ảnh xuống thiết bị di động
  function downloadImageFile(dataUrl, filename) {
    if (!dataUrl) return;
    try {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename || `Phieu_Cham_${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.warn("[Download Error]:", e);
    }
  }

  // =========================================================================
  // 2. KHỞI CHẠY PWA & SERVICE WORKER
  // =========================================================================
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").then((reg) => {
        console.log("[PWA] Service Worker đã đăng ký thành công!");
      }).catch((err) => {
        console.warn("[PWA] Lỗi đăng ký Service Worker:", err);
      });
    });
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    const btnQuick = document.getElementById("btn-quick-pwa-install");
    const banner = document.getElementById("pwa-install-banner");
    if (btnQuick) btnQuick.style.display = "inline-flex";
    if (banner && !sessionStorage.getItem("pwa_banner_dismissed")) {
      banner.style.display = "flex";
    }
  });

  function triggerPwaInstall() {
    if (state.deferredPrompt) {
      state.deferredPrompt.prompt();
      state.deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === "accepted") {
          console.log("[PWA] Thầy đã cài đặt ứng dụng vào màn hình chính!");
        }
        state.deferredPrompt = null;
        const banner = document.getElementById("pwa-install-banner");
        if (banner) banner.style.display = "none";
      });
    } else {
      alert("Để cài SmartOMR Pro vào màn hình chính:\n• Trên Chrome Android: Bấm dấu 3 chấm góc phải trên -> Chọn 'Cài đặt ứng dụng' hoặc 'Thêm vào Màn hình chính'.\n• Trên Safari iOS: Bấm nút Chia sẻ (hình vuông mũi tên) -> Chọn 'Thêm vào Màn hình chính' (Add to Home Screen).");
    }
  }

  // Cập nhật trạng thái mạng Online / Offline
  function updateNetworkStatus() {
    state.isOnline = navigator.onLine;
    const badge = document.getElementById("net-status-badge");
    if (!badge) return;
    const dot = badge.querySelector(".status-dot");
    const txt = badge.querySelector(".status-text");
    if (state.isOnline) {
      dot.className = "status-dot online";
      txt.textContent = state.pcBaseUrl ? "Đã nối PC" : "Online";
    } else {
      dot.className = "status-dot offline";
      txt.textContent = "Offline";
    }
  }

  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);

  // =========================================================================
  // 3. ĐIỀU HƯỚNG TABS (BOTTOM NAVIGATION BAR)
  // =========================================================================
  function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });
    document.querySelectorAll(".tab-view").forEach((view) => {
      view.classList.toggle("active", view.id === tabId);
    });

    // Bật/tắt camera tự động khi chuyển tab
    if (tabId === "tab-camera") {
      startCamera();
      setTimeout(() => renderCornerOverlay(), 120);
    } else {
      stopCamera();
    }

    if (tabId === "tab-batch") {
      renderBatchCards();
    } else if (tabId === "tab-keys") {
      renderKeysManager();
      if (window.SmartPro) window.SmartPro.refreshKeyTools();
    } else if (tabId === "tab-students") {
      renderStudentsList();
      renderGradebook();
    } else if (tabId === "tab-settings") {
      renderSettingsTab();
      if (window.SmartPro) window.SmartPro.refreshSyncCard();
    } else if (tabId === "tab-results" && window.SmartPro) {
      window.SmartPro.refresh();
    }
    if (tabId !== "tab-camera" && window.SmartPro && window.SmartPro.stopAuto) window.SmartPro.stopAuto();
  }

  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // =========================================================================
  // 4. QUẢN LÝ CAMERA (TAB 1)
  // =========================================================================
  async function startCamera() {
    stopCamera();
    const video = document.getElementById("camera-stream");
    if (!video) return;

    try {
      const constraints = {
        video: {
          facingMode: { ideal: state.cameraFacing },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      state.cameraStream = stream;
      video.srcObject = stream;
      await video.play();
      setTimeout(() => renderCornerOverlay(), 100);
    } catch (err) {
      console.warn("[Camera] Không thể mở camera trực tiếp:", err);
      const hint = document.getElementById("camera-guide-hint");
      if (hint) {
        hint.textContent = "Không mở được camera trực tiếp. Thầy có thể bấm '🖼️ Thư Viện' để chọn ảnh chụp!";
      }
    }
  }

  function stopCamera() {
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach((t) => t.stop());
      state.cameraStream = null;
    }
  }

  async function toggleCameraFacing() {
    state.cameraFacing = state.cameraFacing === "environment" ? "user" : "environment";
    await startCamera();
  }

  async function toggleCameraTorch() {
    if (!state.cameraStream) return;
    const track = state.cameraStream.getVideoTracks()[0];
    if (!track) return;

    try {
      state.cameraTorch = !state.cameraTorch;
      await track.applyConstraints({
        advanced: [{ torch: state.cameraTorch }]
      });
      const btn = document.getElementById("btn-toggle-torch");
      if (btn) btn.textContent = state.cameraTorch ? "🔦 Tắt Flash" : "🔦 Flash";
    } catch (e) {
      alert("Thiết bị hoặc trình duyệt không hỗ trợ điều khiển đèn Flash.");
    }
  }

  // =========================================================================
  // 4B. QUẢN LÝ 4 ĐIỂM NEO GÓC KHỔ GIẤY A4 LINH HOẠT & NẮN PHỐI CẢNH
  // =========================================================================
  function initCameraCornerOverlay() {
    const btnPortrait = document.getElementById("btn-a4-portrait");
    const btnLandscape = document.getElementById("btn-a4-landscape");
    const btnSizeDec = document.getElementById("btn-a4-size-dec");
    const btnSizeInc = document.getElementById("btn-a4-size-inc");
    const btnToggleLock = document.getElementById("btn-toggle-anchor-lock");
    const btnReset = document.getElementById("btn-reset-anchors");

    btnPortrait?.addEventListener("click", () => setA4Mode("portrait"));
    btnLandscape?.addEventListener("click", () => setA4Mode("landscape"));
    btnSizeDec?.addEventListener("click", () => adjustA4Scale(-0.04));
    btnSizeInc?.addEventListener("click", () => adjustA4Scale(+0.04));
    btnToggleLock?.addEventListener("click", toggleAnchorLock);
    btnReset?.addEventListener("click", () => resetToDefaultA4());

    // Gắn sự kiện kéo chạm cảm ứng cho 4 điểm neo
    const handleIds = ["anchor-tl", "anchor-tr", "anchor-br", "anchor-bl"];
    handleIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const cornerKey = el.getAttribute("data-corner");
      let isDragging = false;

      el.addEventListener("pointerdown", (e) => {
        if (state.cameraAnchorLock) return;
        isDragging = true;
        el.classList.add("dragging");
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
        e.stopPropagation();
        e.preventDefault();
      });

      el.addEventListener("pointermove", (e) => {
        if (!isDragging) return;
        const layer = document.getElementById("corner-overlay-layer");
        if (!layer) return;
        const rect = layer.getBoundingClientRect();
        const normX = Math.max(0.02, Math.min(0.98, (e.clientX - rect.left) / rect.width));
        const normY = Math.max(0.02, Math.min(0.98, (e.clientY - rect.top) / rect.height));

        state.cameraAnchors[cornerKey] = { x: normX, y: normY };
        renderCornerOverlay();
      });

      const stopDrag = (e) => {
        if (!isDragging) return;
        isDragging = false;
        el.classList.remove("dragging");
        try { el.releasePointerCapture(e.pointerId); } catch (_) {}
        persistState();
      };

      el.addEventListener("pointerup", stopDrag);
      el.addEventListener("pointercancel", stopDrag);
    });

    // Gắn sự kiện kéo cả khung (Pan)
    const panArea = document.getElementById("anchor-pan-area");
    if (panArea) {
      let isPanning = false;
      let startX = 0, startY = 0;
      let startAnchors = null;

      panArea.addEventListener("pointerdown", (e) => {
        if (state.cameraAnchorLock) return;
        isPanning = true;
        try { panArea.setPointerCapture(e.pointerId); } catch (_) {}
        startX = e.clientX;
        startY = e.clientY;
        startAnchors = JSON.parse(JSON.stringify(state.cameraAnchors));
        e.stopPropagation();
        e.preventDefault();
      });

      panArea.addEventListener("pointermove", (e) => {
        if (!isPanning || !startAnchors) return;
        const layer = document.getElementById("corner-overlay-layer");
        if (!layer) return;
        const rect = layer.getBoundingClientRect();
        const deltaX = (e.clientX - startX) / rect.width;
        const deltaY = (e.clientY - startY) / rect.height;

        const keys = ["tl", "tr", "br", "bl"];
        let canMove = true;
        for (const k of keys) {
          const nx = startAnchors[k].x + deltaX;
          const ny = startAnchors[k].y + deltaY;
          if (nx < 0.02 || nx > 0.98 || ny < 0.02 || ny > 0.98) {
            canMove = false;
            break;
          }
        }
        if (canMove) {
          for (const k of keys) {
            state.cameraAnchors[k].x = startAnchors[k].x + deltaX;
            state.cameraAnchors[k].y = startAnchors[k].y + deltaY;
          }
          renderCornerOverlay();
        }
      });

      const stopPan = (e) => {
        if (!isPanning) return;
        isPanning = false;
        try { panArea.releasePointerCapture(e.pointerId); } catch (_) {}
        persistState();
      };

      panArea.addEventListener("pointerup", stopPan);
      panArea.addEventListener("pointercancel", stopPan);
    }

    updateLockUI();
    updateA4ToolbarUI();
    renderCornerOverlay();

    const layer = document.getElementById("corner-overlay-layer");
    if (layer && window.ResizeObserver) {
      new ResizeObserver(() => renderCornerOverlay()).observe(layer);
    }
  }

  function setA4Mode(mode) {
    state.cameraA4Mode = mode;
    resetToDefaultA4();
  }

  function adjustA4Scale(delta) {
    let newScale = Math.max(0.48, Math.min(0.96, state.cameraA4Scale + delta));
    newScale = Math.round(newScale * 100) / 100;
    
    const keys = ["tl", "tr", "br", "bl"];
    const cx = keys.reduce((s, k) => s + state.cameraAnchors[k].x, 0) / 4;
    const cy = keys.reduce((s, k) => s + state.cameraAnchors[k].y, 0) / 4;
    const ratio = newScale / state.cameraA4Scale;

    let valid = true;
    const temp = {};
    for (const k of keys) {
      const nx = cx + (state.cameraAnchors[k].x - cx) * ratio;
      const ny = cy + (state.cameraAnchors[k].y - cy) * ratio;
      if (nx < 0.02 || nx > 0.98 || ny < 0.02 || ny > 0.98) {
        valid = false;
        break;
      }
      temp[k] = { x: nx, y: ny };
    }

    if (valid) {
      state.cameraA4Scale = newScale;
      state.cameraAnchors = temp;
      updateA4ToolbarUI();
      renderCornerOverlay();
      persistState();
    }
  }

  function resetToDefaultA4() {
    const layer = document.getElementById("corner-overlay-layer");
    const rect = layer ? layer.getBoundingClientRect() : { width: 360, height: 600 };
    const W = rect.width || 360;
    const H = rect.height || 600;

    const a4Ratio = 1 / 1.4142; // Tỷ lệ rộng / cao khổ A4 đứng (~0.707)
    let targetW, targetH;

    if (state.cameraA4Mode === "landscape") {
      targetH = H * state.cameraA4Scale * 0.72;
      targetW = targetH / a4Ratio;
      if (targetW > W * 0.94) {
        targetW = W * 0.94;
        targetH = targetW * a4Ratio;
      }
    } else {
      // Portrait
      targetW = W * state.cameraA4Scale;
      targetH = targetW / a4Ratio;
      if (targetH > H * 0.88) {
        targetH = H * 0.88;
        targetW = targetH * a4Ratio;
      }
    }

    const x0 = (W - targetW) / 2;
    const y0 = (H - targetH) / 2;

    state.cameraAnchors = {
      tl: { x: x0 / W, y: y0 / H },
      tr: { x: (x0 + targetW) / W, y: y0 / H },
      br: { x: (x0 + targetW) / W, y: (y0 + targetH) / H },
      bl: { x: x0 / W, y: (y0 + targetH) / H }
    };

    updateA4ToolbarUI();
    renderCornerOverlay();
    persistState();
  }

  function toggleAnchorLock() {
    state.cameraAnchorLock = !state.cameraAnchorLock;
    updateLockUI();
    persistState();
  }

  function updateLockUI() {
    const btn = document.getElementById("btn-toggle-anchor-lock");
    const icon = document.getElementById("anchor-lock-icon");
    const txt = document.getElementById("anchor-lock-text");
    const poly = document.getElementById("svg-corner-poly");
    const panArea = document.getElementById("anchor-pan-area");
    const hint = document.getElementById("camera-guide-hint");

    const handles = ["anchor-tl", "anchor-tr", "anchor-br", "anchor-bl"].map(id => document.getElementById(id));

    if (state.cameraAnchorLock) {
      if (btn) {
        btn.className = "a4-btn a4-btn-toggle mode-locked";
        if (icon) icon.textContent = "🔒";
        if (txt) txt.textContent = "Đã Khóa";
      }
      if (poly) poly.classList.add("locked");
      if (panArea) panArea.classList.add("locked");
      handles.forEach(h => h?.classList.add("locked"));
      if (hint) hint.textContent = "🔒 Đã khóa 4 góc. Nhắm phiếu vừa khung rồi bấm nút chụp!";
    } else {
      if (btn) {
        btn.className = "a4-btn a4-btn-toggle mode-editing";
        if (icon) icon.textContent = "✏️";
        if (txt) txt.textContent = "Chỉnh Góc";
      }
      if (poly) poly.classList.remove("locked");
      if (panArea) panArea.classList.remove("locked");
      handles.forEach(h => h?.classList.remove("locked"));
      if (hint) hint.textContent = "📐 Chạm & Kéo 4 điểm xanh bằng ngón tay để khớp 4 góc phiếu A4";
    }
  }

  function updateA4ToolbarUI() {
    const btnP = document.getElementById("btn-a4-portrait");
    const btnL = document.getElementById("btn-a4-landscape");
    const txtScale = document.getElementById("a4-size-text");

    if (btnP) btnP.className = state.cameraA4Mode === "portrait" ? "a4-btn active" : "a4-btn";
    if (btnL) btnL.className = state.cameraA4Mode === "landscape" ? "a4-btn active" : "a4-btn";
    if (txtScale) txtScale.textContent = Math.round(state.cameraA4Scale * 100) + "%";
  }

  function renderCornerOverlay() {
    const layer = document.getElementById("corner-overlay-layer");
    if (!layer) return;
    const W = layer.clientWidth;
    const H = layer.clientHeight;
    if (!W || !H) return;

    const { tl, tr, br, bl } = state.cameraAnchors;

    const pTL = { x: tl.x * W, y: tl.y * H };
    const pTR = { x: tr.x * W, y: tr.y * H };
    const pBR = { x: br.x * W, y: br.y * H };
    const pBL = { x: bl.x * W, y: bl.y * H };

    const hTL = document.getElementById("anchor-tl");
    const hTR = document.getElementById("anchor-tr");
    const hBR = document.getElementById("anchor-br");
    const hBL = document.getElementById("anchor-bl");

    if (hTL) { hTL.style.left = pTL.x + "px"; hTL.style.top = pTL.y + "px"; }
    if (hTR) { hTR.style.left = pTR.x + "px"; hTR.style.top = pTR.y + "px"; }
    if (hBR) { hBR.style.left = pBR.x + "px"; hBR.style.top = pBR.y + "px"; }
    if (hBL) { hBL.style.left = pBL.x + "px"; hBL.style.top = pBL.y + "px"; }

    const poly = document.getElementById("svg-corner-poly");
    const maskPoly = document.getElementById("svg-mask-polygon");
    const ptsStr = `${pTL.x.toFixed(1)},${pTL.y.toFixed(1)} ${pTR.x.toFixed(1)},${pTR.y.toFixed(1)} ${pBR.x.toFixed(1)},${pBR.y.toFixed(1)} ${pBL.x.toFixed(1)},${pBL.y.toFixed(1)}`;

    if (poly) poly.setAttribute("points", ptsStr);
    if (maskPoly) maskPoly.setAttribute("points", ptsStr);

    const d1 = document.getElementById("svg-diag-1");
    const d2 = document.getElementById("svg-diag-2");
    if (d1) {
      d1.setAttribute("x1", pTL.x); d1.setAttribute("y1", pTL.y);
      d1.setAttribute("x2", pBR.x); d1.setAttribute("y2", pBR.y);
    }
    if (d2) {
      d2.setAttribute("x1", pTR.x); d2.setAttribute("y1", pTR.y);
      d2.setAttribute("x2", pBL.x); d2.setAttribute("y2", pBL.y);
    }

    const panArea = document.getElementById("anchor-pan-area");
    if (panArea) {
      const minX = Math.min(pTL.x, pTR.x, pBR.x, pBL.x);
      const maxX = Math.max(pTL.x, pTR.x, pBR.x, pBL.x);
      const minY = Math.min(pTL.y, pTR.y, pBR.y, pBL.y);
      const maxY = Math.max(pTL.y, pTR.y, pBR.y, pBL.y);
      const padW = (maxX - minX) * 0.22;
      const padH = (maxY - minY) * 0.22;

      panArea.style.left = (minX + padW) + "px";
      panArea.style.top = (minY + padH) + "px";
      panArea.style.width = Math.max(40, (maxX - minX - padW * 2)) + "px";
      panArea.style.height = Math.max(40, (maxY - minY - padH * 2)) + "px";
    }
  }

  function getRealVideoCornerCoordinates() {
    const video = document.getElementById("camera-stream");
    const layer = document.getElementById("corner-overlay-layer");
    if (!video || !layer) return null;

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const bw = layer.clientWidth || 360;
    const bh = layer.clientHeight || 640;

    const scale = Math.max(bw / vw, bh / vh);
    const renderedW = vw * scale;
    const renderedH = vh * scale;
    const offsetX = (bw - renderedW) / 2;
    const offsetY = (bh - renderedH) / 2;

    const toVideo = (pt) => {
      const pxX = pt.x * bw;
      const pxY = pt.y * bh;
      const vidX = Math.round(Math.max(0, Math.min(vw, (pxX - offsetX) / scale)));
      const vidY = Math.round(Math.max(0, Math.min(vh, (pxY - offsetY) / scale)));
      return [vidX, vidY];
    };

    const { tl, tr, br, bl } = state.cameraAnchors;
    return [
      toVideo(tl),
      toVideo(tr),
      toVideo(br),
      toVideo(bl)
    ];
  }

  // Nắn phẳng phối cảnh ảnh theo 4 góc tứ giác thành hình chữ nhật A4 chuẩn
  function warpQuadrilateralCanvas(srcCanvas, corners, dstW = 1200, dstH = 1697) {
    if (!corners || corners.length !== 4) return srcCanvas;
    const [p0, p1, p2, p3] = corners; // TL, TR, BR, BL

    const outCanvas = document.createElement("canvas");
    outCanvas.width = dstW;
    outCanvas.height = dstH;
    const ctx = outCanvas.getContext("2d", { willReadFrequently: true });

    function drawAffineTriangle(s0, s1, s2, d0, d1, d2) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(d0[0], d0[1]);
      ctx.lineTo(d1[0], d1[1]);
      ctx.lineTo(d2[0], d2[1]);
      ctx.closePath();
      ctx.clip();

      const denom = (s0[0] * (s1[1] - s2[1]) + s1[0] * (s2[1] - s0[1]) + s2[0] * (s0[1] - s1[1]));
      if (Math.abs(denom) < 1e-6) {
        ctx.restore();
        return;
      }

      const m11 = -(s0[1] * (d1[0] - d2[0]) + s1[1] * (d2[0] - d0[0]) + s2[1] * (d0[0] - d1[0])) / denom;
      const m12 = (s0[1] * (d1[1] - d2[1]) + s1[1] * (d2[1] - d0[1]) + s2[1] * (d0[1] - d1[1])) / denom;
      const m21 = (s0[0] * (d1[0] - d2[0]) + s1[0] * (d2[0] - d0[0]) + s2[0] * (d0[0] - d1[0])) / denom;
      const m22 = -(s0[0] * (d1[1] - d2[1]) + s1[0] * (d2[1] - d0[1]) + s2[0] * (d0[1] - d1[1])) / denom;
      const dx = (s0[0] * (s1[1] * d2[0] - s2[1] * d1[0]) + s0[1] * (s2[0] * d1[0] - s1[0] * d2[0]) + (s1[0] * s2[1] - s2[0] * s1[1]) * d0[0]) / denom;
      const dy = (s0[0] * (s1[1] * d2[1] - s2[1] * d1[1]) + s0[1] * (s2[0] * d1[1] - s1[0] * d2[1]) + (s1[0] * s2[1] - s2[0] * s1[1]) * d0[1]) / denom;

      ctx.transform(m11, m12, m21, m22, dx, dy);
      ctx.drawImage(srcCanvas, 0, 0);
      ctx.restore();
    }

    // Tam giác 1: TL - TR - BL
    drawAffineTriangle(p0, p1, p3, [0, 0], [dstW, 0], [0, dstH]);
    // Tam giác 2: TR - BR - BL
    drawAffineTriangle(p1, p2, p3, [dstW, 0], [dstW, dstH], [0, dstH]);

    return outCanvas;
  }

  // Chụp khung hình từ camera và chấm bài
  async function captureAndGradeFromCamera() {
    const video = document.getElementById("camera-stream");
    const canvas = document.getElementById("camera-capture-canvas");
    if (!video || !canvas || video.readyState < 2) {
      alert("Camera chưa sẵn sàng!");
      return;
    }

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, vw, vh);

    const base64Data = canvas.toDataURL("image/jpeg", 0.90);
    const templateId = document.getElementById("cam-template-select").value || "thpt_2025";
    const useGemini = document.getElementById("chk-auto-gemini-cam").checked;

    const manualCorners = getRealVideoCornerCoordinates();
    let finalBase64 = base64Data;

    // Nắn thẳng phối cảnh dựa trên 4 điểm neo góc của thầy
    if (manualCorners && manualCorners.length === 4) {
      try {
        const warped = warpQuadrilateralCanvas(canvas, manualCorners, 1200, 1697);
        if (warped) {
          finalBase64 = warped.toDataURL("image/jpeg", 0.92);
        }
      } catch (warpErr) {
        console.warn("[Warp Canvas Error]:", warpErr);
      }
    }

    showShutterFlash();
    await processGradingRequest({
      base64Data: finalBase64,
      rawBase64: base64Data,
      manualCorners: manualCorners,
      templateId: templateId,
      useGemini: useGemini,
      sourceName: "Ảnh_Camera_" + new Date().toLocaleTimeString("vi-VN"),
      isCameraCapture: true
    });
  }

  function showShutterFlash() {
    const wrap = document.getElementById("viewfinder-wrapper");
    if (!wrap) return;
    const flash = document.createElement("div");
    flash.style.position = "absolute";
    flash.style.inset = "0";
    flash.style.backgroundColor = "white";
    flash.style.opacity = "0.8";
    flash.style.zIndex = "30";
    flash.style.transition = "opacity 0.25s ease-out";
    wrap.appendChild(flash);
    setTimeout(() => {
      flash.style.opacity = "0";
      setTimeout(() => flash.remove(), 250);
    }, 50);
  }

  // =========================================================================
  // 5. LÕI GỬI YÊU CẦU CHẤM BÀI (HỖ TRỢ BACKEND + GEMINI AI DIRECT)
  // =========================================================================
  function flagText(f) {
    const where = f.part === "I" ? `Câu ${f.q}` : f.part === "II" ? `Câu II.${f.q}${f.sub || ""}` : f.part === "III" ? `Câu III.${f.q}` : `${f.part} cột ${f.pos}`;
    const what = { multi: "tô nhiều ô", blank: "để trống", faint: "tô mờ", smudge: "có vết tẩy" }[f.type] || f.type;
    return `${where}: ${what}`;
  }

  // Tạo bài chấm mới từ đáp án đọc được
  function buildSubmission({ reads, sbd, made, flags, template, method, name }) {
    const sub = {
      id: newId(), name: name || `Phiếu_${state.submissions.length + 1}`, ts: Date.now(),
      timestamp: new Date().toLocaleString("vi-VN"),
      template: template || "", method: method || "", sbd: sbd || "", made: made || "",
      reads: reads, flags: flags || [], edited: false
    };
    return applyScoring(sub);
  }

  function gradeLegacyRecord(res, name) {
    // Kết quả từ máy chủ PC (định dạng cũ, không có đáp án đọc)
    return Object.assign({ id: res.id || newId(), name: name, ts: Date.now(), timestamp: new Date().toLocaleString("vi-VN"), flags: [], issues: [], level: "ok", method: "Máy chủ PC" }, res);
  }

  async function processGradingRequest({ base64Data, rawBase64, manualCorners, templateId, useGemini, sourceName, isCameraCapture, silent }) {
    const activeKey = state.answerKeys[state.activeMade] || Object.values(state.answerKeys)[0] || DEFAULT_KEY_0101;
    const scoringCfg = activeKey.scoring_config || DEFAULT_STRUCTURE;
    const forcedTemplate = window.SmartOMREngine && window.SmartOMREngine.LAYOUTS[templateId] ? templateId : "auto";

    let sub = null;
    let gradedImage = null;
    let originalImage = rawBase64 || base64Data;
    let localFail = "";

    // Ưu tiên 1 (tuỳ chọn): máy chủ PC — chỉ khi đã cấu hình địa chỉ máy chủ
    if (state.pcBaseUrl) {
      try {
        const payload = { image_base64: base64Data, template_id: templateId, override_made: state.activeMade, save_to_history: true, use_gemini_ai: Boolean(useGemini && state.geminiKey), gemini_api_key: state.geminiKey, gemini_model: state.geminiModel, scoring_config: scoringCfg, manual_corners: manualCorners };
        const resp = await fetch(state.pcBaseUrl.replace(/\/$/, "") + "/api/grade-base64", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (resp.ok) {
          const data = await resp.json();
          sub = gradeLegacyRecord(data.result, sourceName);
          gradedImage = data.graded_image;
          originalImage = data.original_image || base64Data;
        }
      } catch (err) {
        console.log("[Grade] Không kết nối được máy chủ PC, dùng bộ nhận diện trên thiết bị...");
      }
    }

    // Ưu tiên 2: Bộ nhận diện nội bộ (offline, trên thiết bị)
    if (!sub) {
      const local = await readSheetLocally([base64Data, rawBase64], { template: forcedTemplate });
      if (local.ok) {
        const extra = local.markers.extra ? ` + ${local.markers.extra} ô phụ` : "";
        sub = buildSubmission({
          reads: { part1: local.data.part1, part2: local.data.part2, part3: local.data.part3 },
          sbd: local.data.sbd, made: local.data.made, flags: local.flags, template: local.template,
          method: `OMR trên thiết bị — ${local.templateName} (4 góc${extra})`, name: sourceName
        });
        const jpeg = local.canvas.toDataURL("image/jpeg", 0.82);
        sub.H = local.H; sub.imgW = local.canvas.width; sub.imgH = local.canvas.height; sub.hasImage = true;
        await ImgStore.put(sub.id, jpeg);
        try { gradedImage = drawOverlay(sub, local.canvas); } catch (ovErr) { console.warn("[Overlay]", ovErr); gradedImage = jpeg; }
        originalImage = jpeg;
      } else {
        localFail = local.reason;
      }
    }

    // Ưu tiên 3: Gemini Vision (chỉ khi phiếu mờ/không bắt được định vị và có API key)
    if (!sub && state.geminiKey) {
      try {
        const ai = await callGeminiVisionDirect(base64Data, templateId, scoringCfg);
        const reads = { part1: ai.part1 || {}, part2: ai.part2 || {}, part3: ai.part3 || {} };
        sub = buildSubmission({ reads: reads, sbd: String(ai.sbd || ""), made: String(ai.made || ""), flags: [], template: "gemini", method: "Gemini Vision AI", name: sourceName });
        sub.hasImage = true;
        await ImgStore.put(sub.id, base64Data);
        gradedImage = base64Data;
      } catch (gemErr) {
        console.warn("[Gemini Direct Error]:", gemErr);
      }
    }

    // Không đọc được: báo lỗi rõ ràng, KHÔNG chấm điểm giả
    if (!sub) {
      const msg = localFail || "Không đọc được phiếu.";
      if (isCameraCapture && !silent) alert("⚠️ Không chấm được phiếu này.\n\n" + msg);
      console.warn("[Grade] Thất bại:", sourceName, msg);
      return { error: msg, name: sourceName };
    }

    const batchItem = {
      id: sub.id,
      name: sub.name,
      result: sub,
      graded_bgr: gradedImage,
      orig_bgr: originalImage,
      timestamp: new Date().toLocaleTimeString("vi-VN")
    };

    state.batchItems.unshift(batchItem);
    state.submissions.unshift(sub);
    persistState();

    if (isCameraCapture) {
      displayCameraResultSheet(batchItem);
      const autoDlCheckbox = document.getElementById("chk-auto-download-cam");
      const shouldAutoDl = autoDlCheckbox ? autoDlCheckbox.checked : state.autoDownloadGradedCam;
      if (shouldAutoDl && !silent) {
        setTimeout(() => {
          downloadImageFile(batchItem.graded_bgr || batchItem.orig_bgr, `Phieu_Cham_SBD_${sub.sbd}_Made_${sub.made}_${sub.total_score}d.jpg`);
        }, 300);
      }
    }
    if (window.SmartPro && window.SmartPro.onNewSubmission) window.SmartPro.onNewSubmission(sub);
    return batchItem;
  }

  // Hiển thị Bottom Sheet kết quả trên Camera
  function displayCameraResultSheet(item) {
    const sheet = document.getElementById("camera-result-sheet");
    if (!sheet) return;

    state.currentViewerItem = item;
    const res = item.result;
    document.getElementById("cam-res-score").textContent = res.total_score.toFixed(2);
    document.getElementById("cam-res-max").textContent = `/ ${(res.max_possible_score || 10.0).toFixed(1)}`;
    document.getElementById("cam-res-name").textContent = res.student_name;
    document.getElementById("cam-res-sbd").textContent = res.sbd;
    document.getElementById("cam-res-made").textContent = res.made;
    document.getElementById("cam-res-class").textContent = res.student_class;

    const p1 = res.part1_summary || {};
    const p2 = res.part2_summary || {};
    const p3 = res.part3_summary || {};

    document.getElementById("cam-chip-p1").textContent = p1.enabled ? `P.I: ${p1.correct || 0}/${p1.total_questions} (${(p1.score || 0).toFixed(2)}đ)` : "P.I: Tắt";
    document.getElementById("cam-chip-p2").textContent = p2.enabled ? `P.II: ${p2.total_sub_correct || 0} ý (${(p2.score || 0).toFixed(2)}đ)` : "P.II: Tắt";
    document.getElementById("cam-chip-p3").textContent = p3.enabled ? `P.III: ${p3.correct || 0} câu (${(p3.score || 0).toFixed(2)}đ)` : "P.III: Tắt";

    const alignEl = document.getElementById("cam-res-align");
    if (alignEl) {
      const errs = (res.issues || []).filter((i) => i.level !== "info");
      alignEl.textContent = (errs.length ? "⚠️ " + errs.map((i) => i.text).slice(0, 2).join(" · ") : "✅ " + (res.method || "Đã nhận diện"));
    }
    sheet.style.display = "block";
  }

  // Tra đáp án theo mã đề đọc được (chấp nhận "0101" / "101" / "101" có số 0 đầu)
  function findAnswerKey(madeRaw) {
    const m = String(madeRaw || "").trim();
    if (!m || m.includes("?")) return null;
    const strip = (v) => String(v).replace(/^0+/, "");
    for (const k of Object.keys(state.answerKeys)) {
      if (k === m || strip(k) === strip(m)) return { madeKey: k, key: state.answerKeys[k] };
    }
    return null;
  }

  // =========================================================================
  // 5b. NHẬN DIỆN PHIẾU NỘI BỘ (KHÔNG CẦN SERVER / KHÔNG CẦN INTERNET)
  // =========================================================================
  function loadImageToCanvas(dataUrl, maxDim) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c);
      };
      img.onerror = () => reject(new Error("Không đọc được ảnh"));
      img.src = dataUrl;
    });
  }

  // Thử đọc phiếu bằng bộ nhận diện nội bộ trên lần lượt các ảnh (ảnh đã nắn, ảnh gốc)
  async function readSheetLocally(dataUrls, opts) {
    if (!window.SmartOMREngine) return { ok: false, reason: "Chưa tải được bộ nhận diện (omr-engine.js)." };
    let lastReason = "";
    for (const url of dataUrls) {
      if (!url) continue;
      try {
        const canvas = await loadImageToCanvas(url, 1800);
        const ctx = canvas.getContext("2d");
        const res = window.SmartOMREngine.readFromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height), opts);
        if (res.ok) { res.canvas = canvas; return res; }
        lastReason = res.reason;
      } catch (e) {
        lastReason = String(e.message || e);
      }
    }
    return { ok: false, reason: lastReason || "Không đọc được ảnh phiếu." };
  }

  // Vẽ kết quả chấm lên ảnh (minh chứng): xanh = đúng, đỏ = sai, khoanh xanh = đáp án đúng, cam = cần xem lại
  function drawOverlay(sub, srcCanvas, opts) {
    opts = opts || {};
    const E = window.SmartOMREngine;
    const LY = E.LAYOUTS[sub.template];
    const out = document.createElement("canvas");
    out.width = srcCanvas.width; out.height = srcCanvas.height;
    const ctx = out.getContext("2d");
    ctx.drawImage(srcCanvas, 0, 0);
    if (!LY || !sub.H) return opts.asCanvas ? out : out.toDataURL("image/jpeg", 0.88);
    const H = sub.H;
    const groups = {};
    LY.groups.forEach((g) => { groups[g.id] = g; });
    const det = (sub.result && sub.result.detail) || { p1: {}, p2: {}, p3: {} };
    const pos = (id, i) => {
      const g = groups[id]; if (!g || !g.pts[i]) return null;
      const p = g.pts[i]; const c = E.project(H, p[0], p[1]);
      return { x: c[0], y: c[1], r: (g.r || LY.r) * E.pxPerPt(H, p[0], p[1]) };
    };
    const ring = (id, i, color, fill, scale) => {
      const c = pos(id, i); if (!c) return;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r * (scale || (fill ? 0.95 : 1.3)), 0, Math.PI * 2);
      if (fill) { ctx.fillStyle = color; ctx.globalAlpha = 0.42; ctx.fill(); ctx.globalAlpha = 1; }
      ctx.lineWidth = Math.max(1.5, c.r * 0.28); ctx.strokeStyle = color; ctx.stroke();
    };
    const GREEN = "#16a34a", RED = "#dc2626", BLUE = "#2563eb", ORANGE = "#f59e0b", GRAY = "#6b7280";
    const reads = sub.reads || {};
    const cfg = (keyFor(sub.made).key.scoring_config) || {};
    const idx4 = { A: 0, B: 1, C: 2, D: 3 };

    // SBD & mã đề đã đọc (xanh dương)
    String(sub.sbd || "").split("").forEach((ch, i) => { if (/\d/.test(ch)) ring("sbd." + i, +ch, BLUE, true); });
    String(sub.made || "").split("").forEach((ch, i) => { if (/\d/.test(ch)) ring("made." + i, +ch, BLUE, true); });

    for (let q = 1; q <= (cfg.enable_part1 === false ? 0 : (cfg.part1_count == null ? 40 : cfg.part1_count)); q++) {
      const d = det.p1[q]; if (!d) continue;
      if (d.status === "void") continue;
      const ai = idx4[d.ans];
      if (d.status === "free") { if (ai !== undefined) ring("p1." + q, ai, GREEN, true); continue; }
      if (ai !== undefined && d.correct) ring("p1." + q, ai, GREEN, true);
      else { if (ai !== undefined) ring("p1." + q, ai, RED, true); if (idx4[d.key] !== undefined) ring("p1." + q, idx4[d.key], GREEN, false); }
    }
    for (let q = 1; q <= (cfg.enable_part2 === false ? 0 : (cfg.part2_count == null ? 8 : cfg.part2_count)); q++) {
      const d = det.p2[q]; if (!d || d.status === "void") continue;
      ["a", "b", "c", "d"].forEach((k) => {
        const a = String((reads.part2 && reads.part2[q] && reads.part2[q][k]) || "");
        if (!a) return;
        ring("p2." + q + "." + k, a === "Đ" ? 0 : 1, d.subs[k] ? GREEN : RED, true);
      });
    }
    for (let q = 1; q <= (cfg.enable_part3 === false ? 0 : (cfg.part3_count == null ? 6 : cfg.part3_count)); q++) {
      const d = det.p3[q]; if (!d || d.status === "void") continue;
      const ans = String((reads.part3 && reads.part3[q]) || "");
      const color = d.correct ? GREEN : RED;
      for (let c = 0; c < ans.length && c < 4; c++) {
        const ch = ans[c];
        if (ch === "-") ring("p3." + q + ".minus", 0, color, true);
        else if (ch === ",") ring("p3." + q + ".comma", c - 1, color, true);
        else ring("p3." + q + ".c" + c, parseInt(ch, 10), color, true);
      }
    }
    // Đánh dấu ô cần xem lại (cam)
    if (opts.showFlags) {
      (sub.flags || []).forEach((f) => {
        let id = null;
        if (f.part === "I") id = "p1." + f.q;
        else if (f.part === "II") id = "p2." + f.q + "." + f.sub;
        else if (f.part === "SBD") id = "sbd." + (f.pos - 1);
        else if (f.part === "Mã đề") id = "made." + (f.pos - 1);
        const g = id && groups[id];
        if (g) g.pts.forEach((_, i) => ring(id, i, ORANGE, false, 1.5));
      });
    }
    if (opts.highlight) opts.highlight.forEach((h) => ring(h.id, h.i, ORANGE, false, 1.7));

    // Dải thông tin minh chứng
    if (!opts.noBanner) {
      const bh = Math.max(34, Math.round(out.height * 0.032));
      ctx.fillStyle = "rgba(15,23,42,0.82)";
      ctx.fillRect(0, out.height - bh, out.width, bh);
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.round(bh * 0.5)}px sans-serif`;
      ctx.textBaseline = "middle";
      const txt = `${sub.student_name || ""} | SBD ${sub.sbd} | Đề ${sub.made} | ${sub.total_score}/${sub.max_possible_score} điểm | P.I ${sub.part1_summary.correct}/${sub.part1_summary.total_questions} · P.II ${sub.part2_summary.total_sub_correct} ý · P.III ${sub.part3_summary.correct}`;
      ctx.fillText(txt, 12, out.height - bh / 2);
    }
    return opts.asCanvas ? out : out.toDataURL("image/jpeg", 0.9);
  }

  // =========================================================================
  // 6. GỌI GEMINI VISION TRỰC TIẾP TỪ CLIENT (TỰ ĐỘNG DÒ MODEL TRÁNH 404)
  // =========================================================================
  async function callGeminiVisionDirect(base64Image, templateId, scoringCfg) {
    const cleanB64 = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;
    const apiKey = state.geminiKey;
    const modelCandidates = [
      state.geminiModel,
      "gemini-1.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash-latest",
      "gemini-1.5-pro",
      "gemini-2.0-flash-lite",
      "gemini-flash-latest"
    ].filter(Boolean);

    const p1Count = scoringCfg.enable_part1 ? scoringCfg.part1_count : 0;
    const p2Count = scoringCfg.enable_part2 ? scoringCfg.part2_count : 0;
    const p3Count = scoringCfg.enable_part3 ? scoringCfg.part3_count : 0;

    const promptText = `Bạn là hệ thống nhận diện phiếu trả lời trắc nghiệm (OMR) của Bộ GD&ĐT Việt Nam.
Hãy đọc kỹ SBD (8 số), Mã đề (4 số), Phần I (1-${p1Count}), Phần II (1-${p2Count} mỗi câu 4 ý a,b,c,d Đ hoặc S), Phần III (1-${p3Count}).
Trả về DUY NHẤT một chuỗi JSON hợp lệ dạng:
{
  "sbd": "012345",
  "made": "101",
  "part1": {"1": "A", "2": "B"},
  "part2": {"1": {"a": "Đ", "b": "S", "c": "Đ", "d": "S"}},
  "part3": {"1": "2025"}
}`;

    for (const model of modelCandidates) {
      if (!model) continue;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const bodyPayload = {
        contents: [
          {
            parts: [
              { text: promptText },
              { inline_data: { mime_type: "image/jpeg", data: cleanB64 } }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.0,
          responseMimeType: "application/json"
        }
      };

      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload)
        });

        if (resp.ok) {
          const data = await resp.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
          const aiJson = JSON.parse(rawText.replace(/^```json/, "").replace(/```$/, "").trim());

          return aiJson;
        }
      } catch (e) {
        continue;
      }
    }
    throw new Error("Không thể gọi Gemini AI với danh sách mô hình hiện tại.");
  }

  // =========================================================================
  // 7. CHẤM THEO LÔ TỪ THƯ VIỆN ẢNH & FILE PDF (TAB 2)
  // =========================================================================
  async function handleBatchFilesUpload(files) {
    if (!files || files.length === 0) return;
    state.batchPendingFiles = state.batchPendingFiles || [];

    const progCard = document.getElementById("batch-progress-card");
    const progText = document.getElementById("batch-progress-text");
    if (progCard) {
      progCard.style.display = "block";
      if (progText) progText.textContent = `Đang nạp ${files.length} tệp vào hàng chờ...`;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const lower = file.name.toLowerCase();

      // Nếu là tệp PDF (kể cả PDF nhiều trang)
      if (lower.endsWith(".pdf") || file.type === "application/pdf") {
        try {
          if (window.pdfjsLib) {
            const arrBuf = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrBuf }).promise;
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
              const page = await pdf.getPage(pageNum);
              const viewport = page.getViewport({ scale: 2.0 });
              const canvas = document.createElement("canvas");
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              const ctx = canvas.getContext("2d");
              await page.render({ canvasContext: ctx, viewport: viewport }).promise;
              const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
              state.batchPendingFiles.push({
                name: `${file.name.replace(/\.[^/.]+$/, "")}_Trang_${pageNum}.jpg`,
                dataUrl: dataUrl
              });
            }
          } else {
            console.warn("[PDF] Thư viện pdfjsLib chưa sẵn sàng, thử FileReader...");
            const b64 = await readFileAsBase64(file);
            state.batchPendingFiles.push({ name: file.name, dataUrl: b64 });
          }
        } catch (pdfErr) {
          console.warn("[PDF Extract Error]:", pdfErr);
        }
      } else {
        // Ảnh JPG, PNG, HEIC...
        const b64 = await readFileAsBase64(file);
        state.batchPendingFiles.push({
          name: file.name,
          dataUrl: b64
        });
      }
    }

    if (progCard) progCard.style.display = "none";
    renderBatchPendingQueue();
  }

  function renderBatchPendingQueue() {
    const box = document.getElementById("batch-pending-box");
    const countEl = document.getElementById("batch-pending-count");
    const btnCountEl = document.getElementById("btn-pending-count-label");
    const listEl = document.getElementById("batch-pending-list");
    if (!box || !countEl) return;

    const total = (state.batchPendingFiles || []).length;
    if (total === 0) {
      box.style.display = "none";
      return;
    }

    box.style.display = "block";
    countEl.textContent = total;
    if (btnCountEl) btnCountEl.textContent = total;
    if (listEl) {
      listEl.innerHTML = state.batchPendingFiles.map((item, idx) => `
        <div style="padding: 4px 0; border-bottom: 1px dotted #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
          <span>📄 <strong>${idx + 1}.</strong> ${item.name}</span>
          <span style="color:#16a34a; font-size:11.5px; font-weight:bold;">Sẵn sàng</span>
        </div>
      `).join("");
    }
  }

  async function runBatchGrading() {
    const queue = state.batchPendingFiles || [];
    if (queue.length === 0) {
      alert("Hàng chờ trống! Thầy vui lòng bấm '📂 Nạp File Phiếu (PDF, JPG, PNG)' trước khi thực hiện chấm.");
      return;
    }

    const progCard = document.getElementById("batch-progress-card");
    const progText = document.getElementById("batch-progress-text");
    const progBar = document.getElementById("batch-progress-bar");
    const progPercent = document.getElementById("batch-progress-percent");

    if (progCard) progCard.style.display = "block";
    const total = queue.length;
    const failed = [];

    for (let i = 0; i < total; i++) {
      const item = queue[i];
      if (progText) progText.textContent = `Đang chấm ${i + 1}/${total}: ${item.name}`;
      const pct = Math.round(((i + 1) / total) * 100);
      if (progBar) progBar.style.width = `${pct}%`;
      if (progPercent) progPercent.textContent = `${pct}%`;

      const gr = await processGradingRequest({
        base64Data: item.dataUrl,
        templateId: "thpt_2025",
        useGemini: state.autoGemini,
        sourceName: item.name,
        isCameraCapture: false
      });
      if (gr && gr.error) failed.push(`${item.name}: ${gr.error}`);
      renderBatchCards();
    }

    // Đã chấm xong
    state.batchPendingFiles = [];
    renderBatchPendingQueue();

    if (progText) progText.textContent = failed.length ? `⚠️ Chấm xong ${total - failed.length}/${total} bài, ${failed.length} bài không đọc được` : `✅ Đã chấm xong toàn bộ ${total} bài trong lô!`;
    if (failed.length) alert("⚠️ Có " + failed.length + " phiếu không đọc được (cần chụp/scan lại):\n\n" + failed.slice(0, 8).join("\n"));
    setTimeout(() => {
      if (progCard) progCard.style.display = "none";
    }, failed.length ? 8000 : 3500);
  }

  // Tải toàn bộ ảnh phiếu đã chấm thành tệp ZIP
  async function downloadAllBatchImagesZip() {
    if (!state.batchItems || state.batchItems.length === 0) {
      alert("Chưa có bài chấm nào trong danh sách để tải về!");
      return;
    }
    if (typeof JSZip === "undefined") {
      alert("Thư viện nén ZIP chưa sẵn sàng. Thầy vui lòng kiểm tra kết nối!");
      return;
    }
    const zip = new JSZip();
    let imgCount = 0;
    state.batchItems.forEach((item, idx) => {
      const res = item.result || {};
      const imgData = item.graded_bgr || item.orig_bgr;
      if (imgData && imgData.includes("base64,")) {
        const rawB64 = imgData.split("base64,")[1];
        const sbd = res.sbd || "NOSBD";
        const made = res.made || "NOMADE";
        const score = typeof res.total_score === "number" ? res.total_score.toFixed(2) : "0";
        const fname = `Phieu_${idx + 1}_SBD_${sbd}_Made_${made}_Diem_${score}.jpg`;
        zip.file(fname, rawB64, { base64: true });
        imgCount++;
      }
    });

    if (imgCount === 0) {
      alert("Không tìm thấy dữ liệu ảnh để nén ZIP!");
      return;
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Danh_Sach_Anh_Phieu_Cham_${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderBatchCards() {
    const container = document.getElementById("batch-items-container");
    const badge = document.getElementById("batch-count-badge");
    if (badge) badge.textContent = state.batchItems.length;
    if (!container) return;

    if (state.batchItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <div>Chưa có bài chấm nào trong phiên.</div>
          <div class="subtext">Hãy nạp file (PDF, JPG, PNG) hoặc mở tab Camera để quét phiếu thi!</div>
        </div>
      `;
      return;
    }

    container.innerHTML = state.batchItems.map((item, idx) => {
      const res = item.result;
      const score = typeof res.total_score === "number" ? res.total_score.toFixed(2) : "0.00";
      const maxSc = (res.max_possible_score || 10.0).toFixed(1);
      return `
        <div class="batch-card-item" data-idx="${idx}">
          <div class="item-left">
            <div class="item-num">#${state.batchItems.length - idx}</div>
            <div>
              <div class="item-st-title">${res.level === "error" ? "🔴" : res.level === "warn" ? "🟠" : "🟢"} ${res.student_name}</div>
              <div class="item-st-details">SBD: <strong>${res.sbd}</strong> | Đề: <strong>${res.made}</strong> | ${res.student_class} | ${item.timestamp}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="item-score-badge">${score} <span style="font-size:11px;color:#991b1b;">/ ${maxSc}</span></div>
            <button class="btn btn-sm btn-outline btn-dl-single" data-dl-idx="${idx}" title="Lưu ảnh bài chấm này về điện thoại">💾</button>
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".btn-dl-single").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.dlIdx, 10);
        const item = state.batchItems[idx];
        if (item) {
          const res = item.result;
          downloadImageFile(
            item.graded_bgr || item.orig_bgr,
            `Phieu_Cham_SBD_${res.sbd}_Made_${res.made}_${res.total_score}d.jpg`
          );
        }
      });
    });

    container.querySelectorAll(".batch-card-item").forEach((card) => {
      card.addEventListener("click", () => {
        const idx = parseInt(card.dataset.idx, 10);
        const it = state.batchItems[idx];
        if (window.SmartPro && it && it.result && it.result.reads) window.SmartPro.openReview(it.result.id);
        else openImageViewer(it);
      });
    });
  }

  // =========================================================================
  // 8. CẤU TRÚC ĐỀ & QUẢN LÝ MÃ ĐỀ (TAB 3)
  // =========================================================================
  function renderKeysManager() {
    const madeSelect = document.getElementById("key-made-select");
    if (!madeSelect) return;

    madeSelect.innerHTML = Object.keys(state.answerKeys).map((code) => {
      return `<option value="${code}" ${code === state.activeMade ? "selected" : ""}>Mã đề ${code}</option>`;
    }).join("");

    const curKey = state.answerKeys[state.activeMade] || DEFAULT_KEY_0101;
    const cfg = curKey.scoring_config || DEFAULT_STRUCTURE;

    // Load structure checkboxes
    document.getElementById("cfg-p1-enable").checked = cfg.enable_part1;
    document.getElementById("cfg-p1-count").value = cfg.part1_count;
    document.getElementById("cfg-p1-pts").value = cfg.part1_points_each;

    document.getElementById("cfg-p2-enable").checked = cfg.enable_part2;
    document.getElementById("cfg-p2-count").value = cfg.part2_count;
    document.getElementById("cfg-p2-pts").value = cfg.part2_max_points_each;

    document.getElementById("cfg-p3-enable").checked = cfg.enable_part3;
    document.getElementById("cfg-p3-count").value = cfg.part3_count;
    document.getElementById("cfg-p3-pts").value = cfg.part3_points_each;

    updateScoreSummaryBanner();

    // Render Part I (ABCD)
    const p1Grid = document.getElementById("grid-key-p1");
    if (p1Grid) {
      let p1Html = "";
      for (let q = 1; q <= cfg.part1_count; q++) {
        const curAns = (curKey.part1 && curKey.part1[q]) || "A";
        p1Html += `
          <div class="ans-card-cell">
            <span class="ans-q-label">C.${q}</span>
            <div class="ans-options-btns" data-q="${q}">
              ${["A", "B", "C", "D"].map((opt) => `
                <div class="ans-btn-circle ${opt === curAns ? "selected" : ""}" data-opt="${opt}">${opt}</div>
              `).join("")}
            </div>
          </div>
        `;
      }
      p1Grid.innerHTML = p1Html;

      p1Grid.querySelectorAll(".ans-btn-circle").forEach((btn) => {
        btn.addEventListener("click", () => {
          const parent = btn.closest(".ans-options-btns");
          const q = parent.dataset.q;
          const opt = btn.dataset.opt;
          parent.querySelectorAll(".ans-btn-circle").forEach((b) => b.classList.remove("selected"));
          btn.classList.add("selected");
          if (!curKey.part1) curKey.part1 = {};
          curKey.part1[q] = opt;
          persistState();
        });
      });
    }

    // Render Part II (Đúng/Sai)
    const p2List = document.getElementById("grid-key-p2");
    if (p2List) {
      let p2Html = "";
      for (let q = 1; q <= cfg.part2_count; q++) {
        const qSub = (curKey.part2 && curKey.part2[q]) || { a: "Đ", b: "S", c: "Đ", d: "S" };
        p2Html += `
          <div class="p2-row-cell">
            <strong style="font-size:12px;color:#1e3a8a;">Câu ${q}:</strong>
            <div class="p2-sub-group" data-q="${q}">
              ${["a", "b", "c", "d"].map((sub) => {
                const val = qSub[sub] || "Đ";
                return `
                  <div class="p2-sub-item">
                    <span>${sub})</span>
                    <button class="btn btn-sm ${val === "Đ" ? "btn-success" : "btn-outline"} btn-sub-toggle" data-q="${q}" data-sub="${sub}">${val}</button>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        `;
      }
      p2List.innerHTML = p2Html;

      p2List.querySelectorAll(".btn-sub-toggle").forEach((btn) => {
        btn.addEventListener("click", () => {
          const q = btn.dataset.q;
          const sub = btn.dataset.sub;
          const curVal = btn.textContent.trim();
          const nextVal = curVal === "Đ" ? "S" : "Đ";
          btn.textContent = nextVal;
          btn.className = `btn btn-sm ${nextVal === "Đ" ? "btn-success" : "btn-outline"} btn-sub-toggle`;
          if (!curKey.part2) curKey.part2 = {};
          if (!curKey.part2[q]) curKey.part2[q] = {};
          curKey.part2[q][sub] = nextVal;
          persistState();
        });
      });
    }

    // Render Part III (Số)
    const p3List = document.getElementById("grid-key-p3");
    if (p3List) {
      let p3Html = "";
      for (let q = 1; q <= cfg.part3_count; q++) {
        const val = (curKey.part3 && curKey.part3[q]) || "";
        p3Html += `
          <div class="p3-row-cell">
            <strong style="font-size:12px;color:#1e3a8a;">Câu ${q}:</strong>
            <input type="text" value="${val}" placeholder="VD: 2025 hoặc -1,5" class="form-input-sm inp-p3-val" data-q="${q}" style="width:140px;" />
          </div>
        `;
      }
      p3List.innerHTML = p3Html;

      p3List.querySelectorAll(".inp-p3-val").forEach((inp) => {
        inp.addEventListener("change", () => {
          const q = inp.dataset.q;
          if (!curKey.part3) curKey.part3 = {};
          curKey.part3[q] = inp.value.trim();
          persistState();
        });
      });
    }
  }

  function updateScoreSummaryBanner() {
    const p1En = document.getElementById("cfg-p1-enable").checked;
    const p1C = parseInt(document.getElementById("cfg-p1-count").value, 10) || 0;
    const p1P = parseFloat(document.getElementById("cfg-p1-pts").value) || 0;

    const p2En = document.getElementById("cfg-p2-enable").checked;
    const p2C = parseInt(document.getElementById("cfg-p2-count").value, 10) || 0;
    const p2P = parseFloat(document.getElementById("cfg-p2-pts").value) || 0;

    const p3En = document.getElementById("cfg-p3-enable").checked;
    const p3C = parseInt(document.getElementById("cfg-p3-count").value, 10) || 0;
    const p3P = parseFloat(document.getElementById("cfg-p3-pts").value) || 0;

    const total = (p1En ? p1C * p1P : 0) + (p2En ? p2C * p2P : 0) + (p3En ? p3C * p3P : 0);
    const banner = document.getElementById("cfg-total-score-calc");
    if (banner) banner.textContent = `${total.toFixed(2)} đ`;
  }

  // Nhập nhanh chuỗi đáp án (VD: ABCD ABCD hoặc 1A 2B 3C)
  function applyFastAnswerString() {
    const raw = (document.getElementById("txt-fast-answers").value || "").trim().toUpperCase();
    if (!raw) return;

    const curKey = state.answerKeys[state.activeMade] || DEFAULT_KEY_0101;
    if (!curKey.part1) curKey.part1 = {};

    let matches = [];
    if (raw.includes("1") || raw.includes("C")) {
      // Dạng 1A 2B 3C...
      const regex = /(\d+)\s*[:.-]?\s*([A-D])/g;
      let m;
      while ((m = regex.exec(raw)) !== null) {
        matches.push({ q: m[1], ans: m[2] });
      }
    }

    if (matches.length > 0) {
      matches.forEach((item) => {
        curKey.part1[item.q] = item.ans;
      });
    } else {
      // Dạng chuỗi liền: ABCDABCD...
      const pureLetters = raw.replace(/[^ABCD]/g, "").split("");
      pureLetters.forEach((letter, idx) => {
        curKey.part1[idx + 1] = letter;
      });
    }

    persistState();
    renderKeysManager();
    alert("Đã cập nhật chuỗi đáp án thành công!");
  }

  // =========================================================================
  // 9. QUẢN LÝ HỌC SINH & XUẤT EXCEL (TAB 4 - SHEETJS OFFLINE)
  // =========================================================================
  function renderStudentsList() {
    const container = document.getElementById("students-list-container");
    const badge = document.getElementById("students-count-badge");
    if (badge) badge.textContent = state.students.length;
    if (!container) return;

    const query = (document.getElementById("search-student-inp")?.value || "").toLowerCase().trim();
    const filtered = state.students.filter((st) => {
      return st.full_name.toLowerCase().includes(query) || st.sbd.includes(query) || st.class_name.toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div style="padding:10px;text-align:center;color:#94a3b8;font-size:12px;">Không tìm thấy học sinh nào</div>`;
      return;
    }

    container.innerHTML = filtered.map((st, i) => `
      <div class="st-row">
        <div>
          <strong>${st.sbd}</strong> - ${st.full_name} <span style="color:#64748b;">(${st.class_name})</span>
        </div>
        <button class="btn btn-sm btn-ghost btn-del-st" data-sbd="${st.sbd}">✕</button>
      </div>
    `).join("");

    container.querySelectorAll(".btn-del-st").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sbd = btn.dataset.sbd;
        state.students = state.students.filter((s) => s.sbd !== sbd);
        persistState();
        renderStudentsList();
      });
    });
  }

  function renderGradebook() {
    const tbody = document.getElementById("gradebook-tbody");
    if (!tbody) return;

    const total = state.submissions.length;
    let avg = 0, high = 0, pass = 0;

    if (total > 0) {
      const scores = state.submissions.map((s) => s.total_score);
      avg = scores.reduce((a, b) => a + b, 0) / total;
      high = Math.max(...scores);
      pass = scores.filter((s) => s >= 5.0).length;
    }

    document.getElementById("stat-total-graded").textContent = total;
    document.getElementById("stat-avg-score").textContent = avg.toFixed(2);
    document.getElementById("stat-high-score").textContent = high.toFixed(2);
    document.getElementById("stat-pass-count").textContent = pass;

    if (total === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:16px;color:#94a3b8;">Chưa có bài chấm nào</td></tr>`;
      return;
    }

    tbody.innerHTML = state.submissions.map((sub, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${sub.sbd}</strong></td>
        <td>${sub.student_name}</td>
        <td>${sub.student_class}</td>
        <td>${sub.made}</td>
        <td style="color:#dc2626;font-weight:800;">${sub.total_score.toFixed(2)}</td>
      </tr>
    `).join("");
  }

  // Nạp học sinh từ file Excel bằng SheetJS
  async function importStudentsExcelFile(file) {
    if (!file || !window.XLSX) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      let addedCount = 0;
      let headerIdx = -1;
      let sbdCol = 1, nameCol = 2, classCol = 3, dobCol = 4;

      for (let r = 0; r < Math.min(10, rows.length); r++) {
        const rowStr = (rows[r] || []).join(" ").toLowerCase();
        if (rowStr.includes("sbd") || rowStr.includes("báo danh") || rowStr.includes("họ") || rowStr.includes("tên")) {
          headerIdx = r;
          rows[r].forEach((colName, cIdx) => {
            const low = String(colName || "").toLowerCase();
            if (low.includes("sbd") || low.includes("báo danh")) sbdCol = cIdx;
            else if (low.includes("họ") || low.includes("tên")) nameCol = cIdx;
            else if (low.includes("lớp")) classCol = cIdx;
            else if (low.includes("ngày sinh")) dobCol = cIdx;
          });
          break;
        }
      }

      const startRow = headerIdx >= 0 ? headerIdx + 1 : 1;
      for (let r = startRow; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row[nameCol]) continue;
        const sbdRaw = String(row[sbdCol] || "").trim().replace(/\D/g, "").padStart(6, "0").slice(0, 6);
        const nameRaw = String(row[nameCol] || "").trim();
        const classRaw = String(row[classCol] || "12A1").trim();
        const dobRaw = String(row[dobCol] || "").trim();

        if (nameRaw) {
          const existing = state.students.find((s) => s.sbd === sbdRaw);
          if (existing) {
            existing.full_name = nameRaw;
            existing.class_name = classRaw;
            existing.dob = dobRaw;
          } else {
            state.students.push({ sbd: sbdRaw, full_name: nameRaw, class_name: classRaw, dob: dobRaw });
          }
          addedCount++;
        }
      }

      persistState();
      renderStudentsList();
      alert(`Đã nạp thành công ${addedCount} học sinh từ file Excel!`);
    } catch (err) {
      alert("Lỗi đọc file Excel: " + err.message);
    }
  }

  // Tải file mẫu danh sách học sinh
  function exportStudentTemplateExcel() {
    if (!window.XLSX) return;
    const wsData = [
      ["STT", "Số Báo Danh", "Họ và Tên Học Sinh", "Lớp", "Ngày Sinh"],
      [1, "012345", "Nguyễn Văn Minh", "12A1", "15/05/2007"],
      [2, "012346", "Trần Thị Ngọc Ánh", "12A1", "22/08/2007"],
      [3, "012347", "Lê Hoàng Nam", "12A1", "10/01/2007"],
      [4, "012348", "Phạm Thu Hà", "12A2", "03/11/2007"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhSachHocSinh");
    XLSX.writeFile(wb, "Mau_Danh_Sach_Hoc_Sinh_SmartOMR.xlsx");
  }

  // Xuất bảng điểm Excel
  function exportGradebookExcel() {
    if (window.SmartPro && window.SmartPro.exportExcel) return window.SmartPro.exportExcel();
    if (!window.XLSX) return;
    if (state.submissions.length === 0) {
      alert("Chưa có kết quả bài chấm nào để xuất file Excel!");
      return;
    }

    const wsData = [
      ["STT", "Số Báo Danh", "Họ và Tên Học Sinh", "Lớp", "Mã Đề", "Điểm P.I", "Điểm P.II", "Điểm P.III", "TỔNG ĐIỂM", "Thời Gian Chấm"]
    ];

    state.submissions.forEach((sub, i) => {
      wsData.push([
        i + 1,
        sub.sbd,
        sub.student_name,
        sub.student_class,
        sub.made,
        sub.part1_summary?.score ?? 0,
        sub.part2_summary?.score ?? 0,
        sub.part3_summary?.score ?? 0,
        sub.total_score,
        sub.timestamp
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BangDiem");
    const fileName = `Bang_Diem_SmartOMR_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  // =========================================================================
  // 10. QUẢN LÝ PHIÊN CHẤM (.OMR) & ĐỒNG BỘ PC (TAB 5)
  // =========================================================================
  function renderSettingsTab() {
    document.getElementById("cfg-gemini-key").value = state.geminiKey;
    document.getElementById("cfg-gemini-model").value = state.geminiModel;
    document.getElementById("cfg-auto-gemini-toggle").checked = state.autoGemini;
    document.getElementById("inp-session-name-edit").value = state.sessionName;
    document.getElementById("inp-pc-server-url").value = state.pcBaseUrl;
  }

  function exportCurrentSessionFile() {
    const payload = {
      session_name: state.sessionName,
      saved_at: new Date().toLocaleString("vi-VN"),
      answer_keys: state.answerKeys,
      students: state.students,
      submissions: state.submissions,
      copyright: COPYRIGHT
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PhienCham_${state.sessionName.replace(/\s+/g, "_")}.omr`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importSessionFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.answer_keys) state.answerKeys = data.answer_keys;
        if (data.students) state.students = data.students;
        if (data.submissions) state.submissions = data.submissions;
        if (data.session_name) state.sessionName = data.session_name;

        persistState();
        document.getElementById("hdr-session-name").textContent = `Phiên: ${state.sessionName}`;
        alert(`Đã nạp phiên chấm [${state.sessionName}] thành công!`);
        switchTab("tab-batch");
      } catch (err) {
        alert("Lỗi định dạng file .omr: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  async function testGeminiApiKey() {
    const key = document.getElementById("cfg-gemini-key").value.trim();
    let model = document.getElementById("cfg-gemini-model").value;
    const msgBox = document.getElementById("gemini-test-msg");
    if (!key) {
      alert("Vui lòng dán khóa Gemini API Key vào ô trên!");
      return;
    }

    if (msgBox) {
      msgBox.className = "msg-box";
      msgBox.style.display = "block";
      msgBox.textContent = "⏳ Đang kiểm tra kết nối và tự động dò tìm mô hình Google Gemini khả dụng...";
    }

    try {
      // 1. Thử lấy danh sách models được cấp quyền cho API Key này
      let availModels = [];
      try {
        const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (listResp.ok) {
          const listData = await listResp.json();
          availModels = (listData.models || [])
            .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
            .map(m => m.name.replace(/^models\//, ''))
            .filter(n => n.toLowerCase().startsWith("gemini") && !n.includes("embedding"));
        }
      } catch (e) {
        console.warn("Lỗi đọc list models:", e);
      }

      // 2. Danh sách các model ứng viên để kiểm tra
      const testCandidates = [
        model,
        "gemini-1.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-pro",
        "gemini-2.0-flash-lite",
        "gemini-flash-latest",
        ...availModels
      ].filter((v, i, a) => v && a.indexOf(v) === i);

      let workingModel = null;
      let lastErrMsg = "";

      for (const m of testCandidates) {
        try {
          const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "ping" }] }],
              generationConfig: { maxOutputTokens: 5 }
            })
          });

          if (resp.ok) {
            workingModel = m;
            break;
          } else {
            const errData = await resp.json().catch(() => ({}));
            lastErrMsg = errData?.error?.message || `Lỗi HTTP ${resp.status}`;
          }
        } catch (err) {
          lastErrMsg = err.message;
        }
      }

      if (workingModel) {
        msgBox.className = "msg-box success";
        msgBox.textContent = `✅ Kết nối thành công! Mô hình đang hoạt động: [${workingModel}]. Đã tự động kích hoạt.`;
        state.geminiKey = key;
        state.geminiModel = workingModel;

        const sel = document.getElementById("cfg-gemini-model");
        if (sel) {
          let found = false;
          for (let i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value === workingModel) {
              sel.selectedIndex = i;
              found = true;
              break;
            }
          }
          if (!found) {
            const opt = document.createElement("option");
            opt.value = workingModel;
            opt.textContent = `${workingModel} (Tự nhận diện)`;
            sel.appendChild(opt);
            sel.value = workingModel;
          }
        }
        persistState();
      } else {
        msgBox.className = "msg-box error";
        msgBox.textContent = `❌ Lỗi kết nối Google: ${lastErrMsg}`;
      }
    } catch (e) {
      msgBox.className = "msg-box error";
      msgBox.textContent = `❌ Lỗi mạng: ${e.message}`;
    }
  }

  // Đồng bộ qua Wi-Fi với SmartOMR Pro VN trên máy tính
  async function connectAndSyncWithPcServer() {
    let url = (document.getElementById("inp-pc-server-url").value || "").trim().replace(/\/$/, "");
    if (!url) {
      alert("Vui lòng nhập địa chỉ IP máy tính (VD: http://192.168.1.15:8000)!");
      return;
    }
    if (!url.startsWith("http")) url = "http://" + url;

    const statusBox = document.getElementById("pc-sync-status");
    if (statusBox) {
      statusBox.style.display = "block";
      statusBox.className = "msg-box";
      statusBox.textContent = `⏳ Đang kết nối tới ${url}...`;
    }

    try {
      const resp = await fetch(url + "/api/system/info", { timeout: 6000 });
      if (resp.ok) {
        const info = await resp.json();
        state.pcBaseUrl = url;
        persistState();

        // Lấy danh sách đáp án và học sinh từ PC về điện thoại
        const [keysResp, stResp] = await Promise.all([
          fetch(url + "/api/answer-keys"),
          fetch(url + "/api/students")
        ]);

        if (keysResp.ok) state.answerKeys = await keysResp.json();
        if (stResp.ok) state.students = await stResp.json();
        persistState();

        statusBox.className = "msg-box success";
        statusBox.textContent = `✅ Kết nối thành công với máy tính! Đã đồng bộ ${Object.keys(state.answerKeys).length} mã đề và ${state.students.length} học sinh.`;
        updateNetworkStatus();
      } else {
        throw new Error("Máy tính phản hồi mã lỗi " + resp.status);
      }
    } catch (e) {
      if (statusBox) {
        statusBox.className = "msg-box error";
        statusBox.textContent = `❌ Không kết nối được tới máy tính: ${e.message}. Hãy chắc chắn máy tính và điện thoại bắt chung mạng Wi-Fi và lệnh 'python run.py' đang chạy trên máy tính.`;
      }
    }
  }

  // =========================================================================
  // 11. MODAL XEM ẢNH KHOANH ĐÁP ÁN (IMAGE VIEWER)
  // =========================================================================
  function openImageViewer(item) {
    if (!item) return;
    state.currentViewerItem = item;
    const modal = document.getElementById("image-viewer-modal");
    const img = document.getElementById("viewer-target-img");
    const title = document.getElementById("viewer-title-text");
    const score = document.getElementById("viewer-score-text");
    const downloadA = document.getElementById("btn-download-viewer-img");

    if (modal && img) {
      img.src = item.graded_bgr || item.orig_bgr;
      if (title) title.textContent = `${item.result.student_name} (SBD: ${item.result.sbd} - Đề: ${item.result.made})`;
      if (score) score.textContent = `${item.result.total_score.toFixed(2)} / ${(item.result.max_possible_score || 10.0).toFixed(1)} đ`;
      if (downloadA) downloadA.href = item.graded_bgr || item.orig_bgr;
      modal.style.display = "flex";
    }
  }

  // =========================================================================
  // 12. HỆ THỐNG XÁC THỰC FIREBASE & QUẢN TRỊ ADMIN (PHÊ DUYỆT TÀI KHOẢN)
  // =========================================================================
  function syncUserAuthUI() {
    const user = window.SmartAuth ? window.SmartAuth.getCurrentUser() : null;
    state.currentUser = user;

    const topbarName = document.getElementById("topbar-user-name");
    const roleBadge = document.getElementById("badge-my-role");
    const boxLoggedIn = document.getElementById("box-user-logged-in");
    const boxNotLogged = document.getElementById("box-user-not-logged");
    const btnAdminPanel = document.getElementById("btn-open-admin-panel");
    const pendingModal = document.getElementById("pending-approval-modal");

    if (user) {
      if (topbarName) topbarName.textContent = user.displayName || user.email.split("@")[0];
      if (boxLoggedIn) boxLoggedIn.style.display = "block";
      if (boxNotLogged) boxNotLogged.style.display = "none";

      document.getElementById("my-display-name").textContent = user.displayName || "Giáo Viên";
      document.getElementById("my-school-name").textContent = user.school || "THPT Chi Lăng, Lạng Sơn";
      document.getElementById("my-email-address").textContent = user.email;

      const initial = (user.displayName || "GV").split(" ").map(w => w[0]).join("").slice(-2).toUpperCase();
      document.getElementById("avatar-user-initial").textContent = initial || "GV";

      if (roleBadge) {
        roleBadge.textContent = user.role === "admin" ? "🛡️ QUẢN TRỊ VIÊN" : "👨‍🏫 GIÁO VIÊN";
        roleBadge.className = `badge-role ${user.role === "admin" ? "admin" : "teacher"}`;
      }

      const statusEl = document.getElementById("my-account-status");
      if (statusEl) {
        if (user.status === "approved") {
          statusEl.textContent = "✅ Đã Kích Hoạt";
          statusEl.className = "status-badge-ok";
          if (pendingModal) pendingModal.style.display = "none";
        } else if (user.status === "pending") {
          statusEl.textContent = "⏳ Chờ Admin Phê Duyệt";
          statusEl.className = "status-badge-pending";
          // Hiển thị modal chờ duyệt
          document.getElementById("pending-user-name").textContent = user.displayName || user.email;
          if (pendingModal) pendingModal.style.display = "flex";
        } else if (user.status === "blocked") {
          statusEl.textContent = "❌ Đang Bị Tạm Khóa";
          statusEl.className = "status-badge-blocked";
        }
      }

      // Chỉ Admin mới thấy nút Mở Bảng Quản Trị
      if (btnAdminPanel) {
        btnAdminPanel.style.display = user.role === "admin" ? "block" : "none";
      }

      // Nạp API Key riêng biệt của user này vào hệ thống
      if (user.geminiApiKey) {
        state.geminiKey = user.geminiApiKey;
        document.getElementById("cfg-gemini-key").value = user.geminiApiKey;
      }
      if (user.geminiModel) {
        state.geminiModel = user.geminiModel;
        document.getElementById("cfg-gemini-model").value = user.geminiModel;
      }
    } else {
      if (topbarName) topbarName.textContent = "Đăng Nhập";
      if (boxLoggedIn) boxLoggedIn.style.display = "none";
      if (boxNotLogged) boxNotLogged.style.display = "block";
      if (roleBadge) {
        roleBadge.textContent = "CHƯA ĐĂNG NHẬP";
        roleBadge.className = "badge-role";
      }
      if (btnAdminPanel) btnAdminPanel.style.display = "none";
      if (pendingModal) pendingModal.style.display = "none";
    }
  }

  function openAuthModal(isRegister = false) {
    const modal = document.getElementById("auth-modal");
    if (!modal) return;
    const tabLogin = document.getElementById("tab-btn-show-login");
    const tabReg = document.getElementById("tab-btn-show-register");
    const formLogin = document.getElementById("form-login");
    const formReg = document.getElementById("form-register");
    const title = document.getElementById("auth-modal-title");
    const alertMsg = document.getElementById("auth-alert-msg");
    if (alertMsg) alertMsg.style.display = "none";

    if (isRegister) {
      tabLogin.classList.remove("active");
      tabReg.classList.add("active");
      formLogin.style.display = "none";
      formReg.style.display = "block";
      title.textContent = "📝 Đăng Ký Tài Khoản Giáo Viên";
    } else {
      tabLogin.classList.add("active");
      tabReg.classList.remove("active");
      formLogin.style.display = "block";
      formReg.style.display = "none";
      title.textContent = "🔐 Đăng Nhập Giáo Viên";
    }
    modal.style.display = "flex";
  }

  function closeAuthModal() {
    const modal = document.getElementById("auth-modal");
    if (modal) modal.style.display = "none";
  }

  // Xử lý nộp Form Đăng nhập
  async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById("inp-login-email").value.trim();
    const pass = document.getElementById("inp-login-password").value;
    const alertMsg = document.getElementById("auth-alert-msg");

    try {
      alertMsg.style.display = "block";
      alertMsg.className = "msg-box";
      alertMsg.textContent = "⏳ Đang xác thực thông tin tài khoản...";

      const user = await window.SmartAuth.loginUser(email, pass);
      alertMsg.className = "msg-box success";
      alertMsg.textContent = "✅ Đăng nhập thành công!";
      setTimeout(() => {
        closeAuthModal();
        syncUserAuthUI();
      }, 700);
    } catch (err) {
      alertMsg.className = "msg-box error";
      alertMsg.textContent = `❌ Lỗi: ${err.message}`;
    }
  }

  // Xử lý nộp Form Đăng ký
  async function handleRegisterSubmit(e) {
    e.preventDefault();
    const name = document.getElementById("inp-reg-name").value.trim();
    const school = document.getElementById("inp-reg-school").value.trim();
    const email = document.getElementById("inp-reg-email").value.trim();
    const pass = document.getElementById("inp-reg-password").value;
    const phone = document.getElementById("inp-reg-phone").value.trim();
    const adminSecret = document.getElementById("inp-reg-admin-code").value.trim();
    const alertMsg = document.getElementById("auth-alert-msg");

    try {
      alertMsg.style.display = "block";
      alertMsg.className = "msg-box";
      alertMsg.textContent = "⏳ Đang tạo tài khoản giáo viên...";

      const newProfile = await window.SmartAuth.registerUser({
        email,
        password: pass,
        displayName: name,
        school,
        phone,
        adminSecret
      });

      alertMsg.className = "msg-box success";
      if (newProfile.status === "approved") {
        alertMsg.textContent = "🎉 Đăng ký tài khoản Admin thành công! Đang đăng nhập...";
        await window.SmartAuth.loginUser(email, pass);
        setTimeout(() => {
          closeAuthModal();
          syncUserAuthUI();
        }, 1000);
      } else {
        alertMsg.textContent = "✅ Đăng ký thành công! Tài khoản của thầy/cô đã gửi tới Thầy Nguyễn Văn Hoàng (Admin) phê duyệt.";
        await window.SmartAuth.loginUser(email, pass);
        setTimeout(() => {
          closeAuthModal();
          syncUserAuthUI();
        }, 1500);
      }
    } catch (err) {
      alertMsg.className = "msg-box error";
      alertMsg.textContent = `❌ Lỗi đăng ký: ${err.message}`;
    }
  }

  // Đăng xuất
  async function handleLogout() {
    if (confirm("Thầy/cô có chắc muốn đăng xuất khỏi tài khoản này?")) {
      await window.SmartAuth.logoutUser();
      syncUserAuthUI();
      alert("Đã đăng xuất thành công!");
    }
  }

  // =========================================================================
  // 13. QUẢN TRỊ ADMIN: DUYỆT TÀI KHOẢN THÀNH VIÊN
  // =========================================================================
  async function openAdminPanelModal() {
    const modal = document.getElementById("admin-panel-modal");
    if (!modal) return;
    modal.style.display = "flex";
    await refreshAdminUsersList();
  }

  async function refreshAdminUsersList() {
    try {
      const users = await window.SmartAuth.adminFetchAllUsers();
      const pendingUsers = users.filter((u) => u.status === "pending");
      const activeUsers = users.filter((u) => u.status === "approved");

      document.getElementById("admin-stat-total").textContent = users.length;
      document.getElementById("admin-stat-pending").textContent = pendingUsers.length;
      document.getElementById("admin-stat-active").textContent = activeUsers.length;
      document.getElementById("count-pending-users").textContent = pendingUsers.length;

      // 1. Render danh sách tài khoản chờ duyệt
      const pendingBox = document.getElementById("admin-pending-users-list");
      if (pendingUsers.length === 0) {
        pendingBox.innerHTML = `<div style="padding:12px;text-align:center;color:#94a3b8;font-size:12px;">🎉 Hiện không có tài khoản nào đang chờ duyệt.</div>`;
      } else {
        pendingBox.innerHTML = pendingUsers.map((u) => `
          <div class="admin-user-card pending">
            <div class="admin-user-header">
              <div>
                <span class="admin-user-name">${u.displayName || "Giáo Viên"}</span>
                <span class="badge-role teacher" style="margin-left:4px;">Chờ Duyệt</span>
              </div>
              <span style="font-size:11px;color:#94a3b8;">${u.createdAt ? new Date(u.createdAt).toLocaleDateString("vi-VN") : ""}</span>
            </div>
            <div class="admin-user-sub">
              📧 ${u.email} | 🏫 ${u.school || "Chưa rõ trường"} ${u.phone ? `| 📞 ${u.phone}` : ""}
            </div>
            <div class="admin-action-btns">
              <button class="btn btn-sm btn-success btn-approve-user" data-uid="${u.uid}">
                ✅ Phê Duyệt Kích Hoạt
              </button>
              <button class="btn btn-sm btn-danger btn-delete-user" data-uid="${u.uid}">
                ✕ Từ Chối / Xóa
              </button>
            </div>
          </div>
        `).join("");

        pendingBox.querySelectorAll(".btn-approve-user").forEach((b) => {
          b.addEventListener("click", async () => {
            const uid = b.dataset.uid;
            b.disabled = true;
            b.textContent = "⏳ Đang duyệt...";
            await window.SmartAuth.adminApproveUser(uid);
            alert("Đã phê duyệt và kích hoạt tài khoản thành công!");
            await refreshAdminUsersList();
          });
        });

        pendingBox.querySelectorAll(".btn-delete-user").forEach((b) => {
          b.addEventListener("click", async () => {
            if (confirm("Thầy có chắc muốn từ chối và xóa tài khoản này?")) {
              const uid = b.dataset.uid;
              await window.SmartAuth.adminDeleteUser(uid);
              await refreshAdminUsersList();
            }
          });
        });
      }

      // 2. Render danh sách tất cả thành viên
      const allBox = document.getElementById("admin-all-users-list");
      allBox.innerHTML = users.map((u) => {
        const isApproved = u.status === "approved";
        const isBlocked = u.status === "blocked";
        const statusLabel = isApproved ? "✅ Hoạt động" : (isBlocked ? "❌ Bị khóa" : "⏳ Chờ duyệt");
        return `
          <div class="admin-user-card ${u.status || 'active'}">
            <div class="admin-user-header">
              <div>
                <strong class="admin-user-name">${u.displayName || u.email}</strong>
                <span class="badge-role ${u.role === 'admin' ? 'admin' : 'teacher'}" style="margin-left:4px;">${u.role === 'admin' ? 'ADMIN' : 'GIÁO VIÊN'}</span>
              </div>
              <span style="font-size:11px;font-weight:700;color:${isApproved ? '#16a34a' : (isBlocked ? '#dc2626' : '#d97706')}">${statusLabel}</span>
            </div>
            <div class="admin-user-sub">
              📧 ${u.email} | 🏫 ${u.school || "THPT Chi Lăng"}
              ${u.geminiApiKey ? ' | 🔑 Đã có API Key riêng' : ' | ⚠️ Chưa cài API Key'}
            </div>
            <div class="admin-action-btns">
              ${u.role !== 'admin' ? `
                ${isBlocked ? `
                  <button class="btn btn-sm btn-outline btn-toggle-block" data-uid="${u.uid}" data-action="unblock">🔓 Mở Khóa</button>
                ` : `
                  <button class="btn btn-sm btn-outline btn-toggle-block" data-uid="${u.uid}" data-action="block">🔒 Khóa Tạm Thời</button>
                `}
                <button class="btn btn-sm btn-danger btn-delete-user" data-uid="${u.uid}">🗑️ Xóa</button>
              ` : '<span style="font-size:11px;color:#94a3b8;font-style:italic;">(Tài khoản quản trị viên chính)</span>'}
            </div>
          </div>
        `;
      }).join("");

      allBox.querySelectorAll(".btn-toggle-block").forEach((b) => {
        b.addEventListener("click", async () => {
          const uid = b.dataset.uid;
          const action = b.dataset.action;
          if (action === "block") {
            await window.SmartAuth.adminBlockUser(uid);
          } else {
            await window.SmartAuth.adminApproveUser(uid);
          }
          await refreshAdminUsersList();
        });
      });

      allBox.querySelectorAll(".btn-delete-user").forEach((b) => {
        b.addEventListener("click", async () => {
          if (confirm("Thầy có chắc muốn xóa vĩnh viễn tài khoản này?")) {
            const uid = b.dataset.uid;
            await window.SmartAuth.adminDeleteUser(uid);
            await refreshAdminUsersList();
          }
        });
      });
    } catch (err) {
      alert("Lỗi tải danh sách người dùng: " + err.message);
    }
  }

  // =========================================================================
  // 14. GẮN SỰ KIỆN NÚT BẤM TOÀN HỆ THỐNG (EVENT LISTENERS)
  // =========================================================================
  function bindAllEvents() {
    // Header & PWA
    document.getElementById("btn-quick-pwa-install")?.addEventListener("click", triggerPwaInstall);
    document.getElementById("btn-do-install-pwa")?.addEventListener("click", triggerPwaInstall);
    document.getElementById("btn-dismiss-install")?.addEventListener("click", () => {
      document.getElementById("pwa-install-banner").style.display = "none";
      sessionStorage.setItem("pwa_banner_dismissed", "1");
    });

    // Profile button on topbar
    document.getElementById("btn-user-profile")?.addEventListener("click", () => {
      const user = window.SmartAuth ? window.SmartAuth.getCurrentUser() : null;
      if (user) {
        switchTab("tab-settings");
        document.getElementById("card-user-account-info")?.scrollIntoView({ behavior: "smooth" });
      } else {
        openAuthModal(false);
      }
    });

    // Auth Modal events
    document.getElementById("btn-close-auth-modal")?.addEventListener("click", closeAuthModal);
    document.getElementById("btn-trigger-login-modal")?.addEventListener("click", () => openAuthModal(false));
    document.getElementById("tab-btn-show-login")?.addEventListener("click", () => openAuthModal(false));
    document.getElementById("tab-btn-show-register")?.addEventListener("click", () => openAuthModal(true));
    document.getElementById("form-login")?.addEventListener("submit", handleLoginSubmit);
    document.getElementById("form-register")?.addEventListener("submit", handleRegisterSubmit);
    document.getElementById("btn-action-logout")?.addEventListener("click", handleLogout);

    // Pending modal
    document.getElementById("btn-logout-from-pending")?.addEventListener("click", handleLogout);
    document.getElementById("btn-recheck-approval")?.addEventListener("click", () => {
      syncUserAuthUI();
      const user = window.SmartAuth ? window.SmartAuth.getCurrentUser() : null;
      if (user && user.status === "approved") {
        alert("🎉 Chúc mừng thầy/cô! Tài khoản đã được Thầy Nguyễn Văn Hoàng phê duyệt. Thầy/cô có thể bắt đầu sử dụng app!");
      } else {
        alert("⏳ Tài khoản của thầy/cô vẫn đang ở trạng thái chờ Admin duyệt.");
      }
    });

    // Admin panel modal
    document.getElementById("btn-open-admin-panel")?.addEventListener("click", openAdminPanelModal);
    document.getElementById("btn-close-admin-panel")?.addEventListener("click", () => {
      document.getElementById("admin-panel-modal").style.display = "none";
    });

    // Firebase Config modal
    document.getElementById("btn-open-firebase-config")?.addEventListener("click", () => {
      const cfg = window.SmartAuth.getFirebaseConfig();
      document.getElementById("fb-cfg-apikey").value = cfg.apiKey || "";
      document.getElementById("fb-cfg-projectid").value = cfg.projectId || "";
      document.getElementById("fb-cfg-authdomain").value = cfg.authDomain || "";
      document.getElementById("fb-cfg-appid").value = cfg.appId || "";
      document.getElementById("firebase-config-modal").style.display = "flex";
    });
    document.getElementById("btn-close-fb-config")?.addEventListener("click", () => {
      document.getElementById("firebase-config-modal").style.display = "none";
    });
    document.getElementById("btn-save-fb-config")?.addEventListener("click", () => {
      const cfg = {
        apiKey: document.getElementById("fb-cfg-apikey").value.trim(),
        projectId: document.getElementById("fb-cfg-projectid").value.trim(),
        authDomain: document.getElementById("fb-cfg-authdomain").value.trim(),
        appId: document.getElementById("fb-cfg-appid").value.trim(),
        storageBucket: `${document.getElementById("fb-cfg-projectid").value.trim()}.appspot.com`,
        messagingSenderId: ""
      };
      window.SmartAuth.saveFirebaseConfig(cfg);
      window.SmartAuth.initFirebase();
      document.getElementById("firebase-config-modal").style.display = "none";
      alert("Đã lưu cấu hình Firebase! Hệ thống sẽ kết nối với dự án Firebase Cloud của thầy.");
    });
    document.getElementById("btn-reset-fb-mock")?.addEventListener("click", () => {
      window.SmartAuth.saveFirebaseConfig({ apiKey: "", projectId: "" });
      window.SmartAuth.initFirebase();
      document.getElementById("firebase-config-modal").style.display = "none";
      alert("Đã chuyển về chế độ Local Demo để chạy thử nghiệm!");
    });

    // Save individual Gemini API Key for current user
    document.getElementById("btn-save-gemini-key")?.addEventListener("click", async () => {
      const key = document.getElementById("cfg-gemini-key").value.trim();
      const model = document.getElementById("cfg-gemini-model").value;
      state.geminiKey = key;
      state.geminiModel = model;
      state.autoGemini = document.getElementById("cfg-auto-gemini-toggle").checked;
      persistState();

      if (window.SmartAuth && window.SmartAuth.getCurrentUser()) {
        try {
          await window.SmartAuth.updateMyGeminiKey(key, model);
          alert(`Đã lưu khóa Google Gemini API Key riêng biệt cho tài khoản [${state.currentUser.displayName || state.currentUser.email}] thành công!`);
        } catch (e) {
          alert(`Đã lưu cục bộ: ${e.message}`);
        }
      } else {
        alert("Đã lưu khóa Google Gemini API Key thành công!");
      }
    });

    // Session Modal
    document.getElementById("btn-topbar-menu")?.addEventListener("click", () => {
      document.getElementById("quick-session-modal").style.display = "flex";
    });
    document.getElementById("btn-close-session-modal")?.addEventListener("click", () => {
      document.getElementById("quick-session-modal").style.display = "none";
    });
    document.getElementById("btn-modal-new-session")?.addEventListener("click", () => {
      const name = prompt("Nhập tên phiên chấm mới:", "Phiên chấm " + new Date().toLocaleDateString("vi-VN"));
      if (name) {
        state.sessionName = name.trim();
        state.batchItems = [];
        state.submissions = [];
        persistState();
        document.getElementById("hdr-session-name").textContent = `Phiên: ${state.sessionName}`;
        document.getElementById("quick-session-modal").style.display = "none";
        renderBatchCards();
        renderGradebook();
      }
    });
    document.getElementById("btn-modal-save-session")?.addEventListener("click", () => {
      exportCurrentSessionFile();
      document.getElementById("quick-session-modal").style.display = "none";
    });
    document.getElementById("file-import-omr")?.addEventListener("change", (e) => {
      if (e.target.files?.[0]) {
        importSessionFile(e.target.files[0]);
        document.getElementById("quick-session-modal").style.display = "none";
      }
    });
    document.getElementById("btn-modal-sync-pc")?.addEventListener("click", () => {
      document.getElementById("quick-session-modal").style.display = "none";
      switchTab("tab-settings");
      document.getElementById("inp-pc-server-url")?.focus();
    });

    // Camera tab controls
    document.getElementById("btn-shutter-grade")?.addEventListener("click", () => {
      const user = window.SmartAuth ? window.SmartAuth.getCurrentUser() : null;
      if (user && user.status === "pending") {
        alert("Tài khoản của thầy/cô đang chờ Thầy Nguyễn Văn Hoàng phê duyệt. Vui lòng liên hệ Admin để được kích hoạt chức năng chấm bài!");
        return;
      }
      captureAndGradeFromCamera();
    });
    document.getElementById("btn-toggle-camera-facing")?.addEventListener("click", toggleCameraFacing);
    document.getElementById("btn-toggle-torch")?.addEventListener("click", toggleCameraTorch);
    document.getElementById("camera-single-file-input")?.addEventListener("change", async (e) => {
      if (e.target.files?.[0]) {
        const b64 = await readFileAsBase64(e.target.files[0]);
        await processGradingRequest({
          base64Data: b64,
          templateId: document.getElementById("cam-template-select").value || "thpt_2025",
          useGemini: document.getElementById("chk-auto-gemini-cam").checked,
          sourceName: e.target.files[0].name,
          isCameraCapture: true
        });
      }
    });

    // Camera result sheet controls
    document.getElementById("btn-download-cam-graded")?.addEventListener("click", () => {
      if (state.currentViewerItem) {
        const res = state.currentViewerItem.result;
        downloadImageFile(
          state.currentViewerItem.graded_bgr || state.currentViewerItem.orig_bgr,
          `Phieu_Cham_Camera_SBD_${res.sbd}_Made_${res.made}_${res.total_score}d.jpg`
        );
      }
    });
    document.getElementById("btn-export-excel-cam")?.addEventListener("click", () => {
      exportGradebookExcel();
    });
    document.getElementById("btn-view-graded-cam")?.addEventListener("click", () => {
      if (state.currentViewerItem) openImageViewer(state.currentViewerItem);
    });
    document.getElementById("btn-dismiss-continue-cam")?.addEventListener("click", () => {
      document.getElementById("camera-result-sheet").style.display = "none";
    });
    document.getElementById("btn-toggle-result-sheet")?.addEventListener("click", () => {
      document.getElementById("camera-result-sheet").style.display = "none";
    });
    document.getElementById("chk-auto-download-cam")?.addEventListener("change", (e) => {
      state.autoDownloadGradedCam = e.target.checked;
      persistState();
    });

    // Batch tab controls
    document.getElementById("btn-trigger-batch-upload")?.addEventListener("click", () => {
      const user = window.SmartAuth ? window.SmartAuth.getCurrentUser() : null;
      if (user && user.status === "pending") {
        alert("Tài khoản của thầy/cô đang chờ Thầy Nguyễn Văn Hoàng phê duyệt để chấm bài!");
        return;
      }
      document.getElementById("batch-files-input").click();
    });
    document.getElementById("batch-files-input")?.addEventListener("change", (e) => {
      handleBatchFilesUpload(Array.from(e.target.files || []));
      e.target.value = ""; // Reset input để có thể nạp lại cùng file
    });
    document.getElementById("btn-clear-pending-queue")?.addEventListener("click", () => {
      state.batchPendingFiles = [];
      renderBatchPendingQueue();
    });
    document.getElementById("btn-run-batch-grade")?.addEventListener("click", () => {
      const user = window.SmartAuth ? window.SmartAuth.getCurrentUser() : null;
      if (user && user.status === "pending") {
        alert("Tài khoản của thầy/cô đang chờ Thầy Nguyễn Văn Hoàng phê duyệt để chấm bài!");
        return;
      }
      runBatchGrading();
    });
    document.getElementById("btn-download-all-batch-images")?.addEventListener("click", downloadAllBatchImagesZip);
    document.getElementById("btn-clear-batch")?.addEventListener("click", () => {
      if (confirm("Thầy có chắc chắn muốn xóa toàn bộ danh sách bài trong phiên này?")) {
        state.batchItems = [];
        persistState();
        renderBatchCards();
      }
    });
    document.getElementById("btn-export-excel-batch")?.addEventListener("click", exportGradebookExcel);
    document.getElementById("btn-generate-sim-batch")?.addEventListener("click", async () => {
      if (window.SmartPro && window.SmartPro.runDemo) await window.SmartPro.runDemo();
      else alert("Chưa tải được mô-đun chấm thử.");
    });

    // Keys & Structure Tab
    ["cfg-p1-enable", "cfg-p1-count", "cfg-p1-pts", "cfg-p2-enable", "cfg-p2-count", "cfg-p2-pts", "cfg-p3-enable", "cfg-p3-count", "cfg-p3-pts"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", updateScoreSummaryBanner);
    });

    document.getElementById("btn-save-structure")?.addEventListener("click", () => {
      const curKey = state.answerKeys[state.activeMade] || DEFAULT_KEY_0101;
      curKey.scoring_config = Object.assign({}, curKey.scoring_config, {
        enable_part1: document.getElementById("cfg-p1-enable").checked,
        part1_count: parseInt(document.getElementById("cfg-p1-count").value, 10) || 40,
        part1_points_each: parseFloat(document.getElementById("cfg-p1-pts").value) || 0.25,
        enable_part2: document.getElementById("cfg-p2-enable").checked,
        part2_count: parseInt(document.getElementById("cfg-p2-count").value, 10) || 8,
        part2_max_points_each: parseFloat(document.getElementById("cfg-p2-pts").value) || 1.0,
        enable_part3: document.getElementById("cfg-p3-enable").checked,
        part3_count: parseInt(document.getElementById("cfg-p3-count").value, 10) || 6,
        part3_points_each: parseFloat(document.getElementById("cfg-p3-pts").value) || 0.25
      });
      persistState();
      renderKeysManager();
      alert("Đã lưu cấu hình loại hình trắc nghiệm & số câu hỏi thành công!");
    });

    document.getElementById("key-made-select")?.addEventListener("change", (e) => {
      state.activeMade = e.target.value;
      renderKeysManager();
    });

    document.getElementById("btn-add-made-btn")?.addEventListener("click", () => {
      const newMade = (document.getElementById("key-new-made-input").value || "").trim().padStart(4, "0");
      if (newMade && !state.answerKeys[newMade]) {
        state.answerKeys[newMade] = {
          made: newMade,
          exam_name: "Kỳ thi THPT Quốc Gia (Chuẩn Bộ GD&ĐT)",
          scoring_config: { ...DEFAULT_STRUCTURE },
          part1: { ...(state.answerKeys[state.activeMade]?.part1 || DEFAULT_KEY_0101.part1) },
          part2: { ...(state.answerKeys[state.activeMade]?.part2 || DEFAULT_KEY_0101.part2) },
          part3: { ...(state.answerKeys[state.activeMade]?.part3 || DEFAULT_KEY_0101.part3) }
        };
        state.activeMade = newMade;
        persistState();
        renderKeysManager();
        document.getElementById("key-new-made-input").value = "";
      }
    });

    document.getElementById("btn-save-key-answers")?.addEventListener("click", () => {
      persistState();
      alert(`Đã lưu đáp án cho Mã đề [${state.activeMade}]!`);
    });

    document.getElementById("btn-apply-fast-answers")?.addEventListener("click", applyFastAnswerString);

    // Students tab controls
    document.getElementById("file-import-students-excel")?.addEventListener("change", (e) => {
      if (e.target.files?.[0]) importStudentsExcelFile(e.target.files[0]);
    });
    document.getElementById("btn-download-st-template")?.addEventListener("click", exportStudentTemplateExcel);
    document.getElementById("btn-export-gradebook-excel")?.addEventListener("click", exportGradebookExcel);
    document.getElementById("search-student-inp")?.addEventListener("input", renderStudentsList);

    document.getElementById("btn-add-single-student")?.addEventListener("click", () => {
      const sbd = (document.getElementById("inp-st-sbd").value || "").trim().padStart(8, "0");
      const name = (document.getElementById("inp-st-name").value || "").trim();
      const cls = (document.getElementById("inp-st-class").value || "12A1").trim();
      if (!name) {
        alert("Vui lòng nhập họ và tên học sinh!");
        return;
      }
      state.students.push({ sbd, full_name: name, class_name: cls, dob: "" });
      persistState();
      renderStudentsList();
      document.getElementById("inp-st-name").value = "";
    });

    // Settings tab controls
    document.getElementById("btn-test-gemini-key")?.addEventListener("click", testGeminiApiKey);

    document.getElementById("btn-toggle-key-eye")?.addEventListener("click", () => {
      const inp = document.getElementById("cfg-gemini-key");
      inp.type = inp.type === "password" ? "text" : "password";
    });

    document.getElementById("btn-action-new-session")?.addEventListener("click", () => {
      document.getElementById("btn-modal-new-session").click();
    });
    document.getElementById("btn-action-save-session")?.addEventListener("click", exportCurrentSessionFile);
    document.getElementById("inp-file-load-omr-settings")?.addEventListener("change", (e) => {
      if (e.target.files?.[0]) importSessionFile(e.target.files[0]);
    });

    document.getElementById("btn-connect-pc-server")?.addEventListener("click", connectAndSyncWithPcServer);

    // Image viewer modal
    document.getElementById("btn-close-viewer")?.addEventListener("click", () => {
      document.getElementById("image-viewer-modal").style.display = "none";
    });
  }

  // Khởi động ứng dụng
  window.addEventListener("DOMContentLoaded", () => {
    if (window.SmartAuth) {
      window.SmartAuth.initFirebase();
      syncUserAuthUI();
    }
    bindAllEvents();
    initCameraCornerOverlay();
    updateNetworkStatus();
    document.getElementById("hdr-session-name").textContent = `Phiên: ${state.sessionName}`;

    // Khởi chạy tab camera ban đầu
    switchTab("tab-camera");
  });

  window.SmartApp = {
    state, persistState, applyScoring, recalcAll, keyFor, flagText, drawOverlay, ImgStore, newId,
    processGradingRequest, buildSubmission, readSheetLocally, loadImageToCanvas, downloadImageFile,
    renderBatchCards, renderGradebook, renderKeysManager, renderSettingsTab, switchTab, updateScoreSummaryBanner,
    DEFAULT_STRUCTURE
  };
})();
