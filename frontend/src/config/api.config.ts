/**
 * API Configuration
 * Configure the backend API URL based on environment
 * 
 * Environment Variables:
 * - EXPO_PUBLIC_API_ENV: 'localhost' or 'render' to switch between environments
 * - EXPO_PUBLIC_API_BASE_URL_LOCAL: Local development URL
 * - EXPO_PUBLIC_API_BASE_URL_RENDER: Production AWS ECS/Fargate URL
 * 
 * Quick Switch:
 * 1. Edit .env file and change EXPO_PUBLIC_API_ENV value
 * 2. Or use npm scripts: npm run start:local or npm run start:render
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
  
  // Production - AWS Application Load Balancer (static DNS)
  production: {
    baseUrl: 'http://dorsu-backend-alb-2059766618.ap-southeast-1.elb.amazonaws.com', // AWS ALB DNS (static)
    // Note: This DNS name is static and won't change when ECS tasks restart
    // Set EXPO_PUBLIC_API_BASE_URL_RENDER in .env to override
  },
};

// Export the current environment's config
// Read runtime API selection from Expo env variables
const envMode = process.env.EXPO_PUBLIC_API_ENV;
const localUrl = process.env.EXPO_PUBLIC_API_BASE_URL_LOCAL;
const renderUrl = process.env.EXPO_PUBLIC_API_BASE_URL_RENDER;

export const API_BASE_URL = (() => {
  let selectedUrl: string;
  let environment: string;

  if (envMode === 'render') {
    selectedUrl = renderUrl || API_CONFIG.production.baseUrl;
    environment = 'RENDER (Production)';
  } else if (envMode === 'localhost') {
    selectedUrl = localUrl || API_CONFIG.development.baseUrl;
    environment = 'LOCALHOST (Development)';
  } else {
    // Fallback to Expo __DEV__ mode if no env specified
    selectedUrl = isDevelopment
      ? (localUrl || API_CONFIG.development.baseUrl)
      : (renderUrl || API_CONFIG.production.baseUrl);
    environment = isDevelopment ? 'LOCALHOST (Development - Default)' : 'RENDER (Production - Default)';
  }

  // Log the active API configuration for debugging
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 API Configuration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Environment: ${environment}`);
  console.log(`API URL: ${selectedUrl}`);
  console.log(`Mode Set: ${envMode || 'auto-detect'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💡 To switch: Edit .env EXPO_PUBLIC_API_ENV');
  console.log('   Options: "localhost" or "render"');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return selectedUrl;
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

