# HỆ THỐNG QUẢN TRỊ ĐẤU THẦU - SCE ENTERPRISE
> Trung tâm Xúc tiến đầu tư và Hỗ trợ doanh nghiệp Hà Nội (SCE)

---

## 📁 Cấu trúc thư mục dự án

```text
sce-bid-management/
├── index.html          # Ứng dụng web Single-Page Application (Frontend hoàn chỉnh)
├── backend/
│   └── Code.gs         # Mã nguồn Google Apps Script (Backend & CSDL Google Sheets)
└── README.md           # Tài liệu hướng dẫn sử dụng và triển khai
```

---

## 🛠️ Các cải tiến & Lỗi đã được khắc phục toàn diện

1. **Sửa lỗi Trùng lặp hàm (Duplicate Function):**
   - Đã loại bỏ hoàn toàn việc định nghĩa 2 lần hàm `window.deleteProcessTemplate`. Quy trình kiểm tra phân quyền Admin và xác nhận SweetAlert2 hoạt động chính xác.

2. **Nâng cấp Xuất Excel chuẩn Native `.xlsx` (SheetJS):**
   - Đã tích hợp thư viện **SheetJS (`xlsx.full.min.js`)**.
   - Khắc phục triệt để lỗi cảnh báo vàng *"The file format and extension don't match"* khi mở trên Microsoft Excel.
   - Định dạng bảng biểu chuyên nghiệp, tự động căn chỉnh độ rộng cột (`wch`) cho cả **Xuất Tổng hợp** và **Xuất chi tiết Gói thầu**.

3. **Bảo mật & Phòng chống tấn công XSS:**
   - Thêm bộ lọc `escapeHtml()` khử toàn bộ ký tự đặc biệt (`<`, `>`, `"`, `'`, `&`) khi render dữ liệu động, tránh lỗi vỡ DOM hoặc chèn mã độc.

4. **Tối ưu hóa hiệu năng Kéo - Thả (SortableJS):**
   - Quản lý vòng đời các instance SortableJS, hủy và tái khởi tạo chuẩn xác khi chuyển tab hoặc lọc dữ liệu, tránh hiện tượng rò rỉ bộ nhớ (memory leak) hoặc kéo thả bị giật lag.

5. **Hoàn thiện Backend Google Apps Script (`backend/Code.gs`):**
   - Tích hợp **`LockService`** chống xung đột ghi dữ liệu đồng thời khi nhiều chuyên viên cùng lưu vào hệ thống.
   - Tự động tạo và quản lý **50 bản sao lưu gần nhất (Snapshot Backups)** trong trang tính `Backups`.
   - Cung cấp API `?action=getBackups` và `?action=loadBackup&id=...` hỗ trợ khôi phục tức thì từ giao diện web.

---

## 🚀 Hướng dẫn Cài đặt & Triển khai

### Bước 1: Cấu hình Backend Google Sheets & Apps Script
1. Truy cập [Google Sheets](https://sheets.new) và tạo 1 bảng tính mới (đặt tên: `CSDL_QuanTri_DauThau_SCE`).
2. Trên thanh menu, chọn: **Tiện ích mở rộng** (Extensions) &rarr; **Apps Script**.
3. Xóa hết code mặc định, mở file [`backend/Code.gs`](backend/Code.gs) trong dự án này, copy toàn bộ và dán vào Apps Script.
4. Bấm **Lưu** (Ctrl + S).
5. Bấm **Triển khai** (Deploy) &rarr; **Tùy chọn triển khai mới** (New deployment):
   - Chọn loại: **Ứng dụng web** (Web app).
   - Mô tả: `SCE Bid Management Production v1.0`.
   - Thực thi dưới dạng (Execute as): **Tôi** (Me).
   - Ai có quyền truy cập (Who has access): **Bất kỳ ai** (Anyone) *(Bắt buộc chọn Anyone để web frontend gửi request không bị chặn CORS)*.
6. Cấp quyền truy cập cho tài khoản Google của bạn.
7. Sau khi hoàn tất, copy đường dẫn **Web App URL** (có dạng `https://script.google.com/macros/s/.../exec`).

### Bước 2: Cấu hình Frontend
1. Mở file [`index.html`](index.html).
2. Tìm biến `GAS_URL` ở đầu khối `<script>` (dòng khoảng 247):
   ```javascript
   const GAS_URL = "DÁN_URL_WEB_APP_CỦA_BẠN_VÀO_ĐÂY";
   ```
3. Lưu file `index.html`.

### Bước 3: Chạy ứng dụng
- Bạn có thể nhấp đúp trực tiếp vào file [`index.html`](index.html) để mở trên trình duyệt web (Chrome, Edge, Firefox,...), hoặc đẩy lên GitHub Pages, Firebase Hosting, Cloudflare Pages tùy ý.

---

## 🔐 Tài khoản mặc định hệ thống

| Tên đăng nhập | Mật khẩu | Họ và tên | Vai trò |
| :--- | :--- | :--- | :--- |
| `admin` | `Xtdt@Sce` | Quản trị viên SCE | Admin (Toàn quyền) |

*(Sau khi đăng nhập với tài khoản Admin, bạn có thể vào tab **Tài khoản** để tạo thêm các tài khoản Chuyên viên hoặc Lãnh đạo).*

---

## 📋 Hướng dẫn In ấn & Thể thức văn bản
- **In Báo cáo Giao ban:** Đã định dạng chuẩn theo thể thức văn bản hành chính Việt Nam (Quốc hiệu, Tiêu ngữ, Tên cơ quan ban hành, căn cứ thời gian, chữ ký Người lập báo cáo).
- **Lưu ý:** Khi bấm nút **In**, hãy bật tính năng *"Cho phép Pop-up"* trên trình duyệt nếu bị chặn cửa sổ in.
