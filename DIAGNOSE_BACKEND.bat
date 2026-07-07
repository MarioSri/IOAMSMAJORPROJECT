@echo off
echo ========================================
echo IAOMS Backend Diagnostics
echo ========================================
echo.

cd /d "%~dp0backend"

echo [1] Checking Node.js installation...
node --version
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js not found!
    pause
    exit /b 1
)

echo.
echo [2] Checking npm installation...
npm --version
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm not found!
    pause
    exit /b 1
)

echo.
echo [3] Checking if backend dependencies are installed...
if not exist "node_modules\" (
    echo WARNING: node_modules not found!
    echo Installing dependencies...
    npm install
) else (
    echo Dependencies found.
)

echo.
echo [4] Checking .env file...
if not exist ".env" (
    echo ERROR: .env file not found!
    echo Please copy .env.example to .env and configure it.
    pause
    exit /b 1
) else (
    echo .env file found.
)

echo.
echo [5] Checking if port 3001 is available...
netstat -ano | findstr :3001 >NUL
if %ERRORLEVEL% EQU 0 (
    echo WARNING: Port 3001 is already in use!
    echo Showing processes using port 3001:
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do (
        tasklist /FI "PID eq %%a"
    )
    echo.
    echo You may need to kill these processes first.
) else (
    echo Port 3001 is available.
)

echo.
echo [6] Testing backend server startup...
echo Starting server for 10 seconds to check for errors...
timeout /t 2 /nobreak >NUL
start /B cmd /c "npm run dev > test_output.log 2>&1"
timeout /t 10 /nobreak
taskkill /F /IM node.exe 2>NUL

echo.
echo [7] Checking startup logs...
if exist "test_output.log" (
    type test_output.log
    del test_output.log
)

echo.
echo ========================================
echo Diagnostics Complete
echo ========================================
pause
