/* MaxMagia — общий модуль практик клуба (v3: кнопка «назад» только в приложении с ярлыка; + кнопка «назад», Telegram/браузер определяется честно)
   1) Ответы практики синхронизируются через сервер клуба между устройствами
      (Telegram на телефоне, Telegram на компьютере, maxmagia.ru/art).
   2) В Telegram кнопки «Картинкой / PDF / Текстом» присылают файл ботом в личку.
   Подключается первым скриптом в <head>: <script src="/practices/lib/mm-sync.js?v=1"></script>
   Работает с любой практикой, которая хранит ответы в localStorage. */
(function () {
  'use strict';
  if (window.__mmSync) return;
  window.__mmSync = 1;

  var m = location.pathname.match(/^\/(practices|art)\/([a-z0-9-]{1,60})\//);
  if (!m) return;
  var SLUG = m[2];
  var ON_ART = m[1] === 'art';
  var API = ON_ART ? '/art-sync/' : '/api/psync/';
  // Telegram или обычный браузер: кабинет ставит отметку mm_in_tg; без неё — смотрим на признаки Telegram
  var IN_TG = !ON_ART && (function () {
    try { var f = sessionStorage.getItem('mm_in_tg'); if (f === '1') return true; if (f === '0') return false; } catch (e) {}
    try { return !!(window.TelegramWebviewProxy || (window.external && window.external.notify) || window.parent !== window); } catch (e) { return false; }
  })();
  var META = 'mmsync:' + SLUG;
  var RELOAD_FLAG = 'mmsync-reloaded:' + SLUG;

  var LS = null;
  try { LS = window.localStorage; LS.getItem('x'); } catch (e) { LS = null; }

  var SP = window.Storage && Storage.prototype;
  var rawGet = SP && SP.getItem, rawSet = SP && SP.setItem, rawRemove = SP && SP.removeItem;

  function lget(k) { try { return rawGet.call(LS, k); } catch (e) { return null; } }
  function lset(k, v) { try { rawSet.call(LS, k, v); return true; } catch (e) { return false; } }
  function ldel(k) { try { rawRemove.call(LS, k); } catch (e) {} }

  function loadMeta() {
    try { var x = JSON.parse(lget(META) || 'null'); if (x && x.keys) return x; } catch (e) {}
    return { keys: {} };
  }
  var meta = LS ? loadMeta() : { keys: {} };
  function saveMeta() { if (LS) lset(META, JSON.stringify(meta)); }
  function own(k) { return typeof k === 'string' && k !== META && k.indexOf('mmsync') !== 0; }
  function rec(k) { return meta.keys[k] || (meta.keys[k] = { b: null, d: false, s: false }); }

  var ready = false;        // ответы с сервера уже получены
  var pushTimer = null, pushing = false, retryTimer = null, warned = false;

  /* ── 1. Следим за ответами практики ─────────────────────────── */
  if (LS && SP) {
    SP.getItem = function (k) {
      var v = rawGet.call(this, k);
      if (this === LS && own(k) && !meta.keys[k] && v != null) {
        var r = rec(k);                // ответы, введённые до появления синхронизации
        if (ready) r.d = true; else r.s = true;
        saveMeta(); schedulePush();
      }
      return v;
    };
    SP.setItem = function (k, v) {
      if (this === LS && own(k)) {
        var old = rawGet.call(this, k);
        rawSet.call(this, k, v);
        if (old !== String(v)) {
          var r = rec(k);
          if (ready) r.d = true; else r.s = true;
          saveMeta(); schedulePush();
        }
        return;
      }
      return rawSet.call(this, k, v);
    };
    SP.removeItem = function (k) {
      if (this === LS && own(k) && rawGet.call(this, k) != null) {
        rawRemove.call(this, k);
        var r = rec(k);
        if (ready) r.d = true; else r.s = true;
        saveMeta(); schedulePush();
        return;
      }
      return rawRemove.call(this, k);
    };
  }

  function api(action, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    headers['X-MM'] = '1';
    var url = API + action + '?slug=' + encodeURIComponent(SLUG) + (opts.query || '');
    return fetch(url, {
      method: opts.method || 'GET', headers: headers, body: opts.body,
      credentials: 'same-origin', cache: 'no-store', keepalive: !!opts.keepalive
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false }; }).then(function (j) { j.status = r.status; return j; });
    });
  }

  /* ── 2. Первая сверка с сервером ────────────────────────────── */
  function pull() {
    if (!LS) return;
    api('state').then(function (res) {
      if (!res.ok) { if (res.status === 401 || res.status === 403) return; return retry(); }
      var items = res.items || {}, changed = false;
      Object.keys(items).forEach(function (k) {
        if (!own(k)) return;
        var S = items[k], L = lget(k), t = meta.keys[k];
        if (L === S.v) { meta.keys[k] = { b: S.u, d: false, s: false }; return; }
        var takeServer;
        if (t && t.b != null) {
          if (t.d) takeServer = false;                         // правки, не успевшие уйти (не было сети)
          else takeServer = S.u > t.b;                         // на другом устройстве новее
        } else {
          takeServer = L == null || S.v.length >= L.length;    // впервые на этом устройстве
        }
        if (takeServer) { lset(k, S.v); meta.keys[k] = { b: S.u, d: false, s: false }; changed = true; }
        else { var r = rec(k); r.d = true; r.s = false; }
      });
      Object.keys(meta.keys).forEach(function (k) {
        var t = meta.keys[k];
        if (items[k]) return;
        if (t.b != null && !t.d) {                             // стёрто на другом устройстве
          if (lget(k) != null) { ldel(k); changed = true; }
          delete meta.keys[k];
        } else if (t.d || t.s) { t.d = lget(k) != null || t.b != null; t.s = false; }
      });
      ready = true;
      saveMeta();
      if (changed) {
        var last = 0;
        try { last = +sessionStorage.getItem(RELOAD_FLAG) || 0; } catch (e) {}
        if (Date.now() - last > 15000) {
          try { sessionStorage.setItem(RELOAD_FLAG, String(Date.now())); } catch (e) {}
          location.reload();
          return;
        }
      }
      schedulePush(10);
    }).catch(retry);
  }
  function retry() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(pull, 20000);
  }

  /* ── 3. Отправка правок на сервер ───────────────────────────── */
  function schedulePush(delay) {
    if (!ready) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, delay == null ? 1500 : delay);
  }
  function push(keepalive) {
    if (!ready || pushing || !LS) return;
    var set = {}, sent = {}, n = 0;
    Object.keys(meta.keys).forEach(function (k) {
      if (meta.keys[k].d) { var v = lget(k); set[k] = v; sent[k] = v; n++; }
    });
    if (!n) return;
    var body = JSON.stringify({ set: set });
    pushing = true;
    api('state', { method: 'POST', body: body, headers: { 'Content-Type': 'application/json' },
                   keepalive: keepalive && body.length < 60000 })
      .then(function (res) {
        pushing = false;
        if (res.ok) {
          var u = res.u || {};
          Object.keys(sent).forEach(function (k) {
            var t = meta.keys[k]; if (!t) return;
            if (lget(k) === sent[k]) { t.d = false; t.b = u[k] || t.b; if (sent[k] == null) delete meta.keys[k]; }
          });
          saveMeta();
          if (Object.keys(meta.keys).some(function (k) { return meta.keys[k].d; })) schedulePush();
        } else if (res.status === 413) {
          if (!warned) { warned = true; toast('Ответов стало очень много — в клуб они не сохранились, но в этом браузере остались'); }
        } else if (res.status !== 401 && res.status !== 403) {
          setTimeout(function () { schedulePush(); }, 15000);
        }
      })
      .catch(function () { pushing = false; setTimeout(function () { schedulePush(); }, 15000); });
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { clearTimeout(pushTimer); push(true); }
    else if (!ready) pull();
  });
  window.addEventListener('online', function () { if (!ready) pull(); else schedulePush(10); });

  /* ── 4. Строчка для участника + «Стереть» ───────────────────── */
  var CSS = '.mms-note{max-width:680px;margin:40px auto 8px;padding:22px 18px 6px;text-align:center;font-size:14px;line-height:1.55;opacity:.82;border-top:1px solid rgba(127,127,127,.25)}' +
    '.mms-note p{margin:0 0 12px}.mms-btn{font:inherit;font-size:13px;color:inherit;background:transparent;border:1px solid rgba(127,127,127,.45);border-radius:999px;padding:8px 16px;cursor:pointer;min-height:36px}' +
    '.mms-btn:hover{border-color:currentColor}.mms-toast{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2147483000;max-width:min(92vw,460px);' +
    'background:rgba(22,18,26,.94);color:#F4EFE6;border:1px solid rgba(212,180,138,.35);border-radius:14px;padding:12px 16px;font:500 14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
    'box-shadow:0 10px 30px rgba(0,0,0,.35);text-align:center;transition:opacity .3s}' +
    '.mms-back{position:fixed;top:calc(10px + env(safe-area-inset-top,0px));left:calc(10px + env(safe-area-inset-left,0px));z-index:2147482000;display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:7px 14px 7px 11px;border-radius:999px;' +
    'background:rgba(22,18,26,.8);color:#F4EFE6;border:1px solid rgba(212,180,138,.4);font:600 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;text-decoration:none;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);' +
    'box-shadow:0 6px 18px rgba(0,0,0,.25);transition:transform .25s,opacity .25s}.mms-back span{font-size:19px;line-height:1;margin-top:-2px}.mms-back:hover{border-color:rgba(212,180,138,.75)}.mms-back.mms-hide{transform:translateY(-80px);opacity:0}';
  function addCss() {
    if (document.getElementById('mms-css')) return;
    var s = document.createElement('style'); s.id = 'mms-css'; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  var toastEl = null, toastTimer = null;
  function toast(text, ms) {
    addCss();
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'mms-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = text; toastEl.style.opacity = '1'; toastEl.style.display = 'block';
    clearTimeout(toastTimer);
    if (ms !== 0) toastTimer = setTimeout(function () { toastEl.style.opacity = '0'; setTimeout(function () { toastEl.style.display = 'none'; }, 320); }, ms || 4500);
  }
  function addNote() {
    if (!LS || document.querySelector('.mms-note')) return;
    addCss();
    var box = document.createElement('div');
    box.className = 'mms-note';
    box.innerHTML = '<p>Твои ответы сохраняются в клубе, чтобы открыть их с любого устройства. Видишь их только ты. Стереть — кнопкой ниже.</p>' +
      '<button type="button" class="mms-btn">Стереть мои ответы</button>';
    var btn = box.querySelector('button'), armedAt = 0, label = btn.textContent;
    btn.addEventListener('click', function () {
      if (Date.now() - armedAt > 4000) {
        armedAt = Date.now(); btn.textContent = 'Точно стереть всё в этой практике? Нажми ещё раз';
        setTimeout(function () { if (Date.now() - armedAt >= 4000) btn.textContent = label; }, 4100);
        return;
      }
      btn.disabled = true; btn.textContent = 'Стираю…';
      api('clear', { method: 'POST' }).then(function (res) {
        if (!res.ok) throw new Error('clear');
        Object.keys(meta.keys).forEach(function (k) { ldel(k); });
        meta = { keys: {} }; ldel(META);
        try { sessionStorage.setItem('mmsync-cleared:' + SLUG, '1'); } catch (e) {}
        location.reload();
      }).catch(function () {
        btn.disabled = false; btn.textContent = label;
        toast('Не получилось стереть — проверь интернет и попробуй ещё раз');
      });
    });
    var foot = document.querySelector('footer');
    if (foot && foot.parentNode) foot.parentNode.insertBefore(box, foot);
    else document.body.appendChild(box);
  }

  /* ── 5. Сохранение файлов в Telegram: присылает бот ─────────── */
  var blobs = {};
  if (IN_TG && window.URL && URL.createObjectURL) {
    var rawCreate = URL.createObjectURL;
    URL.createObjectURL = function (obj) {
      var u = rawCreate.apply(URL, arguments);
      try { if (obj instanceof Blob) blobs[u] = obj; } catch (e) {}
      return u;
    };
  }
  function dataUrlToBlob(s) {
    var i = s.indexOf(','), head = s.slice(5, i), isB64 = /;base64/.test(head);
    var mime = head.split(';')[0] || 'application/octet-stream';
    var raw = isB64 ? atob(s.slice(i + 1)) : decodeURIComponent(s.slice(i + 1));
    var arr = new Uint8Array(raw.length);
    for (var j = 0; j < raw.length; j++) arr[j] = raw.charCodeAt(j) & 255;
    return new Blob([arr], { type: mime });
  }
  function guessType(name, t) {
    if (t) return t.split(';')[0];
    var ext = (name.split('.').pop() || '').toLowerCase();
    return { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pdf: 'application/pdf', txt: 'text/plain' }[ext] || 'application/octet-stream';
  }
  var sending = false;
  function sendToChat(name, blobPromise) {
    if (sending) { toast('Подожди секунду — отправляю предыдущий файл'); return; }
    sending = true;
    toast('Отправляю тебе в Telegram…', 0);
    Promise.resolve(blobPromise).then(function (blob) {
      var type = guessType(name, blob.type);
      return api('send', { method: 'POST', body: blob, headers: { 'Content-Type': type },
        query: '&name=' + encodeURIComponent(name) + '&title=' + encodeURIComponent(document.title || '') });
    }).then(function (res) {
      sending = false;
      if (res.ok) toast('Готово! Файл — в чате с ботом клуба 🤍', 6000);
      else if (res.error === 'blocked') toast('Бот не может тебе написать: открой чат с ботом клуба, нажми «Старт» и попробуй ещё раз', 8000);
      else if (res.error === 'rate_limited') toast('Много файлов подряд — попробуй через пару минут', 6000);
      else if (res.status === 413) toast('Файл слишком большой для отправки', 6000);
      else toast('Не получилось отправить — проверь интернет и попробуй ещё раз', 6000);
    }).catch(function () {
      sending = false;
      toast('Не получилось отправить — проверь интернет и попробуй ещё раз', 6000);
    });
  }
  function grab(a) {
    if (!IN_TG || !a || a.tagName !== 'A' || !a.hasAttribute('download')) return false;
    var href = a.href || '';
    var name = a.getAttribute('download') || 'result';
    var p = null;
    if (blobs[href]) p = blobs[href];
    else if (href.indexOf('data:') === 0) { try { p = dataUrlToBlob(href); } catch (e) { return false; } }
    else if (href.indexOf('blob:') === 0 || href.indexOf(location.origin + '/') === 0) p = fetch(href).then(function (r) { return r.blob(); });
    else return false;
    sendToChat(name, p);
    return true;
  }
  if (IN_TG) {
    var rawClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (grab(this)) return; return rawClick.apply(this, arguments); };
    var rawDispatch = EventTarget.prototype.dispatchEvent;
    EventTarget.prototype.dispatchEvent = function (ev) {
      if (ev && ev.type === 'click' && this instanceof HTMLAnchorElement && grab(this)) return false;
      return rawDispatch.apply(this, arguments);
    };
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('a[download]');
      if (a && grab(a)) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }

  /* ── 6. Кнопка «назад»: в кабинет (или к списку практик на /art) ─ */
  function addBack() {
    if (document.getElementById('mms-back')) return;
    // В Telegram и в обычном браузере есть свой «назад» — кнопка нужна только в приложении с ярлыка
    var app = false;
    try { app = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches; } catch (e) {}
    if (!app) return;
    addCss();
    var a = document.createElement('a');
    a.id = 'mms-back'; a.className = 'mms-back';
    a.href = ON_ART ? '/art/' : '/';
    a.innerHTML = '<span aria-hidden="true">‹</span>' + (ON_ART ? 'Все практики' : 'Кабинет');
    a.setAttribute('aria-label', ON_ART ? 'Ко всем практикам' : 'Вернуться в кабинет');
    document.body.appendChild(a);
    var lastY = 0;
    window.addEventListener('scroll', function () {        // прячем при прокрутке вниз, показываем при прокрутке вверх
      var y = window.pageYOffset || 0;
      a.classList.toggle('mms-hide', y > lastY && y > 120);
      lastY = y;
    }, { passive: true });
  }

  /* ── старт ──────────────────────────────────────────────────── */
  function onReady() {
    addNote();
    addBack();
    var flag = null;
    try { flag = sessionStorage.getItem(RELOAD_FLAG); } catch (e) {}
    if (flag && Date.now() - (+flag) < 15000) toast('Ответы подтянулись с другого устройства ✨');
    try {
      if (sessionStorage.getItem('mmsync-cleared:' + SLUG)) {
        sessionStorage.removeItem('mmsync-cleared:' + SLUG);
        toast('Ответы этой практики стёрты');
      }
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
  else onReady();
  pull();
})();
