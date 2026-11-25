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

                CREATE INDEX IF NOT EXISTS idx_sce_v2_backups_id_desc ON sce_v2_backups (id DESC);
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
        res.set('Cache-Control', 'no-store');
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

        // Tạo bản sao lưu định kỳ nếu có yêu cầu hoặc mặc định, đồng thời giữ tối đa 100 bản mới nhất
        if (createBackup !== false) {
            pool.query(`
                INSERT INTO sce_v2_backups (data, note, created_by_email)
                VALUES ($1, 'Auto-backup from NAS API', $2)
            `, [data, userEmail])
                .then(() => pool.query(`
                    DELETE FROM sce_v2_backups
                    WHERE id <= COALESCE((
                        SELECT id FROM sce_v2_backups ORDER BY id DESC OFFSET 100 LIMIT 1
                    ), 0)
                `))
                .catch(e => console.warn('Lỗi lưu/dọn backup ngầm:', e));
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
app.use('/api/storage/files', express.static(UPLOADS_DIR, { maxAge: '7d' }));

// ====================== CLOUDFLARE QUICK TUNNEL AUTO-SYNC ======================

const TUNNEL_FILE_PATH = path.join(__dirname, 'current_tunnel_url.txt');
const LOCAL_ENV_PATH = path.join(__dirname, '.env');
let currentTunnelUrl = null;
let currentTunnelUpdatedAt = null;
let lastGithubSyncedUrl = null;
let lastGithubSyncAt = null;
let lastGithubSyncError = null;
let isSyncingGithub = false;

function readLocalEnv() {
    const out = {};
    try {
        if (fs.existsSync(LOCAL_ENV_PATH)) {
            const raw = fs.readFileSync(LOCAL_ENV_PATH, 'utf8');
            for (const line of raw.split(/\r?\n/)) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                const cleanLine = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
                const eqIdx = cleanLine.indexOf('=');
                if (eqIdx === -1) continue;
                const key = cleanLine.slice(0, eqIdx).trim();
                let val = cleanLine.slice(eqIdx + 1).trim();
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.slice(1, -1).trim();
                }
                if (key) out[key] = val;
            }
        }
    } catch (err) {
        console.warn('Không thể đọc file .env cục bộ:', err.message);
    }
    return {
        GITHUB_TOKEN: out.GITHUB_TOKEN || process.env.GITHUB_TOKEN || '',
        GITHUB_REPO: out.GITHUB_REPO || process.env.GITHUB_REPO || 'blackrider232/Theodoidauthauxtdt',
        GITHUB_BRANCH: out.GITHUB_BRANCH || process.env.GITHUB_BRANCH || 'main',
        TUNNEL_METRICS_URL: out.TUNNEL_METRICS_URL || process.env.TUNNEL_METRICS_URL || 'http://tunnel:2000'
    };
}

async function detectCurrentTunnelUrl() {
    const envCfg = readLocalEnv();
    const metricsBase = String(envCfg.TUNNEL_METRICS_URL || 'http://tunnel:2000').replace(/\/+$/, '');
    const tryCloudflareRe = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i;

    let detected = null;
    try {
        const res = await fetch(`${metricsBase}/quicktunnel`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
            const json = await res.json();
            if (json && json.hostname) {
                const candidate = 'https://' + String(json.hostname).trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
                if (tryCloudflareRe.test(candidate)) {
                    detected = candidate;
                }
            }
        }
    } catch (e) {
        // Bỏ qua nếu container tunnel đang khởi tạo
    }

    if (!detected) {
        try {
            const mRes = await fetch(`${metricsBase}/metrics`, { signal: AbortSignal.timeout(3000) });
            if (mRes.ok) {
                const text = await mRes.text();
                const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
                if (match && tryCloudflareRe.test(match[0])) {
                    detected = match[0];
                }
            }
        } catch (e) {
            // Bỏ qua
        }
    }

    if (detected && detected !== currentTunnelUrl) {
        currentTunnelUrl = detected;
        currentTunnelUpdatedAt = new Date().toISOString();
        try {
            fs.writeFileSync(TUNNEL_FILE_PATH, detected + '\n', 'utf8');
        } catch (writeErr) {
            console.warn('Không thể ghi current_tunnel_url.txt:', writeErr.message);
        }
        console.log(`🌐 Phát hiện Cloudflare Quick Tunnel mới: ${detected}`);
    }

    return currentTunnelUrl;
}

