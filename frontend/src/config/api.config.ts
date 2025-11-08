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
  
  // Production - replace with your production backend URL
  production: {
    baseUrl: 'https://your-backend-url.com',
  },
};

// Export the current environment's config
export const API_BASE_URL = isDevelopment 
  ? API_CONFIG.development.baseUrl 
  : API_CONFIG.production.baseUrl;

// Helper to get platform-specific URLs
export const getPlatformAPIUrl = () => {
  if (isDevelopment) {
    // You can add platform-specific logic here if needed
    return API_CONFIG.development.baseUrl;
  }
  return API_CONFIG.production.baseUrl;
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

