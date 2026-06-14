@echo off
echo === CodeInsight Launcher ===
echo.
echo Starting BACKEND in a new window...
start "CodeInsight Backend" powershell -NoExit -ExecutionPolicy Bypass -File "%~dp0start_backend.ps1"

echo Waiting 5 seconds for backend to start...
timeout /t 5 /nobreak >nul

echo Starting FRONTEND in a new window...
start "CodeInsight Frontend" powershell -NoExit -ExecutionPolicy Bypass -File "%~dp0start_frontend.ps1"

echo.
echo Both windows launched.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:5173
echo.
pause
