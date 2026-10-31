# Hướng dẫn tạo phần quản lý tài khoản bằng Firebase (SmartOMR Pro)

## Bước 1. Tạo dự án
1. Vào https://console.firebase.google.com → đăng nhập Gmail của thầy → **Create a project** (tắt Google Analytics cũng được).

## Bước 2. Bật đăng nhập Email/Password
Build → **Authentication** → Get started → tab **Sign-in method** → **Email/Password** → bật **Enable** → Save.

## Bước 3. Tạo cơ sở dữ liệu Firestore
Build → **Firestore Database** → Create database → chọn vị trí gần nhất (asia-southeast1 Singapore) → chọn **Production mode** → Enable.

## Bước 4. Dán Rules bảo mật
Firestore → tab **Rules** → xoá hết → dán toàn bộ nội dung file `firestore.rules` → **Publish**.

## Bước 5. Lấy cấu hình web và dán vào code
1. Project settings (bánh răng) → **General** → cuộn xuống **Your apps** → biểu tượng `</>` (Web) → đặt tên app → Register app.
2. Copy khối `firebaseConfig`.
3. Mở `firebase-config.js`, dán 6 giá trị vào `EMBEDDED_FIREBASE_CONFIG`. (Các giá trị này là công khai, an toàn khi để trong code.)

## Bước 6. Cho phép tên miền web của thầy
Authentication → **Settings** → **Authorized domains** → **Add domain** → nhập tên miền chạy app, ví dụ `tenban.github.io` (không có https://, không có đường dẫn).

## Bước 7. Tạo tài khoản Admin đầu tiên
1. Mở web đã deploy → **Đăng ký** bằng email của thầy (sẽ ở trạng thái "chờ duyệt").
2. Firebase Console → Firestore Database → Data → collection `users` → mở document của thầy (ID = UID).
3. Sửa 2 trường: `role` = `admin`, `status` = `approved` → Update.
4. Trên web: đăng xuất → đăng nhập lại → vào Cài Đặt sẽ thấy nút quản trị.

## Bước 8. Vận hành hằng ngày
- Giáo viên đăng ký → thầy vào Bảng Quản Trị → **Phê Duyệt**.
- **Khóa tạm thời / Mở khóa** để ngừng/cho dùng lại.
- **Xóa** chỉ xóa hồ sơ trong Firestore. Muốn xóa hẳn email: Authentication → Users → ⋮ → Delete account.

## Kiểm tra nhanh nếu lỗi
| Thông báo | Cách xử lý |
|---|---|
| Tên miền chưa được thêm vào Authorized domains | Làm Bước 6 |
| Chưa bật đăng nhập Email/Password | Làm Bước 2 |
| Firestore từ chối quyền truy cập | Làm Bước 4 (Publish Rules) |
| Đăng nhập xong vẫn "chờ duyệt" | Thầy chưa bấm Phê Duyệt, hoặc bấm "Kiểm Tra Lại" |
