// API Configuration
const isServer = typeof window === 'undefined';

// Get the hostname based on environment
const getHostname = () => {
  if (isServer) return 'localhost';
  return window.location.hostname;
};

export const API_BASE = `http://${getHostname()}:5062`;

// For SignalR WebSocket connection
export const SIGNALR_URL = `http://${getHostname()}:5062/gamehub`;
