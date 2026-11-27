'use strict';
// Gira dentro le pagine di claude.ai: legge nome sessione, progetto, contesto e (una scheda alla volta) i limiti di utilizzo.
(function () {
  if (window.__gdcPanel) { return; }
  window.__gdcPanel = true;

  function isCode() { return /^\/code\/session_/.test(location.pathname); }
  function isChat() { return /^\/chat\//.test(location.pathname); }
  function bodyText() { return (document.body && document.body.innerText) || ''; }

  function readContext() {
    var m = /(?:Contesto|Context)[^\d%]{0,12}(\d{1,3})\s*%/i.exec(bodyText());
    return m ? parseInt(m[1], 10) : null;
  }

  // nome della sessione: il primo testo "foglia" nella barra in alto dell'area principale
  function headerCandidates() {
    var out = [], els = document.querySelectorAll('button, h1, h2, span, div, a');
    var minLeft = window.innerWidth > 900 ? 200 : 0;
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (e.children.length > 0) { continue; }
      var t = (e.textContent || '').trim();
      if (t.length < 2 || t.length > 80 || t.indexOf('\n') > -1) { continue; }
      var r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.top < 30 || r.top > 130 || r.left < minLeft || r.height > 50) { continue; }
      out.push({ text: t, top: Math.round(r.top), left: Math.round(r.left), btn: !!(e.closest && e.closest('button, [role="button"]')) });
    }
    out.sort(function (a, b) { return a.top - b.top || a.left - b.left; });
    return out;
  }
  // frasi di stato che compaiono in alto (non sono il nome della sessione)
  var WORKING = /sta rispondendo|is responding|sta pensando|is thinking/i, DONE = /ha terminato la risposta|finished responding/i;
  function isNoise(t) {
    return WORKING.test(t) || DONE.test(t) || /^claude\//.test(t) || ['Code', 'Chat', 'Nuovo', 'Cerca', 'Artefatti', 'Plugin', 'Altro'].indexOf(t) > -1;
  }
  function readName() {
    if (isChat()) { return (document.title || '').replace(/\s*[-\u2013|]\s*Claude.*$/, '').trim(); }
    var c = headerCandidates(), i, ok = [];
    for (i = 0; i < c.length; i++) { if (!isNoise(c[i].text)) { ok.push(c[i]); } }
    for (i = 0; i < ok.length; i++) { if (ok[i].btn) { return ok[i].text; } }   // il nome e' un pulsante (menu della sessione)
    return ok.length ? ok[0].text : '';
  }
  // la sessione sta rispondendo? (frase di stato in alto o in una regione "live")
  function isWorking() {
    var live = document.querySelectorAll('[aria-live], [role="status"]'), i;
    for (i = 0; i < live.length; i++) { if (WORKING.test(live[i].textContent || '')) { return true; } }
    var c = headerCandidates();
    for (i = 0; i < c.length; i++) { if (WORKING.test(c[i].text)) { return true; } }
    return false;
  }
  // progetto = repository mostrato nel pannello a destra (primo "proprietario/nome" dopo "Ambiente")
  function readProject() {
    var t = bodyText(), k = t.search(/Ambiente|Environment/i);
    var m = /([A-Za-z0-9_.-]{2,}\/[A-Za-z0-9_.-]{2,})/.exec(k > -1 ? t.slice(k) : t);
    return m ? m[1].split('/')[1] : '';
  }

  function sendPage() {
    if (!isCode() && !isChat()) { return; }
    try {
      chrome.runtime.sendMessage({ type: 'page', info: { working: isWorking(), name: readName(), project: isCode() ? readProject() : '', context: isCode() ? readContext() : null, ts: Date.now() } });
    } catch (e) { clearInterval(timer); clearInterval(utimer); } // estensione ricaricata: questa copia si ferma
  }

  // ---- limiti di utilizzo: prima l'API interna del sito, poi (se serve) il testo della pagina
  function scrapeUsage() {
    var t = bodyText();
    var five = /(?:Sessione corrente|Limite di 5 ore|Current session|5-hour)[\s\S]{0,160}?(\d{1,3})\s*%/i.exec(t);
    var week = /(?:Questa settimana|Settimanale|This week|Weekly)[\s\S]{0,200}?(\d{1,3})\s*%/i.exec(t);
    if (!five && !week) { return null; }
    var resets = []; t.replace(/(?:Si azzera|Resets)\s+([^\n]+)/gi, function (_, x) { resets.push(x.trim()); return ''; });
    return { fiveHour: five ? { pct: +five[1], resetsAt: '', label: resets[0] || '' } : null,
             week: week ? { pct: +week[1], resetsAt: '', label: resets[1] || '' } : null, source: 'dom' };
  }
  async function fetchUsage() {
    var u;
    try {
      var org = (document.cookie.match(/lastActiveOrg=([^;]+)/) || [])[1];
      if (!org) {
        var ro = await fetch('/api/organizations', { credentials: 'include' });
        var jo = await ro.json();
        org = (jo.filter(function (o) { return o.uuid; })[0] || {}).uuid;
      }
      var r = await fetch('/api/organizations/' + org + '/usage', { credentials: 'include' });
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      var j = await r.json();
      var f = j.five_hour, w = j.seven_day;
      if (!f && !w) { throw new Error('formato inatteso: ' + Object.keys(j).join(',')); }
      u = { fiveHour: f ? { pct: +f.utilization, resetsAt: f.resets_at || '' } : null,
            week: w ? { pct: +w.utilization, resetsAt: w.resets_at || '' } : null, source: 'api' };
    } catch (e) {
      u = scrapeUsage() || { fiveHour: null, week: null, error: String(e && e.message || e), source: 'api' };
    }
    chrome.runtime.sendMessage({ type: 'usage', usage: u });
  }
  // una sola scheda alla volta aggiorna i limiti (al massimo ogni ~80 s)
  async function maybeUsage() {
    try {
      var s = await chrome.storage.local.get('usageTs');
      if (Date.now() - (s.usageTs || 0) < 80000) { return; }
      await chrome.storage.local.set({ usageTs: Date.now() });
      fetchUsage();
    } catch (e) { clearInterval(timer); clearInterval(utimer); }
  }

  // diagnostica: la usa il popup per aiutare a correggere le letture se il sito cambia
  chrome.runtime.onMessage.addListener(function (m, s, reply) {
    if (m.type !== 'diag') { return; }
    var t = bodyText(), i = t.search(/Contesto|Context/i);
    var st = isWorking();
    reply({ url: location.pathname, name: readName(), project: readProject(), context: readContext(),
      header: headerCandidates().slice(0, 12), nearContext: i > -1 ? t.slice(Math.max(0, i - 20), i + 60) : '(parola "Contesto" non trovata)',
      usageDom: scrapeUsage(), working: st, headerAll: headerCandidates().slice(0, 20) });
  });

  var lastObs = 0;
  try { new MutationObserver(function () { var n = Date.now(); if (n - lastObs > 3000) { lastObs = n; sendPage(); } }).observe(document.body, { childList: true, subtree: true, characterData: true }); } catch (e) {}
  var timer = setInterval(sendPage, 5000), utimer = setInterval(maybeUsage, 30000);
  sendPage(); maybeUsage();
  document.addEventListener('visibilitychange', sendPage);
})();
