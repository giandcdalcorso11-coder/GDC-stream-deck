(function () {
  'use strict'; // ES5 di proposito: deve girare su Safari 12 (iOS 12)

  var token = (/[?&]t=([^&]+)/.exec(location.search) || [])[1] || '';
  var THEMES = ['windows', 'apple', 'neon', 'dj'];
  var KIND = { windows: 'slider', apple: 'knob', neon: 'knob', dj: 'fader' };
  var PAL = { windows: { acc: '#0078d4', dng: '#e5484d' }, apple: { acc: '#ffffff', dng: '#ff9c9c' }, neon: { acc: '#00f0ff', dng: '#ff3b6b' }, dj: { acc: '#ff9d00', dng: '#ff3b30' } };
  var stage = document.getElementById('stage');

  var cfg = null, cfgVersion = null, fails = 0;
  var theme = 'windows', page = 'default', autoProfile = null, orient = 'land';
  var vols = {}, ctls = {}, lockUntil = {}, lastSend = {}, sendT = {}, lastState = null;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (html) { e.innerHTML = html; } return e; }
  function ic(n) { return '<svg class="i"><use href="#ic-' + n + '" xlink:href="#ic-' + n + '"></use></svg>'; }
  function clamp(v) { return Math.max(0, Math.min(100, v)); }
  function now() { return new Date().getTime(); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  // etichette dal file di configurazione: solo testo, con <br> per andare a capo
  function setText(node, text) {
    var parts = String(text || '').split('<br>'), i;
    node.innerHTML = '';
    for (i = 0; i < parts.length; i++) {
      if (i) { node.appendChild(document.createElement('br')); }
      node.appendChild(document.createTextNode(parts[i]));
    }
  }
  function modeOf() { return orient === 'land' && page === 'default' ? 'idle' : 'app'; }

  /* ---- rete ---- */
  function api(method, path, body, cb) {
    var x = new XMLHttpRequest(), done = false;
    var url = path + (token ? (path.indexOf('?') > -1 ? '&' : '?') + 't=' + encodeURIComponent(token) : '');
    function end(err, data) { if (!done) { done = true; if (cb) { cb(err, data); } } }
    x.open(method, url, true);
    x.timeout = 4000;
    x.onload = function () {
      var d = null;
      try { d = JSON.parse(x.responseText); } catch (e) {}
      end(x.status >= 200 && x.status < 300 ? null : (d && d.error) || 'errore ' + x.status, d);
    };
    x.onerror = x.ontimeout = function () { end('rete'); };
    if (body) { x.setRequestHeader('Content-Type', 'application/json'); x.send(JSON.stringify(body)); }
    else { x.send(); }
  }

  /* ---- scala: lo "stage" e' 1024x768 (o 768x1024) e viene adattato alla finestra ---- */
  // iOS: window.orientation e' affidabile subito; innerWidth/innerHeight dopo una rotazione possono essere
  // ancora quelli vecchi (scambiati) o arrivare in ritardo: si corregge e si ricalcola piu' volte.
  function currentOrient() {
    if (typeof window.orientation === 'number') { return Math.abs(window.orientation) === 90 ? 'land' : 'port'; }
    return window.innerHeight > window.innerWidth ? 'port' : 'land';
  }
  function fit() {
    var w = window.innerWidth, h = window.innerHeight, o = currentOrient(), t0;
    if ((o === 'land' && h > w) || (o === 'port' && w > h)) { t0 = w; w = h; h = t0; }
    var sw = o === 'port' ? 768 : 1024, sh = o === 'port' ? 1024 : 768, k = Math.min(w / sw, h / sh);
    var t = 'scale(' + k + ')';
    stage.style.webkitTransform = t; stage.style.transform = t;
    stage.style.left = Math.max(0, (w - sw * k) / 2) + 'px';
    stage.style.top = Math.max(0, (h - sh * k) / 2) + 'px';
  }

  /* ---- trascinamento: tocco e mouse ---- */
  function drag(node, onStart, onMove, onEnd) {
    var active = false;
    function pos(e) { var t = e.touches && e.touches.length ? e.touches[0] : e; return { x: t.clientX, y: t.clientY }; }
    function down(e) { active = true; e.preventDefault(); onStart(pos(e)); }
    function move(e) { if (active) { e.preventDefault(); onMove(pos(e)); } }
    function up() { if (active) { active = false; if (onEnd) { onEnd(); } } }
    node.addEventListener('touchstart', down, false);
    node.addEventListener('touchmove', move, false);
    node.addEventListener('touchend', up, false);
    node.addEventListener('touchcancel', up, false);
    node.addEventListener('mousedown', function (e) {
      down(e);
      var mm = function (e2) { move(e2); };
      var mu = function () { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); up(); };
      document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
    });
  }

  /* ---- quadranti disegnati (non usabili): limiti, contesto, CPU/RAM ---- */
  function arcPath(c, R, v) {
    var a1 = 135 + 270 * v, r0 = 135 * Math.PI / 180, r1 = a1 * Math.PI / 180;
    return 'M' + (c + R * Math.cos(r0)) + ' ' + (c + R * Math.sin(r0)) + ' A' + R + ' ' + R + ' 0 ' + ((a1 - 135) > 180 ? 1 : 0) + ' 1 ' + (c + R * Math.cos(r1)) + ' ' + (c + R * Math.sin(r1));
  }
  function dial(pct, D, sw, col, txt, fs, label) {
    var c = D / 2, R = c - sw / 2 - 1;
    var t = label
      ? '<text x="' + c + '" y="' + (c - 1) + '" text-anchor="middle" font-size="9" fill="currentColor" opacity=".7" style="font-family:inherit">' + label + '</text><text x="' + c + '" y="' + (c + 12) + '" text-anchor="middle" font-size="' + fs + '" font-weight="700" fill="currentColor" style="font-family:inherit">' + txt + '</text>'
      : '<text x="' + c + '" y="' + (c + fs * 0.35) + '" text-anchor="middle" font-size="' + fs + '" font-weight="700" fill="currentColor" style="font-family:inherit">' + txt + '</text>';
    return '<svg width="' + D + '" height="' + D + '" viewBox="0 0 ' + D + ' ' + D + '"><path d="' + arcPath(c, R, 1) + '" fill="none" stroke="rgba(128,128,128,.3)" stroke-width="' + sw + '" stroke-linecap="round"/>' +
      '<path d="' + arcPath(c, R, Math.max(pct / 100, 0.004)) + '" fill="none" stroke="' + col + '" stroke-width="' + sw + '" stroke-linecap="round"/>' + t + '</svg>';
  }

  /* ---- volume ---- */
  function postVol(id) { api('POST', '/api/volume', { target: id, value: Math.round(vols[id] || 0) }); }
  function sendVol(id) {
    var t = now(); lockUntil[id] = t + 1500;
    if (t - (lastSend[id] || 0) > 80) { lastSend[id] = t; postVol(id); }
    else { clearTimeout(sendT[id]); sendT[id] = setTimeout(function () { lastSend[id] = now(); postVol(id); }, 80); }
  }
  function setVol(id, v) { vols[id] = clamp(v); sendVol(id); if (ctls[id]) { ctls[id].draw(); } }

  function control(id, name, size) {
    var kind = KIND[theme], box = el('div', 'ctl'), label = el('div', 'lbl'), obj = { draw: null };
    var L = orient === 'land', I = modeOf() === 'idle', big = size === 'lg', i;
    function drawLabel() {
      var v = vols[id];
      label.innerHTML = '';
      var s = el('span'); s.appendChild(document.createTextNode(name)); label.appendChild(s);
      label.appendChild(el('b', '', v == null ? '&mdash;' : Math.round(v) + '%'));
      box.className = 'ctl' + (v == null ? ' off' : '');
    }
    function val() { return vols[id] == null ? 0 : vols[id]; }

    if (kind === 'fader') {
      var H = big ? (I ? 150 : 130) : (I ? 120 : (L ? 90 : 104)), CH = big ? 28 : 22;
      var fd = el('div', 'fd ' + size, '<div class="scale"></div><div class="slot"></div><div class="cap"></div>');
      fd.style.height = H + 'px';
      var cap = fd.querySelector('.cap'), vu = null;
      obj.draw = function () {
        cap.style.top = (8 + (100 - val()) / 100 * (H - 16) - CH / 2) + 'px'; drawLabel();
        if (vu) { var n = Math.round(val() / 100 * 12), k; for (k = 0; k < 12; k++) { vu.childNodes[k].className = (k < n ? 'on ' : '') + (k < 7 ? 'g' : k < 10 ? 'o' : 'r'); } }
      };
      var mvF = function (p) { var r = fd.getBoundingClientRect(), k = r.height / H; setVol(id, 100 - (p.y - r.top - 8 * k) / ((H - 16) * k) * 100); };
      drag(fd, mvF, mvF, function () { postVol(id); });
      var row = el('div', 'fdrow'); row.appendChild(fd);
      if (big) { vu = el('div', 'vu'); vu.style.height = H + 'px'; for (i = 0; i < 12; i++) { vu.appendChild(el('i')); } row.appendChild(vu); }
      box.appendChild(row); box.appendChild(label);
    } else if (kind === 'slider') {
      var s = el('div', 'sl ' + size, '<div class="tk"></div><div class="fl"></div><div class="th"></div>');
      var fl = s.querySelector('.fl'), th = s.querySelector('.th');
      obj.draw = function () { fl.style.width = val() + '%'; th.style.left = val() + '%'; drawLabel(); };
      var mvS = function (p) { var r = s.getBoundingClientRect(); setVol(id, (p.x - r.left) / r.width * 100); };
      drag(s, mvS, mvS, function () { postVol(id); });
      box.appendChild(s); box.appendChild(label);
    } else {
      // manopola: si gira con un gesto circolare attorno al centro (orario = piu' volume)
      var D = big ? (L ? (I ? 196 : 164) : 140) : (L ? (I ? 104 : 58) : 92), R = D / 2 - (big ? 12 : 8), sw = big ? 11 : 8, c = D / 2, ap = theme === 'apple', nn = theme === 'neon';
      var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 ' + D + ' ' + D); svg.setAttribute('width', D); svg.setAttribute('height', D); svg.setAttribute('class', 'kn');
      var pt = function (a, r) { a = a * Math.PI / 180; return [c + r * Math.cos(a), c + r * Math.sin(a)]; };
      var gloss = function (r) { var p0 = pt(200, r - 3), p1 = pt(290, r - 3); return 'M' + p0[0] + ' ' + p0[1] + ' A' + (r - 3) + ' ' + (r - 3) + ' 0 0 1 ' + p1[0] + ' ' + p1[1]; };
      obj.draw = function () {
        var v = val() / 100, ri = R - sw - 4, a = pt(135 + 270 * v, ri - 3), b = pt(135 + 270 * v, ri - (big ? 24 : 14));
        svg.innerHTML =
          '<path d="' + arcPath(c, R, 1) + '" fill="none" stroke="' + (ap ? 'rgba(255,255,255,.22)' : '#1a1a44') + '" stroke-width="' + sw + '" stroke-linecap="round"/>' +
          '<path d="' + arcPath(c, R, Math.max(v, 0.002)) + '" fill="none" stroke="' + (ap ? '#fff' : '#00f0ff') + '" stroke-width="' + sw + '" stroke-linecap="round"' + (nn ? ' style="filter:drop-shadow(0 0 6px #00f0ff)"' : '') + '/>' +
          '<circle cx="' + c + '" cy="' + c + '" r="' + ri + '" fill="' + (ap ? 'rgba(255,255,255,.16)' : '#0d0d2b') + '" ' + (nn ? 'stroke="#00f0ff" stroke-opacity=".5"' : ap ? 'stroke="rgba(255,255,255,.6)" stroke-width="1.5"' : '') + '/>' +
          (ap ? '<path d="' + gloss(ri) + '" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="2" stroke-linecap="round"/>' : '') +
          '<line x1="' + b[0] + '" y1="' + b[1] + '" x2="' + a[0] + '" y2="' + a[1] + '" stroke="' + (ap ? '#fff' : '#00f0ff') + '" stroke-width="' + (big ? 5 : 3) + '" stroke-linecap="round"/>' +
          (big ? '<text x="' + c + '" y="' + (c + 9) + '" font-size="28">' + (vols[id] == null ? '--' : Math.round(val())) + '</text>' : '');
        drawLabel();
      };
      var prev = null;
      var ang = function (p) { var r = svg.getBoundingClientRect(), dx = p.x - (r.left + r.width / 2), dy = p.y - (r.top + r.height / 2); return { a: Math.atan2(dy, dx) * 180 / Math.PI, d: Math.sqrt(dx * dx + dy * dy) / r.width * D }; };
      drag(svg, function (p) { prev = ang(p); }, function (p) {
        var cur = ang(p);
        if (cur.d < 10 || prev.d < 10) { prev = cur; return; }
        var d = cur.a - prev.a; if (d > 180) { d -= 360; } if (d < -180) { d += 360; }
        prev = cur; setVol(id, val() + d / 270 * 100);
      }, function () { postVol(id); });
      box.appendChild(svg); box.appendChild(label);
    }
    obj.el = box; ctls[id] = obj; obj.draw();
    return box;
  }

  /* ---- luminosita' ---- */
  var dimLevel = 0, DIMS = [0, 0.4, 0.7];
  try { dimLevel = parseInt(localStorage.getItem('dim'), 10) || 0; } catch (e) {}
  function applyDim() { $('dim').style.opacity = DIMS[dimLevel]; }

  /* ---- pulsanti ---- */
  function keyButton(b, extra) {
    var k = el('button', 'key' + (extra || '') + (b.small ? ' sm' : ''), ic(b.icon));
    var s = el('span'); setText(s, b.label); k.appendChild(s);
    k.setAttribute('data-c', b.cat || 'sys');
    k.addEventListener('click', function () {
      api('POST', '/api/press', { id: b.id }, function (err) {
        var cls = err ? ' err' : ' ok'; k.className += cls;
        setTimeout(function () { k.className = k.className.replace(cls, ''); }, 600);
      });
    });
    return k;
  }

  /* ---- pagina Claude: limiti e sessioni (dati dall'estensione di Edge) ---- */
  var cvSig = '', DAYS_SHORT = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  function hhmm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function resetText(l, weekly) {
    if (!l) { return ''; }
    var d = l.resetsAt ? new Date(l.resetsAt) : null;
    if (!d || isNaN(d.getTime())) { return l.label ? 'si azzera ' + l.label : ''; }
    if (weekly) { return 'si azzera ' + DAYS_SHORT[d.getDay()] + ' ' + hhmm(d); }
    var mins = Math.max(0, Math.round((d.getTime() - now()) / 60000));
    return 'si azzera alle ' + hhmm(d) + ' (tra ' + (mins >= 60 ? Math.floor(mins / 60) + ' h ' : '') + (mins % 60) + ' min)';
  }
  function limitDial(title, l, weekly) {
    var pal = PAL[theme], d = el('div', 'dl');
    var col = l && l.pct >= 85 ? pal.dng : pal.acc;
    d.innerHTML = dial(l ? l.pct : 0, 60, 6, col, l ? Math.round(l.pct) + '%' : '--', 15);
    var t = el('div'), tt = el('div', 'tt'), sm = el('small');
    tt.appendChild(document.createTextNode(title)); sm.appendChild(document.createTextNode(l ? resetText(l, weekly) : 'non disponibile'));
    t.appendChild(tt); t.appendChild(sm); d.appendChild(t);
    return d;
  }
  function stIcon(st) {
    return '<span class="st ' + st + '">' + (st === 'working' ? '<i></i><i></i><i></i>' : st === 'done' ? ic('chk') : '') + '</span>';
  }
  function claudeShell() {
    var cv = el('div', 'cv'), u = el('div', 'panel'), ss = el('div', 'panel cvs');
    u.id = 'cvu'; ss.id = 'cvs';
    u.appendChild(el('h4', '', 'Utilizzo')); u.appendChild(el('div', '', ''));
    ss.appendChild(el('h4', '', 'Sessioni aperte')); ss.appendChild(el('div', '', ''));
    cv.appendChild(u); cv.appendChild(ss);
    cvSig = '';
    return cv;
  }
  function renderClaude(cl) {
    var u = $('cvu'), ss = $('cvs');
    if (!u || !ss || !cl) { return; }
    var offline = cl.age === null || cl.age > 25;
    var sig = JSON.stringify([cl.tabs, cl.usage, offline]) + Math.floor(now() / 60000);
    if (sig === cvSig) { return; }
    cvSig = sig;
    var ub = u.childNodes[1], sb = ss.childNodes[1], pal = PAL[theme];
    ub.innerHTML = ''; sb.innerHTML = '';
    if (offline) {
      ub.appendChild(el('div', 'cvmsg', 'Estensione di Edge non collegata'));
      sb.appendChild(el('div', 'cvmsg', 'Apri Edge con l’estensione installata (vedi edge-extension/LEGGIMI.txt).'));
      return;
    }
    if (cl.usage && (cl.usage.fiveHour || cl.usage.week)) {
      var row = el('div', 'cvl');
      row.appendChild(limitDial('Limite di 5 ore', cl.usage.fiveHour, false));
      row.appendChild(limitDial('Settimanale', cl.usage.week, true));
      ub.appendChild(row);
    } else {
      ub.appendChild(el('div', 'cvmsg', 'Limiti non disponibili' + (cl.usage && cl.usage.error ? ': ' + cl.usage.error : ' (in lettura...)')));
    }
    var wins = {}, order = [];
    (cl.tabs || []).forEach(function (t) { if (!wins[t.windowId]) { wins[t.windowId] = []; order.push(t.windowId); } wins[t.windowId].push(t); });
    if (!order.length) { sb.appendChild(el('div', 'cvmsg', 'Nessuna sessione di Claude aperta in Edge')); return; }
    order.forEach(function (w, wi) {
      var tabs = wins[w], counts = {}, best = '', bc = 0;
      tabs.forEach(function (t) { if (t.project) { counts[t.project] = (counts[t.project] || 0) + 1; if (counts[t.project] > bc) { bc = counts[t.project]; best = t.project; } } });
      var gh = el('div', 'gh'); gh.appendChild(document.createTextNode(best || 'Finestra ' + (wi + 1))); sb.appendChild(gh);
      tabs.forEach(function (t) {
        var r = el('div', 'sx' + (t.active ? ' on' : '')), nm = el('div', 'nm');
        nm.appendChild(document.createTextNode(t.name || (t.title && t.title !== 'Claude Code' ? t.title : (t.kind === 'chat' ? 'Chat' : 'Sessione'))));
        r.appendChild(nm);
        r.insertAdjacentHTML('beforeend', stIcon(t.status || 'idle'));
        if (t.context !== null && t.context !== undefined) {
          var cc = el('div', 'cx2');
          cc.innerHTML = dial(t.context, 46, 5, t.context >= 85 ? pal.dng : t.context >= 70 ? '#f5a623' : pal.acc, t.context, 13);
          r.appendChild(cc);
        }
        r.addEventListener('click', function () { api('POST', '/api/claude/focus', { tabId: t.id, windowId: t.windowId }); });
        sb.appendChild(r);
      });
    });
  }

  /* ---- schede e pagina ---- */
  function pageById(id) { var i; for (i = 0; i < cfg.pages.length; i++) { if (cfg.pages[i].id === id) { return cfg.pages[i]; } } return null; }
  function buildPage() {
    var tabs = $('tabs'), deck = $('deck');
    if (!tabs || !cfg) { return; }
    tabs.innerHTML = ''; deck.innerHTML = '';
    var cur = pageById(page);
    if (!cur && cfg.pages.length) { cur = cfg.pages[0]; page = cur.id; }
    cfg.pages.forEach(function (p) {
      var t = el('button', 'tab' + (p.id === page ? ' on' : ''), ic(p.icon || 'desk'));
      var l = el('span', 'tl'); l.appendChild(document.createTextNode(p.name)); t.appendChild(l);
      t.addEventListener('click', function () { goPage(p.id); });
      tabs.appendChild(t);
    });
    if (cur && cur.view === 'claude') {
      deck.appendChild(claudeShell());
      if (lastState) { renderClaude(lastState.claude); }
    } else if (cur) {
      cur.buttons.forEach(function (b) {
        var k = keyButton(b, ''), sp = b.span || 1;
        if (sp > 1) { k.style.gridColumn = 'span ' + sp; }
        deck.appendChild(k);
      });
    }
  }

  /* ---- costruzione dell'interfaccia ---- */
  function buildAll(opts) {
    if (!cfg) { return; }
    ctls = {};
    var mode = modeOf();
    stage.className = 't-' + theme + ' ' + orient + (orient === 'land' ? ' ' + mode : '') + (opts && opts.from ? ' fade' : '');
    stage.innerHTML = '';
    var c1 = el('section', 'card', '<div id="clock">--:--<small>--</small></div><div id="date">&nbsp;</div>'); c1.id = 'c1';
    var pal = PAL[theme], sd = orient === 'land' ? (mode === 'idle' ? 74 : 50) : 60;
    var sys = el('section', 'card', '<div id="cpuk">' + dial(0, sd, 5, pal.acc, '--', 13, 'CPU') + '</div><div id="ramk">' + dial(0, sd, 5, pal.acc, '--', 13, 'RAM') + '</div>'); sys.id = 'sys';
    var c2 = el('section', 'card', '<div id="now"><div id="art">' + ic('note') + '</div><div id="meta"><div id="song">Spotify</div><div id="artist">&nbsp;</div></div></div>' +
      '<div id="tr"><button class="tb" data-cmd="prev">' + ic('prev') + '</button><button class="tb big" id="ppbtn" data-cmd="playpause">' + ic('pp') + '</button><button class="tb" data-cmd="next">' + ic('next') + '</button></div>'); c2.id = 'c2';
    var vol = el('section', 'card'); vol.id = 'vol';
    var m = el('div'); m.id = 'master'; m.appendChild(control('master', 'Volume PC', 'lg'));
    var a = el('div'); a.id = 'apps';
    cfg.volumeApps.forEach(function (v) { var d = el('div', 'app'); d.appendChild(control(v.id, v.label, 'sm')); a.appendChild(d); });
    vol.appendChild(m); vol.appendChild(a);
    // comandi desktop: in orizzontale con un programma i grandi sono precedente/successivo (ordine "app"); a riposo e in verticale ordine del file
    var desk = el('section'); desk.id = 'deskrow';
    var list = cfg.desktop.slice(), appMode = orient === 'land' && mode === 'app';
    if (appMode) { list.sort(function (x, y) { return (x.appOrder || 0) - (y.appOrder || 0); }); }
    list.forEach(function (b) {
      var k = keyButton(b, ' dkb');
      if (appMode) { k.style.gridColumn = 'span ' + (b.appSpan || 2); }
      else { var f = b.flex || 1; k.style.webkitFlex = f; k.style.flex = f; }
      desk.appendChild(k);
    });
    var strip = el('section', '', '<div id="tabs"></div>'); strip.id = 'strip';
    var deck = el('section'); deck.id = 'deck';
    var left = el('div'); left.id = 'leftcol'; var top2 = el('div'); top2.id = 'toprow';
    top2.appendChild(c1); top2.appendChild(sys);
    left.appendChild(top2); left.appendChild(c2); left.appendChild(vol); left.appendChild(desk);
    var right = el('div'); right.id = 'rightcol'; right.appendChild(strip); right.appendChild(deck);
    stage.appendChild(left); stage.appendChild(right);
    if (theme === 'dj') {
      var w = '<svg class="wave" viewBox="0 0 500 60" preserveAspectRatio="none">', x, q;
      for (x = 0; x < 500; x += 4) { q = 7 + Math.abs(Math.sin(x / 17) * Math.sin(x / 53)) * 22; w += '<rect x="' + x + '" y="' + (30 - q) + '" width="2" height="' + (q * 2) + '" fill="' + (x < 220 ? '#2f9bff' : '#1c4f8a') + '"/>'; }
      c2.insertAdjacentHTML('beforeend', w + '</svg>');
    }
    // tocco sull'orologio: cambia stile; tocco su CPU/RAM: luminosita'
    c1.addEventListener('click', function () {
      theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
      try { localStorage.setItem('theme', theme); } catch (e) {}
      buildAll(); tick();
    });
    sys.addEventListener('click', function () {
      dimLevel = (dimLevel + 1) % DIMS.length; applyDim();
      try { localStorage.setItem('dim', dimLevel); } catch (e) {}
    });
    Array.prototype.forEach.call(c2.querySelectorAll('[data-cmd]'), function (b) {
      b.addEventListener('click', function () { api('POST', '/api/media', { cmd: b.getAttribute('data-cmd') }); });
    });
    buildPage(); fit(); tick();
    if (lastState) { render(lastState); }
    Object.keys(ctls).forEach(function (k) { ctls[k].draw(); });
    if (opts && opts.from) {
      // la colonna di sinistra parte dalla larghezza della modalita' precedente e si porta a quella nuova
      var lc = $('leftcol'); lc.style.width = opts.from === 'idle' ? '880px' : '360px';
      void lc.offsetWidth; lc.style.width = '';
      setTimeout(function () { stage.className = stage.className.replace(' fade', ''); }, 200);
    }
  }

  // cambio pagina: se cambia anche la modalita' (riposo <-> programma) c'e' la transizione
  function goPage(k) {
    var prev = modeOf();
    page = k;
    if (orient !== 'land' || prev === modeOf()) { if (prev !== modeOf()) { buildAll(); } else { buildPage(); } return; }
    stage.className += ' fade';
    setTimeout(function () { buildAll({ from: prev }); }, 150);
  }

  /* ---- orologio ---- */
  var DAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  var MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  function tick() {
    var d = new Date(), c = $('clock');
    if (!c) { return; }
    c.innerHTML = pad(d.getHours()) + ':' + pad(d.getMinutes()) + '<small>' + pad(d.getSeconds()) + '</small>';
    $('date').textContent = DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
  }
  setInterval(tick, 1000);

  /* ---- stato ---- */
  function render(s) {
    if (!$('cpuk')) { return; }
    var pal = PAL[theme], sd = orient === 'land' ? (modeOf() === 'idle' ? 74 : 50) : 60;
    $('cpuk').innerHTML = dial(s.stats.cpu, sd, 5, pal.acc, s.stats.cpu + '%', 13, 'CPU');
    $('ramk').innerHTML = dial(s.stats.ram, sd, 5, pal.acc, s.stats.ram + '%', 13, 'RAM');
    var sp = s.spotify, song, artist;
    if (!sp.running) { song = 'Spotify non aperto'; artist = 'Apri Spotify sul PC'; }
    else if (!sp.playing) { song = 'In pausa'; artist = 'Spotify'; }
    else { song = sp.title; artist = sp.artist || ' '; }
    $('song').textContent = song; $('artist').textContent = artist;
    $('c2').className = 'card' + (sp.playing ? '' : ' idle');
    $('ppbtn').innerHTML = ic(sp.playing ? 'pp' : 'play');
  }
  function applyVolumes(v) {
    var t = now(), k;
    for (k in v) {
      if (v.hasOwnProperty(k) && (lockUntil[k] || 0) < t) {
        vols[k] = v[k];
        if (ctls[k]) { ctls[k].draw(); }
      }
    }
  }

  function poll() {
    api('GET', '/api/state', null, function (err, s) {
      if (err || !s) {
        fails++;
        if (fails >= 3) { $('offline').className = 'show'; }
      } else {
        fails = 0; $('offline').className = '';
        lastState = s;
        if (s.version !== cfgVersion) { loadConfig(); }
        else {
          render(s); applyVolumes(s.volume || {}); renderClaude(s.claude);
          if (cfg && s.profile !== autoProfile) {
            autoProfile = s.profile;
            if (pageById(s.profile) && s.profile !== page) { goPage(s.profile); }
          }
        }
      }
      setTimeout(poll, err ? 3000 : 1000);
    });
  }

  function loadConfig() {
    api('GET', '/api/config', null, function (err, c) {
      if (err || !c) { return; }
      cfg = c; cfgVersion = c.version;
      var saved = null;
      try { saved = localStorage.getItem('theme'); } catch (e) {}
      theme = THEMES.indexOf(saved) > -1 ? saved : (THEMES.indexOf(c.theme) > -1 ? c.theme : 'windows');
      orient = currentOrient();
      buildAll();
    });
  }

  function relayout() {
    var o = currentOrient();
    if (o !== orient) { orient = o; buildAll(); } else { fit(); }
  }
  function relayoutSoon() { relayout(); setTimeout(relayout, 120); setTimeout(relayout, 400); setTimeout(relayout, 900); setTimeout(relayout, 1800); }
  window.addEventListener('resize', relayoutSoon);
  window.addEventListener('orientationchange', relayoutSoon);
  window.addEventListener('pageshow', relayoutSoon);
  document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  applyDim(); loadConfig(); poll();
})();
