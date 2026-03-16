# Huroof Windows Deployment Script
# Run as Administrator for best results

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  حروف (Huroof) - Windows Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsBuiltInRole]::Administrator).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Please run this script as Administrator!"
    Write-Host "Right-click the script and select 'Run as Administrator'" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit
}

# Function to check if software is installed
function Test-SoftwareInstalled($program) {
    try {
        if ($program -eq "dotnet") {
            $version = & dotnet --version 2>$null
            return $version -ne $null
        }
        if ($program -eq "node") {
            $version = & node --version 2>$null
            return $version -ne $null
        }
    }
    catch {
        return $false
    }
    return $false
}

# Check .NET
Write-Host "[1/4] Checking .NET installation..." -ForegroundColor Yellow
if (Test-SoftwareInstalled "dotnet") {
    $dotnetVersion = & dotnet --version
    Write-Host ".NET $dotnetVersion is installed ✓" -ForegroundColor Green
} else {
    Write-Host "ERROR: .NET is not installed!" -ForegroundColor Red
    Write-Host "Please install .NET 10.0 from: https://dotnet.microsoft.com/download" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit
}

# Check Node.js
Write-Host ""
Write-Host "[2/4] Checking Node.js installation..." -ForegroundColor Yellow
if (Test-SoftwareInstalled "node") {
    $nodeVersion = & node --version
    Write-Host "Node.js $nodeVersion is installed ✓" -ForegroundColor Green
} else {
    Write-Host "ERROR: Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js from: https://nodejs.org" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit
}

# Get local IP address
function Get-LocalIPAddress {
    $computer = $env:COMPUTERNAME
    $adapter = Get-CimInstance -ClassName Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled -eq $true }
    foreach ($a in $adapter) {
        if ($a.IPAddress -like "192.168.*" -or $a.IPAddress -like "10.*" -or $a.IPAddress -like "172.*") {
            return $a.IPAddress[0]
        }
    }
    return "localhost"
}

# Start backend
Write-Host ""
Write-Host "[3/4] Starting backend server..." -ForegroundColor Yellow
Set-Location backend
$backendJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    & dotnet run
} -ArgumentList (Get-Location)

if ($backendJob.State -ne "Running") {
    Write-Host "ERROR: Failed to start backend!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
}

Start-Sleep -Seconds 3
Write-Host "Backend started ✓" -ForegroundColor Green

# Start frontend
Write-Host ""
Write-Host "[4/4] Starting frontend server..." -ForegroundColor Yellow
Set-Location ..\frontend
& npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install frontend dependencies!" -ForegroundColor Red
    Stop-Job $backendJob
    Read-Host "Press Enter to exit"
    exit
}

$frontendJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    & npm run dev
} -ArgumentSet (Get-Location)

Write-Host "Frontend started ✓" -ForegroundColor Green

# Get IP and display info
$localIP = Get-LocalIPAddress

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend is running on: http://localhost:5062" -ForegroundColor White
Write-Host "Frontend is running on: http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "For your friends to join, use this address:" -ForegroundColor Yellow
Write-Host "http://$($localIP):5173" -BackgroundColor DarkGreen -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT: Make sure port 5173 is allowed in Windows Firewall!" -ForegroundColor Red
Write-Host ""
Write-Host "Press Ctrl+C to stop all servers" -ForegroundColor Yellow

# Keep script running
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    Write-Host ""
    Write-Host "Stopping servers..." -ForegroundColor Yellow
    Stop-Job $backendJob
    Stop-Job $frontendJob
    Remove-Job $backendJob
    Remove-Job $frontendJob
    Write-Host "Servers stopped. Goodbye!" -ForegroundColor Green
}
