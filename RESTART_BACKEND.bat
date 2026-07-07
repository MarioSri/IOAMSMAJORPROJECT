@echo off
echo ========================================
echo IAOMS Backend Server Restart Script
echo ========================================
echo.

cd /d "%~dp0backend"

echo Checking for running Node processes...
tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo Found running Node processes. Stopping them...
    taskkill /F /IM node.exe 2>NUL
    timeout /t 2 /nobreak >NUL
)

echo.
echo Starting backend server...
echo.
start "IAOMS Backend" cmd /k "npm run dev"

echo.
echo Backend server starting in new window...
echo Wait 5-10 seconds for server to fully start
echo.
pause
