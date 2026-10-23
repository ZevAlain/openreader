// OpenReader application-shell service worker.
// Strategy: hashed /assets are cache-first; other static files are
// stale-while-revalidate; navigations are network-first with a cached-shell
// fallback; API, uploads, and websockets are never cached.

const CACHE_VERSION = 'openreader-shell-v1'
const PRECACHE_URLS = ['/', '/manifest.webmanifest', '/openreader.svg']

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

const NEVER_CACHE = [
  request => request.method !== 'GET',
  request => new URL(request.url).origin !== self.location.origin,
  request => ['/api/', '/uploads/', '/ws/'].some(prefix => new URL(request.url).pathname.startsWith(prefix)),
]

self.addEventListener('fetch', event => {
  const { request } = event
  if (NEVER_CACHE.some(rule => rule(request))) return

  const url = new URL(request.url)
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request))
    return
  }
  event.respondWith(staleWhileRevalidate(request))
})

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION)
      cache.put('/', response.clone())
    }
    return response
  } catch {
    const cached = await caches.match('/')
    return cached || offlineFallback()
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(CACHE_VERSION)
    cache.put(request, response.clone())
  }
  return response
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request)
  const refresh = fetch(request)
    .then(response => {
      if (response.ok) {
        const cache = caches.open(CACHE_VERSION)
        cache.then(opened => opened.put(request, response.clone()))
      }
      return response
    })
    .catch(() => null)
  if (cached) {
    refresh.catch(() => null)
    return cached
  }
  const fresh = await refresh
  return fresh || offlineFallback()
}

function offlineFallback() {
  return new Response(
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>OpenReader</title><div style="display:flex;height:100vh;align-items:center;justify-content:center;font:16px/1.6 system-ui;color:#4a5568;background:#f6f1e5"><p style="padding:0 24px;text-align:center">当前处于离线状态，无法连接 OpenReader 服务器。<br/>请检查网络后重试。</p></div>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
