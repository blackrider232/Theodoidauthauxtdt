// Cơ bản Service Worker để thỏa mãn điều kiện PWA Installable
const CACHE_NAME = 'sce-dauthau-v1';

self.addEventListener('install', (event) => {
    // Bỏ qua cache các file để luôn lấy dữ liệu mới, chỉ cài đặt SW
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Không làm gì đặc biệt, chỉ fetch bình thường qua mạng
    // Điều này đủ để trình duyệt nhận diện là PWA hợp lệ
    event.respondWith(fetch(event.request));
});