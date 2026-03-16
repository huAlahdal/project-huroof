@echo off
echo ========================================
echo   حروف (Huroof) - Windows Deployment
echo ========================================
echo.

:: Check if .NET is installed
echo [1/4] Checking .NET installation...
dotnet --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: .NET is not installed!
    echo Please install .NET 10.0 from: https://dotnet.microsoft.com/download
    pause
    exit /b 1
)
echo .NET is installed ✓

:: Check if Node.js is installed
echo.
echo [2/4] Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from: https://nodejs.org
    pause
    exit /b 1
)
echo Node.js is installed ✓

:: Build and run backend
echo.
echo [3/4] Starting backend server...
cd backend
dotnet build
if %errorlevel% neq 0 (
    echo ERROR: Failed to build backend!
    pause
    exit /b 1
)
start "Huroof Backend" cmd /k "dotnet run"

:: Build and run frontend
echo.
echo [4/4] Starting frontend server...
cd ../frontend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install frontend dependencies!
    pause
    exit /b 1
)
start "Huroof Frontend" cmd /k "npm run dev"

:: Get local IP address
echo.
echo ========================================
echo   Getting your local IP address...
echo ========================================
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do set LOCAL_IP=%%a
set LOCAL_IP=%LOCAL_IP: =%

echo.
echo ========================================
echo   DEPLOYMENT SUCCESSFUL!
echo ========================================
echo.
echo Backend is running on: http://localhost:5062
echo Frontend is running on: http://localhost:5173
echo.
echo For your friends to join, use this address:
echo http://%LOCAL_IP%:5173
echo.
echo Make sure port 5173 is allowed in Windows Firewall!
echo.
echo Press any key to exit...
pause >nul
