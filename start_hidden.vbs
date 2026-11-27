' Avvia il server senza finestra (da mettere in shell:startup per l'avvio automatico con Windows).
' Se il server si aggiorna da solo (codice 75) viene rilanciato.
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
Do
  rc = sh.Run("pythonw server.py", 0, True)
Loop While rc = 75
