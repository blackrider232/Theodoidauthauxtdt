/**
 * SCE PROCUREMENT - NAS SYNOLOGY CONNECTOR
 * Module kết nối trực tiếp từ Web sang Máy chủ dữ liệu trên Synology DS224+
 * Hỗ trợ tự động cập nhật Cloudflare Quick Tunnel URL và thử lại khi đường truyền thay đổi.
 */

(function() {
    const DEFAULT_NAS_URL = 'https://favor-opponents-tiles-same.trycloudflare.com';
    const LEGACY_URL_KEY = 'sce_nas_backend_url';
    const CUSTOM_URL_KEY = 'sce_nas_custom_url';
    const AUTO_URL_KEY = 'sce_nas_auto_url';
    const RAW_TUNNEL_JSON_URL = 'https://raw.githubusercontent.com/blackrider232/Theodoidauthauxtdt/main/tunnel-url.json';
    const LOCAL_TUNNEL_JSON_URL = './tunnel-url.json';
    const FRIENDLY_TUNNEL_ERROR = 'Không thể kết nối máy chủ NAS Synology (đường truyền HTTPS Tunnel chưa đồng bộ hoặc đang khởi động lại). Vui lòng thử lại sau ít giây!';

    let _refreshPromise = null;

    function normalizeBaseUrl(url) {
        const clean = String(url || '').trim().replace(/\/+$/, '');
        return clean.startsWith('https://') && clean.length > 8 ? clean : '';
    }

    function clearStaleLegacyUrl() {
        try {
            const legacy = localStorage.getItem(LEGACY_URL_KEY);
            if (!legacy) return;
            const trimmed = legacy.trim();
            if (trimmed.startsWith('https://') && !trimmed.includes('.trycloudflare.com')) {
                if (!localStorage.getItem(CUSTOM_URL_KEY)) {
                    localStorage.setItem(CUSTOM_URL_KEY, trimmed.replace(/\/+$/, ''));
                }
            }
            localStorage.removeItem(LEGACY_URL_KEY);
        } catch (e) {}
    }

    function isNetworkOrTunnelError(err) {
        if (!err) return false;
        if (err.name === 'AbortError' || err instanceof TypeError) return true;
        const msg = String(err.message || '');
        return /failed to fetch|load failed|networkerror|network request failed|the internet connection appears to be offline|timeout/i.test(msg);
    }

    function isTunnelDownStatus(status) {
        return status === 502 || status === 503 || status === 504 || status === 530;
    }

    async function fetchWithTimeout(fullUrl, options = {}, timeoutMs = 15000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const fetchOpts = Object.assign({}, options, { signal: controller.signal });
            return await fetch(fullUrl, fetchOpts);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    clearStaleLegacyUrl();

    window.SCE_NAS = {
        getUrl: function() {
            clearStaleLegacyUrl();
            const custom = normalizeBaseUrl(localStorage.getItem(CUSTOM_URL_KEY));
            if (custom) return custom;
            const autoUrl = normalizeBaseUrl(localStorage.getItem(AUTO_URL_KEY));
            if (autoUrl) return autoUrl;
            return DEFAULT_NAS_URL;
        },
        setUrl: function(url) {
            const cleanUrl = String(url || '').trim().replace(/\/+$/, '');
            try { localStorage.removeItem(LEGACY_URL_KEY); } catch (e) {}
            if (cleanUrl) {
                localStorage.setItem(CUSTOM_URL_KEY, cleanUrl);
            } else {
                localStorage.removeItem(CUSTOM_URL_KEY);
            }
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
            } catch (e) {
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

        refreshTunnelUrl: async function(force = false, _avoidUrl = '') {
            if (_refreshPromise && !force) {
                return _refreshPromise;
            }

            const run = async () => {
                const sources = [
                    `${RAW_TUNNEL_JSON_URL}?t=${Date.now()}`,
                    `${LOCAL_TUNNEL_JSON_URL}?t=${Date.now()}`
                ];
                let fallbackCandidate = null;

                for (const srcUrl of sources) {
                    try {
                        const res = await fetchWithTimeout(srcUrl, { cache: 'no-store' }, 4500);
                        if (!res || !res.ok) continue;
                        const data = await res.json();
                        const candidate = normalizeBaseUrl(data && data.url);
                        if (!candidate) continue;

                        if (!_avoidUrl || candidate !== _avoidUrl) {
                            try { localStorage.setItem(AUTO_URL_KEY, candidate); } catch (e) {}
                            return candidate;
                        }
                        if (!fallbackCandidate) fallbackCandidate = candidate;
                    } catch (e) {
                        // Thử nguồn dự phòng tiếp theo
                    }
                }

                if (fallbackCandidate) {
                    try { localStorage.setItem(AUTO_URL_KEY, fallbackCandidate); } catch (e) {}
                    return fallbackCandidate;
                }
                return null;
            };

            const promise = run().finally(() => {
                if (_refreshPromise === promise) {
                    _refreshPromise = null;
                }
            });
            _refreshPromise = promise;
            return promise;
        },

        _request: async function(path, options = {}, timeoutMs = 15000) {
            const targetUrl = this.getUrl();
            let firstRes = null;

            try {
                firstRes = await fetchWithTimeout(`${targetUrl}${path}`, options, timeoutMs);
                if (!isTunnelDownStatus(firstRes.status)) {
                    return { res: firstRes, baseUrl: targetUrl };
                }
            } catch (err) {
                if (!isNetworkOrTunnelError(err)) {
                    throw err;
                }
            }

            const freshUrl = await this.refreshTunnelUrl(true, targetUrl);
            if (freshUrl && freshUrl !== targetUrl) {
                try {
                    const retryRes = await fetchWithTimeout(`${freshUrl}${path}`, options, timeoutMs);
                    if (!isTunnelDownStatus(retryRes.status)) {
                        return { res: retryRes, baseUrl: freshUrl };
                    }
                } catch (retryErr) {
                    if (!isNetworkOrTunnelError(retryErr)) {
                        throw retryErr;
                    }
                }
            }

            throw new Error(FRIENDLY_TUNNEL_ERROR);
        },

        // 1. Kiểm tra kết nối tới NAS (Healthcheck)
        checkConnection: async function(customUrl = null) {
            let targetUrl = customUrl ? String(customUrl).trim().replace(/\/+$/, '') : '';
            if (!targetUrl) {
                await this.refreshTunnelUrl(false);
                targetUrl = this.getUrl();
            }
            try {
                const res = await fetchWithTimeout(`${targetUrl}/api/health`, { cache: 'no-store' }, 4000);
                if (res.ok) {
                    const json = await res.json();
                    return { success: true, data: json };
                }
                if (isTunnelDownStatus(res.status) && !customUrl) {
                    const freshUrl = await this.refreshTunnelUrl(true, targetUrl);
                    if (freshUrl && freshUrl !== targetUrl) {
                        const retryRes = await fetchWithTimeout(`${freshUrl}/api/health`, { cache: 'no-store' }, 4000);
                        if (retryRes.ok) {
                            const retryJson = await retryRes.json();
                            return { success: true, data: retryJson };
                        }
                    }
                }
                return { success: false, error: `HTTP ${res.status}` };
            } catch (e) {
                return { success: false, error: isNetworkOrTunnelError(e) ? FRIENDLY_TUNNEL_ERROR : (e.message || 'Không thể kết nối') };
            }
        },

        // 2. Đăng nhập qua NAS
        login: async function(email, password) {
            const { res } = await this._request('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Lỗi đăng nhập');
            this.setToken(data.token);
            this.setUser(data.user);
            return data;
        },

        // 3. Đăng ký qua NAS
        register: async function(email, password, fullname, department) {
            const { res } = await this._request('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, fullname, department })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Lỗi đăng ký');
            return data;
        },

        // 4. Lấy dữ liệu đấu thầu từ NAS
        loadData: async function() {
            const { res } = await this._request('/api/data', { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            return json.data;
        },

        // 5. Lưu dữ liệu đấu thầu lên NAS
        saveData: async function(appData, createBackup = true) {
            const token = this.getToken();
            const { res } = await this._request('/api/data', {
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
            const token = this.getToken();
            const { res } = await this._request('/api/profiles', {
                headers: { 'Authorization': `Bearer ${token}` },
                cache: 'no-store'
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        },

        // 7. Cập nhật quyền / duyệt tài khoản (Admin)
        updateProfile: async function(id, updates) {
            const token = this.getToken();
            const { res } = await this._request(`/api/profiles/${id}`, {
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
            const token = this.getToken();
            const { res } = await this._request(`/api/profiles/${encodeURIComponent(id)}`, {
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
            const token = this.getToken();
            const { res } = await this._request('/api/backups', {
                headers: { 'Authorization': `Bearer ${token}` },
                cache: 'no-store'
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        },

        // 9. Khôi phục sao lưu từ NAS
        restoreBackup: async function(id) {
            const token = this.getToken();
            const { res } = await this._request(`/api/backups/${id}/restore`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        },

        // 10. Tải file đính kèm / biểu mẫu lên NAS
        uploadFile: async function(file) {
            const token = this.getToken();
            const formData = new FormData();
            formData.append('file', file);

            const { res, baseUrl } = await this._request('/api/storage/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            }, 60000);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return `${baseUrl}${data.url}`;
        }
    };

    try {
        if (typeof window !== 'undefined' && typeof fetch === 'function') {
            window.SCE_NAS.refreshTunnelUrl().catch(function() {});
        }
    } catch (e) {}
})();
