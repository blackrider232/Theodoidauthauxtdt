/**
 * SCE PROCUREMENT - NAS SYNOLOGY CONNECTOR
 * Module kết nối trực tiếp từ Web sang Máy chủ dữ liệu trên Synology DS224+
 */

(function() {
    const DEFAULT_NAS_URL = 'https://favor-opponents-tiles-same.trycloudflare.com';

    window.SCE_NAS = {
        getUrl: function() {
            const saved = localStorage.getItem('sce_nas_backend_url');
            if (saved && saved.startsWith('https://')) {
                return saved;
            }
            // Tự động chuyển đổi từ IP HTTP nội bộ sang HTTPS Cloudflare Tunnel
            localStorage.setItem('sce_nas_backend_url', DEFAULT_NAS_URL);
            return DEFAULT_NAS_URL;
        },
        setUrl: function(url) {
            const cleanUrl = String(url || '').trim().replace(/\/+$/, '');
            localStorage.setItem('sce_nas_backend_url', cleanUrl);
        },
        getMode: function() {
            return 'nas';
        },
        getToken: function() {
            return localStorage.getItem('sce_nas_jwt_token') || '';
        },
        setToken: function(token) {
            if (token) localStorage.setItem('sce_nas_jwt_token', token);
            else localStorage.removeItem('sce_nas_jwt_token');
        },
        getUser: function() {
            try {
                return JSON.parse(localStorage.getItem('sce_nas_logged_user') || 'null');
            } catch(e) {
                return null;
            }
        },
        setUser: function(user) {
            if (user) localStorage.setItem('sce_nas_logged_user', JSON.stringify(user));
            else localStorage.removeItem('sce_nas_logged_user');
        },
        logout: function() {
            this.setToken('');
            this.setUser(null);
            localStorage.removeItem('sce_v2_auth_token');
        },

        // 1. Kiểm tra kết nối tới NAS (Healthcheck)
        checkConnection: async function(customUrl = null) {
            const targetUrl = (customUrl || this.getUrl()).replace(/\/+$/, '');
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);
                const res = await fetch(`${targetUrl}/api/health`, {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (res.ok) {
                    const json = await res.json();
                    return { success: true, data: json };
                }
                return { success: false, error: `HTTP ${res.status}` };
            } catch (e) {
                return { success: false, error: e.message || 'Không thể kết nối' };
            }
        },

        // 2. Đăng nhập qua NAS
        login: async function(email, password) {
            const targetUrl = this.getUrl();
            const res = await fetch(`${targetUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Lỗi đăng nhập');
            this.setToken(data.token);
            this.setUser(data.user);
            return data;
        },

        // 3. Đăng ký qua NAS
        register: async function(email, password, fullname, department) {
            const targetUrl = this.getUrl();
            const res = await fetch(`${targetUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, fullname, department })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Lỗi đăng ký');
            return data;
        },

        // 4. Lấy dữ liệu đấu thầu từ NAS
        loadData: async function() {
            const targetUrl = this.getUrl();
            const res = await fetch(`${targetUrl}/api/data`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            return json.data;
        },

        // 5. Lưu dữ liệu đấu thầu lên NAS
        saveData: async function(appData, createBackup = true) {
            const targetUrl = this.getUrl();
            const token = this.getToken();
            const res = await fetch(`${targetUrl}/api/data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ data: appData, createBackup })
            });
            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.error || `HTTP ${res.status}`);
            }
            return await res.json();
        },

        // 6. Lấy danh sách tài khoản
        getProfiles: async function() {
            const targetUrl = this.getUrl();
            const token = this.getToken();
            const res = await fetch(`${targetUrl}/api/profiles`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        },

        // 7. Cập nhật quyền / duyệt tài khoản (Admin)
        updateProfile: async function(id, updates) {
            const targetUrl = this.getUrl();
            const token = this.getToken();
            const res = await fetch(`${targetUrl}/api/profiles/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updates)
            });
            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.error || `HTTP ${res.status}`);
            }
            return await res.json();
        },

        // 7b. Xóa tài khoản vĩnh viễn (Chỉ Admin)
        deleteProfile: async function(id) {
            const targetUrl = this.getUrl();
            const token = this.getToken();
            const res = await fetch(`${targetUrl}/api/profiles/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.error || `HTTP ${res.status}`);
            }
            return await res.json();
        },

        // 8. Tải danh sách sao lưu từ NAS
        getBackups: async function() {
            const targetUrl = this.getUrl();
            const token = this.getToken();
            const res = await fetch(`${targetUrl}/api/backups`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        },

        // 9. Khôi phục sao lưu từ NAS
        restoreBackup: async function(id) {
            const targetUrl = this.getUrl();
            const token = this.getToken();
            const res = await fetch(`${targetUrl}/api/backups/${id}/restore`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        },

        // 10. Tải file đính kèm / biểu mẫu lên NAS
        uploadFile: async function(file) {
            const targetUrl = this.getUrl();
            const token = this.getToken();
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch(`${targetUrl}/api/storage/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return `${targetUrl}${data.url}`;
        }
    };
})();
