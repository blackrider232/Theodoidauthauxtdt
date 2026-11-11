# HƯỚNG DẪN KÍCH HOẠT MÁY CHỦ DỮ LIỆU ĐẤU THẦU TRÊN NAS SYNOLOGY DS224+

Toàn bộ mã nguồn máy chủ nhẹ (Node.js + PostgreSQL Alpine) đã được chuẩn bị sẵn trong thư mục này:
`xtdt/dauthau_backend`

---

## BƯỚC 1: MỞ CONTAINER MANAGER TRÊN NAS SYNOLOGY
1. Mở trình duyệt và đăng nhập vào DSM:
   - Địa chỉ nội bộ: **`http://192.168.128.73:5000`** 
   - Hoặc qua QuickConnect: **`https://quickconnect.to/XTDT`**
2. Vào biểu tượng Menu chính (Main Menu góc trên bên trái) &rarr; Mở ứng dụng **Container Manager**.
   *(Nếu chưa có, mở **Package Center** tìm từ khóa `Container Manager` rồi bấm Cài đặt - chỉ mất 1 phút).*

---

## BƯỚC 2: TẠO DỰ ÁN (PROJECT)
1. Trong Container Manager, chọn mục **Project** ở cột bên trái &rarr; Bấm nút **Create** (Tạo).
2. Điền các thông tin sau:
   - **Project Name (Tên dự án):** `dauthau-backend`
   - **Path (Đường dẫn):** Bấm nút Browse (Duyệt) &rarr; chọn thư mục **`xtdt/dauthau_backend`**
   - **Source (Nguồn):** Chọn **Use existing docker-compose.yml** (Sử dụng docker-compose.yml có sẵn).
3. Bấm **Next** &rarr; Bấm **Next** &rarr; Bấm **Done**.

Hệ thống sẽ tự động tải các gói siêu nhẹ và khởi chạy 2 container:
- `sce_dauthau_db`: Cơ sở dữ liệu PostgreSQL (~70MB RAM)
- `sce_dauthau_api`: API Backend (~40MB RAM)

---

## BƯỚC 3: KIỂM TRA MÁY CHỦ ĐÃ CHẠY THÀNH CÔNG
Mở trình duyệt trên máy tính và truy cập:
👉 **`http://192.168.128.73:3000/api/health`**

Nếu màn hình hiện:
`{"status":"ok","service":"SCE Procurement NAS Backend",...}`
Là máy chủ trên chiếc DS224+ đã sẵn sàng 100%!
