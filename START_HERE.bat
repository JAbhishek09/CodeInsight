@echo off
title CodeInsight Launcher
color 0A
echo.
echo  ╔══════════════════════════════════════╗
echo  ║     CodeInsight — Starting Up        ║
echo  ╚══════════════════════════════════════╝
echo.

set BASE=%~dp0

echo [1/2] Starting Backend (port 5000)...
start "CodeInsight Backend" cmd /k "cd /d "%BASE%backend" && echo. && echo  Backend starting... && echo. && npm run dev"

echo     Waiting 7s for backend to boot...
timeout /t 7 /nobreak >nul

echo [2/2] Starting Frontend (port 5173)...
start "CodeInsight Frontend" cmd /k "cd /d "%BASE%frontend" && echo. && echo  Frontend starting... && echo. && npm run dev"

echo.
echo  ✓ Both servers launching in separate windows.
echo  ✓ Backend  → http://localhost:5000
echo  ✓ Frontend → http://localhost:5173
echo.
echo  Wait ~10s then open http://localhost:5173 in your browser.
echo.
pause
