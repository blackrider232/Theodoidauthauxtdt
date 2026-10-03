/**
 * =========================================================================
 * BACKEND GOOGLE APPS SCRIPT CHO HỆ THỐNG QUẢN TRỊ ĐẤU THẦU - SCE ENTERPRISE
 * =========================================================================
 */

const SHEET_DB = "Database";
const SHEET_BACKUP = "Backups";
const MAX_BACKUPS = 50;

function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    if (sheetName === SHEET_DB) {
      const firstSheet = ss.getSheets()[0];
      if (firstSheet && firstSheet.getName() !== SHEET_BACKUP) {
        return firstSheet;
      }
    }
    sheet = ss.insertSheet(sheetName);
    if (sheetName === SHEET_BACKUP) {
      sheet.appendRow(["ID", "Timestamp", "Data"]);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ error: "Method Not Allowed. Vui lòng sử dụng POST." }))
      .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); 
    
    const postData = e.postData ? e.postData.contents : "";
    if (!postData) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Không có dữ liệu" })).setMimeType(ContentService.MimeType.JSON);
    }

    let payload = {};
    try { payload = JSON.parse(postData); } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Dữ liệu không hợp lệ" })).setMimeType(ContentService.MimeType.JSON);
    }

    const action = payload.action || "save";
    const u = payload.u;
    const p = payload.p;

    const dbSheet = getOrCreateSheet(SHEET_DB);
    const dataStr = dbSheet.getRange("A1").getValue() || "{}";
    let currentDb = {};
    try { currentDb = JSON.parse(dataStr); } catch(err){}
    
    // Yêu cầu xác thực
    let isAuthenticated = false;
    let currentUser = null;
    if (currentDb.users && currentDb.users.length > 0) {
        currentUser = currentDb.users.find(x => x.username === u && x.password === p);
        if (currentUser) isAuthenticated = true;
    } else {
        // Nếu DB mới tinh, cho phép tạo admin đầu tiên
        isAuthenticated = true; 
    }

    if (!isAuthenticated) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Xác thực thất bại" })).setMimeType(ContentService.MimeType.JSON);
    }

    // XỬ LÝ ĐỌC DATABASE
    if (action === "read") {
        let safeDb = JSON.parse(JSON.stringify(currentDb)); // Deep copy
        if (safeDb.users) {
            safeDb.users.forEach(user => {
                if (user.username !== u) {
                    delete user.password; // Ẩn mật khẩu của người khác
                }
            });
        }
        return ContentService.createTextOutput(JSON.stringify({ success: true, db: safeDb }))
          .setMimeType(ContentService.MimeType.JSON);
    }

    // LẤY DANH SÁCH SAO LƯU
    if (action === "getBackups") {
      if (currentUser && currentUser.role !== 'admin') {
          return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Chỉ Admin mới có quyền xem sao lưu." })).setMimeType(ContentService.MimeType.JSON);
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
      return ContentService.createTextOutput(JSON.stringify({ success: true, backups: backups })).setMimeType(ContentService.MimeType.JSON);
    }

    // KHÔI PHỤC BẢN SAO LƯU
    if (action === "loadBackup") {
      if (currentUser && currentUser.role !== 'admin') {
          return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Chỉ Admin mới có quyền khôi phục." })).setMimeType(ContentService.MimeType.JSON);
      }
      const targetId = String(payload.id);
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
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Không tìm thấy bản sao lưu" })).setMimeType(ContentService.MimeType.JSON);
    }

    // XỬ LÝ UPLOAD FILE LÊN GOOGLE DRIVE
    if (action === "uploadFile") {
        let req = payload.data;
        let folderName = "Tai_Lieu_Dau_Thau_SCE";
        let folders = DriveApp.getFoldersByName(folderName);
        let folder;
        if (folders.hasNext()) {
            folder = folders.next();
        } else {
            folder = DriveApp.createFolder(folderName);
            folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        }
        
        let base64Data = req.base64;
        if (base64Data.indexOf("base64,") !== -1) {
            base64Data = base64Data.split("base64,")[1];
        }
        
        let blob = Utilities.newBlob(Utilities.base64Decode(base64Data), req.mimeType, req.filename);
        let file = folder.createFile(blob);
        let link = file.getUrl();
        
        return ContentService.createTextOutput(JSON.stringify({ status: "success", link: link }))
            .setMimeType(ContentService.MimeType.JSON);
    }
    
    
    // TÌM KIẾM VĂN BẢN PHÁP LUẬT
    if (action === "fetchLaws") {
        try {
            // Sử dụng Google Apps Script UrlFetchApp để gọi API/RSS (tránh CORS)
            // Lấy từ vbpl.vn hoặc Cổng TTĐT Chính phủ (RSS giả lập)
            let query = payload.query || 'đấu thầu';
            let url = "https://vbpl.vn/TW/Pages/rss.aspx"; 
            let response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
            let xmlText = response.getContentText();
            let document = XmlService.parse(xmlText);
            let root = document.getRootElement();
            let channel = root.getChild('channel');
            let items = channel.getChildren('item');
            
            let results = [];
            for (let i = 0; i < items.length; i++) {
                let title = items[i].getChild('title').getText();
                if (title.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
                    results.push({
                        title: title,
                        link: items[i].getChild('link').getText(),
                        pubDate: items[i].getChild('pubDate').getText()
                    });
                }
            }
            return ContentService.createTextOutput(JSON.stringify({ status: "success", data: results })).setMimeType(ContentService.MimeType.JSON);
        } catch(e) {
            // Fallback nếu lỗi (VBPL.vn có thể chặn Google IP hoặc lỗi XML)
            let fallback = [
                { title: "Nghị định 214/2026/NĐ-CP về đấu thầu (Mới)", link: "https://vanban.chinhphu.vn/?keyword=214/2026/NĐ-CP" },
                { title: "Nghị định 349/2026/NĐ-CP (Mới nhất)", link: "https://vanban.chinhphu.vn/?keyword=349/2026/NĐ-CP" }
            ];
            return ContentService.createTextOutput(JSON.stringify({ status: "success", data: fallback })).setMimeType(ContentService.MimeType.JSON);
        }
    }
    
    // XÓA FILE TRÊN GOOGLE DRIVE
    if (action === "deleteFile") {
        let req = payload.data;
        if (req.url) {
            try {
                let match = req.url.match(/\/d\/(.+?)\//);
                if (match && match[1]) {
                    DriveApp.getFileById(match[1]).setTrashed(true);
                }
            } catch(e) {}
        }
        return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // MẶC ĐỊNH: LƯU DATABASE
    let newDb = payload.data;
    if (!newDb) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Không có dữ liệu db" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (newDb.users && currentDb.users) {
        const foundUser = currentUser;
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

function testDriveAuthorization() {
  var tempFolder = DriveApp.createFolder("Xoa_Thu_Muc_Nay");
  tempFolder.setTrashed(true);
}
