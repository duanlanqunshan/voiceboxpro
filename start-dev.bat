@echo off
chcp 65001 >nul
title Voicebox Dev Launcher

echo Voicebox Dev Launcher
echo ======================
echo.

cd /d "%~dp0"

:: Kill existing processes on ports
echo [1/4] Clearing ports 5173 and 18792...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :18792') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 >nul

:: Start backend
echo [2/4] Starting backend (Python/uvicorn)...
start "Voicebox Backend" cmd /k "cd /d "%~dp0" && venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 17493"

echo [3/4] Starting frontend (Vite dev server)...
start "Voicebox Frontend" cmd /k "cd /d "%~dp0app" && pnpm dev"

echo [4/4] Opening browser...
timeout /t 8 >nul
start http://127.0.0.1:5173

echo.
echo Done! Two terminal windows are running.
echo Press Ctrl+C in either window to stop.
pause