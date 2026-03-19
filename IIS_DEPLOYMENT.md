# Windows IIS Deployment Guide

## Prerequisites

Install the following on your Windows server before deploying:

1. **IIS** – Enable via *Windows Features → Internet Information Services*
2. **IIS URL Rewrite Module** – Download from https://www.iis.net/downloads/microsoft/url-rewrite
3. **ASP.NET Core Hosting Bundle** (includes .NET 10 Runtime + ANCM v2)  
   Download from https://dotnet.microsoft.com/download/dotnet/10.0  
   → Choose **"ASP.NET Core Runtime – Hosting Bundle"** (Windows x64)
4. **Node.js 20+** – Only needed on the build machine, not the server

---

## Step 1 – Set a strong JWT secret

Open `backend/appsettings.Production.json` and **change** the placeholder secret:

```json
"Jwt": {
  "Secret": "YOUR_STRONG_RANDOM_SECRET_MIN_32_CHARS_HERE",
  "Issuer": "huroof-backend"
}
```

Generate a strong secret (run in PowerShell):

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { [byte](Get-Random -Max 256) }))
```

---

## Step 2 – Build the Frontend

Run these commands from the repository root:

```powershell
cd frontend
npm install
npm run build
```

The production files land in `frontend/build/client/` (includes `web.config` for IIS).

---

## Step 3 – Publish the Backend

```powershell
cd backend
dotnet publish -c Release -r win-x64 --self-contained false -o C:\inetpub\huroof-backend
```

This produces a self-contained publish folder at `C:\inetpub\huroof-backend\` containing:
- `backend.dll`
- `web.config`
- `appsettings.Production.json`
- `Data\` folder (with `seed_questions.json`)
- `logs\` directory (created automatically for IIS stdout logging)

---

## Step 4 – Copy Frontend Files

Copy the built frontend to a web root folder:

```powershell
robocopy frontend\build\client C:\inetpub\huroof-frontend /E
```

---

## Step 5 – Create IIS Application Pools

Open **IIS Manager** or run in PowerShell (as Administrator):

```powershell
# Backend pool – No Managed Code (ASP.NET Core runs out-of-process)
New-WebAppPool -Name "huroof-backend"
Set-ItemProperty IIS:\AppPools\huroof-backend -Name managedRuntimeVersion -Value ""
Set-ItemProperty IIS:\AppPools\huroof-backend -Name startMode -Value AlwaysRunning
Set-ItemProperty IIS:\AppPools\huroof-backend -Name autoStart -Value $true

# Frontend pool – No Managed Code (static files)
New-WebAppPool -Name "huroof-frontend"
Set-ItemProperty IIS:\AppPools\huroof-frontend -Name managedRuntimeVersion -Value ""
```

---

## Step 6 – Create IIS Sites

```powershell
Import-Module WebAdministration

# Frontend – port 80
New-Website -Name "huroof-frontend" `
            -PhysicalPath "C:\inetpub\huroof-frontend" `
            -ApplicationPool "huroof-frontend" `
            -Port 80 `
            -Force

# Backend – port 5062
New-Website -Name "huroof-backend" `
            -PhysicalPath "C:\inetpub\huroof-backend" `
            -ApplicationPool "huroof-backend" `
            -Port 5062 `
            -Force
```

---

## Step 7 – Enable WebSocket Protocol (required for SignalR)

```powershell
# Enable WebSocket Protocol Windows Feature (if not already on)
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebSockets -All
```

In IIS Manager you can also go to:  
*Server → Web Server (IIS) → Web Server → Application Development → WebSocket Protocol → Enable*

---

## Step 8 – Folder Permissions

Grant **IIS_IUSRS** (and the AppPool identity) read/write access on important folders:

```powershell
# Backend: write access needed for SQLite DB and logs
$acl = Get-Acl "C:\inetpub\huroof-backend"
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    "IIS AppPool\huroof-backend", "Modify", "ContainerInherit,ObjectInherit", "None", "Allow")
$acl.SetAccessRule($rule)
Set-Acl "C:\inetpub\huroof-backend" $acl

# Frontend: read-only is enough
icacls "C:\inetpub\huroof-frontend" /grant "IIS_IUSRS:(R)" /T
```

---

## Step 9 – Verify Deployment

| Check | Expected |
|-------|----------|
| `http://localhost/` | Frontend loads |
| `http://localhost:5062/health` | `{"status":"ok"}` |
| Browser console (game page) | No CORS / WebSocket errors |

---

## Updating After Code Changes

### Frontend only

```powershell
cd frontend ; npm run build
robocopy frontend\build\client C:\inetpub\huroof-frontend /E /PURGE
```

### Backend only

```powershell
# Recycle app pool first so the DLL isn't locked
Restart-WebAppPool -Name "huroof-backend"

cd backend
dotnet publish -c Release -r win-x64 --self-contained false -o C:\inetpub\huroof-backend
```

### Both

```powershell
Restart-WebAppPool -Name "huroof-backend"
cd frontend ; npm run build
robocopy frontend\build\client C:\inetpub\huroof-frontend /E /PURGE
cd ..\backend
dotnet publish -c Release -r win-x64 --self-contained false -o C:\inetpub\huroof-backend
```

---

## Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| 502.5 / backend won't start | .NET 10 Hosting Bundle not installed; check Event Viewer |
| 404 on page refresh | URL Rewrite Module not installed; `web.config` not in frontend root |
| SignalR can't connect | WebSocket Protocol feature disabled in IIS |
| Database errors on first run | AppPool identity lacks write permission on `C:\inetpub\huroof-backend` |
| CORS errors in browser | Verify backend is actually running on port 5062 (`/health` endpoint) |

Enable IIS stdout logging temporarily for backend crashes:

```xml
<!-- In C:\inetpub\huroof-backend\web.config change: -->
<aspNetCore stdoutLogEnabled="true" stdoutLogFile=".\logs\stdout" ...>
```

Then check `C:\inetpub\huroof-backend\logs\` for details.
