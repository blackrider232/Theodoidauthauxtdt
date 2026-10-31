# HƯỚNG DẪN TRIỂN KHAI & VẬN HÀNH BẢO MẬT CAO - QUẢN LÝ ĐẤU THẦU SCE V2

## 1. Những nâng cấp cốt lõi từ Bản V1 lên Bản V2 Enterprise Security

| Hạng mục | Bản V1 (Cũ) | Bản V2 (Enterprise Security Mới) |
| :--- | :--- | :--- |
| **Cơ chế Đăng nhập** | Lưu mật khẩu dạng rõ (Plaintext) trong JSON và `localStorage` (`btoa`). | **Supabase Auth chính thức (Email & Mật khẩu)** mã hóa `bcrypt` cấp máy chủ + Phiên **JWT** tự động làm mới. |
| **Xác thực 2 lớp (2FA)** | Không có. | Tích hợp **2FA / TOTP (Google Authenticator)** bằng mã QR ngay trong mục Cài đặt tài khoản. |
| **Bảo mật Cơ sở dữ liệu** | Bảng `app_data` mở quyền cho `anon` key. | Hệ thống bảng độc lập `sce_v2_profiles`, `sce_v2_app_data`, `sce_v2_backups`, `sce_v2_audit_logs` bật **Row Level Security (RLS) 100%**, chặn hoàn toàn truy cập nặc danh (`anon`). |
| **Quy trình Đấu thầu & Pháp lý** | Phải nhập thủ công nếu tạo mới. | **Đã sao chép sẵn 100% 04 Quy trình thầu mẫu (39 bước) và 09 Văn bản pháp lý** từ bản V1 sang cả mã nguồn V2 lẫn file SQL khởi tạo. |
| **Tự động khóa phiên** | Không có. | Tự động đăng xuất sau **30 phút không tương tác** để bảo vệ dữ liệu đấu thầu nhạy cảm. |

---

## 2. Danh mục 04 Quy trình Đấu thầu & 09 Văn bản Pháp lý đã được chuyển sang V2

Hệ thống V2 đã nạp sẵn toàn bộ cấu hình của bạn tại `src/data/seed_templates_and_docs.json`, `database/supabase_v2_security_schema.sql` và trong `index.html`:
1. **Quy trình Chỉ định thầu** (`chidinh` - 08 bước chuẩn)
2. **Đấu thầu rộng rãi (Phi tư vấn / Hàng hóa)** (`rongrai` - 08 bước chuẩn)
3. **Đấu thầu rộng rãi (Gói CNTT)** (`rongrai_cntt` - 18 bước chuẩn từ Khảo sát, Thẩm định KHĐT đến Nghiệm thu & Thanh lý HĐ)
4. **Mua sắm dưới 100 triệu** (`proc_1790739263585` - 05 bước chuẩn)
5. **09 Văn bản pháp lý** (Luật Đấu thầu 22/2023/QH15, Luật 57/2024/QH15, Luật 90/2025/QH15, NĐ 214/2025/NĐ-CP, TT 79/2025/TT-BTC, NĐ 73/2019/NĐ-CP, NĐ 82/2024/NĐ-CP, NQ 25/2022/NQ-HĐND, QĐ 1516/QĐ-UBND).

---

## 3. Các bước triển khai Hệ thống V2 (Chỉ mất 2 phút)

### Bước 1: Chạy kịch bản SQL Bảo mật V2 trên Supabase
1. Mở giao diện `index.html` của thư mục **Quản lý đấu thầu SCE v2**, bấm nút **"Cấu hình DB"** ở góc phải trên khung đăng nhập, sau đó bấm **"Copy toàn bộ SQL V2"** (Hoặc mở trực tiếp file `database/supabase_v2_security_schema.sql`).
2. Truy cập **Supabase Dashboard** &rarr; Chọn mục **SQL Editor** &rarr; **New Query**.
3. Dán toàn bộ nội dung SQL vừa copy và nhấn **Run**.
   - Kịch bản này tạo bộ bảng `sce_v2_*` hoàn toàn độc lập (không ảnh hưởng đến dữ liệu V1 cũ của bạn), bật RLS và nạp sẵn 4 quy trình thầu.

### Bước 2: Cấu hình Email Auth trên Supabase
1. Trong **Supabase Dashboard** &rarr; **Authentication** &rarr; **Providers** &rarr; **Email**:
   - Đảm bảo **Enable Email provider** đang bật.
   - *(Khuyến nghị cho mạng nội bộ)*: Tắt mục **"Confirm email"** nếu bạn muốn các chuyên viên đăng ký xong có thể đăng nhập ngay lập tức mà không cần bấm link xác nhận trong hòm thư.

### Bước 3: Đăng ký Tài khoản Quản trị viên (Admin) đầu tiên
1. Mở ứng dụng **Quản lý đấu thầu SCE v2** &rarr; Chuyển sang tab **"Đăng ký Auth mới"**.
2. Nhập **Họ và tên**, **Email công vụ** và **Mật khẩu** (tối thiểu 6 ký tự) &rarr; Bấm **"Tạo Tài khoản Supabase Auth"**.
3. Trigger bảo mật trên PostgreSQL sẽ **tự động cấp quyền `admin` (Quản trị viên toàn quyền)** cho tài khoản đầu tiên đăng ký trên hệ thống!
4. Sau khi đăng nhập, bạn có thể bấm vào tên của mình trên thanh Header để bật **Xác thực 2 yếu tố (2FA / Google Authenticator)**.
