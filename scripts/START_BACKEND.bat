@echo off
echo ========================================
echo   Starting IAOMS Backend Server
echo ========================================
echo.

cd backend

echo Checking Node.js installation...
node --version
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)

echo.
echo Starting development server...
echo Server will run on http://localhost:3001
echo API Docs available at http://localhost:3001/api-docs
echo.
echo Press Ctrl+C to stop the server
echo.

npm run dev
