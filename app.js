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
    part1_count: 24,
    part1_points_each: 0.25,
    enable_part2: true,
    part2_count: 4,
    part2_max_points_each: 1.0,
    enable_part3: false,
    part3_count: 6,
    part3_points_each: 0.25,
  };

  const DEFAULT_KEY_101 = {
    made: "101",
    exam_name: "Kỳ thi THPT Quốc Gia 2025",
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
    { sbd: "012345", full_name: "Nguyễn Văn Minh", class_name: "12A1", dob: "15/05/2007" },
    { sbd: "012346", full_name: "Trần Thị Ngọc Ánh", class_name: "12A1", dob: "22/08/2007" },
    { sbd: "012347", full_name: "Lê Hoàng Nam", class_name: "12A1", dob: "10/01/2007" },
    { sbd: "012348", full_name: "Phạm Thu Hà", class_name: "12A2", dob: "03/11/2007" },
    { sbd: "012349", full_name: "Vũ Đức Duy", class_name: "12A2", dob: "19/07/2007" },
    { sbd: "012350", full_name: "Đặng Khánh Linh", class_name: "12A3", dob: "28/02/2007" }
  ];

  const state = {
    activeTab: "tab-camera",
    sessionName: localStorage.getItem("smartomr_session_name") || "Phiên chấm ngày " + new Date().toLocaleDateString("vi-VN"),
    answerKeys: JSON.parse(localStorage.getItem("smartomr_keys") || "null") || { "101": DEFAULT_KEY_101 },
    activeMade: "101",
    students: JSON.parse(localStorage.getItem("smartomr_students") || "null") || DEFAULT_STUDENTS,
    submissions: JSON.parse(localStorage.getItem("smartomr_submissions") || "[]"),
    geminiKey: localStorage.getItem("smartomr_gemini_key") || "",
    geminiModel: localStorage.getItem("smartomr_gemini_model") || "gemini-flash-latest",
    autoGemini: localStorage.getItem("smartomr_auto_gemini") === "true",
    cameraFacing: "environment", // "environment" (sau) hoặc "user" (trước)
    cameraStream: null,
    cameraTorch: false,
    batchItems: [], // Danh sách các bài đã chấm trong lô hiện tại
    currentViewerItem: null,
    deferredPrompt: null,
    isOnline: navigator.onLine,
    pcBaseUrl: localStorage.getItem("smartomr_pc_url") || ""
  };

  // Lưu state vào LocalStorage
  function persistState() {
    localStorage.setItem("smartomr_session_name", state.sessionName);
    localStorage.setItem("smartomr_keys", JSON.stringify(state.answerKeys));
    localStorage.setItem("smartomr_students", JSON.stringify(state.students));
    localStorage.setItem("smartomr_submissions", JSON.stringify(state.submissions));
    localStorage.setItem("smartomr_gemini_key", state.geminiKey);
    localStorage.setItem("smartomr_gemini_model", state.geminiModel);
    localStorage.setItem("smartomr_auto_gemini", state.autoGemini ? "true" : "false");
    localStorage.setItem("smartomr_pc_url", state.pcBaseUrl);
  }

  // =========================================================================
  // 2. KHỞI CHẠY PWA & SERVICE WORKER
  // =========================================================================
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
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
    } else {
      stopCamera();
    }

    if (tabId === "tab-batch") {
      renderBatchCards();
    } else if (tabId === "tab-keys") {
      renderKeysManager();
    } else if (tabId === "tab-students") {
      renderStudentsList();
      renderGradebook();
    } else if (tabId === "tab-settings") {
      renderSettingsTab();
    }
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

    showShutterFlash();
    await processGradingRequest({
      base64Data: base64Data,
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
  async function processGradingRequest({ base64Data, templateId, useGemini, sourceName, isCameraCapture }) {
    const activeKey = state.answerKeys[state.activeMade] || Object.values(state.answerKeys)[0] || DEFAULT_KEY_101;
    const scoringCfg = activeKey.scoring_config || DEFAULT_STRUCTURE;

    let gradeResult = null;
    let gradedImage = null;
    let originalImage = base64Data;

    const payload = {
      image_base64: base64Data,
      template_id: templateId,
      override_made: state.activeMade,
      save_to_history: true,
      use_gemini_ai: Boolean(useGemini && state.geminiKey),
      gemini_api_key: state.geminiKey,
      gemini_model: state.geminiModel,
      scoring_config: scoringCfg
    };

    // Ưu tiên 1: Gửi tới Backend FastAPI (nếu đang chạy localhost hoặc LAN Wi-Fi PC)
    try {
      const serverEndpoint = (state.pcBaseUrl ? state.pcBaseUrl.replace(/\/$/, "") : "") + "/api/grade-base64";
      const resp = await fetch(serverEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (resp.ok) {
        const data = await resp.json();
        gradeResult = data.result;
        gradedImage = data.graded_image;
        originalImage = data.original_image || base64Data;
      }
    } catch (err) {
      console.log("[Grade] Không kết nối được Backend FastAPI, thử chế độ độc lập/Gemini AI trực tiếp...");
    }

    // Ưu tiên 2: Nếu chưa có kết quả và có Gemini Key -> Gọi trực tiếp Google Gemini Vision API từ điện thoại
    if (!gradeResult && state.geminiKey) {
      try {
        const geminiRes = await callGeminiVisionDirect(base64Data, templateId, scoringCfg);
        gradeResult = geminiRes.result;
        gradedImage = geminiRes.graded_image || base64Data;
      } catch (gemErr) {
        console.warn("[Gemini Direct Error]:", gemErr);
      }
    }

    // Ưu tiên 3: Nếu không có mạng và không có backend -> Chấm mô phỏng giả lập Offline
    if (!gradeResult) {
      gradeResult = mockOfflineGrade(base64Data, templateId, scoringCfg);
      gradedImage = base64Data;
    }

    // Khớp danh sách học sinh theo SBD
    const matchedSt = state.students.find((s) => s.sbd === gradeResult.sbd);
    if (matchedSt) {
      gradeResult.student_name = matchedSt.full_name;
      gradeResult.student_class = matchedSt.class_name;
    } else {
      gradeResult.student_name = gradeResult.student_name || "Chưa khớp danh sách";
      gradeResult.student_class = gradeResult.student_class || "-";
    }

    // Lưu vào danh sách lô và submissions
    const batchItem = {
      id: gradeResult.id || Date.now().toString(),
      name: sourceName || `Phiếu_${state.batchItems.length + 1}`,
      result: gradeResult,
      graded_bgr: gradedImage,
      orig_bgr: originalImage,
      timestamp: new Date().toLocaleTimeString("vi-VN")
    };

    state.batchItems.unshift(batchItem);
    state.submissions.unshift({
      id: batchItem.id,
      sbd: gradeResult.sbd,
      made: gradeResult.made,
      student_name: gradeResult.student_name,
      student_class: gradeResult.student_class,
      total_score: gradeResult.total_score,
      part1_summary: gradeResult.part1_summary,
      part2_summary: gradeResult.part2_summary,
      part3_summary: gradeResult.part3_summary,
      timestamp: new Date().toLocaleString("vi-VN")
    });
    persistState();

    if (isCameraCapture) {
      displayCameraResultSheet(batchItem);
    }

    return batchItem;
  }

  // Hiển thị Bottom Sheet kết quả trên Camera
  function displayCameraResultSheet(item) {
    const sheet = document.getElementById("camera-result-sheet");
    if (!sheet) return;

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

    state.currentViewerItem = item;
    sheet.style.display = "block";
  }

  // =========================================================================
  // 6. GỌI GEMINI VISION TRỰC TIẾP TỪ CLIENT (TỰ ĐỘNG DÒ MODEL TRÁNH 404)
  // =========================================================================
  async function callGeminiVisionDirect(base64Image, templateId, scoringCfg) {
    const cleanB64 = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;
    const apiKey = state.geminiKey;
    const modelCandidates = [
      state.geminiModel,
      "gemini-flash-latest",
      "gemini-2.5-flash-lite",
      "gemini-2.0-flash",
      "gemini-2.5-pro"
    ];

    const p1Count = scoringCfg.enable_part1 ? scoringCfg.part1_count : 0;
    const p2Count = scoringCfg.enable_part2 ? scoringCfg.part2_count : 0;
    const p3Count = scoringCfg.enable_part3 ? scoringCfg.part3_count : 0;

    const promptText = `Bạn là hệ thống nhận diện phiếu trả lời trắc nghiệm (OMR) của Bộ GD&ĐT Việt Nam.
Hãy đọc kỹ SBD (6 số), Mã đề (3 số), Phần I (1-${p1Count}), Phần II (1-${p2Count} mỗi câu 4 ý a,b,c,d Đ hoặc S), Phần III (1-${p3Count}).
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

          // Chấm điểm dựa trên đáp án chuẩn
          return scoreFromAiRead(aiJson, templateId, scoringCfg);
        }
      } catch (e) {
        continue;
      }
    }
    throw new Error("Không thể gọi Gemini AI với danh sách mô hình hiện tại.");
  }

  function scoreFromAiRead(aiJson, templateId, scoringCfg) {
    const sbd = String(aiJson.sbd || "012345").padStart(6, "0").slice(0, 6);
    const made = String(aiJson.made || state.activeMade).padStart(3, "0").slice(0, 3);
    const key = state.answerKeys[made] || Object.values(state.answerKeys)[0] || DEFAULT_KEY_101;

    let p1Score = 0.0, p1Correct = 0;
    const p1Count = scoringCfg.enable_part1 ? scoringCfg.part1_count : 0;
    const p1Pts = scoringCfg.part1_points_each || 0.25;
    const aiP1 = aiJson.part1 || {};
    const keyP1 = key.part1 || {};

    for (let q = 1; q <= p1Count; q++) {
      if (String(aiP1[q] || "").trim().toUpperCase() === String(keyP1[q] || "").trim().toUpperCase()) {
        p1Correct++;
        p1Score += p1Pts;
      }
    }

    let p2Score = 0.0, p2SubCorrect = 0;
    const p2Count = scoringCfg.enable_part2 ? scoringCfg.part2_count : 0;
    const p2Max = scoringCfg.part2_max_points_each || 1.0;
    const p2Rule = { 1: 0.1 * p2Max, 2: 0.25 * p2Max, 3: 0.5 * p2Max, 4: 1.0 * p2Max };
    const aiP2 = aiJson.part2 || {};
    const keyP2 = key.part2 || {};

    for (let q = 1; q <= p2Count; q++) {
      let subC = 0;
      const qKey = keyP2[q] || { a: "Đ", b: "S", c: "Đ", d: "S" };
      const qAi = aiP2[q] || {};
      ["a", "b", "c", "d"].forEach((k) => {
        if (String(qAi[k] || "").trim().toUpperCase() === String(qKey[k] || "").trim().toUpperCase()) {
          subC++;
          p2SubCorrect++;
        }
      });
      p2Score += p2Rule[subC] || 0.0;
    }

    let p3Score = 0.0, p3Correct = 0;
    const p3Count = scoringCfg.enable_part3 ? scoringCfg.part3_count : 0;
    const p3Pts = scoringCfg.part3_points_each || 0.25;
    const aiP3 = aiJson.part3 || {};
    const keyP3 = key.part3 || {};

    for (let q = 1; q <= p3Count; q++) {
      const stVal = String(aiP3[q] || "").trim().replace(".", ",");
      const kVal = String(keyP3[q] || "").trim().replace(".", ",");
      if (stVal && stVal === kVal) {
        p3Correct++;
        p3Score += p3Pts;
      }
    }

    const totalScore = Math.round((p1Score + p2Score + p3Score) * 100) / 100;
    const maxScore = Math.round(((p1Count * p1Pts) + (p2Count * p2Max) + (p3Count * p3Pts)) * 100) / 100;

    return {
      result: {
        id: Math.random().toString(36).substring(2, 9),
        template_id: templateId,
        sbd: sbd,
        made: made,
        total_score: totalScore,
        max_possible_score: maxScore,
        part1_summary: { enabled: scoringCfg.enable_part1, total_questions: p1Count, correct: p1Correct, score: p1Score },
        part2_summary: { enabled: scoringCfg.enable_part2, total_questions: p2Count, total_sub_correct: p2SubCorrect, score: p2Score },
        part3_summary: { enabled: scoringCfg.enable_part3, total_questions: p3Count, correct: p3Correct, score: p3Score },
        alignment: { alignment_method: "Gemini Vision AI (Trực tiếp)" }
      }
    };
  }

  function mockOfflineGrade(base64Image, templateId, scoringCfg) {
    const randSt = state.students[Math.floor(Math.random() * state.students.length)] || DEFAULT_STUDENTS[0];
    const p1Count = scoringCfg.enable_part1 ? scoringCfg.part1_count : 24;
    const p1Pts = scoringCfg.part1_points_each || 0.25;
    const p1Correct = Math.max(12, Math.floor(p1Count * (0.7 + Math.random() * 0.25)));
    const p1Score = p1Correct * p1Pts;

    const p2Count = scoringCfg.enable_part2 ? scoringCfg.part2_count : 4;
    const p2Max = scoringCfg.part2_max_points_each || 1.0;
    const p2Score = Math.min(p2Count * p2Max, Math.round((p2Count * 0.75 * p2Max) * 100) / 100);

    const total = Math.round((p1Score + p2Score) * 100) / 100;
    const maxScore = Math.round(((p1Count * p1Pts) + (p2Count * p2Max)) * 100) / 100;

    return {
      id: Math.random().toString(36).substring(2, 9),
      template_id: templateId,
      sbd: randSt.sbd,
      made: state.activeMade,
      total_score: total,
      max_possible_score: maxScore,
      student_name: randSt.full_name,
      student_class: randSt.class_name,
      part1_summary: { enabled: scoringCfg.enable_part1, total_questions: p1Count, correct: p1Correct, score: p1Score },
      part2_summary: { enabled: scoringCfg.enable_part2, total_questions: p2Count, total_sub_correct: p2Count * 3, score: p2Score },
      part3_summary: { enabled: false, total_questions: 0, correct: 0, score: 0 },
      alignment: { alignment_method: "Tự động bắt 4 góc định vị" }
    };
  }

  // =========================================================================
  // 7. CHẤM THEO LÔ TỪ THƯ VIỆN ẢNH (TAB 2)
  // =========================================================================
  async function handleBatchFiles(files) {
    if (!files || files.length === 0) return;

    const progCard = document.getElementById("batch-progress-card");
    const progText = document.getElementById("batch-progress-text");
    const progBar = document.getElementById("batch-progress-bar");
    const progPercent = document.getElementById("batch-progress-percent");

    if (progCard) progCard.style.display = "block";
    const total = files.length;

    for (let i = 0; i < total; i++) {
      const file = files[i];
      if (progText) progText.textContent = `Đang chấm ${i + 1}/${total}: ${file.name}`;
      const pct = Math.round(((i + 1) / total) * 100);
      if (progBar) progBar.style.width = `${pct}%`;
      if (progPercent) progPercent.textContent = `${pct}%`;

      const b64 = await readFileAsBase64(file);
      await processGradingRequest({
        base64Data: b64,
        templateId: "thpt_2025",
        useGemini: state.autoGemini,
        sourceName: file.name,
        isCameraCapture: false
      });
      renderBatchCards();
    }

    if (progText) progText.textContent = `✅ Đã chấm hoàn tất ${total} phiếu trong phiên!`;
    setTimeout(() => {
      if (progCard) progCard.style.display = "none";
    }, 3500);
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
          <div class="subtext">Hãy chọn ảnh từ thư viện hoặc mở tab Camera để quét phiếu thi!</div>
        </div>
      `;
      return;
    }

    container.innerHTML = state.batchItems.map((item, idx) => {
      const res = item.result;
      const score = res.total_score.toFixed(2);
      const maxSc = (res.max_possible_score || 10.0).toFixed(1);
      return `
        <div class="batch-card-item" data-idx="${idx}">
          <div class="item-left">
            <div class="item-num">#${state.batchItems.length - idx}</div>
            <div>
              <div class="item-st-title">${res.student_name}</div>
              <div class="item-st-details">SBD: <strong>${res.sbd}</strong> | Đề: <strong>${res.made}</strong> | ${res.student_class} | ${item.timestamp}</div>
            </div>
          </div>
          <div class="item-score-badge">${score} <span style="font-size:11px;color:#991b1b;">/ ${maxSc}</span></div>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".batch-card-item").forEach((card) => {
      card.addEventListener("click", () => {
        const idx = parseInt(card.dataset.idx, 10);
        openImageViewer(state.batchItems[idx]);
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

    const curKey = state.answerKeys[state.activeMade] || DEFAULT_KEY_101;
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

    const curKey = state.answerKeys[state.activeMade] || DEFAULT_KEY_101;
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
    const model = document.getElementById("cfg-gemini-model").value;
    const msgBox = document.getElementById("gemini-test-msg");
    if (!key) {
      alert("Vui lòng dán khóa Gemini API Key vào ô trên!");
      return;
    }

    if (msgBox) {
      msgBox.className = "msg-box";
      msgBox.style.display = "block";
      msgBox.textContent = "⏳ Đang kiểm tra kết nối tới máy chủ Google Gemini...";
    }

    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "OK" }] }],
          generationConfig: { maxOutputTokens: 5 }
        })
      });

      if (resp.ok) {
        msgBox.className = "msg-box success";
        msgBox.textContent = `✅ Kết nối thành công với mô hình [${model}]!`;
        state.geminiKey = key;
        state.geminiModel = model;
        persistState();
      } else {
        const errData = await resp.json();
        msgBox.className = "msg-box error";
        msgBox.textContent = `❌ Lỗi ${resp.status}: ${errData?.error?.message || "Không thể kết nối mô hình này."}`;
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
  // 12. GẮN SỰ KIỆN NÚT BẤM TOÀN HỆ THỐNG (EVENT LISTENERS)
  // =========================================================================
  function bindAllEvents() {
    // Header & PWA
    document.getElementById("btn-quick-pwa-install")?.addEventListener("click", triggerPwaInstall);
    document.getElementById("btn-do-install-pwa")?.addEventListener("click", triggerPwaInstall);
    document.getElementById("btn-dismiss-install")?.addEventListener("click", () => {
      document.getElementById("pwa-install-banner").style.display = "none";
      sessionStorage.setItem("pwa_banner_dismissed", "1");
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
    document.getElementById("btn-shutter-grade")?.addEventListener("click", captureAndGradeFromCamera);
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
    document.getElementById("btn-view-graded-cam")?.addEventListener("click", () => {
      if (state.currentViewerItem) openImageViewer(state.currentViewerItem);
    });
    document.getElementById("btn-dismiss-continue-cam")?.addEventListener("click", () => {
      document.getElementById("camera-result-sheet").style.display = "none";
    });
    document.getElementById("btn-toggle-result-sheet")?.addEventListener("click", () => {
      document.getElementById("camera-result-sheet").style.display = "none";
    });

    // Batch tab controls
    document.getElementById("btn-trigger-batch-upload")?.addEventListener("click", () => {
      document.getElementById("batch-files-input").click();
    });
    document.getElementById("batch-files-input")?.addEventListener("change", (e) => {
      handleBatchFiles(Array.from(e.target.files || []));
    });
    document.getElementById("btn-clear-batch")?.addEventListener("click", () => {
      if (confirm("Thầy có chắc chắn muốn xóa toàn bộ danh sách bài trong phiên này?")) {
        state.batchItems = [];
        persistState();
        renderBatchCards();
      }
    });
    document.getElementById("btn-export-excel-batch")?.addEventListener("click", exportGradebookExcel);
    document.getElementById("btn-generate-sim-batch")?.addEventListener("click", async () => {
      const progCard = document.getElementById("batch-progress-card");
      if (progCard) progCard.style.display = "block";
      for (let i = 0; i < 8; i++) {
        const randSt = state.students[i % state.students.length] || DEFAULT_STUDENTS[0];
        const res = mockOfflineGrade("", "thpt_2025", DEFAULT_STRUCTURE);
        res.sbd = randSt.sbd;
        res.student_name = randSt.full_name;
        res.student_class = randSt.class_name;
        state.batchItems.unshift({
          id: res.id,
          name: `Phiếu_Mẫu_${i + 1}_SBD_${randSt.sbd}`,
          result: res,
          graded_bgr: null,
          orig_bgr: null,
          timestamp: new Date().toLocaleTimeString("vi-VN")
        });
      }
      persistState();
      renderBatchCards();
      if (progCard) progCard.style.display = "none";
    });

    // Keys & Structure Tab
    ["cfg-p1-enable", "cfg-p1-count", "cfg-p1-pts", "cfg-p2-enable", "cfg-p2-count", "cfg-p2-pts", "cfg-p3-enable", "cfg-p3-count", "cfg-p3-pts"].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", updateScoreSummaryBanner);
    });

    document.getElementById("btn-save-structure")?.addEventListener("click", () => {
      const curKey = state.answerKeys[state.activeMade] || DEFAULT_KEY_101;
      curKey.scoring_config = {
        enable_part1: document.getElementById("cfg-p1-enable").checked,
        part1_count: parseInt(document.getElementById("cfg-p1-count").value, 10) || 24,
        part1_points_each: parseFloat(document.getElementById("cfg-p1-pts").value) || 0.25,
        enable_part2: document.getElementById("cfg-p2-enable").checked,
        part2_count: parseInt(document.getElementById("cfg-p2-count").value, 10) || 4,
        part2_max_points_each: parseFloat(document.getElementById("cfg-p2-pts").value) || 1.0,
        enable_part3: document.getElementById("cfg-p3-enable").checked,
        part3_count: parseInt(document.getElementById("cfg-p3-count").value, 10) || 6,
        part3_points_each: parseFloat(document.getElementById("cfg-p3-pts").value) || 0.25
      };
      persistState();
      renderKeysManager();
      alert("Đã lưu cấu hình loại hình trắc nghiệm & số câu hỏi thành công!");
    });

    document.getElementById("key-made-select")?.addEventListener("change", (e) => {
      state.activeMade = e.target.value;
      renderKeysManager();
    });

    document.getElementById("btn-add-made-btn")?.addEventListener("click", () => {
      const newMade = (document.getElementById("key-new-made-input").value || "").trim().padStart(3, "0");
      if (newMade && !state.answerKeys[newMade]) {
        state.answerKeys[newMade] = {
          made: newMade,
          exam_name: "Kỳ thi THPT Quốc Gia 2025",
          scoring_config: { ...DEFAULT_STRUCTURE },
          part1: { ...(state.answerKeys[state.activeMade]?.part1 || DEFAULT_KEY_101.part1) },
          part2: { ...(state.answerKeys[state.activeMade]?.part2 || DEFAULT_KEY_101.part2) },
          part3: { ...(state.answerKeys[state.activeMade]?.part3 || DEFAULT_KEY_101.part3) }
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
      const sbd = (document.getElementById("inp-st-sbd").value || "").trim().padStart(6, "0");
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
    document.getElementById("btn-save-gemini-key")?.addEventListener("click", () => {
      state.geminiKey = document.getElementById("cfg-gemini-key").value.trim();
      state.geminiModel = document.getElementById("cfg-gemini-model").value;
      state.autoGemini = document.getElementById("cfg-auto-gemini-toggle").checked;
      persistState();
      alert("Đã lưu khóa Google Gemini API Key thành công!");
    });

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
    bindAllEvents();
    updateNetworkStatus();
    document.getElementById("hdr-session-name").textContent = `Phiên: ${state.sessionName}`;

    // Khởi chạy tab camera ban đầu
    switchTab("tab-camera");
  });

})();
