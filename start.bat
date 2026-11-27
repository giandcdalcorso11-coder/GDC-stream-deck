@echo off
cd /d "%~dp0"
:run
where py >nul 2>nul
if %errorlevel%==0 (py -3 server.py) else (python server.py)
rem codice 75 = il server si e' aggiornato da solo e va rilanciato
if %errorlevel%==75 goto run
pause
