/**
 * SmartOMR Pro Mobile — Cấu hình & Module Xác thực Firebase (bản đã sửa)
 * - Đăng ký / Đăng nhập giáo viên bằng Firebase Authentication
 * - Hồ sơ người dùng lưu ở Firestore: users/{uid}
 * - Gemini API Key lưu RIÊNG ở users/{uid}/private/gemini (chỉ chủ tài khoản đọc được)
 * - Quyền Admin do Firestore Rules quyết định; KHÔNG còn "mã kích hoạt Admin" nằm trong code
 * - Chế độ Demo (Mock) chỉ chạy khi chưa dán cấu hình Firebase
 */
(function (window) {
  "use strict";

  const STORAGE_KEY_CONFIG = "smartomr_firebase_config";
  const STORAGE_KEY_SESSION = "smartomr_auth_session";
  const STORAGE_KEY_MOCK_USERS = "smartomr_mock_users";

  // ======================================================================
  // >>> THẦY DÁN CẤU HÌNH FIREBASE CỦA THẦY VÀO ĐÂY (lấy ở Firebase Console
  // >>> → Project settings → Your apps → Web app → firebaseConfig).
  // >>> Đây là thông tin CÔNG KHAI, không phải mật khẩu; bảo mật nằm ở Rules.
  // >>> Dán vào đây thì MỌI thiết bị của giáo viên đều tự kết nối, không phải
  // >>> nhập tay trên từng điện thoại.
  // ======================================================================
  const EMBEDDED_FIREBASE_CONFIG = {
    apiKey: "AIzaSyDKzEVoKpRmhQVbsK2gOIRFxU8zzGGRJYs",
    authDomain: "chamthi-a06f1.firebaseapp.com",
    projectId: "chamthi-a06f1",
    storageBucket: "chamthi-a06f1.firebasestorage.app",
    messagingSenderId: "616917466536",
    appId: "1:616917466536:web:874ed855565e714df0319dhttps://nguyenhoangthptcl-alt.github.io/smartomr-mobile/"
  };

  const DEFAULT_ADMIN_EMAIL = "hoang.thptchilang@gmail.com"; // chỉ dùng cho chế độ Demo

  let firebaseAuth = null;
  let firestoreDb = null;
  let currentUserProfile = null;
  let registering = false;
  let profileListeners = [];

  // ---------------- Cấu hình ----------------
  function getFirebaseConfig() {
    if (EMBEDDED_FIREBASE_CONFIG.apiKey && EMBEDDED_FIREBASE_CONFIG.projectId) {
      return EMBEDDED_FIREBASE_CONFIG;
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      return saved ? JSON.parse(saved) : EMBEDDED_FIREBASE_CONFIG;
    } catch (e) {
      return EMBEDDED_FIREBASE_CONFIG;
    }
  }
  function saveFirebaseConfig(cfg) {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(cfg));
  }
  function isFirebaseConfigured() {
    const cfg = getFirebaseConfig();
    return Boolean(cfg && cfg.apiKey && cfg.projectId);
  }
  function isCloudReady() {
    return Boolean(isFirebaseConfigured() && firebaseAuth && firestoreDb);
  }

  function onProfileChange(cb) { profileListeners.push(cb); }
  function emitProfileChange() {
    profileListeners.forEach((cb) => { try { cb(currentUserProfile); } catch (e) { console.error(e); } });
  }
  function cacheSession(profile) {
    currentUserProfile = profile;
    if (profile) localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(profile));
    else localStorage.removeItem(STORAGE_KEY_SESSION);
  }

  // Dịch lỗi Firebase sang tiếng Việt
  function friendlyError(err) {
    const code = (err && err.code) || "";
    const map = {
      "auth/email-already-in-use": "Email này đã được đăng ký.",
      "auth/invalid-email": "Email không hợp lệ.",
      "auth/weak-password": "Mật khẩu quá yếu (tối thiểu 6 ký tự).",
      "auth/user-not-found": "Email hoặc mật khẩu không chính xác.",
      "auth/wrong-password": "Email hoặc mật khẩu không chính xác.",
      "auth/invalid-credential": "Email hoặc mật khẩu không chính xác.",
      "auth/invalid-login-credentials": "Email hoặc mật khẩu không chính xác.",
      "auth/too-many-requests": "Thử sai quá nhiều lần, vui lòng đợi vài phút rồi thử lại.",
      "auth/network-request-failed": "Không có kết nối mạng. Hãy kiểm tra Wi-Fi/4G.",
      "auth/operation-not-allowed": "Chưa bật đăng nhập Email/Password trong Firebase Authentication.",
      "auth/unauthorized-domain": "Tên miền web chưa được thêm vào Authorized domains của Firebase.",
      "auth/api-key-not-valid": "API Key Firebase không hợp lệ, hãy kiểm tra lại cấu hình.",
      "permission-denied": "Firestore từ chối quyền truy cập. Hãy kiểm tra Rules và trạng thái tài khoản."
    };
    if (map[code]) return new Error(map[code]);
    if (code === "unavailable") return new Error("Không kết nối được máy chủ Firebase.");
    return err instanceof Error ? err : new Error(String(err));
  }

  // ---------------- Khởi tạo ----------------
  function initFirebase() {
    const cfg = getFirebaseConfig();
    if (isFirebaseConfigured() && window.firebase) {
      try {
        if (!firebase.apps.length) firebase.initializeApp(cfg);
        firebaseAuth = firebase.auth();
        firestoreDb = firebase.firestore();
        console.log("[Firebase] Đã kết nối Firebase Cloud.");
        firebaseAuth.onAuthStateChanged(handleAuthStateChanged);
        return true;
      } catch (err) {
        console.warn("[Firebase] Khởi tạo lỗi, dùng chế độ Demo:", err);
        firebaseAuth = null; firestoreDb = null;
      }
    } else {
      console.log("[Firebase] Chưa có cấu hình → chạy chế độ Demo (Local).");
    }
    initMockUsersIfEmpty();
    return false;
  }

  async function loadProfileFromCloud(uid) {
    const snap = await firestoreDb.collection("users").doc(uid).get();
    if (!snap.exists) return null;
    const profile = snap.data();
    profile.uid = uid;
    try {
      const priv = await firestoreDb.collection("users").doc(uid).collection("private").doc("gemini").get();
      profile.geminiApiKey = priv.exists ? (priv.data().apiKey || "") : "";
    } catch (e) {
      profile.geminiApiKey = "";
    }
    return profile;
  }

  async function handleAuthStateChanged(user) {
    if (registering) return;
    if (!user) {
      if (currentUserProfile) { cacheSession(null); emitProfileChange(); }
      return;
    }
    try {
      const profile = await loadProfileFromCloud(user.uid);
      if (!profile) {
        await firebaseAuth.signOut();
        cacheSession(null);
      } else {
        cacheSession(profile);
      }
    } catch (e) {
      console.warn("[Firebase] Không tải được hồ sơ (có thể đang offline), dùng bản lưu cục bộ.", e);
    }
    emitProfileChange();
  }

  // ---------------- Chế độ Demo (Mock) ----------------
  function getMockUsers() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_MOCK_USERS) || "[]"); } catch (e) { return []; }
  }
  function saveMockUsers(users) { localStorage.setItem(STORAGE_KEY_MOCK_USERS, JSON.stringify(users)); }
  function initMockUsersIfEmpty() {
    if (getMockUsers().length > 0) return;
    const now = new Date().toISOString();
    saveMockUsers([
      { uid: "admin_demo", email: DEFAULT_ADMIN_EMAIL, password: "password123", displayName: "Admin Demo",
        school: "THPT Chi Lăng, Lạng Sơn", phone: "", role: "admin", status: "approved",
        geminiApiKey: "", geminiModel: "gemini-flash-latest", createdAt: now, approvedAt: now },
      { uid: "teacher_demo", email: "giaovien.demo@example.com", password: "password123", displayName: "Giáo viên Demo",
        school: "THPT Chi Lăng, Lạng Sơn", phone: "", role: "teacher", status: "pending",
        geminiApiKey: "", geminiModel: "gemini-flash-latest", createdAt: now, approvedAt: null }
    ]);
  }

  // ---------------- Đăng ký / Đăng nhập ----------------
  function buildNewProfile(uid, email, displayName, school, phone) {
    return {
      uid, email, displayName,
      school: school || "THPT Chi Lăng",
      phone: phone || "",
      role: "teacher",          // luôn là teacher; Admin chỉ được đặt thủ công trong Firebase Console
      status: "pending",        // luôn chờ duyệt
      hasGeminiKey: false,
      geminiModel: "gemini-flash-latest",
      createdAt: new Date().toISOString(),
      approvedAt: null
    };
  }

  async function registerUser({ email, password, displayName, school, phone }) {
    const cleanEmail = email.trim().toLowerCase();
    if (!displayName || !displayName.trim()) throw new Error("Vui lòng nhập họ và tên.");

    if (isCloudReady()) {
      registering = true;
      try {
        let user;
        try {
          const cred = await firebaseAuth.createUserWithEmailAndPassword(cleanEmail, password);
          user = cred.user;
        } catch (err) {
          // Tài khoản Auth đã có nhưng hồ sơ bị Admin xoá trước đó → cho phép tạo lại hồ sơ chờ duyệt
          if (err.code === "auth/email-already-in-use") {
            let cred;
            try { cred = await firebaseAuth.signInWithEmailAndPassword(cleanEmail, password); }
            catch (e2) { throw new Error("Email này đã được đăng ký. Hãy chuyển sang tab Đăng Nhập."); }
            const existing = await firestoreDb.collection("users").doc(cred.user.uid).get().catch(() => null);
            if (existing && existing.exists) {
              await firebaseAuth.signOut();
              throw new Error("Email này đã được đăng ký. Hãy chuyển sang tab Đăng Nhập.");
            }
            user = cred.user;
          } else {
            throw friendlyError(err);
          }
        }
        try { await user.updateProfile({ displayName }); } catch (e) {}
        const profile = buildNewProfile(user.uid, cleanEmail, displayName.trim(), school, phone);
        try {
          await firestoreDb.collection("users").doc(user.uid).set(profile);
        } catch (e) {
          try { await user.delete(); } catch (e2) {}
          throw friendlyError(e);
        }
        profile.geminiApiKey = "";
        cacheSession(profile);
        return profile;
      } finally {
        registering = false;
      }
    }

    // Demo
    const users = getMockUsers();
    if (users.some((u) => u.email === cleanEmail)) throw new Error("Email này đã được đăng ký trong hệ thống!");
    const p = buildNewProfile("usr_" + Math.random().toString(36).slice(2, 9), cleanEmail, displayName.trim(), school, phone);
    p.password = password; p.geminiApiKey = "";
    users.push(p); saveMockUsers(users);
    return p;
  }

  async function loginUser(email, password) {
    const cleanEmail = email.trim().toLowerCase();

    if (isCloudReady()) {
      let cred;
      try { cred = await firebaseAuth.signInWithEmailAndPassword(cleanEmail, password); }
      catch (err) { throw friendlyError(err); }
      let profile;
      try { profile = await loadProfileFromCloud(cred.user.uid); }
      catch (err) { await firebaseAuth.signOut(); throw friendlyError(err); }
      if (!profile) {
        await firebaseAuth.signOut();
        throw new Error("Tài khoản chưa có hồ sơ hoặc đã bị Admin xóa. Hãy đăng ký lại hoặc liên hệ Admin.");
      }
      cacheSession(profile);
      return profile;
    }

    const found = getMockUsers().find((u) => u.email === cleanEmail && u.password === password);
    if (!found) throw new Error("Email hoặc mật khẩu không chính xác!");
    cacheSession(found);
    return found;
  }

  async function logoutUser() {
    cacheSession(null);
    if (firebaseAuth) { try { await firebaseAuth.signOut(); } catch (e) {} }
  }

  function getCurrentUser() {
    if (currentUserProfile) return currentUserProfile;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SESSION);
      if (saved) { currentUserProfile = JSON.parse(saved); return currentUserProfile; }
    } catch (e) {}
    return null;
  }

  /** Tải lại hồ sơ từ máy chủ (dùng cho nút "Kiểm Tra Lại" khi chờ duyệt) */
  async function refreshMyProfile() {
    const user = getCurrentUser();
    if (!user) return null;
    if (isCloudReady()) {
      const p = await loadProfileFromCloud(user.uid).catch((e) => { throw friendlyError(e); });
      if (p) cacheSession(p);
      return p;
    }
    const found = getMockUsers().find((u) => u.uid === user.uid);
    if (found) cacheSession(found);
    return found || null;
  }

  async function updateMyGeminiKey(apiKey, modelName) {
    const user = getCurrentUser();
    if (!user) throw new Error("Chưa đăng nhập!");
    const key = (apiKey || "").trim();
    user.geminiApiKey = key;
    if (modelName) user.geminiModel = modelName;
    user.hasGeminiKey = Boolean(key);
    cacheSession(user);

    if (isCloudReady()) {
      try {
        await firestoreDb.collection("users").doc(user.uid).collection("private").doc("gemini").set({ apiKey: key });
        await firestoreDb.collection("users").doc(user.uid).update({
          hasGeminiKey: user.hasGeminiKey, geminiModel: user.geminiModel
        });
      } catch (e) { throw friendlyError(e); }
    } else {
      const users = getMockUsers();
      const i = users.findIndex((u) => u.uid === user.uid);
      if (i !== -1) { users[i].geminiApiKey = key; users[i].geminiModel = user.geminiModel; users[i].hasGeminiKey = user.hasGeminiKey; saveMockUsers(users); }
    }
  }

  // ---------------- Admin ----------------
  function assertAdmin() {
    const a = getCurrentUser();
    if (!a || a.role !== "admin") throw new Error("Chỉ Quản Trị Viên (Admin) mới có quyền này!");
    return a;
  }

  async function adminFetchAllUsers() {
    assertAdmin();
    if (isCloudReady()) {
      try {
        const snap = await firestoreDb.collection("users").get();
        const list = [];
        snap.forEach((d) => { const x = d.data(); x.uid = d.id; list.push(x); });
        list.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
        return list;
      } catch (e) { throw friendlyError(e); }
    }
    return getMockUsers().map((u) => ({ ...u, hasGeminiKey: Boolean(u.geminiApiKey) }));
  }

  async function adminUpdate(targetUid, fields) {
    assertAdmin();
    if (isCloudReady()) {
      try { await firestoreDb.collection("users").doc(targetUid).update(fields); }
      catch (e) { throw friendlyError(e); }
      return;
    }
    const users = getMockUsers();
    const t = users.find((u) => u.uid === targetUid);
    if (t) { Object.assign(t, fields); saveMockUsers(users); }
  }

  async function adminApproveUser(targetUid) {
    const a = assertAdmin();
    await adminUpdate(targetUid, { status: "approved", approvedAt: new Date().toISOString(), approvedBy: a.email });
  }
  async function adminBlockUser(targetUid) {
    assertAdmin();
    await adminUpdate(targetUid, { status: "blocked" });
  }
  async function adminDeleteUser(targetUid) {
    const a = assertAdmin();
    if (a.uid === targetUid) throw new Error("Không thể tự xóa tài khoản Admin đang đăng nhập!");
    if (isCloudReady()) {
      try { await firestoreDb.collection("users").doc(targetUid).delete(); }
      catch (e) { throw friendlyError(e); }
      return;
    }
    saveMockUsers(getMockUsers().filter((u) => u.uid !== targetUid));
  }

  window.SmartAuth = {
    initFirebase, getFirebaseConfig, saveFirebaseConfig, isFirebaseConfigured, isCloudReady,
    registerUser, loginUser, logoutUser, getCurrentUser, refreshMyProfile, onProfileChange,
    updateMyGeminiKey, adminFetchAllUsers, adminApproveUser, adminBlockUser, adminDeleteUser
  };
})(window);
