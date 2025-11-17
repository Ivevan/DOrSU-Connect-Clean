// Simple in-memory Admin data service (TypeScript)
// Provides dashboard data and CRUD-like helpers for posts/updates

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import apiConfig from '../config/api.config';
import { getCurrentUser } from './authService';

export interface Post {
  id: string;
  title: string;
  description?: string;
  category: string;
  date: string;
  isoDate: string;
  time?: string;
  images?: string[];
  image?: string;
  isPinned?: boolean;
  isUrgent?: boolean;
  source?: string;
}

export interface PostPartial {
  title?: string;
  description?: string;
  category?: string;
  date?: string;
  isoDate?: string;
  time?: string;
  images?: string[];
  image?: string;
  imageFile?: {
    uri: string;
    fileCopyUri?: string | null;
    cachedUri?: string | null;
    name: string;
    mimeType: string | null;
    size: number;
  };
  isPinned?: boolean;
  isUrgent?: boolean;
  source?: string;
}

export interface PostUpdates {
  title?: string;
  description?: string;
  category?: string;
  date?: string;
  isoDate?: string;
  time?: string;
  images?: string[];
  image?: string;
  isPinned?: boolean;
  isUrgent?: boolean;
  source?: string;
}

export interface DashboardUpdate {
  title: string;
  date: string;
  isoDate: string;
  time?: string;
  tag: string;
  description?: string;
  images?: string[];
  image?: string;
  pinned?: boolean;
  source?: string;
}

export interface DashboardStats {
  totalUpdates: number;
  pinned: number;
  urgent: number;
  recentUpdates: DashboardUpdate[];
}

let postsStore: Post[] = [];
let idCounter: number = 1;

// Reduced delay for better performance - can be removed in production
const delay = (ms: number = __DEV__ ? 50 : 100): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

function normalizeImages(images: string | string[] | undefined): string[] {
  if (!images) return [];
  if (Array.isArray(images)) return images.filter(Boolean);
  if (typeof images === 'string' && images.trim().length > 0) return [images.trim()];
  return [];
}

function toIsoDate(input: string | Date | undefined): string {
  if (!input) return new Date().toISOString();
  const asDate = new Date(input);
  if (!isNaN(asDate.getTime())) return asDate.toISOString();
  if (typeof input === 'string' && input.includes('/')) {
    const m = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const dd = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10) - 1;
      const yyyy = parseInt(m[3], 10);
      const d = new Date(yyyy, mm, dd);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }
  // Fallback now
  return new Date().toISOString();
}

function dateToSortKey(post: Post): number {
  const iso = post?.isoDate || post?.date;
  const t = Date.parse(iso);
  if (!isNaN(t)) return t;
  // Try dd/mm/yyyy fallback
  if (typeof iso === 'string') {
    const m = iso.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const dd = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10) - 1;
      const yyyy = parseInt(m[3], 10);
      return new Date(yyyy, mm, dd).getTime();
    }
  }
  return 0;
}

interface CreatePostResponse {
  post?: {
    id?: string;
    title?: string;
    description?: string;
    category?: string;
    date?: string;
    image?: string;
    source?: string;
  };
  event?: {
    id?: string;
    title?: string;
    description?: string;
    category?: string;
    date?: string;
    image?: string;
    source?: string;
  };
}

interface FirebaseLoginResponse {
  token?: string;
  user?: {
    id?: string;
  };
}

