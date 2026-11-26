# Documento di Sessione — GDC Stream Deck

**Versione:** 5
**Ultimo aggiornamento:** 2026-11-26 20:05

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

**Stato:** in corso

**Obiettivo:** confermare che sul PC Windows funzionino lettura di Spotify, tasti multimediali, scorciatoie e avvio programmi.

**Decisioni progettuali:** il server accetta POST solo con `Content-Type: application/json` (protezione da comandi inviati da altri siti).

**Criterio di completamento:** conferma dell'utente dopo la prova di: brano e artista corretti, tasti multimediali, almeno un pulsante per tipo (`hotkey`, `url`, `run`, `lock`).

**Note (cronologia dello step):**
- [2026-11-25] Da fare al primo avvio sul PC; nessun esito ancora.
- [2026-11-26] Revisione del codice Windows fatta a tavolino (nessun difetto trovato nelle chiamate ctypes, tasti e CPU/RAM), ma ancora non provato su Windows vero.
- [2026-11-26] Prova su PC Windows: l'utente conferma che il server parte e i pulsanti funzionano. Ancora da confermare: brano/artista di Spotify e tasti multimediali.

### Step 3 — Prova su iPad e avvio automatico

**Stato:** da fare

**Obiettivo:** verificare il pannello sull'iPad Air 1 reale (Safari 12), con Home, Blocco automatico su Mai e Accesso Guidato.

**Decisioni progettuali:** nessuna app nativa; si usa solo il collegamento Home creato da Safari (Condividi → Aggiungi a Home).

**Criterio di completamento:** il pannello resta aperto in carica e si ricollega da solo quando il PC si riaccende.

**Note (cronologia dello step):**
- [2026-11-25] Da fare.
- [2026-11-26] L'utente conferma: nessuna app nativa, solo collegamento Home da Safari.

### Step 4 — Copertina Spotify (opzionale)

**Stato:** da fare

**Obiettivo:** mostrare la copertina del brano tramite le API di Spotify.

**Decisioni progettuali:** nessuna ancora (richiede di creare un'app sviluppatore Spotify).

**Criterio di completamento:** copertina visibile sul pannello.

**Note (cronologia dello step):**
- [2026-11-25] Proposto all'utente, non ancora deciso.

### Step 5 — Pagine dei programmi (Claude, DaVinci Resolve, Bambu Studio)

**Stato:** in corso

**Obiettivo:** pulsanti utili e verificati per ogni programma, con cambio pagina automatico.

**Decisioni progettuali:** la pagina segue il programma in primo piano (`match` in `buttons.json`).

**Criterio di completamento:** l'utente conferma che pagina e scorciatoie funzionano in ciascun programma.

**Note (cronologia dello step):**
- [2026-11-26] Pagine inserite con tasti provvisori; da verificare le scorciatoie reali e cosa usa l'utente di Claude (app, sito o Claude Code).

### Step 6 — Icona nell'area di notifica

**Stato:** da fare

**Obiettivo:** il server gira senza finestra visibile, con un'icona vicino a Bluetooth/Ollama/Spotify e un menu (apri pannello, mostra indirizzo, esci).

**Decisioni progettuali:** probabile `pystray` + `Pillow`, installati da `start.bat`.

**Criterio di completamento:** icona visibile nell'area di notifica e funzionante sul PC dell'utente.

**Note (cronologia dello step):**
- [2026-11-26] Richiesto dall'utente, non ancora iniziato.

## Storico sessioni

### [2026-11-26 20:05] Prime prove sull'iPad: cache, rotazione, Edge e pagina Claude

**Riepilogo:** dopo le prime prove su iPad vero sono stati corretti cache vecchia e rotazione dello schermo, sono stati messi Edge al posto di Chrome e il cambio pagina legato al titolo della finestra, ed e' stata disegnata (solo mockup) la pagina Claude con utilizzo e sessioni.

**Cosa e' stato fatto:**

**Bug: dopo l'aggiornamento il pannello mostrava il layout vecchio senza pulsanti**

**Sintomo:** solo data, ora, CPU/RAM e Spotify, nessun pulsante.
**Causa:** probabile: l'iPad riusava i file vecchi (cache dell'icona Home) mentre il server nuovo mandava la configurazione nuova; non verificato direttamente.
**Fix applicato:** il server aggiunge una versione ai file collegati in `index.html`; l'utente ha poi visto il pannello corretto (dopo aver svuotato la memoria dell'iPad).

