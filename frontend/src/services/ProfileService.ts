/**
 * Profile Service
 * Handles profile picture uploads
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import apiConfig from '../config/api.config';
import { getCurrentUser } from './authService';

class ProfileService {
  /**
   * Get authentication token
   */
  async getToken(): Promise<string | null> {
    try {
      const storedToken = await AsyncStorage.getItem('userToken');
      
      // If we have a backend JWT token, use it
      if (storedToken && !storedToken.startsWith('admin_')) {
        return storedToken;
      }

      // If no backend token, try to exchange Firebase ID token
      const currentUser = getCurrentUser();
      
      if (!currentUser || typeof currentUser.getIdToken !== 'function') {
        console.warn('⚠️ ProfileService.getToken: No Firebase user found');
        return null;
      }

      // Force refresh Firebase token
      const firebaseToken = await currentUser.getIdToken(true);
      
      if (!firebaseToken) {
        console.warn('⚠️ ProfileService.getToken: Failed to get Firebase token');
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
            return data.token;
          }
        }
      } catch (exchangeError) {
        console.warn('⚠️ ProfileService.getToken: Token exchange failed:', exchangeError);
      }

      return firebaseToken;
    } catch (error) {
      console.error('❌ ProfileService.getToken: Error getting token:', error);
      return null;
    }
  }

  /**
   * Upload profile picture
   */
  async uploadProfilePicture(fileUri: string, fileName: string, mimeType: string): Promise<{ imageFileId: string; imageUrl: string }> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Handle web vs native platforms differently
      let fileContent: Blob | File | { uri: string; type: string; name: string };
      
      if (Platform.OS === 'web') {
        // For web, use fetch to get the file blob
        try {
          const response = await fetch(fileUri);
          if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`);
          }
          const blob = await response.blob();
          fileContent = new File([blob], fileName, { 
            type: mimeType,
            lastModified: Date.now()
          });
        } catch (fetchError) {
          // Try to read file using FileSystem
          try {
            const base64Content = await FileSystem.readAsStringAsync(fileUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            const binaryString = atob(base64Content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: mimeType });
            fileContent = new File([blob], fileName, { 
              type: mimeType,
              lastModified: Date.now()
            });
          } catch (fileSystemError) {
            throw new Error(`Unable to read file on web platform. Please try selecting the file again.`);
          }
        }
      } else {
        // For native React Native, use uri format
        fileContent = {
          uri: fileUri,
          type: mimeType,
          name: fileName,
        };
      }

      const formData = new FormData();
      formData.append('file', fileContent as any, Platform.OS === 'web' ? fileName : undefined);

      console.log(`📤 Uploading profile picture: ${fileName}, Platform: ${Platform.OS}`);
      
      const response = await fetch(`${apiConfig.baseUrl}/api/auth/profile-picture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - let fetch set it automatically with boundary for FormData
        },
        body: formData,
      });

      console.log(`📥 Profile picture upload response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Profile picture upload error response: ${errorText}`);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Upload failed' };
        }
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Update AsyncStorage with new profile picture URL
      if (data.imageUrl) {
        await AsyncStorage.setItem('userPhoto', data.imageUrl);
      }
      
      return {
        imageFileId: data.imageFileId,
        imageUrl: data.imageUrl,
      };
    } catch (error: any) {
      console.error('Profile picture upload error:', error);
      throw error;
    }
  }

  /**
   * Change account password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${apiConfig.baseUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Failed to change password' };
        }
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
    } catch (error: any) {
      console.error('Change password error:', error);
      throw error;
    }
  }
}

export default new ProfileService();

