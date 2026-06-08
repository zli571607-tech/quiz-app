// Service Worker v2 - 缓存静态资源，检测更新自动刷新
const CACHE = 'quiz-v2'

self.addEventListener('install', (e) => {
  // 立即激活，不等待
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  // 清除所有旧缓存
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))))
  self.clients.claim()
  // 通知所有页面刷新
  self.clients.matchAll().then(clients => clients.forEach(c => c.navigate(c.url)))
})

self.addEventListener('fetch', (e) => {
  // 对 HTML 永不缓存，始终从网络获取
  if (e.request.destination === 'document') {
    e.respondWith(fetch(e.request))
    return
  }
  // 其他资源：网络优先，失败时用缓存
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone()
      caches.open(CACHE).then(c => c.put(e.request, clone))
      return res
    }).catch(() => caches.match(e.request))
  )
})
