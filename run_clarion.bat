@echo off
cd /d "%~dp0"
title Clarion - Private Meeting Intelligence Launcher
cls
echo ====================================================================
echo   CLARION - PRIVATE MEETING INTELLIGENCE
echo   Local-First Autonomous Meeting Orchestrator
echo ====================================================================
echo.

:: 1. Check Node.js
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js / npm is not installed or not in PATH!
    echo Please install Node.js 20 or 24 LTS from https://nodejs.org and try again.
    pause
    exit /b 1
)

:: 2. Check Python executable (venv first, then py, then python)
set "PY_CMD="
if exist "ai-summary-service\venv\Scripts\python.exe" (
    set "PY_CMD=ai-summary-service\venv\Scripts\python.exe"
) else (
    where py >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        set "PY_CMD=py"
    ) else (
        where python >nul 2>nul
        if %ERRORLEVEL% equ 0 (
            set "PY_CMD=python"
        )
    )
)

if "%PY_CMD%"=="" (
    echo [ERROR] Python environment not detected!
    echo Please install Python 3.10+ or initialize ai-summary-service\venv.
    pause
    exit /b 1
)

:: 3. Check Frontend node_modules
if not exist "meeting-assistant-ui\node_modules" (
    echo [INFO] Frontend node_modules missing. Installing dependencies...
    cd meeting-assistant-ui && npm install && cd ..
)

echo [1/3] Launching Clarion FastAPI Backend (Port 8002)...
start "Clarion - Backend (Port 8002)" cmd /k "cd ai-summary-service && %PY_CMD% main.py"

echo [2/3] Launching Clarion Web Dashboard (Port 5173)...
start "Clarion - Frontend (Port 5173)" cmd /k "cd meeting-assistant-ui && npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"

echo [3/3] Initializing system services...
timeout /t 3 /nobreak >nul

echo Opening Clarion Studio in your default browser...
start http://localhost:5173

echo.
echo ====================================================================
echo [RUNNING] Clarion is fully operational!
echo   - Web Studio:    http://localhost:5173
echo   - Backend Docs:  http://localhost:8002/docs
echo   - Health Status: http://localhost:8002/api/health
echo.
echo Useful Commands:
echo   - Reset to Demo Data:   cd meeting-assistant-ui ^&^& npm run db:demo
echo   - Run Benchmarks:       cd meeting-assistant-ui ^&^& npm run benchmark
echo   - Clean Database:       cd meeting-assistant-ui ^&^& npm run db:clean
echo.
echo Note: If local Ollama is offline, Clarion seamlessly uses
echo       Presenter Fail-Safe fixtures for instant 100%% offline demo!
echo ====================================================================
echo.
pause
