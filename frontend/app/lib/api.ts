// API Configuration
const isServer = typeof window === 'undefined';

// Get the hostname based on environment
const getHostname = () => {
  if (isServer) return 'localhost';
  return window.location.hostname;
};

export const API_BASE = `https://${getHostname()}:7047`;

// For SignalR WebSocket connection
export const SIGNALR_URL = `https://${getHostname()}:7047/gamehub`;