const AdminDataService = {
  async getPosts(): Promise<Post[]> {
    try {
      const token = await this.getToken();
      if (!token) {
        console.warn('⚠️ AdminDataService.getPosts: No token available, using local store');
        console.log('📦 Local store has', postsStore.length, 'posts');
        // Fallback to local store if no token
        await delay();
        const sorted = [...postsStore].sort((a, b) => {
          const da = dateToSortKey(a);
          const db = dateToSortKey(b);
          return db - da;
        });
        console.log('✅ Returning', sorted.length, 'posts from local store (no token)');
        return sorted;
      }

      console.log('🌐 Fetching posts from backend:', `${apiConfig.baseUrl}/api/admin/posts?limit=1000`);
      
      // Fetch from backend MongoDB
      const response = await fetch(`${apiConfig.baseUrl}/api/admin/posts?limit=1000`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 Backend response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Backend HTTP error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📦 Backend response data:', { success: data.success, postsCount: Array.isArray(data.posts) ? data.posts.length : 'not an array' });
      
      if (data.success && Array.isArray(data.posts)) {
        // Update local store for offline access
        postsStore = data.posts;
        console.log('✅ Updated local store with', data.posts.length, 'posts from backend');
        return data.posts;
      }
      
      // Fallback to local store if response format is unexpected
      console.warn('⚠️ Unexpected response format, using local store');
      console.log('📦 Local store has', postsStore.length, 'posts');
      await delay();
      const sorted = [...postsStore].sort((a, b) => {
        const da = dateToSortKey(a);
        const db = dateToSortKey(b);
        return db - da;
      });
      console.log('✅ Returning', sorted.length, 'posts from local store (unexpected format)');
      return sorted;
    } catch (error: any) {
      console.error('❌ Failed to fetch posts from backend:', error);
      console.error('❌ Error details:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
      });
      // Fallback to local store
      console.log('📦 Local store has', postsStore.length, 'posts');
      await delay();
      const sorted = [...postsStore].sort((a, b) => {
        const da = dateToSortKey(a);
        const db = dateToSortKey(b);
        return db - da;
      });
      console.log('✅ Returning', sorted.length, 'posts from local store (error fallback)');
      return sorted;
    }
  },

  async getPostById(id: string | number): Promise<Post | null> {
    await delay();
    return postsStore.find(p => p.id === String(id)) || null;
  },

  async getToken(): Promise<string | null> {
    try {
      // Check if user is admin first
      const isAdmin = await AsyncStorage.getItem('isAdmin');
      const storedToken = await AsyncStorage.getItem('userToken');
      
      // If admin, return admin token directly
      if (isAdmin === 'true' && storedToken && storedToken.startsWith('admin_')) {
        return storedToken;
      }
      
      // For regular users, try to get backend JWT token
      if (storedToken && !storedToken.startsWith('admin_')) {
        return storedToken;
      }

      // If no backend token, try to exchange Firebase ID token
      const currentUser = getCurrentUser();
      
      if (!currentUser || typeof currentUser.getIdToken !== 'function') {
        console.warn('⚠️ AdminDataService.getToken: No Firebase user found');
        return null;
      }

      // Force refresh Firebase token
      const firebaseToken = await currentUser.getIdToken(true);
      
      if (!firebaseToken) {
        console.warn('⚠️ AdminDataService.getToken: Failed to get Firebase token');
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
          const data = await exchangeResponse.json() as FirebaseLoginResponse;
          if (data.token) {
            await AsyncStorage.setItem('userToken', data.token);
            if (data.user?.id) {
              await AsyncStorage.setItem('userId', String(data.user.id));
            }
            return data.token;
          }
        }
      } catch (exchangeError) {
        console.warn('⚠️ AdminDataService.getToken: Token exchange failed:', exchangeError);
      }

      // Fallback to Firebase token
      return firebaseToken;
    } catch (error) {
      console.error('❌ AdminDataService.getToken: Error getting token:', error);
      return null;
    }
  },

  async createPost(partial: PostPartial): Promise<Post> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Create FormData for multipart/form-data
      const formData = new FormData();
      formData.append('title', partial?.title || 'Untitled');
      formData.append('description', partial?.description || '');
      formData.append('category', partial?.category || 'General');
      formData.append('date', partial?.date || new Date().toISOString());

      // Handle image upload if present
      // Check if imageFile object is provided (from AddEventDrawer) or image URI string
      const imageFile = partial?.imageFile;
      const imageUri = partial?.image;
      
      if (imageFile || (imageUri && typeof imageUri === 'string')) {
        const uri = imageFile?.uri || imageUri;
        const mimeType = imageFile?.mimeType || null;
        const fileName = imageFile?.name || `image_${Date.now()}.jpg`;
        
        console.log('📸 Processing image:', { uri: uri?.substring(0, 50) + '...', mimeType, fileName, hasImageFile: !!imageFile });
        
        if (!uri) {
          console.warn('⚠️ Image URI is empty');
        } else {
          // Check if it's a base64 data URI
          const isBase64DataUri = uri.startsWith('data:');
          
          if (isBase64DataUri) {
            // Handle base64 data URI
            try {
              console.log('📸 Detected base64 data URI, converting for upload...');
              
              // Parse data URI: data:image/png;base64,<base64data>
              const matches = uri.match(/^data:([^;]+);base64,(.+)$/);
              if (!matches || matches.length < 3) {
                throw new Error('Invalid base64 data URI format');
              }
              
              const detectedMimeType = matches[1] || 'image/png';
              const base64Data = matches[2];
              
              // Determine file extension from MIME type
              const extension = detectedMimeType.includes('png') ? 'png' :
                               detectedMimeType.includes('gif') ? 'gif' :
                               detectedMimeType.includes('webp') ? 'webp' :
                               'jpg';
              
              const finalMimeType = mimeType || detectedMimeType;
              const finalFileName = fileName.includes('.') ? fileName : `image_${Date.now()}.${extension}`;
              
              if (Platform.OS === 'web') {
                // For web: Convert base64 to Blob and append directly
                console.log('📸 Platform: Web - Converting base64 to Blob...');
                
                // Convert base64 string to binary string
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                
                // Create Blob from bytes
                const blob = new Blob([bytes], { type: finalMimeType });
                
                // Append Blob to FormData
                formData.append('image', blob, finalFileName);
                
                console.log('✅ Image appended to FormData from base64 (web):', { 
                  type: finalMimeType,
                  name: finalFileName,
                  size: blob.size,
                });
              } else {
                // For native: Write to temporary file and use file URI
                console.log('📸 Platform: Native - Writing base64 to temporary file...');
                
                // Create temporary file path
                const tempFilePath = `${FileSystem.cacheDirectory}upload_${Date.now()}.${extension}`;
                
                // Write base64 data to temporary file
                await FileSystem.writeAsStringAsync(tempFilePath, base64Data, {
                  encoding: FileSystem.EncodingType.Base64,
                });
                
                console.log('✅ Base64 data written to temporary file:', tempFilePath);
                
                // Use the temporary file for upload
                formData.append('image', {
                  uri: `file://${tempFilePath}`,
                  type: finalMimeType,
                  name: finalFileName,
                } as any);
                
                console.log('✅ Image appended to FormData from base64 (native):', { 
                  uri: tempFilePath, 
                  type: finalMimeType,
                  name: finalFileName,
                });
              }
            } catch (error: any) {
              console.error('❌ Failed to process base64 data URI:', error);
              console.error('❌ Error details:', {
                message: error.message,
                stack: error.stack,
                platform: Platform.OS,
              });
              // Continue without image rather than failing the entire request
            }
          } else {
            // Check for various URI formats (file://, content://, or file path)
            const isLocalFile = uri.startsWith('file://') || 
                               uri.startsWith('content://') || 
                               uri.startsWith('/') ||
                               uri.includes('DocumentPicker') ||
                               uri.includes('cache') ||
                               uri.includes('file:///');
            
            if (isLocalFile) {
              try {
                // Try to get file info to verify it exists
                let fileInfo;
                let actualUri = uri;
                
                // Try with the URI as-is first
                try {
                  fileInfo = await FileSystem.getInfoAsync(uri);
                  actualUri = uri;
                  console.log('✅ File verified with original URI');
                } catch (firstError) {
                  // If that fails, try adding file:// prefix if missing
                  const uriWithPrefix = uri.startsWith('file://') ? uri : `file://${uri}`;
                  try {
                    fileInfo = await FileSystem.getInfoAsync(uriWithPrefix);
                    actualUri = uriWithPrefix;
                    console.log('✅ File verified with file:// prefix');
                  } catch (secondError) {
                    // If that fails, try removing file:// prefix
                    const cleanUri = uri.replace(/^file:\/\//, '');
                    try {
                      fileInfo = await FileSystem.getInfoAsync(cleanUri);
                      actualUri = cleanUri;
                      console.log('✅ File verified without file:// prefix');
                    } catch (thirdError) {
                      console.warn('⚠️ Could not verify file exists with any URI format, proceeding anyway');
                      // Continue anyway - React Native FormData can handle URIs even if FileSystem can't verify
                      fileInfo = { exists: true }; // Assume it exists
                      actualUri = uri;
                    }
                  }
                }
                
                // Determine MIME type - prefer from imageFile, then from extension
                let finalMimeType = mimeType;
                if (!finalMimeType) {
                  const extension = uri.split('.').pop()?.toLowerCase() || 'jpg';
                  finalMimeType = extension === 'png' ? 'image/png' : 
                                 extension === 'gif' ? 'image/gif' : 
                                 extension === 'webp' ? 'image/webp' :
                                 'image/jpeg';
                }
                
                // Determine file extension for name
                const extension = fileName.split('.').pop()?.toLowerCase() || uri.split('.').pop()?.toLowerCase() || 'jpg';
                const finalFileName = fileName.includes('.') ? fileName : `image_${Date.now()}.${extension}`;
                
                // Use the actual URI that worked, or original if we couldn't verify
                const uploadUri = actualUri || uri;
                
                formData.append('image', {
                  uri: uploadUri,
                  type: finalMimeType,
                  name: finalFileName,
                } as any);
                
                console.log('✅ Image appended to FormData:', { 
                  uri: uploadUri, 
                  type: finalMimeType,
                  name: finalFileName,
                  fileExists: fileInfo?.exists,
                });
              } catch (error: any) {
                console.error('❌ Failed to process image file:', error);
                console.error('❌ Error details:', {
                  message: error.message,
                  stack: error.stack,
                  uri: uri,
                });
                // Continue without image rather than failing the entire request
              }
            } else {
              console.warn('⚠️ Image URI format not recognized as local file:', uri);
            }
          }
        }
      } else {
        console.log('ℹ️ No image provided in postData');
      }

      // Call backend API
      console.log('📤 Sending FormData to backend...');
      console.log('📤 FormData entries:');
      // Log FormData contents (for debugging)
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          console.log(`  ${key}: [File] ${value.name || 'unnamed'}, size: ${value.size || 'unknown'}, type: ${value.type || 'unknown'}`);
        } else if (typeof value === 'object' && value !== null && 'uri' in value) {
          const fileObj = value as { uri?: string; name?: string; size?: number; type?: string };
          console.log(`  ${key}: [File] ${fileObj.name || 'unnamed'}, size: ${fileObj.size || 'unknown'}, type: ${fileObj.type || 'unknown'}`);
        } else {
          console.log(`  ${key}: ${String(value).substring(0, 100)}`);
        }
      }
      
      try {
        const response = await fetch(`${apiConfig.baseUrl}/api/admin/create-post`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            // Don't set Content-Type - let fetch set it with boundary
          },
          body: formData,
        });

        console.log('📥 Response status:', response.status);
        console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Backend error response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Failed to create post' };
        }
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

        const data = await response.json() as CreatePostResponse;
        console.log('✅ Post created successfully:', data);
        
        // Handle both 'post' and 'event' response formats (for backward compatibility)
        const eventData = (data as any).event || data.post;
      
      // Also add to local store for immediate UI update
      const images = normalizeImages(partial?.images || (eventData?.image ? [eventData.image] : []));
      const firstImage = images.length > 0 ? images[0] : undefined;
      const nowIso = new Date().toISOString();
      const chosenIso = toIsoDate(partial?.date || nowIso);
      const next: Post = {
        id: eventData?.id || String(idCounter++),
        title: eventData?.title || partial?.title || 'Untitled',
        description: eventData?.description || partial?.description || '',
        category: eventData?.category || partial?.category || 'General',
        date: eventData?.date || partial?.date || nowIso,
        isoDate: chosenIso,
        images,
        image: firstImage,
        isPinned: Boolean(partial?.isPinned),
        isUrgent: Boolean(partial?.isUrgent),
        source: eventData?.source || partial?.source || 'Admin',
      };
        console.log('📦 Adding post to local store:', { id: next.id, title: next.title });
        console.log('📦 Local store before:', postsStore.length, 'posts');
        postsStore = [next, ...postsStore];
        console.log('✅ Local store after:', postsStore.length, 'posts');
        return next;
      } catch (fetchError: any) {
        console.error('❌ Fetch error:', fetchError);
        console.error('❌ Error details:', {
          message: fetchError.message,
          stack: fetchError.stack,
          name: fetchError.name,
        });
        throw fetchError;
      }
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  },

  async updatePost(id: string | number, updates: PostUpdates): Promise<Post | null> {
    try {
      const token = await this.getToken();
      if (!token) {
        console.warn('⚠️ AdminDataService.updatePost: No token available, using local store');
        // Fallback to local store
        await delay();
        let updated: Post | null = null;
        postsStore = postsStore.map(p => {
          if (p.id === String(id)) {
            const images = normalizeImages(updates?.images ?? p.images);
            const firstImage = images.length > 0 ? images[0] : undefined;
            const nextDate = updates?.date !== undefined ? updates.date : p.date;
            updated = {
              ...p,
              title: updates?.title ?? p.title,
              description: updates?.description ?? p.description,
              category: updates?.category ?? p.category,
              date: nextDate,
              isoDate: toIsoDate(nextDate || p.isoDate || p.date),
              images,
              image: firstImage,
              isPinned: typeof updates?.isPinned === 'boolean' ? updates.isPinned : p.isPinned,
              isUrgent: typeof updates?.isUrgent === 'boolean' ? updates.isUrgent : p.isUrgent,
              source: updates?.source ?? p.source,
            };
            return updated;
          }
          return p;
        });
        return updated;
      }

      // Check if a new image is being uploaded (has imageFile object)
      const hasImageUpdate = !!(updates as any)?.imageFile;
      const imageUri = updates?.image || (updates as any)?.imageFile?.uri;
      
      let response;
      if (hasImageUpdate && imageUri && typeof imageUri === 'string') {
        // Use multipart/form-data for image upload
        const formData = new FormData();
        
        if (updates.title) formData.append('title', updates.title);
        if (updates.description) formData.append('description', updates.description || '');
        if (updates.category) formData.append('category', updates.category);
        if (updates.date) formData.append('date', updates.date);

        // Handle image upload
        if (imageUri && typeof imageUri === 'string') {
          const imageFile = (updates as any)?.imageFile;
          const uri = imageFile?.uri || imageUri;
          const mimeType = imageFile?.mimeType || null;
          const fileName = imageFile?.name || `image_${Date.now()}.jpg`;

          // Check if it's a base64 data URI
          const isBase64DataUri = uri.startsWith('data:');
          
          if (isBase64DataUri) {
            // Handle base64 data URI
            const matches = uri.match(/^data:([^;]+);base64,(.+)$/);
            if (matches && matches.length >= 3) {
              const detectedMimeType = matches[1] || 'image/png';
              const base64Data = matches[2];
              
              if (Platform.OS === 'web') {
                // For web: Convert base64 to Blob
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: detectedMimeType });
                formData.append('image', blob, fileName);
              } else {
                // For native: Write to temporary file
                const extension = detectedMimeType.includes('png') ? 'png' :
                                 detectedMimeType.includes('gif') ? 'gif' :
                                 detectedMimeType.includes('webp') ? 'webp' :
                                 'jpg';
                const tempFilePath = `${FileSystem.cacheDirectory}upload_${Date.now()}.${extension}`;
                await FileSystem.writeAsStringAsync(tempFilePath, base64Data, {
                  encoding: FileSystem.EncodingType.Base64,
                });
                formData.append('image', {
                  uri: `file://${tempFilePath}`,
                  type: detectedMimeType,
                  name: fileName,
                } as any);
              }
            }
          } else {
            // Handle local file URI
            const finalMimeType = mimeType || 'image/jpeg';
            const finalFileName = fileName.includes('.') ? fileName : `image_${Date.now()}.jpg`;
            formData.append('image', {
              uri: uri,
              type: finalMimeType,
              name: finalFileName,
            } as any);
          }
        }

        response = await fetch(`${apiConfig.baseUrl}/api/admin/posts/${id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            // Don't set Content-Type - let fetch set it with boundary
          },
          body: formData,
        });
      } else {
        // Use JSON for text-only updates
        response = await fetch(`${apiConfig.baseUrl}/api/admin/posts/${id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Update failed' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.post) {
        // Update local store
        const updatedPost = data.post;
        postsStore = postsStore.map(p => 
          p.id === String(id) ? updatedPost : p
        );
        return updatedPost;
      }
      
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('Failed to update post:', error);
      throw error;
    }
  },

  async deletePost(id: string | number): Promise<boolean> {
    try {
      const token = await this.getToken();
      if (!token) {
        console.warn('⚠️ AdminDataService.deletePost: No token available, using local store');
        // Fallback to local store
        await delay();
        const before = postsStore.length;
        postsStore = postsStore.filter(p => p.id !== String(id));
        return postsStore.length < before;
      }

      // Call backend API
      const response = await fetch(`${apiConfig.baseUrl}/api/admin/posts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        // Remove from local store
        postsStore = postsStore.filter(p => p.id !== String(id));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to delete post:', error);
      throw error;
    }
  },

  async togglePin(id: string | number): Promise<Post | null> {
    await delay();
    let updated: Post | null = null;
    postsStore = postsStore.map(p => {
      if (p.id === String(id)) {
        const next = { ...p, isPinned: !p.isPinned };
        updated = next;
        return next;
      }
      return p;
    });
    return updated;
  },

  async getDashboard(/* period?: string */): Promise<DashboardStats> {
    await delay();
    const totalUpdates = postsStore.length;
    const pinnedCount = postsStore.filter(p => p.isPinned).length;
    const urgentCount = postsStore.filter(p => p.isUrgent).length;

    const recentUpdates: DashboardUpdate[] = [...postsStore]
      .sort((a, b) => dateToSortKey(b) - dateToSortKey(a))
      .slice(0, 20)
      .map(p => ({
        title: p.title,
        date: p.date,
        isoDate: p.isoDate,
        time: p.time || '',
        tag: p.category,
        description: p.description,
        images: p.images,
        image: p.image || (Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : undefined),
        pinned: p.isPinned,
        source: p.source || 'Admin',
      }));

    return {
      totalUpdates,
      pinned: pinnedCount,
      urgent: urgentCount,
      recentUpdates,
    };
  },
};

export default AdminDataService;

