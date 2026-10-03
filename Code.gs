/**
 * =========================================================================
 * BACKEND GOOGLE APPS SCRIPT CHO HỆ THỐNG QUẢN TRỊ ĐẤU THẦU - SCE ENTERPRISE
 * =========================================================================
 * Hướng dẫn triển khai:
 * 1. Mở Google Sheets mới (đặt tên: "CSDL_QuanTri_DauThau_SCE").
 * 2. Vào Tiện ích mở rộng (Extensions) -> Apps Script.
 * 3. Xóa toàn bộ mã cũ và dán toàn bộ nội dung file này vào.
 * 4. Bấm biểu tượng "Lưu" (Save).
 * 5. Bấm "Triển khai" (Deploy) -> "Tùy chọn triển khai mới" (New deployment).
 *    - Chọn loại: Ứng dụng web (Web app).
 *    - Mô tả: "Phiên bản v1.0 Production".
 *    - Thực thi dưới dạng (Execute as): "Tôi" (Me).
 *    - Ai có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone).
 * 6. Bấm "Triển khai" (Deploy), cấp quyền và copy đường dẫn Web App URL 
 *    để dán vào biến GAS_URL trong file index.html.
 * =========================================================================
 */

const SHEET_DB = "Database";
const SHEET_BACKUP = "Backups";
const MAX_BACKUPS = 50;

/**
 * Khởi tạo hoặc lấy Sheet theo tên
 */
function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (sheetName === SHEET_BACKUP) {
      sheet.appendRow(["ID", "Timestamp", "Data"]);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

/**
 * Xử lý yêu cầu GET: Đọc dữ liệu hoặc lấy danh sách bản sao lưu
 */
function doGet(e) {
  try {
    const action = e.parameter ? e.parameter.action : null;
    
    // 1. Lấy danh sách bản sao lưu (không tải kèm toàn bộ JSON để tối ưu tốc độ)
    if (action === "getBackups") {
      const backupSheet = getOrCreateSheet(SHEET_BACKUP);
      const lastRow = backupSheet.getLastRow();
      const backups = [];
      
      if (lastRow > 1) {
        const rows = backupSheet.getRange(2, 1, lastRow - 1, 2).getValues();
        for (let i = rows.length - 1; i >= 0; i--) {
          if (rows[i][0] && rows[i][1]) {
            backups.push({
              id: rows[i][0],
              time: rows[i][1]
            });
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify(backups))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Tải nội dung của 1 bản sao lưu cụ thể theo ID
    if (action === "loadBackup") {
      const targetId = String(e.parameter.id);
      const backupSheet = getOrCreateSheet(SHEET_BACKUP);
      const lastRow = backupSheet.getLastRow();
      
      if (lastRow > 1) {
        const rows = backupSheet.getRange(2, 1, lastRow - 1, 3).getValues();
        for (let i = 0; i < rows.length; i++) {
          if (String(rows[i][0]) === targetId) {
            return ContentService.createTextOutput(rows[i][2])
              .setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ error: "Không tìm thấy bản sao lưu" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Mặc định: Đọc toàn bộ Database hiện tại
    const dbSheet = getOrCreateSheet(SHEET_DB);
    const data = dbSheet.getRange("A1").getValue();
    
    return ContentService.createTextOutput(data || "{}")
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Xử lý yêu cầu POST: Lưu dữ liệu mới và tự động tạo snapshot sao lưu
 */
function doPost(e) {
  // Sử dụng LockService để tránh xung đột ghi đè đồng thời nhiều người dùng
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // Đợi tối đa 30s
    
    const postData = e.postData ? e.postData.contents : "";
    if (!postData) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Không có dữ liệu gửi lên" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Kiểm tra định dạng JSON hợp lệ
    JSON.parse(postData);

    // 1. Lưu vào Database chính
    const dbSheet = getOrCreateSheet(SHEET_DB);
    dbSheet.getRange("A1").setValue(postData);

    // 2. Lưu vào danh sách Backups (tối đa 50 bản)
    const backupSheet = getOrCreateSheet(SHEET_BACKUP);
    const now = new Date();
    const backupId = now.getTime();
    const timeFormatted = Utilities.formatDate(now, "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");

    backupSheet.appendRow([backupId, timeFormatted, postData]);

    // Xóa bớt nếu vượt quá 50 bản sao lưu cũ
    const lastRow = backupSheet.getLastRow();
    if (lastRow - 1 > MAX_BACKUPS) {
      const deleteCount = (lastRow - 1) - MAX_BACKUPS;
      backupSheet.deleteRows(2, deleteCount);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", timestamp: timeFormatted }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
