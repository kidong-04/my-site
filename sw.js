// 홈 화면 앱용 서비스 워커
// 네트워크 우선: 인터넷이 되면 항상 최신 파일을 쓰고, 안 될 때만 저장해 둔 파일로 연다.
var CACHE = "family-tracker-v4";
// supabase-js: 버전이 고정된 파일이라 내용이 바뀌지 않음 → 한 번 받아 두고 그대로 사용(오프라인에서도 화면이 열리게)
var SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
var SHELL = ["./", "index.html", "style.css", "app.js", "data.js", "cloud.js", "manifest.json",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(SHELL).then(function () {
      return c.add(new Request(SUPABASE_JS, { mode: "cors" })).catch(function () {}); // CDN 실패해도 설치는 진행
    });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = e.request.url;
  if (url === SUPABASE_JS) {
    e.respondWith(caches.match(url).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(url, copy); }); }
        return res;
      });
    }));
    return;
  }
  if (new URL(url).origin !== location.origin) return; // Supabase API 등 외부 요청은 그대로 통과
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (hit) { return hit || caches.match("index.html"); });
    })
  );
});
