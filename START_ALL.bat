@echo off
echo ========================================
echo IAOMS Full Stack Startup Script
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] Cleaning up any existing Node processes...
taskkill /F /IM node.exe 2>NUL
timeout /t 2 /nobreak >NUL

echo.
echo [2/3] Starting Backend Server (Port 3001)...
cd backend
start "IAOMS Backend" cmd /k "npm run dev"
cd ..

echo.
echo [3/3] Waiting 5 seconds for backend to initialize...
timeout /t 5 /nobreak >NUL

echo.
echo Starting Frontend (Port 5173)...
start "IAOMS Frontend" cmd /k "npm run dev"

echo.
echo ========================================
echo Startup Complete!
echo ========================================
echo Backend: http://localhost:3001
echo Frontend: http://localhost:5173
echo API Docs: http://localhost:3001/api-docs
echo.
echo Both servers are running in separate windows.
echo Close those windows to stop the servers.
echo ========================================
pause