async function syncTunnelUrlToGithub(url) {
    if (isSyncingGithub || !url) return;
    const envCfg = readLocalEnv();
    const githubToken = String(envCfg.GITHUB_TOKEN || '').trim();
    if (!githubToken || url === lastGithubSyncedUrl) return;

    const githubRepo = String(envCfg.GITHUB_REPO || 'blackrider232/Theodoidauthauxtdt').trim();
    const githubBranch = String(envCfg.GITHUB_BRANCH || 'main').trim();
    const apiUrl = `https://api.github.com/repos/${githubRepo}/contents/tunnel-url.json`;
    const commonHeaders = {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'SCE-NAS-Tunnel-Sync'
    };

    isSyncingGithub = true;
    try {
        let existingSha = null;
        const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(githubBranch)}`, {
            headers: commonHeaders,
            signal: AbortSignal.timeout(8000)
        });

        if (getRes.status === 200) {
            const fileMeta = await getRes.json();
            existingSha = fileMeta.sha || null;
            if (fileMeta.content) {
                try {
                    const decoded = Buffer.from(String(fileMeta.content).replace(/\n/g, ''), 'base64').toString('utf8');
                    const parsed = JSON.parse(decoded);
                    if (parsed && parsed.url === url) {
                        lastGithubSyncedUrl = url;
                        if (!lastGithubSyncAt) lastGithubSyncAt = new Date().toISOString();
                        lastGithubSyncError = null;
                        return;
                    }
                } catch (parseErr) {
                    // File trên repo chưa đúng JSON chuẩn -> tiếp tục ghi đè
                }
            }
        } else if (getRes.status !== 404) {
            const errTxt = await getRes.text().catch(() => '');
            lastGithubSyncError = `GitHub GET HTTP ${getRes.status}: ${errTxt.slice(0, 200)}`;
            console.warn('⚠️ Lỗi đọc tunnel-url.json trên GitHub:', lastGithubSyncError);
            return;
        }

        const payload = {
            url,
            updated_at: new Date().toISOString(),
            source: 'sce_dauthau_nas'
        };
        const putBody = {
            message: 'chore(tunnel): auto-update NAS tunnel URL [skip ci]',
            branch: githubBranch,
            content: Buffer.from(JSON.stringify(payload, null, 2) + '\n', 'utf8').toString('base64')
        };
        if (existingSha) putBody.sha = existingSha;

        const putRes = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                ...commonHeaders,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(putBody),
            signal: AbortSignal.timeout(10000)
        });

        if (putRes.status === 200 || putRes.status === 201) {
            lastGithubSyncedUrl = url;
            lastGithubSyncAt = new Date().toISOString();
            lastGithubSyncError = null;
            console.log(`✅ Đã tự động đồng bộ Tunnel URL lên GitHub (${githubRepo}): ${url}`);
        } else {
            const errTxt = await putRes.text().catch(() => '');
            lastGithubSyncError = `GitHub PUT HTTP ${putRes.status}: ${errTxt.slice(0, 200)}`;
            console.warn('⚠️ Lỗi đẩy tunnel-url.json lên GitHub:', lastGithubSyncError);
        }
    } catch (err) {
        lastGithubSyncError = err.message || 'Unknown GitHub sync error';
        console.warn('⚠️ Không thể kết nối GitHub API để đồng bộ Tunnel URL:', lastGithubSyncError);
    } finally {
        isSyncingGithub = false;
    }
}

async function checkAndSyncTunnel() {
    try {
        const url = await detectCurrentTunnelUrl();
        if (url) {
            await syncTunnelUrlToGithub(url);
        }
    } catch (err) {
        console.warn('⚠️ Lỗi kiểm tra Tunnel định kỳ:', err.message);
    }
}

// 13. Endpoint chẩn đoán địa chỉ Quick Tunnel hiện tại
app.get('/api/tunnel-url', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const envCfg = readLocalEnv();
    res.json({
        url: currentTunnelUrl,
        updated_at: currentTunnelUpdatedAt,
        github_token_configured: Boolean(String(envCfg.GITHUB_TOKEN || '').trim()),
        github_synced_url: lastGithubSyncedUrl,
        github_synced_at: lastGithubSyncAt,
        github_sync_error: lastGithubSyncError
    });
});

// 14. Healthcheck
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'SCE Procurement NAS Backend',
        timestamp: new Date().toISOString(),
        tunnel_url: currentTunnelUrl
    });
});

// Khởi chạy server
initDatabase().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 SCE Procurement NAS Backend đang chạy tại http://0.0.0.0:${PORT}`);
        setTimeout(checkAndSyncTunnel, 5000);
        setTimeout(checkAndSyncTunnel, 15000);
        setInterval(checkAndSyncTunnel, 30000);
    });
});
