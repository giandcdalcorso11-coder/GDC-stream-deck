#!/usr/bin/env python3
"""Pannello per iPad: server per Windows (solo libreria standard di Python).

Serve la pagina web in web/ e offre alla pagina:
  - stato di Spotify (brano/artista, letto dal titolo della finestra dell'app desktop)
  - uso di CPU e RAM del PC
  - volume di sistema e delle singole app (API audio di Windows, via ctypes)
  - programma in primo piano, per cambiare pagina da solo
  - pulsanti personalizzabili (buttons.json) in stile Stream Deck
Su Windows invia tasti e comandi; su altri sistemi li simula (utile per provare).
"""
import json
import os
import socket
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

BASE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(BASE, "web")
CONFIG = os.path.join(BASE, "buttons.json")
IS_WIN = os.name == "nt"
DEMO = os.environ.get("PANEL_DEMO") == "1"

DEFAULT_CFG = {"settings": {"port": 8080, "token": "", "theme": "windows"},
               "volumeApps": [], "desktop": [], "pages": []}


def log(*a):
    try:
        print(*a, flush=True)
    except Exception:
        pass


# ---------------------------------------------------------------- configurazione
_cfg = {"mtime": None, "data": DEFAULT_CFG}


def load_config():
    try:
        m = os.path.getmtime(CONFIG)
    except OSError:
        m = 0
    if m != _cfg["mtime"]:
        try:
            with open(CONFIG, encoding="utf-8") as f:
                data = json.load(f)
            data.setdefault("settings", {})
            for k in ("volumeApps", "desktop", "pages"):
                data.setdefault(k, [])
            _cfg["data"] = data
        except Exception as e:
            log("buttons.json non valido, tengo la versione precedente:", e)
        _cfg["mtime"] = m
    return _cfg["data"], _cfg["mtime"]


def all_buttons(cfg):
    for b in cfg["desktop"]:
        yield b
    for p in cfg["pages"]:
        for b in p.get("buttons", []):
            yield b


