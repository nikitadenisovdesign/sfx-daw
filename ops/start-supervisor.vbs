' Launches the SFX DAW supervisor fully hidden (no console window).
' Used both by the Startup-folder entry and the scheduled task.
Set sh = CreateObject("WScript.Shell")
sh.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -NonInteractive -File ""Z:\Claude\SFXDAW\ops\supervise.ps1""", 0, False
