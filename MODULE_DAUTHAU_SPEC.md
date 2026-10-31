# TÀI LIỆU ĐẶC TẢ KIẾN TRÚC & NGHIỆP VỤ (MODULE QUẢN LÝ ĐẤU THẦU SCE)
*Dành cho việc tái tạo, bảo trì hoặc tích hợp vào Super App đa chức năng*

---

## 1. Thông tin chung
- **Đơn vị chủ quản:** Trung tâm Xúc tiến Đầu tư và Hỗ trợ Doanh nghiệp Hà Nội (SCE) - Sở Tài chính Hà Nội.
- **Tên phân hệ:** Quản lý Đấu thầu và Tiến độ Nhiệm vụ chuyên môn.
- **Mục tiêu:** Quản lý tập trung toàn bộ quy trình, theo dõi sát sao thời hạn từng bước, cảnh báo chậm tiến độ, chuẩn hóa biểu mẫu công đoạn, phân quyền rõ ràng theo 4 phòng ban và Ban Giám đốc.

---

## 2. Mô hình Phân quyền (RBAC) 4 Phòng ban
Hệ thống loại bỏ vai trò kiểm toán viên (auditor), chỉ sử dụng:
1. **Ban Giám đốc (`admin`, `leader`):**
   - Toàn quyền xem và thao tác trên mọi nhiệm vụ chính, nhiệm vụ cụ thể của toàn bộ 4 phòng ban.
   - Quản lý tài khoản, xem toàn bộ lịch sử hoạt động (Audit Log), phê duyệt, xuất báo cáo.
   - Quản trị Quy trình mẫu và tải lên/cấu hình biểu mẫu chuẩn cho từng công đoạn.
2. **Lãnh đạo phòng (`dept_leader`):**
   - Quản lý toàn bộ nhiệm vụ chính & nhiệm vụ cụ thể thuộc phòng mình (gồm 4 phòng: *Phòng Hành chính - Tổ chức*, *Phòng Phát triển doanh nghiệp*, *Phòng Xúc tiến đầu tư*, *Phòng Tư vấn doanh nghiệp*).
   - Phân công chuyên viên phụ trách (`owner`).
3. **Chuyên viên (`staff`, `user`):**
   - Xem các nhiệm vụ cụ thể trong phòng mình để nắm tiến độ chung.
   - Thao tác cập nhật, hoàn thành việc, tải/mở biểu mẫu công đoạn, thêm link/file, viết ghi chú cho các nhiệm vụ cụ thể mình phụ trách trực tiếp.

---

## 3. Cấu trúc Thực thể Dữ liệu (Data Model)
- **Cấp 1 - Nhiệm vụ chính (`Mission`):**
  - `id`, `name`, `deadline`, `owner`, `department`, `completed`, `archived`, `packages: []`.
- **Cấp 2 - Nhiệm vụ cụ thể (`Package` - Gói thầu):**
  - `id`, `name`, `processTitle`, `owner`, `department`, `budget`, `contractor`, `winningBid`, `note`, `completed`, `archived`, `activityLog: []`, `steps: []`.
- **Cấp 3 - Bước quy trình chi tiết (`Step`):**
  - `id`, `name`, `deadline`, `originalDays`, `originalDayType` (`workday` | `calendar`), `completed`, `completedBy`, `subTasks: []`, `links: []`.
  - `templateForm`: `{ name, url, type: 'file' | 'link', updatedAt, updatedBy }` (Biểu mẫu chuẩn của công đoạn, do Admin tải lên hoặc kế thừa từ Quy trình mẫu).
  - *Lưu ý quan trọng:* Không lưu ghi chú và trao đổi tại từng bước chi tiết, toàn bộ ghi chú chuyển lên trường `package.note`.

---

## 4. Thuật toán Quản lý Tiến độ & Lịch trình
- **Ngày làm việc (`workday`):** Tự động bỏ qua Thứ Bảy và Chủ Nhật khi tính toán số ngày định mức.
- **Cơ chế Đẩy lùi lịch (Cascade Shift):** Khi dời hạn chót ở bước $K$ hoặc ngày bắt đầu nhiệm vụ cụ thể, hệ thống tự động tính lại ngày đến hạn của toàn bộ các bước phía sau.
- **Trạng thái tiến độ nhiệm vụ cụ thể:**
  - `Đã xong (completed)`: 100% bước hoàn thành hoặc chốt hoàn thành.
  - `Chậm tiến độ (overdue)`: Có ít nhất một bước chưa hoàn thành có hạn chót trước ngày hôm nay (badge đỏ, nhấp nháy pulse).
  - `Đang thực hiện (in_progress)`: Đang triển khai đúng hạn (badge xanh dương).

---

