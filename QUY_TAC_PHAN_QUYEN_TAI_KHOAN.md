# QUY TẮC VÀ LOGIC PHÂN QUYỀN TÀI KHOẢN (RBAC)
**Phần mềm Quản lý Đấu thầu & Tiến độ Công việc — SCE v2**  
*Đơn vị áp dụng: Trung tâm Xúc tiến đầu tư và Hỗ trợ doanh nghiệp Hà Nội (SCE) — Sở Tài chính Hà Nội*  
*Cập nhật: Tháng 11/2026*

---

## 1. Cơ Cấu Đơn Vị & Các Vai Trò Tài Khoản

### 1.1. Danh mục 4 Phòng chuyên môn chuẩn (`SCE_DEPARTMENTS`)
Đối với các tài khoản thuộc cấp Phòng (**Lãnh đạo phòng** và **Chuyên viên thực hiện**), hệ thống bắt buộc gắn đúng 1 trong 4 phòng chuyên môn thuộc Trung tâm:
- `Phòng Hành chính - Tổ chức`
- `Phòng Phát triển doanh nghiệp`
- `Phòng Xúc tiến đầu tư`
- `Phòng Tư vấn doanh nghiệp`

*(Tài khoản **Admin** gắn phạm vi `Toàn Trung tâm`; tài khoản **Ban Giám đốc** gắn phạm vi `Ban Giám đốc` — không phụ thuộc cố định vào 1 phòng đơn lẻ).*

### 1.2. Chuẩn hóa 4 Vai trò (`normalizeRole`)
Hệ thống duy trì đúng **4 vai trò** (đã loại bỏ hoàn toàn vai trò kiểm toán viên `auditor`):
- **`admin` — Quản trị viên (Admin):** Toàn quyền quản trị hệ thống, quy trình mẫu, biểu mẫu chuẩn, tài khoản nhân sự, văn bản pháp quy, sao lưu và dữ liệu nghiệp vụ toàn Trung tâm.
- **`leader` — Ban Giám đốc:** Chế độ **Giám sát chỉ đọc (Read-only Supervisor)** trên toàn bộ 4 phòng chuyên môn của Trung tâm.
- **`dept_leader` — Lãnh đạo phòng:** Chế độ **Giám sát chỉ đọc (Read-only Supervisor)** đối với toàn bộ nhiệm vụ và gói thầu thuộc phòng chuyên môn của mình. *(Mã `team_lead` cũ trong CSDL nếu có sẽ tự động quy đổi sang `dept_leader`).*
- **`user` — Chuyên viên thực hiện:** Trực tiếp khởi tạo và cập nhật tiến độ, hồ sơ, ghi chú trên các nhiệm vụ/gói thầu do chính mình phụ trách (`owner`). *(Mọi mã quyền không xác định hoặc `auditor` cũ đều tự động quy đổi về `user`).*

---

## 2. Ma Trận Phân Quyền Chi Tiết Theo Chức Năng

