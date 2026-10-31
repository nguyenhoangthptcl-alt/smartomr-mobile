/**
 * SmartOMR Pro Mobile — Cấu Hình & Module Quản Lý Xác Thực Firebase
 * - Đăng ký / Đăng nhập tài khoản giáo viên
 * - Quản trị duyệt tài khoản bởi Admin (Thầy Nguyễn Văn Hoàng)
 * - Quản lý Gemini API Key riêng biệt cho từng tài khoản
 * - Hỗ trợ cả Firebase thật và Chế độ Mô phỏng (Mock Mode) khi chưa cấu hình Firebase
 */

(function (window) {
  "use strict";

  const STORAGE_KEY_CONFIG = "smartomr_firebase_config";
  const STORAGE_KEY_SESSION = "smartomr_auth_session";
  const STORAGE_KEY_MOCK_USERS = "smartomr_mock_users";

  // Cấu hình mẫu mặc định (Thầy Hoàng có thể thay thế bằng config từ Firebase Console)
  const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  };

  // Mật khẩu bí mật Admin dùng khi tạo tài khoản Admin đầu tiên (nếu cần kích hoạt ngay)
  const ADMIN_SECRET_CODE = "CHILANG2025";
  const DEFAULT_ADMIN_EMAIL = "hoang.thptchilang@gmail.com";

  let firebaseApp = null;
  let firebaseAuth = null;
  let firestoreDb = null;
  let currentUserProfile = null;

  // Lấy cấu hình đã lưu
  function getFirebaseConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      return saved ? JSON.parse(saved) : DEFAULT_FIREBASE_CONFIG;
    } catch (e) {
      return DEFAULT_FIREBASE_CONFIG;
    }
  }

  function saveFirebaseConfig(cfg) {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(cfg));
  }

  function isFirebaseConfigured() {
    const cfg = getFirebaseConfig();
    return Boolean(cfg && cfg.apiKey && cfg.projectId);
  }

  // Khởi tạo Firebase SDK
  function initFirebase() {
    const cfg = getFirebaseConfig();
    if (isFirebaseConfigured() && window.firebase) {
      try {
        if (!firebase.apps.length) {
          firebaseApp = firebase.initializeApp(cfg);
        } else {
          firebaseApp = firebase.app();
        }
        firebaseAuth = firebase.auth();
        firestoreDb = firebase.firestore();
        console.log("[Firebase] Đã kết nối Firebase Cloud thành công!");
        return true;
      } catch (err) {
        console.warn("[Firebase] Khởi tạo Firebase lỗi, dùng chế độ Local Mock:", err);
      }
    } else {
      console.log("[Firebase] Chưa cấu hình Project ID, chạy ở chế độ Local Mock.");
    }
    initMockUsersIfEmpty();
    return false;
  }

  // =========================================================================
  // MOCK STORAGE: Dành cho chạy thử khi thầy chưa cấu hình Firebase
  // =========================================================================
  function initMockUsersIfEmpty() {
    let users = getMockUsers();
    if (!users || users.length === 0) {
      users = [
        {
          uid: "admin_hoang_01",
          email: DEFAULT_ADMIN_EMAIL,
          password: "password123",
          displayName: "Thầy Nguyễn Văn Hoàng",
          school: "THPT Chi Lăng, Lạng Sơn",
          phone: "0988888888",
          role: "admin",
          status: "approved",
          geminiApiKey: localStorage.getItem("smartomr_gemini_key") || "",
          geminiModel: "gemini-flash-latest",
          createdAt: new Date().toISOString(),
          approvedAt: new Date().toISOString()
        },
        {
          uid: "teacher_demo_02",
          email: "giaovien.toan@gmail.com",
          password: "password123",
          displayName: "Cô Trần Thị Mai",
          school: "THPT Chi Lăng, Lạng Sơn",
          phone: "0912345678",
          role: "teacher",
          status: "pending",
          geminiApiKey: "",
          geminiModel: "gemini-flash-latest",
          createdAt: new Date().toISOString(),
          approvedAt: null
        }
      ];
      saveMockUsers(users);
    }
  }

  function getMockUsers() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_MOCK_USERS) || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveMockUsers(users) {
    localStorage.setItem(STORAGE_KEY_MOCK_USERS, JSON.stringify(users));
  }

  // =========================================================================
  // AUTH API: ĐĂNG KÝ, ĐĂNG NHẬP, DUYỆT TÀI KHOẢN
  // =========================================================================

  /**
   * Đăng ký tài khoản giáo viên mới
   */
  async function registerUser({ email, password, displayName, school, phone, adminSecret }) {
    const cleanEmail = email.trim().toLowerCase();
    const isSpecialAdmin = (adminSecret && adminSecret.trim() === ADMIN_SECRET_CODE) || cleanEmail === DEFAULT_ADMIN_EMAIL;
    const role = isSpecialAdmin ? "admin" : "teacher";
    const status = isSpecialAdmin ? "approved" : "pending";

    // 1. Nếu có Firebase Cloud
    if (isFirebaseConfigured() && firebaseAuth && firestoreDb) {
      const userCred = await firebaseAuth.createUserWithEmailAndPassword(cleanEmail, password);
      const user = userCred.user;
      await user.updateProfile({ displayName: displayName });

      const profile = {
        uid: user.uid,
        email: cleanEmail,
        displayName: displayName,
        school: school || "THPT Chi Lăng",
        phone: phone || "",
        role: role,
        status: status,
        geminiApiKey: "",
        geminiModel: "gemini-flash-latest",
        createdAt: new Date().toISOString(),
        approvedAt: isSpecialAdmin ? new Date().toISOString() : null
      };

      await firestoreDb.collection("users").doc(user.uid).set(profile);
      return profile;
    }

    // 2. Chế độ Mock Storage
    const users = getMockUsers();
    if (users.some((u) => u.email === cleanEmail)) {
      throw new Error("Email này đã được đăng ký trong hệ thống!");
    }

    const newProfile = {
      uid: "usr_" + Math.random().toString(36).substring(2, 9),
      email: cleanEmail,
      password: password,
      displayName: displayName,
      school: school || "THPT Chi Lăng",
      phone: phone || "",
      role: role,
      status: status,
      geminiApiKey: "",
      geminiModel: "gemini-flash-latest",
      createdAt: new Date().toISOString(),
      approvedAt: isSpecialAdmin ? new Date().toISOString() : null
    };

    users.push(newProfile);
    saveMockUsers(users);
    return newProfile;
  }

  /**
   * Đăng nhập tài khoản
   */
  async function loginUser(email, password) {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Nếu có Firebase Cloud
    if (isFirebaseConfigured() && firebaseAuth && firestoreDb) {
      const userCred = await firebaseAuth.signInWithEmailAndPassword(cleanEmail, password);
      const user = userCred.user;
      const doc = await firestoreDb.collection("users").doc(user.uid).get();

      if (!doc.exists) {
        throw new Error("Không tìm thấy hồ sơ người dùng trên Firestore!");
      }

      const profile = doc.data();
      currentUserProfile = profile;
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(profile));
      return profile;
    }

    // 2. Chế độ Mock Storage
    const users = getMockUsers();
    const found = users.find((u) => u.email === cleanEmail && u.password === password);
    if (!found) {
      throw new Error("Email hoặc mật khẩu không chính xác!");
    }

    currentUserProfile = found;
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(found));
    return found;
  }

  /**
   * Đăng xuất
   */
  async function logoutUser() {
    currentUserProfile = null;
    localStorage.removeItem(STORAGE_KEY_SESSION);
    if (isFirebaseConfigured() && firebaseAuth) {
      try {
        await firebaseAuth.signOut();
      } catch (e) {}
    }
  }

  /**
   * Lấy hồ sơ người dùng đang đăng nhập
   */
  function getCurrentUser() {
    if (currentUserProfile) return currentUserProfile;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SESSION);
      if (saved) {
        currentUserProfile = JSON.parse(saved);
        return currentUserProfile;
      }
    } catch (e) {}
    return null;
  }

  /**
   * Cập nhật Google Gemini API Key riêng biệt của tài khoản này
   */
  async function updateMyGeminiKey(apiKey, modelName) {
    const user = getCurrentUser();
    if (!user) throw new Error("Chưa đăng nhập!");

    user.geminiApiKey = apiKey.trim();
    if (modelName) user.geminiModel = modelName;
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(user));

    // Cập nhật lên Firebase Firestore
    if (isFirebaseConfigured() && firestoreDb) {
      await firestoreDb.collection("users").doc(user.uid).update({
        geminiApiKey: user.geminiApiKey,
        geminiModel: user.geminiModel
      });
    } else {
      // Mock storage
      const users = getMockUsers();
      const idx = users.findIndex((u) => u.uid === user.uid);
      if (idx !== -1) {
        users[idx].geminiApiKey = user.geminiApiKey;
        users[idx].geminiModel = user.geminiModel;
        saveMockUsers(users);
      }
    }
  }

  // =========================================================================
  // ADMIN API: QUẢN LÝ & PHÊ DUYỆT TÀI KHOẢN
  // =========================================================================

  /**
   * Lấy danh sách toàn bộ người dùng (chỉ Admin mới được gọi)
   */
  async function adminFetchAllUsers() {
    const admin = getCurrentUser();
    if (!admin || admin.role !== "admin") {
      throw new Error("Chỉ tài khoản Quản Trị Viên (Admin) mới có quyền truy cập chức năng này!");
    }

    if (isFirebaseConfigured() && firestoreDb) {
      const snap = await firestoreDb.collection("users").get();
      const list = [];
      snap.forEach((doc) => list.push(doc.data()));
      return list;
    }

    return getMockUsers();
  }

  /**
   * Phê duyệt tài khoản (chuyển sang approved)
   */
  async function adminApproveUser(targetUid) {
    const admin = getCurrentUser();
    if (!admin || admin.role !== "admin") {
      throw new Error("Bạn không có quyền quản trị viên!");
    }

    const now = new Date().toISOString();
    if (isFirebaseConfigured() && firestoreDb) {
      await firestoreDb.collection("users").doc(targetUid).update({
        status: "approved",
        approvedAt: now,
        approvedBy: admin.email
      });
      return;
    }

    const users = getMockUsers();
    const target = users.find((u) => u.uid === targetUid);
    if (target) {
      target.status = "approved";
      target.approvedAt = now;
      target.approvedBy = admin.email;
      saveMockUsers(users);
    }
  }

  /**
   * Khóa / Tạm dừng tài khoản (chuyển sang blocked)
   */
  async function adminBlockUser(targetUid) {
    const admin = getCurrentUser();
    if (!admin || admin.role !== "admin") {
      throw new Error("Bạn không có quyền quản trị viên!");
    }

    if (isFirebaseConfigured() && firestoreDb) {
      await firestoreDb.collection("users").doc(targetUid).update({
        status: "blocked"
      });
      return;
    }

    const users = getMockUsers();
    const target = users.find((u) => u.uid === targetUid);
    if (target) {
      target.status = "blocked";
      saveMockUsers(users);
    }
  }

  /**
   * Xóa tài khoản
   */
  async function adminDeleteUser(targetUid) {
    const admin = getCurrentUser();
    if (!admin || admin.role !== "admin") {
      throw new Error("Bạn không có quyền quản trị viên!");
    }

    if (isFirebaseConfigured() && firestoreDb) {
      await firestoreDb.collection("users").doc(targetUid).delete();
      return;
    }

    let users = getMockUsers();
    users = users.filter((u) => u.uid !== targetUid);
    saveMockUsers(users);
  }

  // Export module ra window để app.js dùng
  window.SmartAuth = {
    initFirebase,
    getFirebaseConfig,
    saveFirebaseConfig,
    isFirebaseConfigured,
    registerUser,
    loginUser,
    logoutUser,
    getCurrentUser,
    updateMyGeminiKey,
    adminFetchAllUsers,
    adminApproveUser,
    adminBlockUser,
    adminDeleteUser,
    ADMIN_SECRET_CODE
  };

})(window);
