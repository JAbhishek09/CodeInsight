Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

Dim basePath
basePath = "C:\Users\91977\OneDrive\Desktop\FullStackProjects\CodeInsight"

' Start backend
objShell.Run "cmd /c cd /d """ & basePath & "\backend"" && npm run dev > """ & basePath & "\backend_log.txt"" 2>&1", 0, False

' Wait 6 seconds for backend to initialize
WScript.Sleep 6000

' Start frontend  
objShell.Run "cmd /c cd /d """ & basePath & "\frontend"" && npm run dev > """ & basePath & "\frontend_log.txt"" 2>&1", 0, False

' Wait 5 seconds for frontend to initialize
WScript.Sleep 5000

WScript.Echo "Done. Backend: http://localhost:5000 | Frontend: http://localhost:5173"
