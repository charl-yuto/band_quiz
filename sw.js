// Service worker: app shell offline + cache of hashed build assets. Quiz data (/api) always goes to the network.
const SHELL = 'shell-v1'
const ASSETS = 'assets-v1'
const ROOT = new URL(self.registration.scope).pathname   // '/' or '/<repo>/' on GitHub Pages

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll([ROOT, ROOT + 'manifest.webmanifest', ROOT + 'icon-192.png'])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== ASSETS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()))
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api')) return
  if (url.pathname.startsWith(ROOT + 'assets/')) {   // content-hashed: cache first, never stale
    e.respondWith(caches.open(ASSETS).then(async c => {
      const hit = await c.match(e.request)
      if (hit) return hit
      const res = await fetch(e.request)
      if (res.ok) c.put(e.request, res.clone())
      return res
    }))
    return
  }
  if (e.request.mode === 'navigate') {   // network first so a new build shows up at once; cached shell when offline
    e.respondWith(fetch(e.request).then(res => {
      if (res.ok) caches.open(SHELL).then(c => c.put(ROOT, res.clone()))
      return res
    }).catch(() => caches.match(ROOT)))
  }
})
