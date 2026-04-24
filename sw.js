const CACHE_NAME = 'wc-betting-v2'
const ASSETS = [
  '/',
  '/index.html',
  '/Css/shared.css',
  '/Css/landing.css',
  '/Css/account-modal.css',
  '/Js/landing.js',
  '/Js/firebase.js',
  '/Js/i18n.js',
  '/favicon.svg'
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS)
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(cacheNames =>
        Promise.all(
          cacheNames
            .filter(cacheName => cacheName !== CACHE_NAME)
            .map(cacheName => caches.delete(cacheName))
        )
      )
  )

  self.clients.claim()
})

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request)
    })
  )
})
