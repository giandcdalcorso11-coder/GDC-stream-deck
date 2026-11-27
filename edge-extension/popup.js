'use strict';
function $(id) { return document.getElementById(id); }
chrome.runtime.sendMessage({ type: 'status' }, function (r) {
  if (!r) { $('st').textContent = 'Nessuna risposta dal servizio.'; return; }
  $('port').value = r.settings.port; $('tok').value = r.settings.token;
  var ago = r.last.ts ? Math.round((Date.now() - r.last.ts) / 1000) + ' s fa' : 'mai';
  $('st').innerHTML = (r.last.ok ? '<b class="ok">Collegato al pannello</b>' : '<b class="ko">Non collegato</b>') + ' <small>(ultimo invio ' + ago + (r.last.error ? ', ' + r.last.error : '') + ')</small>';
  var u = r.usage;
  $('us').textContent = !u ? 'Limiti: non ancora letti' : u.error ? 'Limiti: errore - ' + u.error :
    'Limiti (' + u.source + '): 5 ore ' + (u.fiveHour ? u.fiveHour.pct + '%' : '--') + ', settimana ' + (u.week ? u.week.pct + '%' : '--');
});
$('save').onclick = function () {
  chrome.runtime.sendMessage({ type: 'settings', settings: { port: parseInt($('port').value, 10) || 8080, token: $('tok').value.trim() } });
  $('save').textContent = 'Salvato';
};
$('diag').onclick = function () {
  chrome.tabs.query({ active: true, currentWindow: true }, function (t) {
    if (!t[0] || !/claude\.ai/.test(t[0].url || '')) { $('out').value = 'Apri una scheda di claude.ai e riprova.'; return; }
    chrome.tabs.sendMessage(t[0].id, { type: 'diag' }, function (d) {
      $('out').value = d ? JSON.stringify(d, null, 1) : 'La scheda non risponde: ricaricala (F5) e riprova.';
      $('out').select();
    });
  });
};
