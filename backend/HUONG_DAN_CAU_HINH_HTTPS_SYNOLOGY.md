# HƯỚNG DẪN THIẾT LẬP HTTPS CHO MÁY CHỦ NAS SYNOLOGY DS224+
### (Sử dụng Synology DDNS + Let's Encrypt SSL + Reverse Proxy có sẵn trên DSM)

Tài liệu này hướng dẫn từng bước kích hoạt địa chỉ **HTTPS** bảo mật cho máy chủ Backend trên NAS Synology DS224+ để ứng dụng Quản lý Đấu thầu SCE có thể kết nối từ xa từ mọi nơi (ở nhà, điện thoại 4G, cơ quan) mà không bị trình duyệt chặn bảo mật (Mixed Content / Private Network Access).

---

## BƯỚC 1: TẠO TÊN MIỀN DDNS & CHỨNG CHỈ SSL MIỄN PHÍ TRÊN DSM

1. Mở trình duyệt đăng nhập vào DSM:
   - Địa chỉ nội bộ: **`http://192.168.128.73:5000`**
   - Hoặc qua QuickConnect: **`https://quickconnect.to/XTDT`**
2. Mở **Control Panel (Bảng điều khiển)** &rarr; chọn **External Access (Truy cập bên ngoài)**.
3. Chọn tab **DDNS** &rarr; Bấm nút **Add (Thêm)**:
   - **Service provider:** Chọn `Synology`.
   - **Hostname:** Điền tên tiền tố Hoàng muốn (ví dụ: `dauthau-sce` hoặc `sce-xtdt` hoặc tên riêng của Hoàng).
   - Phần đuôi tên miền: Chọn `.synology.me`.
   - **TÍCH CHỌN BẮT BUỘC:** `Request a certificate from Let's Encrypt and set it as default` (Yêu cầu chứng chỉ Let's Encrypt và đặt làm mặc định).
   - Bấm nút **Test Connection** (hiển thị trạng thái *Normal* màu xanh là đạt).
   - Bấm **OK**.
4. Chờ khoảng 30 giây để DSM tự động đăng ký với Let's Encrypt và cài đặt chứng chỉ SSL. Lúc này NAS đã sở hữu tên miền chính thức:
   👉 **`https://<ten-hoang-chon>.synology.me`**

---

## BƯỚC 2: CẤU HÌNH REVERSE PROXY TRÊN DSM (CHUYỂN TIẾP HTTPS VỀ CỔNG 3000)

1. Trong **Control Panel** &rarr; chọn mục **Login Portal (Cổng đăng nhập)**.
2. Chọn tab **Advanced (Nâng cao)** ở phía trên &rarr; Bấm vào nút **Reverse Proxy (Proxy ngược)**.
3. Bấm **Create (Tạo)** và điền các thông tin:
   - **Reverse Proxy Name:** `Dauthau Backend API`
   - **Source (Nguồn tiếp nhận yêu cầu từ Internet):**
     - **Protocol:** `HTTPS`
     - **Hostname:** `*` (hoặc điền `<ten-hoang-chon>.synology.me`)
     - **Port:** Điền **`3443`** *(Dùng cổng riêng này để không xung đột với cổng quản trị DSM)*.
     - Tích chọn: **Enable HSTS** (Tùy chọn)
   - **Destination (Đích đến của ứng dụng trong nội bộ NAS):**
     - **Protocol:** `HTTP`
     - **Hostname:** `localhost`
     - **Port:** `3000`
4. Chuyển sang tab **Custom Header** (phía trên cạnh tab General):
   - Bấm **Create** &rarr; Chọn **WebSocket** *(để hệ thống tự sinh các header Upgrade và Connection)*.
5. Bấm **Save (Lưu)**.

---

## BƯỚC 3: MỞ PORT FORWARDING (NAT CỔNG) TRÊN ROUTER / MODEM MẠNG

1. Mở trình duyệt trên máy tính, đăng nhập vào trang quản trị modem WiFi/router (thường là `192.168.1.1` hoặc `192.168.128.1` tùy mạng):
2. Tìm đến mục **Port Forwarding** (hoặc **Virtual Server / NAT / Chuyển tiếp cổng**):
   - **Service Name:** `Dauthau_NAS`
   - **Protocol (Giao thức):** `TCP` (hoặc `Both/All`)
   - **External Port (Cổng ngoài WAN):** `3443`
   - **Internal Port (Cổng trong LAN):** `3443`
   - **Internal IP Address (IP của NAS):** `192.168.128.73`
   - Bấm **Apply / Save (Lưu)**.

---

## BƯỚC 4: KIỂM TRA ĐƯỜNG TRUYỀN & CẬP NHẬT ỨNG DỤNG

1. Dùng điện thoại tắt WiFi (bật 4G) hoặc máy tính ngoài mạng mở trình duyệt truy cập:
   👉 **`https://<ten-hoang-chon>.synology.me:3443/api/health`**
2. Nếu màn hình hiển thị:
   ```json
   {
     "status": "ok",
     "service": "SCE Procurement NAS Backend",
     "timestamp": "..."
   }
   ```
   kèm biểu tượng **ổ khóa bảo mật HTTPS** màu xanh trên thanh địa chỉ là máy chủ đã thông mạng toàn cầu 100%!

3. Hoàng chỉ cần gửi cho tôi tên miền:
   `https://<ten-hoang-chon>.synology.me:3443`
   Tôi sẽ cập nhật vào file cấu hình `nas-connector.js` và đồng bộ lên GitHub Pages là xong toàn bộ quy trình!
