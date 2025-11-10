/**
 * API Configuration
 * Configure the backend API URL based on environment
 */

// Determine if we're in development or production
const isDevelopment = __DEV__;

// Configure your API URLs here
const API_CONFIG = {
  // Local development - adjust this if your backend runs on a different port
  development: {
    baseUrl: 'http://localhost:3000',
    // For Android emulator, use: 'http://10.0.2.2:3000'
    // For iOS simulator, use: 'http://localhost:3000'
    // For physical device, use your computer's IP: 'http://192.168.x.x:3000'
  },
  
  // Production - Render deployment
  production: {
    baseUrl: 'https://dorsu-connect.onrender.com',
  },
};

// Export the current environment's config
// Read runtime API selection from Expo env variables
const envMode = process.env.EXPO_PUBLIC_API_ENV;
const localUrl = process.env.EXPO_PUBLIC_API_BASE_URL_LOCAL;
const renderUrl = process.env.EXPO_PUBLIC_API_BASE_URL_RENDER;

export const API_BASE_URL = (() => {
  if (envMode === 'render') {
    return renderUrl || API_CONFIG.production.baseUrl;
  }
  if (envMode === 'localhost') {
    return localUrl || API_CONFIG.development.baseUrl;
  }
  // Fallback to Expo __DEV__ mode if no env specified
  return isDevelopment
    ? (localUrl || API_CONFIG.development.baseUrl)
    : (renderUrl || API_CONFIG.production.baseUrl);
})();

// Helper to get platform-specific URLs
export const getPlatformAPIUrl = () => {
  return API_BASE_URL;
};

export default {
  baseUrl: API_BASE_URL,
  timeout: 30000, // 30 seconds timeout
  endpoints: {
    chat: '/api/chat',
    health: '/health',
    mongoStatus: '/api/mongodb-status',
    news: '/api/news',
    refreshKnowledge: '/api/refresh-knowledge',
    clearCache: '/api/clear-cache',
  },
};