## 5. Tiêu chuẩn Giao diện & Trải nghiệm (UI/UX 4 Tầng Mở Dần)
1. **Tư duy tiếp cận 4 tầng (4-Tier Progressive Disclosure):**
   - **Tầng 1 (Thẻ tóm tắt Nhiệm vụ chính - Collapsible Accordion):**
     * Mặc định khi vào ứng dụng: **Thu gọn tất cả** để màn hình tinh gọn tối đa.
     * Tự động mở các nhiệm vụ có nhiệm vụ cụ thể bị trễ hạn (`overdue`) kèm badge cảnh báo đỏ để đôn đốc kịp thời.
     * Tự động mở khi tìm kiếm hoặc lọc có kết quả khớp.
     * Click vào header để đóng/mở (các nút In NV, Sửa, Chốt NV, + Nhiệm vụ cụ thể có `stopPropagation` chống chạm nhầm).
   - **Tầng 2 (Dòng tóm tắt Nhiệm vụ cụ thể - Khi đóng):**
     * STT, Tên nhiệm vụ cụ thể, Huy hiệu trạng thái, Badge có ghi chú. Click để mở Tầng 3.
   - **Tầng 3 (Khung thông tin cơ bản Nhiệm vụ cụ thể):**
     * Dự toán, Nhà thầu, Giá trúng, Ký HĐ, Chuyên viên, Thẻ ghi chú amber, Thanh nút chức năng.
   - **Tầng 4 (Bảng các bước quy trình chi tiết):**
     * Bảng 2 cột: Cột Thông tin & Đính kèm; Cột Thao tác & Hoàn thành.
2. **Quản lý & Sử dụng Biểu mẫu Công đoạn (Step Template Forms):**
   - **Dành cho Cán bộ triển khai:**
     * Tại mỗi bước, nếu có biểu mẫu sẽ xuất hiện nút nổi bật `[ 📄 Biểu mẫu: Tên_mẫu.docx ]`.
     * Bấm vào nút sẽ mở modal chuyên dụng với 2 lựa chọn tiện lợi:
       1. **📥 Tải biểu mẫu về máy:** Tải file `.docx`, `.xlsx`, `.pdf` trực tiếp về máy tính để mở bằng Word/Excel soạn thảo offline.
       2. **🌐 Mở & Chỉnh sửa trực tuyến:** Mở xem qua Microsoft Office Web Viewer hoặc Google Docs; đối với link Google Docs có nút `Tạo bản sao Google Docs` để cán bộ tạo bản sao riêng vào Google Drive của mình trong 1-click.
       3. Sau khi soạn thảo xong, cán bộ đính kèm file hoàn thiện bằng nút `[ Tải file lên ]` hoặc `[ Link web ]` ngay tại công đoạn đó.
   - **Dành cho Quản trị viên (Admin):**
     * Up file mẫu từ máy tính (lưu trữ trên Supabase Storage) hoặc dán link trực tuyến (Google Docs/Drive/SharePoint).
     * Cấu hình sẵn ở **Quản lý Quy trình mẫu** (tự động áp dụng cho các gói thầu tạo mới và có tùy chọn đồng bộ sang các gói thầu đang chạy).
     * Gán hoặc thay đổi biểu mẫu linh hoạt trực tiếp trên từng công đoạn của gói thầu đang thực hiện.
3. **Nút Điều khiển Chế độ xem Toàn cục (Dropdown Menu):**
   - Nút `[ 👁 Chế độ xem ▾ ]` cạnh thanh tìm kiếm hỗ trợ 3 chế độ:
     + 🔽 *Thu gọn tất cả (Mặc định)*: Chỉ hiện đầu Nhiệm vụ chính.
     + 🔼 *Mở rộng Nhiệm vụ chính*: Hiện danh sách nhiệm vụ cụ thể dạng tóm tắt.
     + 📑 *Mở rộng toàn bộ chi tiết*: Mở bung toàn bộ chi tiết các bước.
4. **Ghi chú nhanh cho Nhiệm vụ cụ thể:**
   - Chưa có ghi chú: Hiện nút `[ 📝 Ghi chú ]` trên thanh công cụ Tầng 3.
   - Bấm nút: Mở popup textarea SweetAlert2 nhập nội dung $\rightarrow$ lưu `pkg.note`.
   - Đã có ghi chú: Xuất hiện Thẻ ghi chú nổi bật màu amber bên dưới thông tin cơ bản kèm nút `[ ✏ Sửa ]` và `[ ✖ Xóa ]`.
   - Tìm kiếm từ khóa: Tìm kiếm được cả theo nội dung trong ghi chú nhiệm vụ cụ thể.
   - Tự động xuất ghi chú ra Excel (.xlsx) và trang In ấn.
5. **Đổi thứ tự bước an toàn (Hybrid Reorder):**
   - Bình thường ẩn toàn bộ icon kéo thả để tránh chạm nhầm trên điện thoại.
   - Bấm nút `[ ↕️ Đổi thứ tự ]` mới hiện nút `[↑]`, `[↓]` và tay nắm kéo thả.
6. **Responsive 100% Mobile (Zero Horizontal Overflow):**
   - Không bị tràn ngang trên Samsung Galaxy S25 Ultra, iPhone hay bất kỳ thiết bị di động nào.

---

## 6. Cách gọi Antigravity tự động tạo lại module này trong Super App mới
Khi khởi tạo project Super App mới trên Antigravity, bạn chỉ cần ra lệnh trong chat:
> *"Tôi muốn tạo phân hệ Quản lý Đấu thầu theo đúng quy chuẩn của skill `quanlydauthau`."*

Antigravity sẽ tự động đọc `SKILL.md` và tái tạo chính xác toàn bộ logic, phân quyền, quản lý biểu mẫu công đoạn và giao diện này vào project mới của bạn!
