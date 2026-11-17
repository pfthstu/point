/* 点图 · 标注记忆 service worker（离线缓存） */
const CACHE = 'pointfield-mwka4p65';
const ASSETS = ['./index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 逐资源缓存：单个图标失败不再让整个 install 失败（M1-24）
    await Promise.allSettled(ASSETS.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.indexOf('pointfield-') === 0 && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function putSafe(cache, key, res) {
  if (!res || !res.ok) return Promise.resolve();
  return cache.put(key, res).catch(() => {});
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match('./index.html');
      const network = fetch(req).then((res) => {
        if (res && res.ok) putSafe(cache, './index.html', res.clone());
        return res;
      }).catch(() => null);
      if (cached) {
        try { event.waitUntil(network); } catch (e) { /* 生命周期已结束就放弃后台更新 */ }
        return cached;
      }
      const res = await network;
      if (res) return res;
      return new Response('<!doctype html><meta charset="utf-8"><title>离线</title><p>离线且没有缓存，请联网后再打开一次。</p>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    })());
    return;
  }

  event.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res && res.ok) {
      const copy = res.clone();
      try { event.waitUntil(caches.open(CACHE).then((c) => putSafe(c, req, copy))); } catch (e) {}
    }
    return res;
  })());
});
