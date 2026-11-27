'use strict';
// Service worker: raccoglie le schede di claude.ai, parla col server del pannello (sul tuo PC) ed esegue i comandi dell'iPad.
var settings = { port: 8080, token: '' };
var pages = {};          // tabId -> info letta dalla pagina
var usage = null;        // ultimo dato sui limiti
var last = { ok: false, ts: 0, error: 'mai inviato' };
var loopRunning = false, pushTimer = null, lastCmd = 0, epoch = '';

function base() { return 'http://localhost:' + settings.port; }
function withToken(path) { return base() + path + (settings.token ? (path.indexOf('?') > -1 ? '&' : '?') + 't=' + encodeURIComponent(settings.token) : ''); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function loadAll() {
  var s = await chrome.storage.local.get(['port', 'token', 'usage']);
  settings = { port: s.port || 8080, token: s.token || '' };
  if (s.usage) { usage = s.usage; }
  try { var ss = await chrome.storage.session.get('pages'); if (ss.pages) { pages = ss.pages; } } catch (e) {}
}

function kindOf(url) {
  if (/^https:\/\/claude\.ai\/code\/session_/.test(url)) { return 'code'; }
  if (/^https:\/\/claude\.ai\/chat\//.test(url)) { return 'chat'; }
  return 'other';
}

async function push() {
  try {
    var tabs = await chrome.tabs.query({ url: 'https://claude.ai/*' });
    var wins = await chrome.windows.getAll();
    var focused = null;
    wins.forEach(function (w) { if (w.focused) { focused = w.id; } });
    var out = [];
    tabs.forEach(function (t) {
      var k = kindOf(t.url || '');
      if (k === 'other') { return; }
      var p = pages[t.id] || {};
      out.push({ id: t.id, windowId: t.windowId, kind: k, active: !!t.active, current: !!t.active && t.windowId === focused,
        title: t.title || '', name: p.name || '', project: p.project || '', context: (p.context == null ? null : p.context) });
    });
    var r = await fetch(withToken('/api/ext/state'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tabs: out, usage: usage }) });
    last = { ok: r.ok, ts: Date.now(), error: r.ok ? '' : 'HTTP ' + r.status };
  } catch (e) {
    last = { ok: false, ts: Date.now(), error: 'server non raggiungibile (' + (e && e.message || e) + ')' };
  }
  chrome.storage.session.set({ pages: pages, last: last }).catch(function () {});
}
function pushSoon() { clearTimeout(pushTimer); pushTimer = setTimeout(push, 400); }

async function handle(cmd) {
  if (cmd.type === 'focus') {
    try {
      await chrome.tabs.update(cmd.tabId, { active: true });
      await chrome.windows.update(cmd.windowId, { focused: true });
    } catch (e) { /* scheda chiusa nel frattempo */ }
    pushSoon();
  }
}

// ascolta il server con una richiesta lunga (max 20 s): i comandi dell'iPad arrivano subito
async function loop() {
  if (loopRunning) { return; }
  loopRunning = true;
  setInterval(function () { chrome.runtime.getPlatformInfo(); }, 20000); // tiene sveglio il service worker
  setInterval(push, 5000);
  for (;;) {
    try {
      var r = await fetch(withToken('/api/ext/poll?ack=' + lastCmd));
      var j = await r.json();
      if (j.epoch !== epoch) { epoch = j.epoch; lastCmd = 0; }   // server riavviato: gli id ripartono
      (j.commands || []).forEach(function (c) { if (c.id > lastCmd) { lastCmd = c.id; handle(c); } });
    } catch (e) { await sleep(3000); }
  }
}

async function start() { await loadAll(); loop(); push(); }

chrome.runtime.onMessage.addListener(function (m, sender, reply) {
  if (m.type === 'page' && sender.tab) { pages[sender.tab.id] = m.info; pushSoon(); }
  else if (m.type === 'usage') { usage = m.usage; chrome.storage.local.set({ usage: usage }); pushSoon(); }
  else if (m.type === 'settings') { settings = m.settings; chrome.storage.local.set(m.settings); pushSoon(); }
  else if (m.type === 'status') { reply({ last: last, usage: usage, settings: settings, tabs: Object.keys(pages).length }); }
});
chrome.tabs.onUpdated.addListener(pushSoon);
chrome.tabs.onActivated.addListener(pushSoon);
chrome.tabs.onRemoved.addListener(function (id) { delete pages[id]; pushSoon(); });
chrome.windows.onFocusChanged.addListener(pushSoon);
chrome.alarms.create('tick', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(function () { if (!loopRunning) { start(); } else { push(); } });
chrome.runtime.onStartup.addListener(start);
chrome.runtime.onInstalled.addListener(start);
start();
