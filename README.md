# HỆ THỐNG QUẢN TRỊ ĐẤU THẦU - SCE ENTERPRISE
> Trung tâm Xúc tiến đầu tư và Hỗ trợ doanh nghiệp Hà Nội (SCE)

---

## 🎯 Giới thiệu
Phần mềm Quản trị Đấu thầu SCE Enterprise là công cụ được thiết kế để số hóa toàn bộ luồng công việc, theo dõi tiến độ, và quản lý các gói thầu/nhiệm vụ của Trung tâm SCE. Hệ thống giúp chuyên viên và lãnh đạo nắm bắt tiến độ công việc theo thời gian thực.

## 🌟 Các tính năng nổi bật
1. **Bảng điều khiển (Dashboard):** Tổng hợp thống kê nhiệm vụ đang chạy, công việc trễ hạn, gói thầu đã hoàn thành. Hệ thống biểu đồ trực quan.
2. **Quản lý Nhiệm vụ & Gói thầu:** Tạo nhiệm vụ tổng, tạo nhiều gói thầu con bên trong. Phân bổ công việc (step) và việc nhỏ (sub-tasks) theo các quy trình chuẩn.
3. **Bảng Kanban:** Theo dõi luồng công việc trực quan bằng phương pháp kéo-thả (Kéo thả thay đổi thứ tự bước).
4. **Lịch biểu (Calendar View):** Hiển thị toàn bộ hạn chót công việc lên lịch tháng/tuần. Giúp nhận biết ngay các công việc sắp tới hạn (màu cam) hoặc trễ hạn (màu đỏ).
5. **Trao đổi & Bình luận (Comments):** Hỗ trợ chat, báo cáo tiến độ, thảo luận trực tiếp ngay tại từng công việc (Step).
6. **Ứng dụng Offline (PWA):** Tích hợp công nghệ Progressive Web App. Có thể "Cài đặt" ứng dụng ra màn hình chính điện thoại hoặc máy tính. Tốc độ tải trang siêu tốc.
7. **Bảo mật Backend:** Chống truy cập trái phép. Ẩn mật khẩu của người dùng khác. Kiểm tra quyền tại Server (Google Apps Script).
8. **In ấn & Xuất Excel:** Xuất báo cáo tự động sang định dạng `.xlsx` chuẩn (sử dụng thư viện SheetJS) và In ấn báo cáo giao ban theo chuẩn thể thức hành chính Việt Nam.
9. **Tích hợp Pháp lý:** Tra cứu Luật nhanh chóng với Thư viện Pháp luật và LuatVietnam ngay trên thanh Menu.

---

## 🚀 Hướng dẫn sử dụng cho Chuyên viên / Lãnh đạo

### Đăng nhập & Bắt đầu
- Truy cập vào đường dẫn trang web của phần mềm.
- Đăng nhập bằng tên đăng nhập và mật khẩu được Admin cấp.
- Nếu được phép ghi nhớ, bạn có thể tick chọn "Ghi nhớ đăng nhập" để không phải nhập lại lần sau.

### Quản lý công việc hàng ngày
- **Xem Lịch biểu:** Chuyển sang Tab "Lịch biểu" để xem tổng quan các việc trong tháng. Ưu tiên làm các việc có màu đỏ (trễ hạn) hoặc cam (sắp hạn).
- **Thực hiện công việc:** Tại Tab "Danh sách Dự án", bấm dấu check `(V)` để đánh dấu hoàn thành công việc. Nếu có việc nhỏ (sub-task), hãy check từng việc nhỏ.
- **Trao đổi / Báo cáo:** Bấm vào nút `Trao đổi` dưới tên mỗi công việc để báo cáo tiến độ, giải trình lý do trễ hạn với lãnh đạo hoặc đồng nghiệp.
- **Đính kèm link:** Bấm nút `Gắn file` để chèn link Google Drive, OneDrive tài liệu, quyết định phê duyệt... cho bước đó.

### Giao diện Sáng/Tối
- Có thể bấm vào biểu tượng 🌙/☀️ ở góc trên cùng bên phải để thay đổi giao diện theo sở thích.

---

## 🛠 Hướng dẫn Triển khai & Cập nhật (Dành cho Quản trị viên)

### 1. Cập nhật Backend (Google Apps Script)
Mỗi khi có cập nhật code `Code.gs`:
1. Mở Google Sheets đang lưu dữ liệu của bạn, vào **Tiện ích mở rộng > Apps Script**.
2. Dán code mới vào file `Code.gs`. Bấm Lưu.
3. Bấm **Triển khai (Deploy)** -> **Quản lý bản triển khai (Manage deployments)**.
4. Bấm biểu tượng Cây bút (Chỉnh sửa) -> Ở mục Phiên bản, CHỌN **Phiên bản mới (New version)**. Bấm Triển khai.

### 2. Cấu hình & Backup dữ liệu
- Admin có quyền truy cập tab **Quy trình**, **Pháp lý**, **Tài khoản** và **Khôi phục**.
- **Khôi phục (Backups):** Hệ thống sẽ tự động lưu 50 bản Snapshots mỗi khi có thao tác lưu. Admin có thể bấm Khôi phục bất cứ lúc nào nếu ai đó lỡ tay xóa nhầm dữ liệu.

*(Được phát triển riêng biệt cho quy trình hoạt động của Trung tâm)*