| Nhóm chức năng | Admin (`admin`) | Ban Giám đốc (`leader`) | Lãnh đạo phòng (`dept_leader`) | Chuyên viên (`user`) |
| :--- | :--- | :--- | :--- | :--- |
| **Phạm vi xem Danh sách dự án, Kanban, Lịch biểu, Dashboard** | Toàn bộ 4 phòng | Toàn bộ 4 phòng | Chỉ các nhiệm vụ/gói thầu thuộc **phòng mình** (hoặc mình đứng tên) | Chỉ các nhiệm vụ/gói thầu do **chính mình phụ trách (`owner`)** |
| **Bộ lọc Phòng chuyên môn & Chuyên viên** | Mở khóa lọc cả 4 phòng & toàn bộ chuyên viên | Mở khóa lọc cả 4 phòng & toàn bộ chuyên viên | Khóa cố định ở phòng mình; lọc được các chuyên viên trong phòng | Khóa cố định ở phòng mình và tên chính mình |
| **Xuất báo cáo Excel / PDF / In ấn** | Toàn bộ dữ liệu được xem | Toàn bộ dữ liệu toàn Trung tâm | Dữ liệu trong phạm vi phòng mình | Dữ liệu các gói thầu do mình phụ trách |
| **Tạo mới Nhiệm vụ chính / Gói thầu (Nhiệm vụ cụ thể)** | Có (phân công được cho mọi chuyên viên) | **Không** (ẩn nút tạo, chỉ giám sát) | **Không** (ẩn nút tạo, chỉ giám sát) | Có (khi tạo gói thầu, người phụ trách mặc định khóa vào tên chính mình) |
| **Chỉnh sửa thông tin Nhiệm vụ / Gói thầu** | Toàn quyền mọi gói thầu | **Không** (chỉ đọc) | **Không** (chỉ đọc) | Chỉ gói thầu/nhiệm vụ có `owner === fullname` của mình |
| **Tích hoàn thành bước, thêm việc nhỏ, đính kèm file/link, ghi chú nhanh, đổi thứ tự bước** | Toàn quyền mọi gói thầu | **Không** (khóa checkbox & nút sửa) | **Không** (khóa checkbox & nút sửa) | Chỉ trên gói thầu do chính mình phụ trách (`owner`) |
| **Hoàn tác / Làm lại (`Ctrl+Z` / `Ctrl+Y`)** | Có | Không có thao tác ghi | Không có thao tác ghi | Có (trong phạm vi thao tác của mình) |
| **Lưu trữ / Khôi phục / Xóa Nhiệm vụ hoặc Gói thầu** | Toàn quyền | **Không** | **Không** | Chỉ trên nhiệm vụ/gói thầu do mình đứng tên `owner` |
| **Xem Nhật ký hoạt động gói thầu (Audit Log)** | Xem toàn Trung tâm | Xem toàn Trung tâm | Xem các gói thuộc phòng mình | **Không** có quyền mở xem Nhật ký kiểm tra |
| **Biểu mẫu công đoạn (`templateForm`)** | Tải lên / Gắn link / Xóa mẫu chuẩn, đồng bộ sang gói đang chạy & Tải về máy | Chỉ hiện nút ở bước có mẫu & **chỉ tải biểu mẫu về máy** | Chỉ hiện nút ở bước có mẫu & **chỉ tải biểu mẫu về máy** | Chỉ hiện nút ở bước có mẫu & **chỉ tải biểu mẫu về máy** (không có quyền sửa trực tiếp mẫu gốc) |
| **Tab Văn bản pháp quy (`view-docs`)** | Xem + Thêm / Sửa / Xóa văn bản & file đính kèm | Chỉ xem & mở văn bản | Chỉ xem & mở văn bản | Chỉ xem & mở văn bản |
| **Tab Quy trình (`view-settings`)** | Toàn quyền tạo, đổi tên, sửa bước, xóa/khôi phục quy trình gốc & đồng bộ gói đang chạy | Ẩn tab & chặn truy cập | Ẩn tab & chặn truy cập | Ẩn tab & chặn truy cập |
| **Tab Tài khoản (`view-users`)** | Toàn quyền phê duyệt, khóa, thêm, phân quyền, đổi phòng, xóa tài khoản | Ẩn tab & chặn truy cập | Ẩn tab & chặn truy cập | Ẩn tab & chặn truy cập |
| **Tab Sao lưu (`view-backups`)** | Toàn quyền tạo bản sao lưu, khôi phục JSON/Cloud | Ẩn tab & chặn truy cập | Ẩn tab & chặn truy cập | Ẩn tab & chặn truy cập |

---

## 3. Logic Kiểm Tra Quyền Trong Ứng Dụng (Frontend Guards)

### 3.1. Nguyên tắc Giám sát chỉ đọc (`isReadOnlySupervisor`)
- Áp dụng cho `leader` (Ban Giám đốc) và `dept_leader` (Lãnh đạo phòng).
- Lý do thiết kế: Giúp Lãnh đạo Trung tâm và Lãnh đạo phòng theo dõi tiến độ, hạn chót, cảnh báo quá hạn, tải biểu mẫu/tài liệu và kiểm tra Nhật ký hoạt động trên máy tính hoặc điện thoại mà **không lo chạm nhầm** làm thay đổi trạng thái hoàn thành hoặc xóa nhầm dữ liệu của chuyên viên.

### 3.2. Logic xác định Phòng ban của Nhiệm vụ & Gói thầu
- **Phòng của Nhiệm vụ chính (`getMissionDepartment`):** Lấy `mission.department`; nếu dữ liệu cũ chưa có trường này thì tự động tra cứu phòng ban của `mission.owner` trong danh sách nhân sự.
- **Phòng của Gói thầu (`getPackageDepartment`):** Ưu tiên lấy `pkg.department` -> nếu trống thì tra cứu phòng ban của chuyên viên chủ trì `pkg.owner` -> nếu vẫn trống thì kế thừa từ phòng của Nhiệm vụ chính.

### 3.3. Logic Quyền Xem (`canViewPackage` & `canViewMission`)
- **Xem Gói thầu (`canViewPackage`):**
  - Nếu `role` là `admin` hoặc `leader` -> Cho phép xem (`true`).
  - Nếu `role` là `dept_leader` -> Cho phép xem khi `pkgDept === myDept` (cùng phòng chuyên môn) hoặc chính mình đứng tên chủ trì.
  - Nếu `role` là `user` -> Chỉ cho phép xem khi `pkgOwner === currentUser.fullname`.
- **Xem Nhiệm vụ chính (`canViewMission`):**
  - `admin` và `leader` xem toàn bộ.
  - `dept_leader` xem được mọi Nhiệm vụ chính thuộc phòng mình hoặc có chứa ít nhất 1 gói thầu thuộc phòng mình.
  - `user` xem được Nhiệm vụ chính do mình tạo hoặc có chứa ít nhất 1 gói thầu do mình phụ trách (các gói thầu của người khác nằm chung trong Nhiệm vụ chính đó vẫn bị ẩn đối với `user`).

