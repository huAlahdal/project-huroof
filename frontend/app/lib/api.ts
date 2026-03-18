// API Configuration
const isServer = typeof window === 'undefined';

// Check if we're running behind IIS reverse proxy
const isBehindProxy = () => {
  if (isServer) return false;
  // Check if the application is served through IIS
  // When behind IIS, the port is typically 80 (HTTP) or 443 (HTTPS) or empty
  const port = window.location.port;
  return !port || port === '80' || port === '443';
};

// Get the hostname based on environment
const getHostname = () => {
  if (isServer) return 'localhost';
  return window.location.hostname;
};

// Check if we're in production (deployed on huroof.ddns.net)
const isProduction = () => {
  return !isServer && window.location.hostname === 'huroof.ddns.net';
};

export const API_BASE = isBehindProxy() 
  ? '' // Use relative paths when behind IIS proxy
  : isProduction() 
    ? 'http://huroof.ddns.net:5062'
    : `http://${getHostname()}:5062`;

// For SignalR WebSocket connection
export const SIGNALR_URL = isBehindProxy()
  ? '/gamehub' // Use relative path when behind IIS proxy
  : isProduction()
    ? 'http://huroof.ddns.net:5062/gamehub'
    : `http://${getHostname()}:5062/gamehub`;
