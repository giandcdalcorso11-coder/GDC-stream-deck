# Pannello per iPad (Spotify + orologio + volume + pulsanti)

Pagina web pensata per **iPad Air 1 / iOS 12** (JavaScript ES5, nessuna funzione moderna).
Un piccolo server sul PC Windows la serve all'iPad via Wi-Fi.

## Installazione / aggiornamento
1. Sul PC installa **Python 3** da python.org (spunta "Add python.exe to PATH").
2. Copia questa cartella sul PC e fai doppio clic su `start.bat`.
   Per aggiornare: chiudi la finestra del server, sostituisci i file della cartella con quelli nuovi
   (se hai personalizzato `buttons.json` o il token, tieni la tua copia) e rilancia `start.bat`.
3. Alla richiesta del firewall di Windows consenti l'accesso sulle **reti private**.
4. La finestra mostra l'indirizzo, es. `http://192.168.1.20:8080`. Aprilo in Safari sull'iPad (stessa Wi-Fi).
   Dopo un aggiornamento basta chiudere e riaprire il pannello sull'iPad.

## iPad
- Safari: Condividi -> *Aggiungi a Home*, cosi' si apre a schermo intero.
- Impostazioni -> Schermo e luminosita' -> **Blocco automatico: Mai**.
- Impostazioni -> Generali -> Accessibilita' -> **Accesso Guidato** (triplo clic su Home nel pannello).
- iOS non permette di aprire un'app in automatico all'accensione: dopo un riavvio tocca l'icona una volta.

## Come si usa
- **Orizzontale** (davanti alla tastiera) o **verticale** (a sinistra): la pagina si adatta da sola.
- **Stili:** tocca l'**orologio** per cambiare stile (Windows, Apple Glass, Neon, DJ). Lo stile resta salvato sull'iPad.
  Windows e DJ usano slider/fader, Apple e Neon usano manopole (si girano con un gesto circolare).
- **Luminosita':** tocca la scheda **CPU/RAM** per attenuare lo schermo (3 livelli).
- **Volume:** il controllo grande e' il volume di sistema, quelli piccoli sono Spotify, Chrome e Discord
  (si attivano quando l'app sta usando l'audio; altrimenti restano spenti). Si cambiano in `volumeApps`.
- **Comandi desktop** (sempre visibili): desktop precedente/successivo, panoramica, nuovo, chiudi desktop.
- **Pagine:** le schede cambiano pagina; la pagina cambia da sola in base al programma in primo piano
  (campo `match` di ogni pagina, es. `"resolve.exe"`).

## Pagina Claude (estensione di Edge)
La pagina Claude mostra i limiti di 5 ore e settimanali e, per ogni sessione di Claude Code aperta in Edge, il suo
contesto (rosso da 85%, arancione da 70%: e' il momento di fare un compact). Toccando una sessione Edge la porta
in primo piano. Serve l'estensione nella cartella `edge-extension` (istruzioni in `edge-extension/LEGGIMI.txt`):
si installa una sola volta e le autorizzazioni non vengono piu' richieste. Se la porta del server non e' 8080 o hai
messo un token, impostali dall'icona dell'estensione.

## Pulsanti personalizzabili
Modifica `buttons.json` (si ricarica da solo). Ogni pulsante: `id` unico, `label` (`<br>` per andare a capo),
`icon` (nome di un'icona in `web/index.html`), `cat` (`sys`, `audio`, `work`, `danger`: il colore dipende dallo stile),
`span` (larghezza in colonne), `small` e un'`action`:

| type | esempio |
|---|---|
| `hotkey` | `{ "type": "hotkey", "keys": "ctrl+shift+m" }` (lettere, cifre, f1-f24, ctrl, shift, alt, win, enter, esc, frecce, backslash...) |
| `media` | `{ "type": "media", "cmd": "playpause" }` |
| `url` | `{ "type": "url", "url": "https://..." }` (solo http/https) |
| `run` | `{ "type": "run", "path": "C:\\Programmi\\App\\app.exe", "args": [] }` |
| `saver` | `{ "type": "saver" }` avvia lo screen saver (deve essere impostato in Windows) |
| `lock` | `{ "type": "lock" }` blocca Windows |

L'iPad puo' eseguire solo i pulsanti scritti in questo file, mai comandi arbitrari.
Chiunque sia sulla tua Wi-Fi puo' pero' aprire la pagina: per proteggerla metti una parola in `"token"` dentro
`settings` e apri `http://IP:8080/?t=LA-TUA-PAROLA`.

## Limiti e cose da verificare
- I tasti delle pagine Claude, DaVinci e Bambu Studio sono **provvisori** (scorciatoie da verificare nei programmi).
- Il volume (sistema e per app) usa l'API audio di Windows via ctypes: **da provare sul PC**. Se non funziona il
  controllo resta spento e il server scrive il motivo nella finestra.
- Spotify: titolo e artista dal titolo della finestra (l'app deve essere aperta); niente copertina.
