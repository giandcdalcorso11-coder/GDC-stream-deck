# Documento di Sessione — GDC Stream Deck

**Versione:** 1
**Ultimo aggiornamento:** 2026-11-26 07:31

## Vision

Trasformare un vecchio iPad Air 1 (iOS 12.5.8, 16 GB) in un pannello da scrivania collegato al PC Windows:
orologio, controllo di Spotify (app desktop) e pulsanti personalizzabili in stile Stream Deck. La pagina web
deve girare su Safari 12 (solo JavaScript ES5, CSS senza funzioni moderne) e la configurazione dei pulsanti
deve essere modificabile da file, senza toccare il codice. Il pannello deve restare sempre acceso in carica.

## Pipeline

Regola generale: ogni parte lato Windows va verificata su un PC Windows vero prima di considerarla chiusa,
perché finora è stata provata solo in modalità simulata su Linux.

### Step 1 — Prima versione (server + pagina)

**Stato:** completato

**Obiettivo:** server Python (solo libreria standard) e pagina ES5 con orologio, stato CPU/RAM, Spotify e pulsanti.

**Decisioni progettuali:** vedi storico sessioni (pagina web invece di app nativa; titolo finestra per leggere Spotify).

**Criterio di completamento:** pagina verificata in orizzontale e verticale (1024×768 e 768×1024), sintassi ES5 controllata con un parser.

**Note (cronologia dello step):**
- [2026-11-25] Prima versione scritta, provata su Linux in modalità simulata e caricata nel repo.

### Step 2 — Verifica su PC Windows

**Stato:** da fare

**Obiettivo:** confermare che sul PC Windows funzionino lettura di Spotify, tasti multimediali, scorciatoie e avvio programmi.

**Decisioni progettuali:** nessuna ancora.

**Criterio di completamento:** conferma dell'utente dopo la prova di: brano e artista corretti, tasti multimediali, almeno un pulsante per tipo (`hotkey`, `url`, `run`, `lock`).

**Note (cronologia dello step):**
- [2026-11-25] Da fare al primo avvio sul PC; nessun esito ancora.

### Step 3 — Prova su iPad e avvio automatico

**Stato:** da fare

**Obiettivo:** verificare il pannello sull'iPad Air 1 reale (Safari 12), con Home, Blocco automatico su Mai e Accesso Guidato.

**Decisioni progettuali:** nessuna ancora.

**Criterio di completamento:** il pannello resta aperto in carica e si ricollega da solo quando il PC si riaccende.

**Note (cronologia dello step):**
- [2026-11-25] Da fare.

### Step 4 — Copertina Spotify (opzionale)

**Stato:** da fare

**Obiettivo:** mostrare la copertina del brano tramite le API di Spotify.

**Decisioni progettuali:** nessuna ancora (richiede di creare un'app sviluppatore Spotify).

**Criterio di completamento:** copertina visibile sul pannello.

**Note (cronologia dello step):**
- [2026-11-25] Proposto all'utente, non ancora deciso.

## Storico sessioni

### [2026-11-26 07:31] Dall'analisi di PhoneBox al pannello per iPad nel repo GDC-stream-deck

**Riepilogo:** PhoneBox (ersinkoc/phonebox) non gira su iPhone 6 e iPad Air 1 (iOS 12), quindi è stato scritto un pannello web su misura per l'iPad Air 1 con orologio, Spotify e pulsanti, poi spostato nel nuovo repo GDC-stream-deck.

**Cosa è stato fatto:**
- Analisi di compatibilità di PhoneBox

**Bug: PhoneBox non utilizzabile su iPhone 6 e iPad Air 1**

**Sintomo:** né l'app né il pannello web di PhoneBox funzionano su iOS 12.
**Causa:** l'app ufficiale è solo Android 5+; il companion iOS è sperimentale e richiede iOS 16+; il pannello web usa `?.` (circa 400 volte), `??`, `replaceAll`, `@container`, `color-mix` e altro, non supportati da Safari 12. Dedotta leggendo il codice, non provata su un dispositivo vero.
**Fix applicato:** nessuno su PhoneBox; si è scelto un pannello nuovo (vedi Decisioni).

- Pannello scritto: `server.py` (Python, libreria standard, HTTP sulla rete locale), pagina ES5 in `web/`, pulsanti in `buttons.json` (azioni `hotkey`, `media`, `url`, `run`, `lock`; l'iPad può eseguire solo pulsanti presenti nel file; token opzionale).
- Spotify letto dal titolo della finestra di Spotify.exe; controlli via tasti multimediali di Windows.
- Provato su Linux in modalità simulata (`PANEL_DEMO=1`), con screenshot in orizzontale e verticale e controllo ES5 con acorn.
- Spostato dal repo GDC-DASHBOARD (branch `claude/intelligent-heisenberg-nspzk5`) a GDC-stream-deck (branch `main`, repo prima vuoto); la copia in GDC-DASHBOARD è stata cancellata su richiesta.
- Consigli su uso sempre in carica: consumo stimato di 3-4 kWh al mese (stima, non misura); rischio principale è l'usura della batteria del 2013 perché iOS 12 non ha la ricarica ottimizzata; lo schermo LCD non ha burn-in.

**Decisioni prese:**
- Contesto: PhoneBox non è utilizzabile sull'iPad e l'utente vuole Spotify, orologio e pulsanti personalizzabili.
- Decisione: pagina web ES5 servita da un server Python sul PC Windows, aperta in Safari e aggiunta alla Home.
- Alternative scartate: app nativa (iOS 12 non è supportato dagli strumenti attuali); polyfill/transpiling del pannello PhoneBox (circa 4,4 MB di codice, il progetto non lo prevede); Duet Display e Spacedesk (non erano la richiesta, solo citati).
- Da rivedere se: l'iPad viene sostituito con un dispositivo con iOS recente, o servono funzioni che la lettura via titolo finestra non dà (copertina, posizione nel brano).

**Limiti noti:** l'avvio automatico all'accensione non è possibile su iOS 12 (serve toccare l'icona dopo un riavvio); le parti Windows non sono ancora state provate su un PC Windows vero.

**File consegnati/modificati:**
- Creati nel repo GDC-stream-deck: `server.py`, `buttons.json`, `start.bat`, `start_hidden.vbs`, `README.md`, `web/index.html`, `web/style.css`, `web/app.js`, `documento-sessione-gdc-stream-deck.md`
- GDC-DASHBOARD: aggiunta e poi rimossa la cartella `ipad-panel/` (commit nella cronologia del branch)

---
