# Deploying React Router + ASP.NET on Windows (Accessible from the Internet)

## Prerequisites

- A **static public IP** or use a **DDNS service** (like No-IP or DuckDNS) if your ISP gives you a dynamic IP
- Your Windows PC stays **on and connected**

---

## Step 1: Build Your Projects for Production

**React Router (Frontend)**
```bash
npm run build
# This creates a /dist or /build folder
```

**ASP.NET (Backend)**
```bash
dotnet publish -c Release -o ./publish
```

---

## Step 2: Install IIS (Internet Information Services)

IIS will serve both your frontend and proxy your backend.

1. Open **"Turn Windows features on or off"**
2. Enable **Internet Information Services**
3. Also enable **IIS → Application Development Features → WebSocket Protocol** (useful for React apps)

---

## Step 3: Deploy the ASP.NET Backend

1. Install the **[.NET Hosting Bundle](https://dotnet.microsoft.com/en-us/download)** — this installs the ASP.NET Core Module for IIS
2. Open **IIS Manager**
3. Create a new **Application Pool** → set **"No Managed Code"**
4. Add a new **Website**, point it to your `./publish` folder, set a port (e.g., `5000`)

**Alternatively**, run it as a background Windows service using NSSM:

```bash
# Install NSSM from https://nssm.cc, then:
nssm install MyBackend "dotnet" "C:\path\to\publish\YourApp.dll"
nssm start MyBackend
```

---

## Step 4: Deploy the React Frontend in IIS

1. In IIS Manager, add another **Website** (or use the default one)
2. Point the physical path to your `/dist` or `/build` folder
3. Set port to **80** (HTTP) or **443** (HTTPS)
4. Add a `web.config` in your build folder to handle React Router's client-side routing:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="React Router" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

> ⚠️ You also need the **IIS URL Rewrite** module. Download it from the official Microsoft site.

---

## Step 5: Open Windows Firewall Ports

Go to **Windows Defender Firewall → Advanced Settings → Inbound Rules** and add new rules to allow:

| Port | Purpose |
|------|---------|
| 80   | HTTP |
| 443  | HTTPS (recommended) |
| 5000 | Backend (only if direct access is needed; otherwise keep internal) |

---

## Step 6: Port Forward on Your Router

1. Log into your router admin panel (usually `192.168.1.1`)
2. Go to **Port Forwarding**
3. Forward external port **80** → your PC's local IP (e.g., `192.168.1.10`) port **80**
4. Repeat for port **443** if using HTTPS

Find your local IP with:
```bash
ipconfig
# Look for "IPv4 Address" under your active network adapter
```

---

## Step 7: Handle Your Public IP (DDNS)

If your ISP gives you a **dynamic IP** (it changes periodically):

1. Sign up at **[DuckDNS.org](https://www.duckdns.org)** (free)
2. Create a subdomain like `myapp.duckdns.org`
3. Install their Windows updater script — it keeps your domain pointing to your current IP automatically

---

## Step 8: (Recommended) Add HTTPS with a Free SSL Certificate

Use **[win-acme](https://www.win-acme.com/)** — a free Let's Encrypt client for IIS:

```bash
# Run wacs.exe and follow the interactive prompts
# It automatically configures IIS with a free SSL cert and sets up auto-renewal
```

---

## Step 9: Proxy API Calls Through IIS (Optional but Recommended)

Install **Application Request Routing (ARR)** for IIS, then add a rewrite rule to forward `/api/*` to your backend:

```xml
<rule name="Proxy API to Backend" stopProcessing="true">
  <match url="^api/(.*)" />
  <action type="Rewrite" url="http://localhost:5000/api/{R:1}" />
</rule>
```

This way your friends only hit **one domain** for both the frontend and API.

---

## Final Architecture

```
Internet
    │
    ▼
Your Router (port forward 80/443)
    │
    ▼
IIS on Windows PC
    ├── Frontend (React static files)  ──►  serves /dist or /build
    └── Reverse Proxy (/api/*)         ──►  ASP.NET Backend (localhost:5000)
```

---

## Summary Checklist

- [ ] Build frontend (`npm run build`) and backend (`dotnet publish`)
- [ ] Install IIS and enable WebSocket Protocol
- [ ] Install .NET Hosting Bundle
- [ ] Deploy backend via IIS or NSSM service on port 5000
- [ ] Deploy frontend in IIS with `web.config` for React Router
- [ ] Open Windows Firewall ports (80, 443)
- [ ] Port forward on your router (port 80 and 443)
- [ ] Set up DDNS (DuckDNS) if you have a dynamic IP
- [ ] (Optional) Add HTTPS via win-acme
- [ ] (Optional) Configure ARR reverse proxy for `/api/*`
