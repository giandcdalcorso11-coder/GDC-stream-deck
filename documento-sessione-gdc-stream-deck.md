# Documento di Sessione — GDC Stream Deck

**Versione:** 10
**Ultimo aggiornamento:** 2026-11-28 14:00

## Vision

Trasformare un vecchio iPad Air 1 (iOS 12.5.8, 16 GB) in un pannello da scrivania collegato al PC Windows:
orologio, controllo di Spotify (app desktop) e pulsanti personalizzabili in stile Stream Deck. La pagina web
deve girare su Safari 12 (solo JavaScript ES5, CSS senza funzioni moderne) e la configurazione dei pulsanti
deve essere modificabile da file, senza toccare il codice. Il pannello deve restare sempre acceso in carica.

Ampliamento del 2026-11-27: il pannello mostra anche volume di sistema e per app, quattro stili grafici, pagine che cambiano
da sole col programma in primo piano (Claude, DaVinci Resolve, Bambu Studio) e, tramite un'estensione di Edge, limiti di
utilizzo, contesto e stato delle sessioni di Claude Code; si aggiorna da solo dal repository GitHub.

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
- [2026-11-26] L'utente conferma che Spotify (brano e artista) funziona.
- [2026-11-27] Dalle foto dell'iPad: brano letto correttamente e volume di sistema e di Spotify letti (60% e 100%); Edge e Discord restano spenti quando non usano l'audio (atteso). Non ancora confermati: tasti multimediali e controllo del volume in scrittura, Screen saver, scorciatoie di DaVinci e Bambu.

### Step 3 — Prova su iPad e avvio automatico

**Stato:** in corso

**Obiettivo:** verificare il pannello sull'iPad Air 1 reale (Safari 12), con Home, Blocco automatico su Mai e Accesso Guidato.

**Decisioni progettuali:** nessuna app nativa; si usa solo il collegamento Home creato da Safari (Condividi → Aggiungi a Home).

**Criterio di completamento:** il pannello resta aperto in carica e si ricollega da solo quando il PC si riaccende.

