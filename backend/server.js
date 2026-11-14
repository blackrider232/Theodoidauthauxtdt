const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sce_dauthau_nas_secret_key_2026';

// Cấu hình Database PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://sce_admin:SceDauthau2026!@db:5432/sce_dauthau',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// Thư mục lưu trữ tệp đính kèm / biểu mẫu
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Cấu hình Multer upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const ext = path.extname(originalName);
        const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_\-\u00C0-\u1EF9]/g, '_');
        cb(null, `${baseName}_${uniqueSuffix}${ext}`);
    }
});
const upload = multer({ 
    storage, 
    limits: { fileSize: 50 * 1024 * 1024 } // Giới hạn 50MB cho biểu mẫu
});

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware xác thực JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Chưa đăng nhập (Thiếu token)' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
        req.user = user;
        next();
    });
};

// Khởi tạo bảng dữ liệu PostgreSQL tự động
async function initDatabase() {
    let retries = 5;
    while (retries > 0) {
        try {
            console.log('Đang kết nối cơ sở dữ liệu PostgreSQL...');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS sce_v2_profiles (
                    id SERIAL PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    fullname TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'user',
                    department TEXT NOT NULL DEFAULT '',
                    is_active BOOLEAN NOT NULL DEFAULT false,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                );

                CREATE TABLE IF NOT EXISTS sce_v2_app_data (
                    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
                    data JSONB NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_by_email TEXT
                );

                CREATE TABLE IF NOT EXISTS sce_v2_backups (
                    id BIGSERIAL PRIMARY KEY,
                    data JSONB NOT NULL,
                    note TEXT DEFAULT 'Auto-backup on save',
                    created_by_email TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                );

                CREATE TABLE IF NOT EXISTS sce_v2_audit_logs (
                    id BIGSERIAL PRIMARY KEY,
                    actor_email TEXT,
                    action TEXT NOT NULL,
                    summary TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                );
            `);
            console.log('✅ Cơ sở dữ liệu PostgreSQL đã sẵn sàng.');
            break;
        } catch (err) {
            console.error(`Chưa thể kết nối DB, thử lại sau 3 giây... (${err.message})`);
            retries--;
            await new Promise(r => setTimeout(r, 3000));
        }
    }
}

// ====================== AUTH ROUTES ======================

// 1. Đăng ký tài khoản
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, fullname, department } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
        }

        const cleanEmail = String(email).trim().toLowerCase();
        const hash = await bcrypt.hash(password, 10);

        // Kiểm tra xem đã có tài khoản nào trong hệ thống chưa
        const countRes = await pool.query('SELECT COUNT(*) FROM sce_v2_profiles');
        const isFirstUser = parseInt(countRes.rows[0].count, 10) === 0;

        const role = isFirstUser ? 'admin' : 'user';
        const isActive = isFirstUser ? true : false;
        const name = fullname || cleanEmail.split('@')[0];
        const dept = department || '';

        const insertRes = await pool.query(`
            INSERT INTO sce_v2_profiles (email, password_hash, fullname, role, department, is_active)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, email, fullname, role, department, is_active
        `, [cleanEmail, hash, name, role, dept, isActive]);

        const newUser = insertRes.rows[0];
        res.json({
            message: isFirstUser ? 'Đăng ký thành công! Bạn là Quản trị viên hệ thống.' : 'Đăng ký thành công! Vui lòng chờ Quản trị viên phê duyệt tài khoản.',
            user: newUser
        });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Email này đã được đăng ký trong hệ thống' });
        }
        res.status(500).json({ error: 'Lỗi máy chủ: ' + err.message });
    }
});

// 2. Đăng nhập
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' });
        }

        const cleanEmail = String(email).trim().toLowerCase();
        const userRes = await pool.query('SELECT * FROM sce_v2_profiles WHERE email = $1', [cleanEmail]);
        if (userRes.rows.length === 0) {
            return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
        }

        const user = userRes.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: 'Tài khoản của bạn đang chờ Quản trị viên duyệt kích hoạt!' });
        }

        const payload = {
            id: user.id,
            email: user.email,
            fullname: user.fullname,
            role: user.role,
            department: user.department
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

        res.json({
            token,
            user: payload
        });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi đăng nhập: ' + err.message });
    }
});

// 3. Lấy thông tin user hiện tại
app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

// ====================== DATA ROUTES ======================

// 4. Lấy dữ liệu đấu thầu (sce_v2_app_data)
app.get('/api/data', async (req, res) => {
    try {
        const dataRes = await pool.query('SELECT data, updated_at FROM sce_v2_app_data WHERE id = 1');
        if (dataRes.rows.length === 0) {
            return res.json({ data: null, updated_at: null });
        }
        res.json({
            data: dataRes.rows[0].data,
            updated_at: dataRes.rows[0].updated_at
        });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi tải dữ liệu: ' + err.message });
    }
});

// 5. Lưu dữ liệu đấu thầu & Tự động sao lưu
app.post('/api/data', authenticateToken, async (req, res) => {
    try {
        const { data, createBackup } = req.body;
        if (!data) return res.status(400).json({ error: 'Dữ liệu không được trống' });

        const userEmail = req.user ? req.user.email : 'system';

        // Lưu / cập nhật bảng chính
        await pool.query(`
            INSERT INTO sce_v2_app_data (id, data, updated_at, updated_by_email)
            VALUES (1, $1, now(), $2)
            ON CONFLICT (id) DO UPDATE
            SET data = $1, updated_at = now(), updated_by_email = $2
        `, [data, userEmail]);

        // Tạo bản sao lưu định kỳ nếu có yêu cầu hoặc mặc định
        if (createBackup !== false) {
            pool.query(`
                INSERT INTO sce_v2_backups (data, note, created_by_email)
                VALUES ($1, 'Auto-backup from NAS API', $2)
            `, [data, userEmail]).catch(e => console.warn('Lỗi lưu backup ngầm:', e));
        }

        res.json({ success: true, updated_at: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi lưu dữ liệu: ' + err.message });
    }
});

// ====================== PROFILES ROUTES ======================

// 6. Danh sách hồ sơ người dùng (Dành cho Admin hoặc hiển thị danh sách giao việc)
app.get('/api/profiles', authenticateToken, async (req, res) => {
    try {
        const profilesRes = await pool.query(`
            SELECT id, email, fullname, role, department, is_active, created_at 
            FROM sce_v2_profiles 
            ORDER BY created_at ASC
        `);
        res.json(profilesRes.rows);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi tải danh sách người dùng: ' + err.message });
    }
});

// 7. Cập nhật quyền / duyệt tài khoản (Chỉ Admin)
app.put('/api/profiles/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Chỉ Quản trị viên được thay đổi thông tin này' });
        }
        const { id } = req.params;
        const { role, department, is_active, fullname } = req.body;

        const updateRes = await pool.query(`
            UPDATE sce_v2_profiles
            SET role = COALESCE($1, role),
                department = COALESCE($2, department),
                is_active = COALESCE($3, is_active),
                fullname = COALESCE($4, fullname),
                updated_at = now()
            WHERE id = $5
            RETURNING id, email, fullname, role, department, is_active
        `, [role, department, is_active, fullname, id]);

        if (updateRes.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy người dùng' });
        }
        res.json({ success: true, user: updateRes.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi cập nhật người dùng: ' + err.message });
    }
});

// 8. Xóa tài khoản (Chỉ Admin)
app.delete('/api/profiles/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền xóa người dùng' });
        }
        const { id } = req.params;
        const isNumeric = /^\d+$/.test(String(id).trim());
        const paramId = isNumeric ? parseInt(id, 10) : String(id).trim();

        // Không cho phép xóa chính mình
        if (isNumeric && req.user.id && parseInt(req.user.id, 10) === parseInt(id, 10)) {
            return res.status(400).json({ error: 'Không thể tự xóa tài khoản của chính mình' });
        }
        if (!isNumeric && req.user.email && req.user.email.toLowerCase() === String(id).toLowerCase().trim()) {
            return res.status(400).json({ error: 'Không thể tự xóa tài khoản của chính mình' });
        }

        const whereClause = isNumeric ? 'id = $1' : 'LOWER(email) = LOWER($1)';
        const delRes = await pool.query(`DELETE FROM sce_v2_profiles WHERE ${whereClause} RETURNING id, email, fullname`, [paramId]);
        res.json({ success: true, message: 'Đã xóa người dùng thành công', deleted: delRes.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi xóa người dùng: ' + err.message });
    }
});

// ====================== BACKUPS ROUTES ======================

// 9. Lấy danh sách bản sao lưu
app.get('/api/backups', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Chỉ Quản trị viên được xem bản sao lưu' });
        }
        const backupsRes = await pool.query(`
            SELECT id, note, created_by_email, created_at 
            FROM sce_v2_backups 
            ORDER BY id DESC 
            LIMIT 50
        `);
        res.json(backupsRes.rows);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi tải sao lưu: ' + err.message });
    }
});

// 10. Khôi phục bản sao lưu
app.post('/api/backups/:id/restore', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Chỉ Quản trị viên được khôi phục dữ liệu' });
        }
        const { id } = req.params;
        const backupRow = await pool.query('SELECT data FROM sce_v2_backups WHERE id = $1', [id]);
        if (backupRow.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy bản sao lưu' });
        }

        const dataToRestore = backupRow.rows[0].data;
        await pool.query(`
            UPDATE sce_v2_app_data 
            SET data = $1, updated_at = now(), updated_by_email = $2 
            WHERE id = 1
        `, [dataToRestore, req.user.email]);

        res.json({ success: true, message: 'Khôi phục dữ liệu thành công', data: dataToRestore });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi khôi phục sao lưu: ' + err.message });
    }
});

// ====================== STORAGE ROUTES ======================

// 11. Tải file biểu mẫu / đính kèm lên NAS
app.post('/api/storage/upload', authenticateToken, upload.single('file'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Chưa chọn file để tải lên' });
        const fileUrl = `/api/storage/files/${req.file.filename}`;
        res.json({
            success: true,
            filename: req.file.filename,
            url: fileUrl,
            size: req.file.size
        });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi tải file: ' + err.message });
    }
});

// 12. Tải về / Mở file từ NAS
app.use('/api/storage/files', express.static(UPLOADS_DIR));

// 13. Healthcheck
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'SCE Procurement NAS Backend', timestamp: new Date().toISOString() });
});

// Khởi chạy server
initDatabase().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 SCE Procurement NAS Backend đang chạy tại http://0.0.0.0:${PORT}`);
    });
});
