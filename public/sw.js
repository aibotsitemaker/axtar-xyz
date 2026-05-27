const CACHE_NAME = 'axtar-xyz-v1'
const STATIC_CACHE = 'axtar-static-v1'

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html'
]

// Install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// Activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map(key => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

// Fetch
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Supabase API-ə birbaşa get
  if (url.hostname.includes('supabase.co')) {
    return
  }

  // GET olmayan sorğuları keçdir
  if (request.method !== 'GET') {
    return
  }

  // HTML səhifələr — Network first
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          return response
        })
        .catch(() => {
          return caches.match(request) || caches.match('/offline.html')
        })
    )
    return
  }

  // Statik fayllar — Cache first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
        }
        return response
      })
    })
  )
})

// Push notifications
self.addEventListener('push', event => {
  const data = event.data?.json() || {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Axtar.xyz', {
      body: data.body || 'Yeni bildiriş var',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200]
    })
  )
})

// Notification click
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  )
})