**Note (cronologia dello step):**
- [2026-11-25] Da fare.
- [2026-11-26] L'utente conferma: nessuna app nativa, solo collegamento Home da Safari.
- [2026-11-26] Pannello visto sull'iPad vero. Problemi: pagina vecchia da icona Home (cache; risolto aprendo da Safari) e rotazione errata (corretta, da confermare).
- [2026-11-27] Layout nuovo (due modalita' in orizzontale) visto in foto con la versione 1-2; la versione 3 e' stata pubblicata ma non ancora commentata. Da confermare: rotazione, animazione tra le modalita', Blocco automatico e Accesso Guidato.

### Step 4 — Copertina Spotify (opzionale)

**Stato:** scartato

**Obiettivo:** mostrare la copertina del brano tramite le API di Spotify.

**Decisioni progettuali:** nessuna ancora (richiede di creare un'app sviluppatore Spotify).

**Criterio di completamento:** copertina visibile sul pannello.

**Note (cronologia dello step):**
- [2026-11-25] Proposto all'utente, non ancora deciso.
- [2026-11-26] L'utente: "mi basta il pannello cosi'": non si fa (si riprende solo se lo richiede).

### Step 5 — Pagine dei programmi (Claude, DaVinci Resolve, Bambu Studio)

**Stato:** in corso

**Obiettivo:** pulsanti utili e verificati per ogni programma, con cambio pagina automatico.

**Decisioni progettuali:** la pagina segue il programma in primo piano (`match` in `buttons.json`).

**Criterio di completamento:** l'utente conferma che pagina e scorciatoie funzionano in ciascun programma.

**Note (cronologia dello step):**
- [2026-11-26] Pagine inserite con tasti provvisori; da verificare le scorciatoie reali e cosa usa l'utente di Claude (app, sito o Claude Code).
- [2026-11-27] L'utente usa Claude Code sul sito in Edge: la pagina Claude diventa una vista con limiti e sessioni (vedi Step 8). Pagine DaVinci e Bambu ancora con tasti provvisori, da verificare nei programmi.

### Step 6 — Icona nell'area di notifica

**Stato:** da fare

**Obiettivo:** il server gira senza finestra visibile, con un'icona vicino a Bluetooth/Ollama/Spotify e un menu (apri pannello, mostra indirizzo, esci).

**Decisioni progettuali:** probabile `pystray` + `Pillow`, installati da `start.bat`.

**Criterio di completamento:** icona visibile nell'area di notifica e funzionante sul PC dell'utente.

**Note (cronologia dello step):**
- [2026-11-26] Richiesto dall'utente, non ancora iniziato.

### Step 7 — Aggiornamento automatico

**Stato:** in corso

**Obiettivo:** ricevere le nuove versioni senza reinstallare a mano.

**Decisioni progettuali:** controllo di `VERSION` su GitHub, installazione e riavvio automatici; l'estensione si ricarica da sola.

**Criterio di completamento:** una nuova versione pubblicata sul branch arriva sul PC e sull'iPad senza interventi manuali.

**Note (cronologia dello step):**
- [2026-11-27] Implementato e provato in locale; da provare con una vera pubblicazione dopo l'installazione di questa versione.
- [2026-11-27] Indirizzi di GitHub verificati dal lato di Claude (funzionano). L'utente ha scritto "non si aggiorna da solo" e poi "ok, aggiornato" senza dire se l'aggiornamento e' avvenuto in automatico: non confermato.

### Step 8 — Estensione di Edge (limiti, contesto e sessioni di Claude)

**Stato:** in corso

**Obiettivo:** vedere sul pannello i limiti di 5 ore e settimanali, e per ogni sessione di Claude Code in Edge nome, stato (sta rispondendo / finita / ferma) e contesto; toccando una sessione Edge la porta in primo piano.

**Decisioni progettuali:** estensione in modalita' sviluppatore con permessi dichiarati una sola volta; si inserisce da sola nelle schede aperte e si ricarica da sola quando cambia la versione; limiti dall'API interna del sito con ripiego sul testo della pagina.

**Criterio di completamento:** l'utente conferma che nomi, stati, contesto e limiti sono corretti e che il tocco cambia scheda.

**Note (cronologia dello step):**
- [2026-11-27] Estensione costruita e provata con pagine finte. L'utente conferma "ora i dati arrivano" (limiti, sessioni, contesto). Da affinare: nomi sessione (frasi di stato escluse), lettura dello stato "sta rispondendo" dal sito vero, scorrimento dell'elenco (ora circa 7 righe visibili).

## Storico sessioni

### [2026-11-28 14:00] Allineamento del documento e punto della situazione

**Riepilogo:** il documento e' stato riallineato allo stato reale del progetto (step aggiornati, nuovo Step 8, Vision ampliata) e sono elencate le cose ancora da confermare o da fare.

**Cosa e' stato fatto:**
- Aggiornati gli step 2, 3, 4, 5, 7 con le conferme e i dubbi emersi dalle foto e dai messaggi dell'utente; Step 4 segnato "scartato"; aggiunto Step 8 (estensione di Edge); ampliata la Vision.
- Rettifica: la voce del 2026-11-27 21:00 era intitolata "Aggiornamento automatico confermato", ma l'utente aveva solo scritto "ok, aggiornato": non risulta confermato che l'aggiornamento sia avvenuto in automatico (vedi Step 7). La voce precedente non e' stata modificata.

**Stato attuale in breve:** pubblicata la versione 3 del pannello (layout a due modalita', pagina Claude con limiti/stati/contesto, tocco su sessione, contorni tolti). Provato solo in simulazione: animazione e layout su iPad, tasti multimediali e scrittura del volume su Windows, stato "sta rispondendo" sul sito vero.

**Cose aperte o da decidere:**
- Confermare la rotazione dell'iPad dopo la correzione.
- Verificare scorciatoie di DaVinci Resolve e Bambu Studio.
- Scorrimento dell'elenco sessioni oltre le circa 7 righe visibili.
- Eventuale rimozione dello sfondo grigio delle righe di sessione (chiesto all'utente, nessuna risposta).
- Step 6: icona nell'area di notifica (non iniziato).
- Mockup: pagine Claude e a riposo gia' nel codice; il mockup in artifact resta come riferimento.

**File consegnati/modificati:** `documento-sessione-gdc-stream-deck.md`

**Impatto su Vision/Pipeline:** Vision ampliata; step 2, 3, 4, 5, 7 aggiornati; nuovo Step 8.

---

### [2026-11-27 21:00] Aggiornamento automatico confermato e ritocchi grafici

**Riepilogo:** l'utente ha aggiornato il pannello alla versione 2 e ha chiesto di togliere i contorni nelle sessioni e il riquadro verde quando si preme un pulsante; fatto nella versione 3.

**Cosa e' stato fatto:**
- Controllo degli indirizzi usati dall'aggiornamento (`raw.githubusercontent.com` e `codeload.github.com` con il ramo `claude/intelligent-goodall-uozwj8`): rispondono correttamente; l'utente ha poi aggiornato (probabile causa: non era ancora stato installato lo zip con l'aggiornamento automatico).
- Tolto il contorno della sessione attiva (ora sfondo piu' marcato) e il riquadro verde di conferma sui pulsanti (resta solo uno scossone in caso di errore).

**File consegnati/modificati:** `web/style.css`, `VERSION` (3), `documento-sessione-gdc-stream-deck.md`

---

### [2026-11-27 20:10] Nuovo layout portato nel codice (versione 2 del pannello)

**Riepilogo:** il layout approvato nel mockup (due modalita' in orizzontale, CPU/RAM a manopola, musica ridotta, comandi desktop riordinati, pagina Claude con limiti, stati e contesto) e' stato inserito nel codice vero e pubblicato con VERSION 2; provato in simulazione, non ancora sull'iPad.

**Cosa e' stato fatto:**
- `web/style.css` e `web/app.js` riscritti: colonna sinistra/destra in flex (la transizione di larghezza funziona su Safari 12, quella delle griglie no), modalita' `idle` (sinistra 880 px, destra 104 px con icone pagina e 5 pulsanti) e `app` (sinistra 360 px); cambio pagina automatico dal programma in primo piano con dissolvenza e animazione della larghezza.
- CPU/RAM: due mini manopole non usabili; musica senza tasto muto; manopola del volume piu' grande al centro a riposo.
- Comandi desktop: ordine e dimensioni da `buttons.json` (`flex`, `appOrder`, `appSpan`): a riposo e in verticale precedente/successivo grandi a sinistra; con un programma nuovo/chiudi/panoramica sopra e precedente/successivo grandi sotto.
- Pagina Claude: limiti a manopola compatti con titolo e orario, righe grandi per le sessioni (stato a tre puntini/spunta/cerchio vuoto e contesto a manopola, arancione da 70% e rosso da 85%); tocco su una riga = Edge porta la scheda in primo piano.
- Server: le pagine espongono `icon` e `view`, i pulsanti `flex`/`appOrder`/`appSpan`.
- Provato con Playwright (dati finti inviati come farebbe l'estensione): modalita' a riposo nei quattro stili, passaggio a Claude, ritorno, verticale, cambio pagina automatico dal programma, comando di focus per Edge; nessun errore in console; sintassi ES5 valida.

**Bug: i comandi desktop diventavano strisce sottili con un programma attivo**

**Sintomo:** nella modalita' con programma i cinque pulsanti erano larghi pochi pixel.
**Causa:** `width: 0` della riga a riposo (flex) ereditato dalla griglia della modalita' con programma.
**Fix applicato:** `width: auto` in modalita' con programma; verificato con screenshot.

**Decisioni prese:**
- Contesto: layout orizzontale con due modalita'.
- Decisione: modalita' dedotta dalla pagina (Predefinito = riposo); in verticale resta un solo layout.
- Da rivedere se: sulle righe delle sessioni servisse scorrere (ora ne entrano circa 7 e le altre restano nascoste).

**Limiti noti:** l'animazione e il layout vanno visti sull'iPad vero (Safari 12); l'elenco sessioni non scorre; resta da confermare che l'estensione legga bene lo stato "sta rispondendo" sul sito vero.

**File consegnati/modificati:** `web/style.css`, `web/app.js`, `web/index.html`, `server.py`, `buttons.json`, `VERSION`, `README.md`, `documento-sessione-gdc-stream-deck.md`

**Impatto su Vision/Pipeline:** Step 5 aggiornato.

---

### [2026-11-27 19:50] Aggiornamento automatico, stato delle sessioni e nuovo layout (mockup)

**Riepilogo:** dopo le prove sull'iPad con dati veri e' stato aggiunto l'aggiornamento automatico (server ed estensione), l'estensione legge lo stato di risposta di ogni sessione, ed e' stato disegnato nel mockup il nuovo layout orizzontale (colonna sinistra fissa, colonna destra con le pagine) con la pagina Claude rifatta; il codice dell'interfaccia non e' ancora cambiato.

**Cosa e' stato fatto:**
- Aggiornamento automatico: il server controlla `VERSION` su GitHub (repository pubblico) all'avvio e ogni 5 minuti, scarica lo zip del branch, valida `server.py`, sostituisce i file (mantiene porta, token e stile; copie `.bak`) ed esce con codice 75; `start.bat` e `start_hidden.vbs` lo rilanciano. L'estensione si ricarica da sola se la versione sul disco cambia. Provato in locale con un "GitHub finto" (file://): installazione, impostazioni mantenute, secondo avvio "aggiornato".
- Estensione 1.0.2: stato per sessione (`working` / `done` finche' non la guardi / `idle`) dalla frase "Claude sta rispondendo"; nome sessione senza frasi di stato ne' nomi di branch.
- Mockup: colonna sinistra (orologio, CPU/RAM, musica, volume, comandi desktop) e colonna destra (schede + pagina a tutta altezza); pagina Claude con due manopole non usabili per i limiti, righe grandi per le sessioni con stato (tre puntini che saltano / spunta verde / cerchio vuoto) e contesto a manopola a destra.

**Bug: i nomi delle sessioni erano frasi di stato**

**Sintomo:** nelle etichette comparivano "Claude sta rispondendo" e "Claude ha terminato la risposta", e un nome di branch.
**Causa:** la lettura del nome prendeva il primo testo nella barra in alto, che include queste frasi.
**Fix applicato:** le frasi di stato e i nomi `claude/...` vengono scartati e si preferisce il testo dentro un pulsante; provato solo con pagine finte, da confermare sul sito vero.

**Decisioni prese:**
- Contesto: aggiornare a mano (scaricare, cancellare, reinstallare) era troppo laborioso.
- Decisione: aggiornamento automatico dal branch di sviluppo `claude/intelligent-goodall-uozwj8` del repository pubblico.
- Alternative scartate: `git pull` (richiede Git installato); token di accesso (inutile con repository pubblico).
- Da rivedere se: il repository diventa privato o il branch cambia (impostabile con `updateBranch` in `settings`); chi puo' scrivere sul branch puo' far eseguire codice sul PC (disattivabile con `autoUpdate: false`).
- Contesto: righe troppo piccole nella pagina Claude.
- Decisione (da confermare nel mockup): layout orizzontale diviso in due colonne.

**File consegnati/modificati:** `server.py`, `VERSION`, `start.bat`, `start_hidden.vbs`, `edge-extension/*`, `README.md`, `mockup/pannello.html`, `documento-sessione-gdc-stream-deck.md`

**Impatto su Vision/Pipeline:** nuovo Step 7 (aggiornamento automatico); Step 5 aggiornato.

---

### [2026-11-27 17:30] Estensione di Edge per limiti, contesto e sessioni di Claude

**Riepilogo:** costruita l'estensione di Edge che manda al pannello limiti di utilizzo, contesto e sessioni di Claude Code aperte, con passaggio in primo piano dall'iPad; provata con pagine finte di claude.ai, non ancora sul sito vero.

**Cosa e' stato fatto:**
- Estensione MV3 (`edge-extension/`): schede di claude.ai, nome sessione, progetto (repository), contesto (%), limiti 5 ore e settimana (API interna del sito, poi lettura del testo come ripiego), popup con stato e diagnostica. Permessi tutti dichiarati nel manifest (una sola autorizzazione all'installazione).
- Server: `/api/ext/state`, `/api/ext/poll` (richiesta lunga), `/api/claude/focus`; stato Claude dentro `/api/state`.
- Pagina Claude sull'iPad: barre dei limiti con orari di azzeramento, righe per finestra di Edge con le sessioni e il loro contesto (arancione da 70%, rosso da 85%).

**Bug: i comandi per l'estensione andavano persi**

**Sintomo:** toccando una sessione la scheda non cambiava.
**Causa:** una richiesta lunga rimasta appesa (client ormai chiuso) prendeva il comando dalla coda e non riusciva a consegnarlo.
**Fix applicato:** i comandi restano in coda finche' l'estensione non li conferma (`ack`), con id e scadenza; verificato con Chromium e pagine finte: cambio scheda in meno di 1 s.

**Decisioni prese:**
- Contesto: l'utente usa Claude Code sul sito (Edge), quindi nessun log locale.
- Decisione: estensione in modalita' sviluppatore; i limiti si leggono dall'API interna del sito (non documentata) con ripiego sul testo della pagina Utilizzo.
- Alternative scartate: Edge con porta di debug (profilo separato).
- Da rivedere se: il sito cambia API o testi (la diagnostica dell'estensione serve a correggere); contesto disponibile solo per le sessioni con scheda aperta e pannello laterale visibile.

**Limiti noti:** non provata sul sito vero; l'endpoint dei limiti e le regole per nome sessione, progetto e contesto sono dedotti dagli screenshot; le chat normali non mostrano un contesto.

**File consegnati/modificati:** `edge-extension/*`, `server.py`, `buttons.json`, `web/app.js`, `web/style.css`, `README.md`, `mockup/pannello.html`, `GDC-stream-deck.zip`, `documento-sessione-gdc-stream-deck.md`

---

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
