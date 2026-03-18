// API Configuration
const isServer = typeof window === 'undefined';

// Get the hostname based on environment
const getHostname = () => {
  if (isServer) return 'localhost';
  return window.location.hostname;
};

// Check if we're in production (deployed on huroof.ddns.net)
const isProduction = () => {
  return !isServer && window.location.hostname === 'huroof.ddns.net';
};

export const API_BASE = isProduction() 
  ? 'http://huroof.ddns.net:5062'
  : `http://${getHostname()}:5062`;

// For SignalR WebSocket connection
export const SIGNALR_URL = isProduction()
  ? 'http://huroof.ddns.net:5062/gamehub'
  : `http://${getHostname()}:5062/gamehub`;