### 3.4. Logic Quyền Chỉnh sửa (`canEditPackage` & `canEditMission`)
- Nếu `role === 'admin'` -> Luôn cho phép chỉnh sửa (`true`).
- Nếu `role === 'leader'` hoặc `role === 'dept_leader'` -> Luôn từ chối chỉnh sửa (`false`).
- Nếu `role === 'user'` -> Chỉ cho phép chỉnh sửa khi `owner === currentUser.fullname`.
- **Quy tắc tuần tự các bước trong gói thầu:** Ngay cả khi có quyền `canEditPackage`, một bước công việc (và các việc nhỏ bên trong) chỉ mở khóa cho phép tích hoàn thành khi **tất cả các bước đứng trước nó đã hoàn thành** (`!anyPrevIncomplete`).

### 3.5. Logic Phân quyền Biểu mẫu Công đoạn
- Tại **Danh sách dự án**: Bước công việc nào chưa được Admin gắn biểu mẫu thì ẩn hoàn toàn nút biểu mẫu (kể cả trên màn hình của Admin) để giao diện gọn sạch.
- Chỉ Admin mới có quyền tải file mẫu lên, gắn link hoặc gỡ biểu mẫu chuẩn (thực hiện tập trung tại tab **Quy trình**).
- Chuyên viên khi bấm vào nút `Biểu mẫu: <Tên mẫu>` chỉ có duy nhất lựa chọn **Tải biểu mẫu về máy** (hệ thống tự động chuyển đổi mọi link Google Docs/Sheets/Slides/Drive và Supabase Storage thành đường dẫn tải file trực tiếp về thiết bị, không mở trình sửa trực tuyến trên file gốc của Admin).

---

## 4. Logic Xác Thực, Phê Duyệt & Bảo Mật Cấp Cơ Sở Dữ Liệu (Supabase Auth & RLS)

### 4.1. Luồng Đăng ký & Chốt chặn Phê duyệt (`is_active`)
- **Tài khoản đầu tiên** trong bảng `public.sce_v2_profiles` (khi hệ thống mới khởi tạo, chưa có nhân sự nào) được Trigger PostgreSQL `handle_new_sce_v2_user()` tự động gán `role = 'admin'` và `is_active = true`.
- **Tất cả tài khoản đăng ký mới về sau** (qua Email/Mật khẩu hoặc Google OAuth) đều mặc định nhận `role = 'user'` và **`is_active = false` (Trạng thái Chờ duyệt)**.
- Khi `is_active = false`, hàm `completeAuthenticatedSession()` tự động ngắt phiên đăng nhập ngay sau bước xác thực và thông báo yêu cầu liên hệ Admin phê duyệt tại tab **Tài khoản**.

### 4.2. Quản trị Vòng đời Tài khoản bởi Admin
- **Phê duyệt / Khóa tạm thời (`toggleUserActiveStatus`):** Admin bật/tắt `is_active` trực tiếp trên bảng `sce_v2_profiles` và danh sách nhân sự. Hệ thống khóa nút tự khóa / tự xóa đối với chính tài khoản Admin đang đăng nhập (`!isSelf`) để chống mất quyền quản trị.
- **Đồng bộ tự động khi đổi Tên / Phòng ban (`saveEditUser`):** Khi Admin điều chuyển phòng chuyên môn hoặc sửa họ tên hiển thị của nhân sự, hệ thống tự động quét và cập nhật đồng bộ `owner` và `department` trên toàn bộ Nhiệm vụ chính và Gói thầu liên quan.
- **Bảo mật mật khẩu & phiên làm việc:**
  - Tuyệt đối không lưu mật khẩu người dùng trong dữ liệu JSON ứng dụng (quản lý hoàn toàn qua Supabase Auth mã hóa chuẩn bcrypt).
  - Hỗ trợ bật xác thực 2 yếu tố **2FA (TOTP - Google Authenticator)** cho từng cá nhân.
  - Tự động đăng xuất bảo vệ dữ liệu sau **30 phút** không có thao tác chuột/bàn phím/cảm ứng (`INACTIVITY_LIMIT_MS`).

### 4.3. Chính sách Bảo mật Dữ liệu Tầng Database (PostgreSQL Row Level Security - RLS)
- **Bảng `public.sce_v2_profiles`:**
  - `SELECT`: Chỉ xem được hồ sơ khi tài khoản đã được kích hoạt (`is_active = true`) hoặc xem hồ sơ của chính mình (`id = auth.uid()`).
  - `UPDATE`: Người dùng thường chỉ được cập nhật thông tin cá nhân của chính mình với điều kiện giữ nguyên `role` và `is_active` hiện tại (chống tự nâng quyền qua API); chỉ `admin` mới được phép thay đổi `role` và `is_active`.
  - `DELETE`: Chỉ `admin` mới có quyền xóa bản ghi hồ sơ.
- **Bảng `public.sce_v2_app_data`:**
  - `SELECT / INSERT / UPDATE`: Bắt buộc `is_my_sce_account_active() = true` và thuộc tập vai trò hợp lệ. Tài khoản đang chờ duyệt hoặc đã bị Admin khóa (`is_active = false`) bị từ chối truy xuất dữ liệu ngay từ máy chủ Supabase.
