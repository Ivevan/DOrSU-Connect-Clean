/**
 * Admin File Service
 * Handles file uploads for knowledge base and calendar CSV imports
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import apiConfig from '../config/api.config';
import { getCurrentUser } from './authService';

class AdminFileService {
  /**
   * Get authentication token (with admin token support and Firebase token exchange if needed)
   */
  async getToken(): Promise<string | null> {
    try {
      // Check if user is admin first
      const isAdmin = await AsyncStorage.getItem('isAdmin');
      const storedToken = await AsyncStorage.getItem('userToken');
      
      // If admin, return admin token directly
      if (isAdmin === 'true' && storedToken && storedToken.startsWith('admin_')) {
        console.log('✅ AdminFileService.getToken: Using admin token');
        return storedToken;
      }
      
      // For regular users, try to get backend JWT token
      if (storedToken && !storedToken.startsWith('admin_')) {
        console.log('✅ AdminFileService.getToken: Using backend JWT token');
        return storedToken;
      }

      // If no backend token, try to exchange Firebase ID token
      console.log('🔄 AdminFileService.getToken: No backend token, attempting token exchange...');
      const currentUser = getCurrentUser();
      
      if (!currentUser || typeof currentUser.getIdToken !== 'function') {
        console.warn('⚠️ AdminFileService.getToken: No Firebase user found or getIdToken not available');
        return null;
      }

      // Force refresh Firebase token
      const firebaseToken = await currentUser.getIdToken(true);
      
      if (!firebaseToken) {
        console.warn('⚠️ AdminFileService.getToken: Failed to get Firebase token');
        return null;
      }

      // Exchange Firebase token for backend JWT
      try {
        const exchangeResponse = await fetch(`${apiConfig.baseUrl}/api/auth/firebase-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken: firebaseToken }),
        });

        if (exchangeResponse.ok) {
          const data = await exchangeResponse.json();
          if (data.token) {
            await AsyncStorage.setItem('userToken', data.token);
            if (data.user?.id) {
              await AsyncStorage.setItem('userId', String(data.user.id));
            }
            console.log('✅ AdminFileService.getToken: Token exchange successful');
            return data.token;
          }
        }
      } catch (exchangeError) {
        console.warn('⚠️ AdminFileService.getToken: Token exchange failed:', exchangeError);
      }

      // Fallback to Firebase token (though backend might not accept it)
      console.log('⚠️ AdminFileService.getToken: Using Firebase ID token as fallback (may not work for admin endpoints)');
      return firebaseToken;
    } catch (error) {
      console.error('❌ AdminFileService.getToken: Error getting token:', error);
      return null;
    }
  }

  /**
   * Upload file to knowledge base
   */
  async uploadFile(fileUri: string, fileName: string, mimeType: string): Promise<any> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Read file as base64
      const fileBase64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to blob for multipart/form-data
      // For React Native, we'll use FormData
      const formData = new FormData();
      
      // Create a file object for FormData
      // @ts-ignore - React Native FormData accepts objects with these properties
      formData.append('file', {
        uri: fileUri,
        type: mimeType,
        name: fileName,
      } as any);

      const response = await fetch(`${apiConfig.baseUrl}/api/admin/upload-file`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - let fetch set it with boundary
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('File upload error:', error);
      throw error;
    }
  }

  /**
   * Upload CSV file for calendar events
   */
  async uploadCalendarCSV(fileUri: string, fileName: string): Promise<any> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Read file content - works for both React Native and React Native Web
      let fileContent: Blob | File | { uri: string; type: string; name: string };
      
      // Check if we're on web or native
      if (Platform.OS === 'web') {
        // For web, read file content and create File object
        try {
          // Try to read as text first (for blob URLs or file:// URLs)
          const textContent = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          
          // Create a File object from the text content with proper filename
          const blob = new Blob([textContent], { type: 'text/csv' });
          fileContent = new File([blob], fileName, { 
            type: 'text/csv',
            lastModified: Date.now()
          });
        } catch (error) {
          // Fallback: try to fetch as blob
          console.warn('Failed to read file as text, trying fetch:', error);
          try {
            const response = await fetch(fileUri);
            const blob = await response.blob();
            fileContent = new File([blob], fileName, { 
              type: 'text/csv',
              lastModified: Date.now()
            });
          } catch (fetchError) {
            // Last resort: read as base64 and convert
            const base64Content = await FileSystem.readAsStringAsync(fileUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            const binaryString = atob(base64Content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'text/csv' });
            fileContent = new File([blob], fileName, { 
              type: 'text/csv',
              lastModified: Date.now()
            });
          }
        }
      } else {
        // For native React Native, use uri format
        fileContent = {
          uri: fileUri,
          type: 'text/csv',
          name: fileName,
        };
      }

      const formData = new FormData();
      // For web, File object should include filename automatically
      // For native, the object with uri/type/name should work
      formData.append('file', fileContent as any, Platform.OS === 'web' ? fileName : undefined);

      console.log(`📤 Uploading calendar CSV to: ${apiConfig.baseUrl}/api/admin/upload-calendar-csv`);
      console.log(`📤 Token prefix: ${token?.substring(0, 20)}...`);
      console.log(`📤 File: ${fileName}, Platform: ${Platform.OS}`);
      
      const response = await fetch(`${apiConfig.baseUrl}/api/admin/upload-calendar-csv`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - let fetch set it automatically with boundary for FormData
        },
        body: formData,
      });

      console.log(`📥 Calendar CSV upload response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Calendar CSV upload error response: ${errorText}`);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Upload failed' };
        }
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Calendar CSV upload error:', error);
      throw error;
    }
  }
}

export default new AdminFileService();

