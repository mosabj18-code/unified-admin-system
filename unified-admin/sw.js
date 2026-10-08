/* النظام الإداري الموحّد — Service Worker
   يجب أن يطابق APP_VERSION في index.html */
const APP_VERSION = '2.14.1';
const CACHE = 'unified-admin-v' + APP_VERSION;

/* لا تكرر أي مسار هنا — addAll يفشل عند التكرار */
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './lib/xlsx.mini.js',
  './lib/chart.mini.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/badge-96.png'
];

/* Cloudflare يحوّل /index.html إلى / (307) — والمتصفح يرفض فتح صفحة من استجابة
   محوَّلة وهو أوفلاين، فنعيد بناءها نظيفة قبل التخزين */
const clean = async res => res && res.redirected
  ? new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers })
  : res;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(CORE.map(async u => {
      try {
        const res = await fetch(u, { cache: 'reload' });
        if (res.ok) await c.put(u, await clean(res));
      } catch(err){}
    }));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

const isFont = u => /fonts\.(googleapis|gstatic)\.com/.test(u);
const isCdnIcon = u => /cdn\.jsdelivr\.net/.test(u);

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;

  /* الصفحات: الشبكة أولاً ثم الذاكرة */
  if (req.mode === 'navigate'){
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        /* لا نخزّن رد التحويل نفسه (opaqueredirect) مكان الصفحة */
        if (res.ok && res.type === 'basic'){
          const c = await caches.open(CACHE); c.put('./index.html', await clean(res.clone()));
        }
        return res;
      } catch(err){
        return (await clean(await caches.match('./index.html'))) || (await clean(await caches.match('./'))) || Response.error();
      }
    })());
    return;
  }

  /* الخطوط وأيقونات jsdelivr: الذاكرة أولاً مع تحديث بالخلفية */
  if (isFont(url) || isCdnIcon(url)){
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res && res.status === 200) c.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
    return;
  }

  /* ملفات التطبيق: الذاكرة أولاً */
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && new URL(url).origin === self.location.origin){
        const c = await caches.open(CACHE); c.put(req, res.clone());
      }
      return res;
    } catch(err){ return Response.error(); }
  })());
});

/* الضغط على إشعار النظام: افتح التطبيق وانتقل للصفحة */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const page = (e.notification.data && e.notification.data.page) || null;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
    for (const c of list){
      if ('focus' in c){ await c.focus(); if (page) c.postMessage({ type:'NAVIGATE', page }); return; }
    }
    if (self.clients.openWindow){
      const w = await self.clients.openWindow(page ? './index.html#' + page : './index.html');
      if (w && page) setTimeout(() => w.postMessage({ type:'NAVIGATE', page }), 1200);
    }
  })());
});
