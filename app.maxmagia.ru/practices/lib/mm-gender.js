/* MaxMagia — тексты практик в роде участника (v2, 21.10.2026: «маленьким(ой)» не ломается)
   Подключается в <head> практики сразу после mm-sync.js:
     <script src="/practices/lib/mm-gender.js?v=2"></script>
   Что делает:
   • узнаёт у сервера род и имя участника (тот же пропуск, что у mm-sync.js);
   • «сказал(а)» → «сказал» / «сказала», «готов(а)», «важен(на)», «сонный(ая)»,
     «виноватым(ой)», «остался(лась)» и т. п. — во всей странице, в том числе в тексте,
     который страница дорисовывает сама (вопросы, разборы, итог), на картинке-шпаргалке
     и в текстовом файле результата;
   • иногда обращается по имени («Максим, твоё звание»);
   • род неизвестен (Саша, Женя…) — текст остаётся как есть, с «(а)». */
(function () {
  'use strict';
  if (window.__mmGender) return;
  window.__mmGender = 1;

  var m = location.pathname.match(/^\/(practices|art)\/([a-z0-9-]{1,60})\//);
  if (!m) return;
  var SLUG = m[2];
  var API = m[1] === 'art' ? '/art-sync/' : '/api/psync/';
  var CACHE = 'mmsync-gender';   // начинается с mmsync — mm-sync.js не отправляет это как ответ практики

  var G = null, NAME = '';
  try {
    var c = JSON.parse(localStorage.getItem(CACHE) || 'null');
    if (c && (c.g === 'm' || c.g === 'f')) { G = c.g; NAME = c.n || ''; }
  } catch (e) {}

  /* ── правила ─────────────────────────────────────────── */
  var WORD = /([А-Яа-яЁё]+)\((-?)(а|я|на|ая|яя|ой|ей|ла|лась|ась|ось|ся)\)/g;
  function fem(w, s) {
    var low = w.toLowerCase();
    if (s === 'на' && /ен$/.test(low)) return w.slice(0, -2) + 'на';          // важен → важна
    if (s === 'ая' && /(ый|ий|ой)$/.test(low)) return w.slice(0, -2) + 'ая';   // сонный → сонная
    if (s === 'ой' && /(ым|им)$/.test(low)) return w.slice(0, -2) + 'ой';      // злым → злой
    if (s === 'лась' && /лся$/.test(low)) return w.slice(0, -3) + 'лась';      // остался → осталась
    if (s === 'ась' && /ся$/.test(low)) return w.slice(0, -2) + 'ась';
    return w + s;                                                              // сказал → сказала
  }
  // Слова без пометки, которые в женском роде тоже меняются (по смыслу фразы)
  var FEM_CTX = [
    [/(был)\(а\)(\s+)маленьким(?![А-Яа-яЁё(])/g, '$1а$2маленькой'],
    [/(Будь|будь)\s+удобным(?![А-Яа-яЁё(])/g, '$1 удобной'],
    [/быть хорошим(?![А-Яа-яЁё(])/g, 'быть хорошей'],
    [/стать плохим(?![А-Яа-яЁё(])/g, 'стать плохой']
  ];
  // Обращение по имени — в нескольких спокойных местах
  var NAME_SPOTS = [
    [/^(\s*)Твоё звание(\s*)$/, function (all, a, b) { return a + NAME + ', твоё звание' + b; }],
    [/^(\s*)После каждого ответа будет разбор\./, function (all, a) { return a + NAME + ', после каждого ответа будет разбор.'; }]
  ];

  function conv(t) {
    if (!G || typeof t !== 'string' || !t) return t;
    if (t.indexOf('(') >= 0) {
      if (G === 'f') for (var i = 0; i < FEM_CTX.length; i++) t = t.replace(FEM_CTX[i][0], FEM_CTX[i][1]);
      t = t.replace(WORD, function (all, w, dash, s) { return G === 'm' ? w : fem(w, s); });
    } else if (G === 'f') {
      for (var j = 1; j < FEM_CTX.length; j++) t = t.replace(FEM_CTX[j][0], FEM_CTX[j][1]);
    }
    return t;
  }
  function convNode(t) {
    var out = conv(t);
    if (NAME) for (var i = 0; i < NAME_SPOTS.length; i++) {
      if (NAME_SPOTS[i][0].test(out)) { out = out.replace(NAME_SPOTS[i][0], NAME_SPOTS[i][1]); break; }
    }
    return out;
  }
  window.mmGender = { conv: conv, get g() { return G; }, get name() { return NAME; } };

  /* ── страница ────────────────────────────────────────── */
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, CODE: 1 };
  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  function okParent(n) {
    var p = n.parentNode;
    return !(p && (SKIP[p.nodeName] || p.isContentEditable));
  }
  function fixText(n) {
    if (!G || !okParent(n)) return;
    var v = n.nodeValue, w = convNode(v);
    if (w !== v) n.nodeValue = w;
  }
  function fixEl(el) {
    if (!G || el.nodeType !== 1 || SKIP[el.nodeName]) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = el.getAttribute && el.getAttribute(ATTRS[i]);
      if (a) { var b = conv(a); if (b !== a) el.setAttribute(ATTRS[i], b); }
    }
  }
  function walk(root) {
    if (!G || !root) return;
    if (root.nodeType === 3) return fixText(root);
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1) { if (SKIP[root.nodeName]) return; fixEl(root); }
    var tw = document.createTreeWalker(root, 5, null), n;           // элементы + текст
    while ((n = tw.nextNode())) { if (n.nodeType === 3) fixText(n); else fixEl(n); }
  }
  var busy = false;
  var mo = new MutationObserver(function (list) {
    if (!G || busy) return;
    busy = true;
    try {
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (r.type === 'characterData') fixText(r.target);
        else if (r.type === 'attributes') fixEl(r.target);
        else for (var j = 0; j < r.addedNodes.length; j++) walk(r.addedNodes[j]);
      }
    } finally { busy = false; }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true,
                                         attributes: true, attributeFilter: ATTRS });

  /* ── картинка-шпаргалка и текстовый файл ─────────────── */
  try {
    var CP = CanvasRenderingContext2D.prototype;
    ['fillText', 'strokeText', 'measureText'].forEach(function (k) {
      var raw = CP[k];
      CP[k] = function (t) { var a = Array.prototype.slice.call(arguments); a[0] = conv(String(t)); return raw.apply(this, a); };
    });
  } catch (e) {}
  try {
    var RawBlob = window.Blob;
    var MBlob = function (parts, opts) {
      if (G && opts && /^text\/plain/i.test(opts.type || '') && parts && parts.map)
        parts = parts.map(function (p) { return typeof p === 'string' ? conv(p) : p; });
      return arguments.length ? new RawBlob(parts, opts) : new RawBlob();
    };
    MBlob.prototype = RawBlob.prototype;
    window.Blob = MBlob;
  } catch (e) {}

  /* ── род и имя с сервера ─────────────────────────────── */
  var hid = false;
  if (!G) {                         // первый раз на этом устройстве — секунду ждём, чтобы не мелькало «(а)»
    hid = true;
    var st = document.createElement('style');
    st.id = 'mmg-wait'; st.textContent = 'body{visibility:hidden!important}';
    (document.head || document.documentElement).appendChild(st);
    setTimeout(show, 900);
  }
  function show() {
    if (!hid) return; hid = false;
    var s = document.getElementById('mmg-wait'); if (s) s.remove();
  }
  function cleanName(n) {
    n = String(n || '').trim().split(/\s+/)[0] || '';
    n = n.replace(/[^A-Za-zА-Яа-яЁё-]/g, '');
    if (n.length < 2 || n.length > 20) return '';
    return n.split('-').map(function (p) { return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p; }).join('-');
  }
  fetch(API + 'me?slug=' + encodeURIComponent(SLUG), { headers: { 'X-MM': '1' }, credentials: 'same-origin', cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j || !j.ok) return show();
      var g = (j.g === 'm' || j.g === 'f') ? j.g : null, n = cleanName(j.name);
      try { localStorage.setItem(CACHE, JSON.stringify({ g: g, n: n })); } catch (e) {}
      var was = G;
      if (was && g !== was) { try { if (!sessionStorage.getItem('mmg-re')) { sessionStorage.setItem('mmg-re', '1'); location.reload(); return; } } catch (e) {} }
      G = g; NAME = g ? n : '';
      if (G && !was) walk(document.documentElement);
      show();
    })
    .catch(show);
})();