# ---------------------------------------------------------------- Windows API
if IS_WIN:
    import ctypes
    from ctypes import wintypes

    user32 = ctypes.windll.user32
    kernel32 = ctypes.windll.kernel32
    ole32 = ctypes.windll.ole32
    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.QueryFullProcessImageNameW.argtypes = [
        wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
    user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    user32.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    user32.GetWindowTextLengthW.argtypes = [wintypes.HWND]
    user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
    user32.GetForegroundWindow.restype = wintypes.HWND
    user32.GetDesktopWindow.restype = wintypes.HWND
    user32.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    ENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    class MEMORYSTATUSEX(ctypes.Structure):
        _fields_ = [("dwLength", wintypes.DWORD), ("dwMemoryLoad", wintypes.DWORD),
                    ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]

    def _ft(ft):
        return (ft.dwHighDateTime << 32) | ft.dwLowDateTime

    _pid_exe = {}

    def _exe_of(pid):
        if pid in _pid_exe:
            return _pid_exe[pid]
        exe = ""
        h = kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if h:
            buf = ctypes.create_unicode_buffer(1024)
            size = wintypes.DWORD(1024)
            if kernel32.QueryFullProcessImageNameW(h, 0, buf, ctypes.byref(size)):
                exe = os.path.basename(buf.value).lower()
            kernel32.CloseHandle(h)
        if len(_pid_exe) > 500:
            _pid_exe.clear()
        _pid_exe[pid] = exe
        return exe

    def foreground_info():
        """(programma, titolo finestra) di quello in primo piano."""
        hwnd = user32.GetForegroundWindow()
        if not hwnd:
            return "", ""
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        n = user32.GetWindowTextLengthW(hwnd)
        title = ""
        if n > 0:
            buf = ctypes.create_unicode_buffer(n + 1)
            user32.GetWindowTextW(hwnd, buf, n + 1)
            title = buf.value
        return _exe_of(pid.value), title

    def spotify_titles():
        """Titoli delle finestre di Spotify.exe (None se Spotify non e' aperto)."""
        titles, found = [], [False]

        def cb(hwnd, _):
            cls = ctypes.create_unicode_buffer(256)
            user32.GetClassNameW(hwnd, cls, 256)
            if not cls.value.startswith("Chrome_WidgetWin"):
                return True
            pid = wintypes.DWORD()
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
            if _exe_of(pid.value) != "spotify.exe":
                return True
            found[0] = True
            n = user32.GetWindowTextLengthW(hwnd)
            if n > 0:
                buf = ctypes.create_unicode_buffer(n + 1)
                user32.GetWindowTextW(hwnd, buf, n + 1)
                titles.append(buf.value)
            return True

        user32.EnumWindows(ENUMPROC(cb), 0)
        return titles if found[0] else None

    _cpu_prev = [None]

    def cpu_percent():
        idle, kern, usr = wintypes.FILETIME(), wintypes.FILETIME(), wintypes.FILETIME()
        if not kernel32.GetSystemTimes(ctypes.byref(idle), ctypes.byref(kern), ctypes.byref(usr)):
            return 0
        cur = (_ft(idle), _ft(kern) + _ft(usr))
        prev, _cpu_prev[0] = _cpu_prev[0], cur
        if not prev or cur[1] == prev[1]:
            return 0
        return max(0, min(100, round(100 * (1 - (cur[0] - prev[0]) / (cur[1] - prev[1])))))

    def ram_percent():
        m = MEMORYSTATUSEX()
        m.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
        kernel32.GlobalMemoryStatusEx(ctypes.byref(m))
        return int(m.dwMemoryLoad)

    # ---- audio (Core Audio via COM, solo ctypes). Va usato sempre dallo stesso thread.
    class GUID(ctypes.Structure):
        _fields_ = [("Data1", wintypes.DWORD), ("Data2", wintypes.WORD),
                    ("Data3", wintypes.WORD), ("Data4", ctypes.c_ubyte * 8)]

    ole32.CLSIDFromString.argtypes = [ctypes.c_wchar_p, ctypes.POINTER(GUID)]
    ole32.CoCreateInstance.argtypes = [ctypes.POINTER(GUID), ctypes.c_void_p, wintypes.DWORD,
                                       ctypes.POINTER(GUID), ctypes.POINTER(ctypes.c_void_p)]
    ole32.CoCreateInstance.restype = ctypes.c_long
    ole32.CoInitializeEx.argtypes = [ctypes.c_void_p, wintypes.DWORD]

    def _guid(s):
        g = GUID()
        ole32.CLSIDFromString("{" + s + "}", ctypes.byref(g))
        return g

    CLSID_ENUM = _guid("BCDE0395-E52F-467C-8E3D-C4579291692E")
    IID_ENUM = _guid("A95664D2-9614-4F35-A746-DE8DB63617E6")
    IID_EPV = _guid("5CDF2C82-841E-4546-9722-0CF74078229A")    # IAudioEndpointVolume
    IID_ASM2 = _guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F")   # IAudioSessionManager2
    IID_ASC2 = _guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D")   # IAudioSessionControl2
    IID_SAV = _guid("87CE5498-68D6-44E5-9215-6DA47EF883D8")    # ISimpleAudioVolume
    VP = ctypes.c_void_p

    def com(p, idx, argtypes, *args):
        """Chiama il metodo numero idx dell'interfaccia COM p (indirizzo intero)."""
        vtbl = ctypes.cast(p, ctypes.POINTER(ctypes.POINTER(VP)))[0]
        fn = ctypes.WINFUNCTYPE(ctypes.c_long, VP, *argtypes)(vtbl[idx])
        return fn(p, *args)

    def _release(p):
        if p:
            com(p, 2, [])

    def _check(hr):
        if hr < 0:
            raise OSError("COM errore 0x%08X" % (hr & 0xFFFFFFFF))

    def _default_device():
        enum = VP()
        _check(ole32.CoCreateInstance(ctypes.byref(CLSID_ENUM), None, 23, ctypes.byref(IID_ENUM), ctypes.byref(enum)))
        dev = VP()
        try:
            _check(com(enum.value, 4, [ctypes.c_int, ctypes.c_int, ctypes.POINTER(VP)], 0, 1, ctypes.byref(dev)))
        finally:
            _release(enum.value)
        return dev.value

    def _activate(dev, iid):
        out = VP()
        _check(com(dev, 3, [ctypes.POINTER(GUID), wintypes.DWORD, VP, ctypes.POINTER(VP)],
                   ctypes.byref(iid), 23, None, ctypes.byref(out)))
        return out.value

    def audio_init():
        ole32.CoInitializeEx(None, 0)

    def master_get():
        dev = _default_device()
        try:
            epv = _activate(dev, IID_EPV)
            try:
                v = ctypes.c_float()
                _check(com(epv, 9, [ctypes.POINTER(ctypes.c_float)], ctypes.byref(v)))
                return int(round(v.value * 100))
            finally:
                _release(epv)
        finally:
            _release(dev)

    def master_set(pct):
        dev = _default_device()
        try:
            epv = _activate(dev, IID_EPV)
            try:
                _check(com(epv, 7, [ctypes.c_float, VP], ctypes.c_float(pct / 100.0), None))
            finally:
                _release(epv)
        finally:
            _release(dev)

    def _sessions():
        """[(exe, puntatore ISimpleAudioVolume)]: chi chiama rilascia i puntatori."""
        out = []
        dev = _default_device()
        try:
            mgr = _activate(dev, IID_ASM2)
        finally:
            _release(dev)
        try:
            senum = VP()
            _check(com(mgr, 5, [ctypes.POINTER(VP)], ctypes.byref(senum)))
            try:
                cnt = ctypes.c_int()
                _check(com(senum.value, 3, [ctypes.POINTER(ctypes.c_int)], ctypes.byref(cnt)))
                for i in range(cnt.value):
                    ctl = VP()
                    if com(senum.value, 4, [ctypes.c_int, ctypes.POINTER(VP)], i, ctypes.byref(ctl)) < 0:
                        continue
                    try:
                        c2, sav = VP(), VP()
                        if com(ctl.value, 0, [ctypes.POINTER(GUID), ctypes.POINTER(VP)],
                               ctypes.byref(IID_ASC2), ctypes.byref(c2)) < 0:
                            continue
                        pid = wintypes.DWORD()
                        com(c2.value, 14, [ctypes.POINTER(wintypes.DWORD)], ctypes.byref(pid))
                        _release(c2.value)
                        if com(ctl.value, 0, [ctypes.POINTER(GUID), ctypes.POINTER(VP)],
                               ctypes.byref(IID_SAV), ctypes.byref(sav)) >= 0:
                            out.append((_exe_of(pid.value), sav.value))
                    finally:
                        _release(ctl.value)
            finally:
                _release(senum.value)
        finally:
            _release(mgr)
        return out

    def apps_get(exes):
        """{exe: volume 0-100; assente se l'app non sta usando l'audio}."""
        res = {}
        sess = _sessions()
        try:
            for exe, sav in sess:
                if exe in exes:
                    v = ctypes.c_float()
                    if com(sav, 4, [ctypes.POINTER(ctypes.c_float)], ctypes.byref(v)) >= 0:
                        res[exe] = max(res.get(exe, 0), int(round(v.value * 100)))
        finally:
            for _, sav in sess:
                _release(sav)
        return res

    def app_set(exe, pct):
        sess = _sessions()
        try:
            for e, sav in sess:
                if e == exe:
                    com(sav, 3, [ctypes.c_float, VP], ctypes.c_float(pct / 100.0), None)
        finally:
            for _, sav in sess:
                _release(sav)

    def screensaver():
        # WM_SYSCOMMAND / SC_SCREENSAVE: funziona se in Windows e' impostato uno screen saver
        user32.PostMessageW(user32.GetDesktopWindow(), 0x0112, 0xF140, 0)
else:
    _cpu_prev = [None]
    _sim = {"master": 42}

    def spotify_titles():
        return None

    def foreground_info():
        return os.environ.get("PANEL_DEMO_FG", ""), os.environ.get("PANEL_DEMO_TITLE", "")

    def cpu_percent():
        try:
            with open("/proc/stat") as f:
                v = [int(x) for x in f.readline().split()[1:]]
            cur = (v[3] + v[4], sum(v))
            prev, _cpu_prev[0] = _cpu_prev[0], cur
            if not prev or cur[1] == prev[1]:
                return 0
            return round(100 * (1 - (cur[0] - prev[0]) / (cur[1] - prev[1])))
        except Exception:
            return 0

    def ram_percent():
        try:
            d = {}
            with open("/proc/meminfo") as f:
                for line in f:
                    k, v = line.split(":")
                    d[k] = int(v.split()[0])
            return round(100 * (1 - d["MemAvailable"] / d["MemTotal"]))
        except Exception:
            return 0

    def audio_init():
        pass

    def master_get():
        return _sim["master"]

    def master_set(pct):
        _sim["master"] = pct

    def apps_get(exes):
        return dict((e, _sim.get(e, 50)) for e in exes)

    def app_set(exe, pct):
        _sim[exe] = pct

    def screensaver():
        log("[simulato] screen saver")


# ---------------------------------------------------------------- tasti
VK = {"ctrl": 0x11, "control": 0x11, "shift": 0x10, "alt": 0x12, "win": 0x5B, "enter": 0x0D, "esc": 0x1B,
      "escape": 0x1B, "space": 0x20, "tab": 0x09, "backspace": 0x08, "delete": 0x2E, "del": 0x2E,
      "up": 0x26, "down": 0x28, "left": 0x25, "right": 0x27, "home": 0x24, "end": 0x23,
      "pageup": 0x21, "pagedown": 0x22, "printscreen": 0x2C, "insert": 0x2D, "backslash": 0xDC,
      "playpause": 0xB3, "next": 0xB0, "prev": 0xB1, "stop": 0xB2,
      "mute": 0xAD, "voldown": 0xAE, "volup": 0xAF}
EXTENDED = {0xB0, 0xB1, 0xB2, 0xB3, 0xAD, 0xAE, 0xAF, 0x26, 0x28, 0x25, 0x27, 0x24, 0x23, 0x21, 0x22, 0x2E, 0x2D}
MEDIA = {"playpause", "next", "prev", "stop", "mute", "voldown", "volup"}


def vk_for(name):
    n = name.strip().lower()
    if n in VK:
        return VK[n]
    if len(n) == 1 and n.isalnum():
        return ord(n.upper())
    if n.startswith("f") and n[1:].isdigit() and 1 <= int(n[1:]) <= 24:
        return 0x70 + int(n[1:]) - 1
    raise ValueError("tasto sconosciuto: " + name)


def send_keys(combo):
    codes = [vk_for(p) for p in combo.split("+")]
    if not IS_WIN:
        log("[simulato] tasti:", combo)
        return
    for c in codes:
        user32.keybd_event(c, 0, 1 if c in EXTENDED else 0, 0)
        time.sleep(0.01)
    for c in reversed(codes):
        user32.keybd_event(c, 0, (1 if c in EXTENDED else 0) | 2, 0)


def run_action(a):
    t = a.get("type")
    if t == "hotkey":
        send_keys(a["keys"])
    elif t == "media":
        if a.get("cmd") not in MEDIA:
            raise ValueError("comando media non valido")
        send_keys(a["cmd"])
    elif t == "url":
        url = a["url"]
        if not (url.startswith("http://") or url.startswith("https://")):
            raise ValueError("solo http/https")
        if IS_WIN:
            os.startfile(url)
        else:
            log("[simulato] apri", url)
    elif t == "run":
        cmd = [a["path"]] + [str(x) for x in a.get("args", [])]
        if IS_WIN:
            subprocess.Popen(cmd, close_fds=True)
        else:
            log("[simulato] avvia", cmd)
    elif t == "saver":
        screensaver()
    elif t == "lock":
        if IS_WIN:
            subprocess.Popen(["rundll32.exe", "user32.dll,LockWorkStation"])
        else:
            log("[simulato] blocca PC")
    else:
        raise ValueError("azione sconosciuta: %s" % t)


# ---------------------------------------------------------------- stato (aggiornato ogni secondo)
IDLE_TITLES = ("", "spotify", "spotify free", "spotify premium", "advertisement")
STATE = {"spotify": {"running": False, "playing": False, "title": "", "artist": ""},
         "stats": {"cpu": 0, "ram": 0}, "profile": "default", "fg": ""}
VOLS = {}                 # id -> 0-100, oppure None se non disponibile
CLAUDE = {"ts": 0, "tabs": [], "usage": None}   # inviato dall'estensione di Edge
CMDS = []                 # comandi per l'estensione (es. porta in primo piano una scheda), con id progressivo
CCOND = threading.Condition()
CMD_SEQ = [0]
EPOCH = str(int(time.time()))   # cambia a ogni avvio del server: l'estensione riparte da zero
PENDING = {}              # id -> valore da applicare (lo applica il thread audio)
PLOCK = threading.Lock()


def read_spotify():
    if DEMO:
        return {"running": True, "playing": True, "title": "Instant Crush", "artist": "Daft Punk"}
    titles = spotify_titles()
    if titles is None:
        return {"running": False, "playing": False, "title": "", "artist": ""}
    for t in titles:
        if t.strip().lower() not in IDLE_TITLES:
            artist, sep, title = t.partition(" - ")
            if not sep:
                artist, title = "", t
            return {"running": True, "playing": True, "title": title.strip(), "artist": artist.strip()}
    return {"running": True, "playing": False, "title": "", "artist": ""}


def pick_profile(cfg, fg, title=""):
    """Prima pagina che corrisponde: 'match' = programmi, 'matchTitle' = testo nel titolo della finestra."""
    for p in cfg["pages"]:
        progs = [m.lower() for m in p.get("match", [])]
        texts = [t.lower() for t in p.get("matchTitle", [])]
        if not progs and not texts:
            continue
        if progs and fg not in progs:
            continue
        if texts and not any(t in title.lower() for t in texts):
            continue
        return p.get("id", "default")
    return "default"


def sampler():
    while True:
        try:
            cfg = load_config()[0]
            fg, title = foreground_info()
            STATE["spotify"] = read_spotify()
            STATE["stats"] = {"cpu": cpu_percent(), "ram": ram_percent()}
            STATE["fg"] = fg
            STATE["profile"] = pick_profile(cfg, fg, title)
        except Exception as e:
            log("errore lettura stato:", e)
        time.sleep(1)


def audio_worker():
    """Unico thread che tocca l'audio di Windows: applica i comandi e rilegge i volumi."""
    try:
        audio_init()
    except Exception as e:
        log("audio non inizializzato:", e)
    last = 0
    while True:
        try:
            cfg = load_config()[0]
            apps = dict((a["id"], a.get("exe", "").lower()) for a in cfg["volumeApps"])
            with PLOCK:
                items = list(PENDING.items())
                PENDING.clear()
            for target, val in items:
                try:
                    if target == "master":
                        master_set(val)
                    elif target in apps:
                        app_set(apps[target], val)
                    VOLS[target] = val
                except Exception as e:
                    log("errore volume %s: %s" % (target, e))
            if time.time() - last >= 1:
                last = time.time()
                try:
                    VOLS["master"] = master_get()
                except Exception as e:
                    VOLS["master"] = None
                    log("lettura volume master:", e)
                try:
                    got = apps_get(set(apps.values()))
                    for aid, exe in apps.items():
                        VOLS[aid] = got.get(exe)
                except Exception as e:
                    for aid in apps:
                        VOLS[aid] = None
                    log("lettura volume app:", e)
        except Exception as e:
            log("errore audio:", e)
        time.sleep(0.05)


# ---------------------------------------------------------------- HTTP
TYPES = {".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
         ".css": "text/css; charset=utf-8", ".png": "image/png", ".ico": "image/x-icon"}


def _s(v, n=120):
    return str(v if v is not None else "")[:n]


def clean_claude(body):
    """Dati ricevuti dal browser: non sono fidati, si tengono solo tipi semplici e lunghezze limitate."""
    tabs = []
    for t in (body.get("tabs") or [])[:60]:
        if not isinstance(t, dict):
            continue
        ctx = t.get("context")
        tabs.append({"id": int(t.get("id", 0)), "windowId": int(t.get("windowId", 0)),
                     "kind": _s(t.get("kind"), 12), "name": _s(t.get("name")), "project": _s(t.get("project"), 60),
                     "title": _s(t.get("title")), "current": bool(t.get("current")), "active": bool(t.get("active")),
                     "context": int(ctx) if isinstance(ctx, (int, float)) else None})
    u = body.get("usage")
    usage = None
    if isinstance(u, dict):
        def lim(x):
            if not isinstance(x, dict):
                return None
            try:
                return {"pct": round(float(x.get("pct")), 1), "resetsAt": _s(x.get("resetsAt"), 40), "label": _s(x.get("label"), 40)}
            except (TypeError, ValueError):
                return None
        usage = {"fiveHour": lim(u.get("fiveHour")), "week": lim(u.get("week")),
                 "error": _s(u.get("error"), 160), "source": _s(u.get("source"), 12)}
    return {"ts": time.time(), "tabs": tabs, "usage": usage}


def public_button(b):
    return {"id": b.get("id"), "label": b.get("label", ""), "icon": b.get("icon", ""),
            "cat": b.get("cat", "sys"), "span": b.get("span", 1), "small": bool(b.get("small"))}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        if not isinstance(body, bytes):
            body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self, query):
        token = load_config()[0]["settings"].get("token", "")
        return not token or query.get("t", [""])[0] == token

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if u.path.startswith("/api/"):
            if not self._authorized(q):
                return self._send(401, {"error": "token"})
            data, ver = load_config()
            if u.path == "/api/config":
                return self._send(200, {
                    "version": ver,
                    "theme": data["settings"].get("theme", "windows"),
                    "volumeApps": [{"id": a["id"], "label": a.get("label", a["id"])} for a in data["volumeApps"]],
                    "desktop": [public_button(b) for b in data["desktop"]],
                    "pages": [{"id": p.get("id"), "name": p.get("name", ""), "view": p.get("view", ""),
                               "buttons": [public_button(b) for b in p.get("buttons", [])]} for p in data["pages"]]})
            if u.path == "/api/state":
                cl = dict(CLAUDE)
                cl["age"] = round(time.time() - cl["ts"], 1) if cl["ts"] else None
                return self._send(200, dict(STATE, version=ver, volume=dict(VOLS), claude=cl))
            if u.path == "/api/ext/poll":
                # richiesta "lunga": l'estensione resta in attesa fino a 20 s di un comando dall'iPad
                # I comandi restano in coda finche' l'estensione non li conferma (ack = ultimo id eseguito):
                # cosi' una richiesta rimasta appesa e ormai morta non li fa perdere.
                try:
                    ack = int(q.get("ack", ["0"])[0])
                except ValueError:
                    ack = 0
                end = time.time() + 20
                with CCOND:
                    CMDS[:] = [c for c in CMDS if c["id"] > ack and time.time() - c["ts"] < 15]
                    while not CMDS and time.time() < end:
                        CCOND.wait(timeout=max(0.1, end - time.time()))
                        CMDS[:] = [c for c in CMDS if c["id"] > ack and time.time() - c["ts"] < 15]
                    cmds = [dict(c) for c in CMDS]
                return self._send(200, {"epoch": EPOCH, "commands": cmds})
            return self._send(404, {"error": "not found"})
        name = "index.html" if u.path == "/" else u.path.lstrip("/")
        full = os.path.realpath(os.path.join(WEB, name))
        if not full.startswith(os.path.realpath(WEB) + os.sep) or not os.path.isfile(full):
            return self._send(404, b"not found", "text/plain")
        with open(full, "rb") as f:
            data = f.read()
        if name == "index.html":
            # aggiunge la versione ai file collegati: dopo un aggiornamento l'iPad non riusa quelli vecchi
            try:
                ver = str(int(max(os.path.getmtime(os.path.join(WEB, n)) for n in os.listdir(WEB))))
                data = data.replace(b'style.css"', b'style.css?v=' + ver.encode() + b'"')
                data = data.replace(b'app.js"', b'app.js?v=' + ver.encode() + b'"')
            except OSError:
                pass
        self._send(200, data, TYPES.get(os.path.splitext(full)[1], "application/octet-stream"))

    def do_POST(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if not self._authorized(q):
            return self._send(401, {"error": "token"})
        # Solo application/json: una pagina web esterna non puo' inviarlo senza una richiesta
        # preliminare (CORS) che questo server non accetta -> protezione dai comandi da altri siti.
        if not self.headers.get("Content-Type", "").lower().startswith("application/json"):
            return self._send(415, {"error": "serve application/json"})
        try:
            n = int(self.headers.get("Content-Length", 0))
            if n < 0 or n > (65536 if u.path == "/api/ext/state" else 4096):
                return self._send(413, {"error": "richiesta troppo grande"})
            body = json.loads(self.rfile.read(n) or b"{}")
            cfg = load_config()[0]
            if u.path == "/api/media":
                run_action({"type": "media", "cmd": body.get("cmd")})
            elif u.path == "/api/press":
                btn = next((b for b in all_buttons(cfg) if b.get("id") == body.get("id")), None)
                if not btn:
                    return self._send(404, {"error": "pulsante sconosciuto"})
                run_action(btn.get("action", {}))
            elif u.path == "/api/ext/state":
                CLAUDE.update(clean_claude(body))
            elif u.path == "/api/claude/focus":
                with CCOND:
                    CMD_SEQ[0] += 1
                    CMDS[:] = [{"id": CMD_SEQ[0], "ts": time.time(), "type": "focus",   # conta solo l'ultimo tocco
                                "tabId": int(body.get("tabId")), "windowId": int(body.get("windowId"))}]
                    CCOND.notify_all()
            elif u.path == "/api/volume":
                target = body.get("target")
                if target != "master" and target not in [a["id"] for a in cfg["volumeApps"]]:
                    return self._send(404, {"error": "controllo sconosciuto"})
                val = max(0, min(100, int(round(float(body.get("value", 0))))))
                with PLOCK:
                    PENDING[target] = val
            else:
                return self._send(404, {"error": "not found"})
            self._send(200, {"ok": True})
        except Exception as e:
            log("errore azione:", e)
            self._send(400, {"error": str(e)})


def local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "IP-DEL-PC"


def main():
    cfg = load_config()[0]
    port = int(os.environ.get("PANEL_PORT") or (sys.argv[1] if len(sys.argv) > 1 else cfg["settings"].get("port", 8080)))
    threading.Thread(target=sampler, daemon=True).start()
    threading.Thread(target=audio_worker, daemon=True).start()
    try:
        srv = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    except OSError as e:
        log("Impossibile usare la porta %d: %s" % (port, e))
        sys.exit(1)
    srv.daemon_threads = True
    tok = cfg["settings"].get("token", "")
    log("Pannello attivo. Sull'iPad apri:  http://%s:%d/%s" % (local_ip(), port, ("?t=" + tok) if tok else ""))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
