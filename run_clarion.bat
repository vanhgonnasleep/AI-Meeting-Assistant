@echo off
setlocal
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
    echo Please install Node.js 24 LTS from https://nodejs.org and try again.
    pause
    exit /b 1
)

:: 2. Check Python executable (venv first, then py, then python)
set "PY_CMD="
if exist "ai-summary-service\venv\Scripts\python.exe" (
    set "PY_CMD=%~dp0ai-summary-service\venv\Scripts\python.exe"
) else (
    where py >nul 2>nul
    if not errorlevel 1 (
        set "PY_CMD=py"
    ) else (
        where python >nul 2>nul
        if not errorlevel 1 (
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
    pushd "%~dp0meeting-assistant-ui"
    call npm.cmd install
    if errorlevel 1 (
        popd
        echo [ERROR] Frontend dependency installation failed.
        pause
        exit /b 1
    )
    popd
)

echo [1/3] Launching Clarion FastAPI Backend (Port 8002)...
start "Clarion - Backend (Port 8002)" /D "%~dp0ai-summary-service" cmd /k ""%PY_CMD%" main.py"

echo [2/3] Launching Clarion Web Dashboard (Port 5173)...
start "Clarion - Frontend (Port 5173)" cmd /k "cd meeting-assistant-ui && npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"

echo [3/3] Initializing system services...
timeout /t 3 /nobreak >nul

echo Opening Clarion Studio in your default browser...
start http://localhost:5173

echo.
echo ====================================================================
echo [STARTED] Service terminals launched. Check their output for readiness.
echo   - Web Studio:    http://localhost:5173
echo   - Backend Docs:  http://localhost:8002/docs
echo   - Health Status: http://localhost:8002/api/health
echo.
echo Useful Commands:
echo   - Reset to Demo Data:   cd meeting-assistant-ui ^&^& npm run db:demo
echo   - Run Benchmarks:       cd meeting-assistant-ui ^&^& npm run benchmark
echo   - Clean Database:       cd meeting-assistant-ui ^&^& npm run db:clean
echo.
echo Note: If Ollama is offline, real recordings use a labeled transcript
echo       excerpt fallback. Sample results require explicit demo mode.
echo ====================================================================
echo.
pause
