# Network Setup Guide

## To run on the same network (not just localhost)

### 1. Find your network IP address

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter (usually 192.168.x.x or 10.x.x.x)

**Mac/Linux:**
```bash
ip addr show
# or
ifconfig
```

### 2. Update frontend configuration

The frontend is now configured to automatically use the current hostname. When accessing from another device on the network, use your IP address:

```
http://YOUR_IP_ADDRESS:5173
```

### 3. Run the applications

**Backend:**
```bash
cd backend
dotnet run
```
The backend will now bind to all network interfaces (0.0.0.0:5062)

**Frontend:**
```bash
cd frontend
npm run dev
```
The frontend will bind to all network interfaces (0.0.0.0:5173)

### 4. Access from other devices on the same network

- Frontend: `http://YOUR_IP_ADDRESS:5173`
- Backend API: `http://YOUR_IP_ADDRESS:5062`
- SignalR Hub: `http://YOUR_IP_ADDRESS:5062/gamehub`

### 5. Firewall considerations

Make sure your firewall allows:
- Port 5173 (frontend)
- Port 5062 (backend)

### 6. Docker considerations (if using)

If running in Docker, the configuration already includes support for `host.docker.internal` for container communication.

### Example

If your IP address is `192.168.1.100`:
- Frontend: http://192.168.1.100:5173
- Backend: http://192.168.1.100:5062