**Bug: dopo una rotazione la pagina era compressa, poi piccola e a sinistra**

**Sintomo:** in verticale pagina compressa in alto; tornando in orizzontale circa il 60% dello schermo.
**Causa:** probabile: dopo la rotazione iOS fornisce misure della finestra vecchie o in ritardo e la scala veniva calcolata su quelle. Non riprodotto (solo su iPad vero).
**Fix applicato:** orientamento da `window.orientation`, misure corrette se scambiate, ricalcolo ripetuto dopo 120/400/900/1800 ms; in simulazione (Chromium) tutto ok, **da confermare sull'iPad**.

- Volumi: Edge (`msedge.exe`) al posto di Chrome. Pagina Claude attiva solo con Edge in primo piano e "Claude" nel titolo (`matchTitle`).
- Tocco su CPU/RAM per la luminosita' ora funziona su iOS (`cursor: pointer`).
- Mockup pagina Claude: barre utilizzo (5 ore, settimana) e sessioni per finestra di Edge.

**Decisioni prese:**
- Contesto: l'utente usa Claude Code sul sito in Edge, non in locale.
- Decisione: utilizzo e sessioni richiedono un'estensione di Edge installata in modalita' sviluppatore; token in tempo reale non disponibili dal sito.
- Alternative scartate: lettura di log locali (non esistono per il sito); Edge con porta di debug (richiederebbe un profilo separato e farebbe perdere gli accessi).
- Da rivedere se: l'utente passa a Claude Code in locale (log disponibili) o non vuole l'estensione.

**File consegnati/modificati:** `server.py`, `buttons.json`, `web/app.js`, `web/style.css`, `mockup/pannello.html`, `GDC-stream-deck.zip`, `documento-sessione-gdc-stream-deck.md`

---

### [2026-11-26 19:10] Nuova interfaccia (stili, volume, pagine) portata nel codice vero

**Riepilogo:** il layout deciso nel mockup (4 stili, slider/fader/manopole, volume per app, comandi desktop fissi, pagine che cambiano col programma in primo piano) e' stato inserito in server e pagina, provato in modalita' simulata su Linux ma non ancora su Windows e iPad veri.

