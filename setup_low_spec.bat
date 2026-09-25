@echo off
title AI Meeting Assistant - Low Spec Setup Helper
echo ========================================================
echo   AI MEETING ASSISTANT - LOW-SPEC HARDWARE SETUP
echo   Optimized for Laptops without Dedicated GPU
echo ========================================================
echo.

echo [1/3] Checking Ollama installation...
where ollama >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Ollama is not installed or not in PATH!
    echo Please install Ollama from https://ollama.com and run this script again.
    pause
    exit /b 1
)
echo [OK] Ollama is installed.
echo.

echo [2/3] Pulling ultra-lightweight Llama 3.2 1B (Only ~1.3GB)...
echo This model runs smoothly (~20-30 tokens/sec) on standard Intel/AMD CPUs with 8GB RAM!
echo.
ollama pull llama3.2:1b
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Could not pull llama3.2:1b automatically.
    echo Trying fallback to llama3.2:3b...
    ollama pull llama3.2:3b
)
echo.

echo [3/3] Verifying installed models...
ollama list
echo.
echo ========================================================
echo [SUCCESS] Your computer is now ready for AI Meeting Assistant!
echo Start the application by running:
echo   1. Terminal 1: ollama run llama3.2:1b
echo   2. Terminal 2: cd ai-summary-service ^&^& python main.py
echo   3. Terminal 3: cd meeting-assistant-ui ^&^& npm run dev
echo ========================================================
pause
