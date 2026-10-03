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
 * Khởi tạo hoặc lấy Sheet
 */
function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    // Nếu là SHEET_DB mà không tìm thấy "Database", ta thử lấy tab đầu tiên trong file (thường là Data_DauThau_SCE hoặc Trang tính 1)
    if (sheetName === SHEET_DB) {
      const firstSheet = ss.getSheets()[0];
      // Nếu tab đầu tiên không phải là Backups, ta cứ coi nó là Database
      if (firstSheet && firstSheet.getName() !== SHEET_BACKUP) {
        return firstSheet;
      }
    }
    
    // Nếu vẫn không có, thì tạo mới
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
    const u = e.parameter ? e.parameter.u : null;
    const p = e.parameter ? e.parameter.p : null;
    
    const dbSheet = getOrCreateSheet(SHEET_DB);
    const dataStr = dbSheet.getRange("A1").getValue() || "{}";
    let db = {};
    try { db = JSON.parse(dataStr); } catch(err){}
    
    // Yêu cầu xác thực cho mọi tác vụ đọc dữ liệu (trừ khi db trống hoàn toàn)
    let isAuthenticated = false;
    let currentUser = null;
    if (db.users && db.users.length > 0) {
        currentUser = db.users.find(x => x.username === u && x.password === p);
        if (currentUser) isAuthenticated = true;
    } else {
        // Nếu DB mới tinh, cho phép admin mặc định
        isAuthenticated = true; 
    }
    
    if (!isAuthenticated) {
        return ContentService.createTextOutput(JSON.stringify({ error: "Xác thực thất bại. Vui lòng đăng nhập lại." }))
          .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 1. Lấy danh sách bản sao lưu
    if (action === "getBackups") {
      if (currentUser && currentUser.role !== 'admin') {
          return ContentService.createTextOutput(JSON.stringify({ error: "Chỉ Admin mới có quyền xem sao lưu." })).setMimeType(ContentService.MimeType.JSON);
      }
      const backupSheet = getOrCreateSheet(SHEET_BACKUP);
      const lastRow = backupSheet.getLastRow();
      const backups = [];
      if (lastRow > 1) {
        const rows = backupSheet.getRange(2, 1, lastRow - 1, 2).getValues();
        for (let i = rows.length - 1; i >= 0; i--) {
          if (rows[i][0] && rows[i][1]) {
            backups.push({ id: rows[i][0], time: rows[i][1] });
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify(backups)).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Tải nội dung 1 bản sao lưu cụ thể
    if (action === "loadBackup") {
      if (currentUser && currentUser.role !== 'admin') {
          return ContentService.createTextOutput(JSON.stringify({ error: "Chỉ Admin mới có quyền khôi phục." })).setMimeType(ContentService.MimeType.JSON);
      }
      const targetId = String(e.parameter.id);
      const backupSheet = getOrCreateSheet(SHEET_BACKUP);
      const lastRow = backupSheet.getLastRow();
      if (lastRow > 1) {
        const rows = backupSheet.getRange(2, 1, lastRow - 1, 3).getValues();
        for (let i = 0; i < rows.length; i++) {
          if (String(rows[i][0]) === targetId) {
            return ContentService.createTextOutput(rows[i][2]).setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ error: "Không tìm thấy bản sao lưu" })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Mặc định: Đọc toàn bộ Database hiện tại (Đã loại bỏ mật khẩu người khác)
    let safeDb = JSON.parse(JSON.stringify(db)); // Deep copy
    if (safeDb.users) {
        safeDb.users.forEach(user => {
            if (user.username !== u) {
                delete user.password; // Ẩn mật khẩu của người khác
            }
        });
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, db: safeDb }))
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
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); 
    
    const u = e.parameter ? e.parameter.u : null;
    const p = e.parameter ? e.parameter.p : null;
    const postData = e.postData ? e.postData.contents : "";
    
    if (!postData) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Không có dữ liệu" })).setMimeType(ContentService.MimeType.JSON);
    }

    const dbSheet = getOrCreateSheet(SHEET_DB);
    const dataStr = dbSheet.getRange("A1").getValue() || "{}";
    let currentDb = {};
    try { currentDb = JSON.parse(dataStr); } catch(err){}
    
    // Xác thực khi lưu
    if (currentDb.users && currentDb.users.length > 0) {
        const foundUser = currentDb.users.find(x => x.username === u && x.password === p);
        if (!foundUser) {
            return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Xác thực thất bại, không thể lưu" })).setMimeType(ContentService.MimeType.JSON);
        }
    }
    
    // Lắp lại mật khẩu cũ và phân quyền chặt chẽ mảng users
    let newDb = JSON.parse(postData);
    if (newDb.users && currentDb.users) {
        const foundUser = currentDb.users.find(x => x.username === u && x.password === p);
        if (foundUser && foundUser.role !== 'admin') {
            // Nếu không phải Admin, CHỈ được phép cập nhật chính mình (Tên và Mật khẩu)
            let restoredUsers = [];
            currentDb.users.forEach(oldU => {
                if (oldU.username === u) {
                    let submittedSelf = newDb.users.find(x => x.username === u);
                    if (submittedSelf) {
                        submittedSelf.role = oldU.role; // Không cho phép tự đổi Role
                        if (!submittedSelf.password) submittedSelf.password = oldU.password;
                        restoredUsers.push(submittedSelf);
                    } else {
                        restoredUsers.push(oldU); // Không cho phép tự xóa tài khoản
                    }
                } else {
                    restoredUsers.push(oldU); // Giữ nguyên người khác
                }
            });
            newDb.users = restoredUsers;
        } else {
            // Nếu là Admin, chỉ lắp lại mật khẩu bị ẩn của người khác
            newDb.users.forEach(newUser => {
                if (!newUser.password) {
                    let oldUser = currentDb.users.find(x => x.username === newUser.username);
                    if (oldUser) newUser.password = oldUser.password;
                }
            });
        }
    }

    const finalJson = JSON.stringify(newDb);

    // 1. Lưu vào Database chính
    dbSheet.getRange("A1").setValue(finalJson);

    // 2. Lưu vào danh sách Backups
    const backupSheet = getOrCreateSheet(SHEET_BACKUP);
    const now = new Date();
    const backupId = now.getTime();
    const timeFormatted = Utilities.formatDate(now, "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");

    backupSheet.appendRow([backupId, timeFormatted, finalJson]);

    // Xóa bớt sao lưu cũ
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