**Cosa e' stato fatto:**
- Mockup in artifact aggiornato piu' volte con l'utente: disposizione orizzontale/verticale, pagina base (YouTube, Gestione attivita', Screen saver, Mostra desktop, Screenshot), CPU/RAM in scheda piccola, comandi desktop grandi e sempre visibili, schede pagina (Predefinito, Claude, DaVinci, Bambu Studio), manopole con gesto circolare.
- Server: volume di sistema e per app (Core Audio via ctypes, thread dedicato), programma in primo piano e scelta automatica della pagina, azione `saver`, `/api/volume`, nuova struttura di `buttons.json`.
- Pagina riscritta in ES5 e CSS senza `gap` nei flex (non supportato da Safari 12): stage 1024x768 / 768x1024 adattato alla finestra; tocco sull'orologio cambia stile, tocco su CPU/RAM la luminosita'.
- Provato in simulazione (Playwright): cambio pagina automatico, gesto circolare sul volume (42% -> 75% arrivato al server), pressione pulsanti, quattro stili in entrambi gli orientamenti, nessun errore in console; sintassi ES5 verificata con acorn.

**Decisioni prese:**
- Contesto: servivano comandi desktop sempre visibili ma grandi.
- Decisione: riga fissa sopra le schede pagina; i pulsanti di ogni pagina sotto.
- Alternative scartate: comandi desktop piccoli nella striscia (richiesta di invertire poi annullata dall'utente).
- Da rivedere se: i pulsanti di pagina risultano troppo bassi sull'iPad vero.
- Decisione: nessuna app nativa, solo collegamento Home da Safari (Step 3).
- Nota: tasti di Claude, DaVinci e Bambu sono provvisori; stile GDC Stuff rimandato; animazioni rimandate.

**Limiti noti:** volume (sistema e per app) scritto senza poterlo provare su Windows; `pointer events` assenti su iOS 12, quindi nella pagina si usano gli eventi touch (provati solo con mouse simulato); l'icona nell'area di notifica del PC non e' ancora stata fatta.

**File consegnati/modificati:** `server.py`, `buttons.json` (nuova struttura), `web/index.html`, `web/style.css`, `web/app.js`, `README.md`, `mockup/pannello.html`, `GDC-stream-deck.zip`, `documento-sessione-gdc-stream-deck.md`

**Impatto su Vision/Pipeline:** aggiunti Step 5 (pagine Claude/DaVinci/Bambu) e Step 6 (icona nell'area di notifica); Step 2 e 3 aggiornati.

---

### [2026-11-26 09:00] Prima prova su Windows riuscita

**Riepilogo:** l'utente ha avviato il server sul PC Windows e ha confermato che il server funziona e i pulsanti funzionano; restano da provare Spotify e tasti multimediali.

**Cosa è stato fatto:**
- Consegnato lo zip del progetto per il PC; prova eseguita dall'utente.
- Step 2 portato a "in corso" (parte confermata dall'utente, il resto da verificare).

**File consegnati/modificati:** `documento-sessione-gdc-stream-deck.md`

**Impatto su Vision/Pipeline:** Step 2 in corso.

---

### [2026-11-26 08:10] Revisione del codice per Windows e rafforzamento del server

**Riepilogo:** letti `server.py` e `web/` per cercare problemi su Windows/iOS 12 e aggiunte due protezioni al server; l'utente ha confermato che sull'iPad si userà solo il collegamento Home da Safari.

**Cosa è stato fatto:**
- Revisione di `server.py`, `web/app.js`, `index.html`, `style.css`, `start.bat`, `start_hidden.vbs`: chiamate ctypes, tasti, calcolo CPU, compatibilità ES5/CSS con Safari 12 e `pythonw` senza console risultano corretti leggendo il codice (non provati su Windows).

**Bug: i comandi potevano essere inviati da qualsiasi sito aperto in un browser sulla stessa rete**

**Sintomo:** nessuno osservato; rischio trovato in revisione. Un POST a `/api/press` con tipo `text/plain` veniva accettato e il corpo letto come JSON.
**Causa:** il server non controllava il `Content-Type`, quindi una pagina esterna poteva inviare la richiesta senza controllo preventivo del browser (CORS). Con token vuoto (impostazione predefinita) bastava conoscere l'indirizzo e l'`id` di un pulsante.
**Fix applicato:** i POST senza `application/json` ricevono 415; corpo massimo 4096 byte (413). Verificato su Linux in modalità simulata: JSON 200, `text/plain` e senza tipo 415.

- Aggiunto "advertisement" ai titoli considerati inattivi, per non mostrare "Advertisement" come brano (ipotesi, da verificare su Spotify vero).

**Decisioni prese:**
- Contesto: lo Step 3 prevedeva avvio sull'iPad.
- Decisione: nessuna app nativa, solo collegamento Home da Safari.
- Alternative scartate: app nativa.
- Da rivedere se: serve l'avvio automatico dopo il riavvio dell'iPad (con questa scelta non è possibile).

**File consegnati/modificati:** `server.py`, `documento-sessione-gdc-stream-deck.md`

**Impatto su Vision/Pipeline:** Step 2 e Step 3 aggiornati (decisioni e note).

---

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
