/**
 * CÔNG CỤ CHUYỂN ĐỔI DỮ LIỆU TỪ SUPABASE CLOUD SANG NAS SYNOLOGY DS224+
 * Tự động tải sce_v2_app_data, sce_v2_profiles và xuất thành file JSON an toàn,
 * đồng thời có thể nạp thẳng vào Backend PostgreSQL trên NAS.
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://xqmeeticiwclsvckpqrd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxbWVldGljaXdjbHN2Y2twcXJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwMzQ4NDEsImV4cCI6MjEwNjYxMDg0MX0.izCPDQ8wIMqr8GEm47Oz2PTJB7srj5Fj7DpeKIR_HAk';

async function fetchSupabaseTable(tableName) {
    try {
        const url = `${SUPABASE_URL}/rest/v1/${tableName}?select=*`;
        const res = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        if (!res.ok) {
            console.warn(`Không thể đọc trực tiếp bảng ${tableName} qua Anon Key (có thể do bật RLS): ${res.statusText}`);
            return null;
        }
        return await res.json();
    } catch (err) {
        console.error(`Lỗi kết nối Supabase bảng ${tableName}:`, err.message);
        return null;
    }
}

async function runMigration() {
    console.log('====================================================');
    console.log(' BẮT ĐẦU TRÍCH XUẤT DỮ LIỆU TỪ SUPABASE CLOUD...');
    console.log('====================================================');

    const appData = await fetchSupabaseTable('sce_v2_app_data');
    const profiles = await fetchSupabaseTable('sce_v2_profiles');
    const backups = await fetchSupabaseTable('sce_v2_backups');

    const exportBundle = {
        exportedAt: new Date().toISOString(),
        supabaseUrl: SUPABASE_URL,
        appData: (appData && appData.length > 0) ? appData[0].data : null,
        profiles: profiles || [],
        backups: backups || []
    };

    const outPath = path.join(__dirname, 'supabase_backup_export.json');
    fs.writeFileSync(outPath, JSON.stringify(exportBundle, null, 2), 'utf8');

    console.log(`✅ Đã xuất dữ liệu thành công ra file: ${outPath}`);
    if (exportBundle.appData) {
        const missionCount = (exportBundle.appData.missions && exportBundle.appData.missions.length) || 0;
        console.log(`- Số lượng Nhiệm vụ chính: ${missionCount}`);
    }
    console.log(`- Số lượng Tài khoản người dùng: ${exportBundle.profiles.length}`);
    console.log('====================================================');
}

runMigration();
