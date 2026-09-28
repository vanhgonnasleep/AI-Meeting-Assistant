@echo off
title AI Meeting Assistant - Unified Launcher
echo ========================================================
echo   🎙️ AI MEETING ASSISTANT - 1-CLICK SYSTEM LAUNCHER
echo   Local Multi-Agent Intelligence System
echo ========================================================
echo.

:: 1. Check Python
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    echo Please install Python 3.10+ from python.org and try again.
    pause
    exit /b 1
)

:: 2. Check Node
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js / npm is not installed or not in PATH!
    echo Please install Node.js 18+ from nodejs.org and try again.
    pause
    exit /b 1
)

echo [1/3] Launching FastAPI Backend (Port 8002)...
start "AI Meeting Assistant - Backend (Port 8002)" cmd /k "cd ai-summary-service && if exist venv\Scripts\activate (call venv\Scripts\activate) && python main.py"

echo [2/3] Launching React Vite Frontend (Port 5173)...
start "AI Meeting Assistant - Frontend (Port 5173)" cmd /k "cd meeting-assistant-ui && npm run dev"

echo [3/3] Waiting for servers to initialize...
timeout /t 3 /nobreak >nul

echo Opening application dashboard in default browser...
start http://localhost:5173

echo.
echo ========================================================
echo [RUNNING] AI Meeting Assistant is now operational!
echo   - Web Dashboard: http://localhost:5173
echo   - Backend API:   http://localhost:8002/docs
echo   - Health Check:  http://localhost:8002/api/health
echo.
echo Tip: If Ollama is not running, either start it with:
echo      ollama run llama3.2:1b
echo   or select 'Instant Demo' on the UI top navigation.
echo ========================================================
echo.
pause
