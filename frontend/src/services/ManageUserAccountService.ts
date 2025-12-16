/**
 * Manage User Account Service
 * Handles student and faculty management operations (superadmin only)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import apiConfig from '../config/api.config';
import { getCurrentUser } from './authService';

export interface Student {
  _id?: string;
  studentId: string;
  lastName: string;
  firstName: string;
  middleInitial?: string;
  extension?: string;
  fullName: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Faculty {
  _id: string;
  fullName: string;
  createdAt?: string;
  updatedAt?: string;
}

class ManageUserAccountService {
  /**
   * Get authentication token (with admin token support and Firebase token exchange if needed)
   */
  async getToken(): Promise<string | null> {
    try {
      const isSuperAdmin = await AsyncStorage.getItem('isSuperAdmin');
      const storedToken = await AsyncStorage.getItem('userToken');
      
      // If superadmin, return admin token directly
      if (isSuperAdmin === 'true' && storedToken && storedToken.startsWith('admin_')) {
        return storedToken;
      }
      
      // For regular users, try to get backend JWT token
      if (storedToken && !storedToken.startsWith('admin_')) {
        return storedToken;
      }

      // If no backend token, try to exchange Firebase ID token
      const currentUser = getCurrentUser();
      if (!currentUser || typeof currentUser.getIdToken !== 'function') {
        console.warn('⚠️ ManageUserAccountService.getToken: No Firebase user found');
        return null;
      }

      // Force refresh Firebase token
      const firebaseToken = await currentUser.getIdToken(true);
      if (!firebaseToken) {
        console.warn('⚠️ ManageUserAccountService.getToken: Failed to get Firebase token');
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
        console.warn('⚠️ ManageUserAccountService.getToken: Token exchange failed:', exchangeError);
      }

      // Fallback to Firebase token
      return firebaseToken;
    } catch (error) {
      console.error('Failed to get token:', error);
      return null;
    }
  }

  /**
   * Add student (superadmin only)
   */
  async addStudent(studentId: string, lastName: string, firstName: string, middleInitial?: string, extension?: string): Promise<boolean> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${apiConfig.baseUrl}/api/admin/students`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          studentId, 
          lastName, 
          firstName, 
          middleInitial: middleInitial || '',
          extension: extension || ''
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in again');
        } else if (response.status === 403) {
          throw new Error('Forbidden: Superadmin access required');
        }
        throw new Error(errorData.error || `Failed to add student: ${response.statusText}`);
      }

      return true;
    } catch (error: any) {
      console.error('Failed to add student:', error);
      throw error;
    }
  }

  /**
   * Get all students (superadmin only)
   */
  async getAllStudents(): Promise<Student[]> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${apiConfig.baseUrl}/api/admin/students`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in again');
        } else if (response.status === 403) {
          throw new Error('Forbidden: Superadmin access required');
        }
        throw new Error(errorData.error || `Failed to fetch students: ${response.statusText}`);
      }

      const data = await response.json();
      return data.students || [];
    } catch (error: any) {
      console.error('Failed to get students:', error);
      throw error;
    }
  }

  /**
   * Delete student (superadmin only)
   */
  async deleteStudent(studentId: string): Promise<boolean> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${apiConfig.baseUrl}/api/admin/students/${encodeURIComponent(studentId)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in again');
        } else if (response.status === 403) {
          throw new Error('Forbidden: Superadmin access required');
        }
        throw new Error(errorData.error || `Failed to delete student: ${response.statusText}`);
      }

      return true;
    } catch (error: any) {
      console.error('Failed to delete student:', error);
      throw error;
    }
  }

  /**
   * Bulk add students from CSV (superadmin only)
   */
  async bulkAddStudents(students: Array<{ studentId: string; fullName: string }>): Promise<{ insertedCount: number }> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${apiConfig.baseUrl}/api/admin/students/bulk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ students }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in again');
        } else if (response.status === 403) {
          throw new Error('Forbidden: Superadmin access required');
        }
        throw new Error(errorData.error || `Failed to bulk add students: ${response.statusText}`);
      }

      const data = await response.json();
      return { insertedCount: data.insertedCount || 0 };
    } catch (error: any) {
      console.error('Failed to bulk add students:', error);
      throw error;
    }
  }

  /**
   * Add faculty (superadmin only)
   */
  async addFaculty(fullName: string): Promise<boolean> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${apiConfig.baseUrl}/api/admin/faculty`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fullName }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in again');
        } else if (response.status === 403) {
          throw new Error('Forbidden: Superadmin access required');
        }
        throw new Error(errorData.error || `Failed to add faculty: ${response.statusText}`);
      }

      return true;
    } catch (error: any) {
      console.error('Failed to add faculty:', error);
      throw error;
    }
  }

  /**
   * Get all faculty (superadmin only)
   */
  async getAllFaculty(): Promise<Faculty[]> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${apiConfig.baseUrl}/api/admin/faculty`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in again');
        } else if (response.status === 403) {
          throw new Error('Forbidden: Superadmin access required');
        }
        throw new Error(errorData.error || `Failed to fetch faculty: ${response.statusText}`);
      }

      const data = await response.json();
      return data.faculty || [];
    } catch (error: any) {
      console.error('Failed to get faculty:', error);
      throw error;
    }
  }

  /**
   * Delete faculty (superadmin only)
   */
  async deleteFaculty(facultyId: string): Promise<boolean> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${apiConfig.baseUrl}/api/admin/faculty/${encodeURIComponent(facultyId)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in again');
        } else if (response.status === 403) {
          throw new Error('Forbidden: Superadmin access required');
        }
        throw new Error(errorData.error || `Failed to delete faculty: ${response.statusText}`);
      }

      return true;
    } catch (error: any) {
      console.error('Failed to delete faculty:', error);
      throw error;
    }
  }

  /**
   * Delete all students (superadmin only)
   */
  async deleteAllStudents(): Promise<{ deletedCount: number }> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${apiConfig.baseUrl}/api/admin/students/all`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in again');
        } else if (response.status === 403) {
          throw new Error('Forbidden: Superadmin access required');
        }
        throw new Error(errorData.error || `Failed to delete all students: ${response.statusText}`);
      }

      const data = await response.json();
      return { deletedCount: data.deletedCount || 0 };
    } catch (error: any) {
      console.error('Failed to delete all students:', error);
      throw error;
    }
  }

  /**
   * Delete all faculty (superadmin only)
   */
  async deleteAllFaculty(): Promise<{ deletedCount: number }> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${apiConfig.baseUrl}/api/admin/faculty/all`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in again');
        } else if (response.status === 403) {
          throw new Error('Forbidden: Superadmin access required');
        }
        throw new Error(errorData.error || `Failed to delete all faculty: ${response.statusText}`);
      }

      const data = await response.json();
      return { deletedCount: data.deletedCount || 0 };
    } catch (error: any) {
      console.error('Failed to delete all faculty:', error);
      throw error;
    }
  }

  /**
   * Bulk add faculty from CSV (superadmin only)
   */
  async bulkAddFaculty(faculty: Array<{ fullName: string }>): Promise<{ insertedCount: number }> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${apiConfig.baseUrl}/api/admin/faculty/bulk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ faculty }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in again');
        } else if (response.status === 403) {
          throw new Error('Forbidden: Superadmin access required');
        }
        throw new Error(errorData.error || `Failed to bulk add faculty: ${response.statusText}`);
      }

      const data = await response.json();
      return { insertedCount: data.insertedCount || 0 };
    } catch (error: any) {
      console.error('Failed to bulk add faculty:', error);
      throw error;
    }
  }

  /**
   * Parse CSV file content (unified format with user type column)
   * Expected format: StudentID, FullName, UserType
   * UserType can be "Student" or "Faculty"
   */
  parseCSV(csvContent: string): Array<{ studentId?: string; fullName: string; type: 'student' | 'faculty' }> {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    const results: Array<{ studentId?: string; fullName: string; type: 'student' | 'faculty' }> = [];
    
    // Skip header row if it exists (check for common header patterns)
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('studentid') || 
                      firstLine.includes('fullname') || 
                      firstLine.includes('name') || 
                      firstLine.includes('usertype') ||
                      firstLine.includes('role') ||
                      firstLine.includes('type');
    const startIndex = hasHeader ? 1 : 0;

    const errors: string[] = [];
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        // Handle CSV with quotes and commas - more robust parsing
        // Split by comma, but handle quoted values
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim().replace(/^"|"$/g, ''));
        
        if (values.length < 2) {
          errors.push(`Line ${i + 1}: Expected at least 2 columns (StudentID/Empty, FullName, UserType). Found: ${values.length} column(s)`);
          continue;
        }

        // Determine user type from third column (if present) or by checking if Student ID exists
        let userType: 'student' | 'faculty' = 'student';
        let studentId = values[0].trim();
        let fullName = values[1].trim();
        
        // Check if first column is just a row number (1-9999) - if so, shift columns
        const isRowNumber = /^\d{1,4}$/.test(studentId) && parseInt(studentId) > 0 && parseInt(studentId) < 10000;
        if (isRowNumber) {
          // First column is row number, shift everything
          if (values.length >= 2) {
            studentId = values[1].trim();
            fullName = values.length >= 3 ? values[2].trim() : '';
          }
        }
        
        // Normalize student ID - remove extra spaces, handle different separators
        const originalStudentId = studentId;
        studentId = studentId.replace(/\s+/g, ''); // Remove all spaces
        
        // First, try to determine if studentId is valid before checking UserType column
        // This ensures we don't treat row numbers or invalid IDs as students
        let hasValidStudentId = false;
        if (studentId && studentId.trim()) {
          const normalizedId = studentId.replace(/[^\d-]/g, ''); // Keep only digits and dashes
          
          // Check if it's a valid student ID format
          if (/^\d{4}-\d{4}$/.test(normalizedId)) {
            studentId = normalizedId;
            hasValidStudentId = true;
          } else if (/^\d{8}$/.test(normalizedId)) {
            // Format: YYYYNNNN -> YYYY-NNNN
            studentId = `${normalizedId.substring(0, 4)}-${normalizedId.substring(4)}`;
            hasValidStudentId = true;
          }
        }
        
        // Determine user type based on available columns
        if (isRowNumber && values.length >= 4) {
          // Format: RowNumber, StudentID, FullName, UserType
          const typeValue = values[3].toLowerCase().trim();
          // Only trust UserType if we have a valid student ID, otherwise treat as faculty
          if (hasValidStudentId && (typeValue === 'student' || typeValue === '')) {
            userType = 'student';
          } else {
            userType = 'faculty';
            studentId = ''; // Clear invalid student ID
          }
        } else if (!isRowNumber && values.length >= 3) {
          // Format: StudentID, FullName, UserType
          const typeValue = values[2].toLowerCase().trim();
          // Only trust UserType if we have a valid student ID, otherwise treat as faculty
          if (hasValidStudentId && (typeValue === 'student' || typeValue === '')) {
            userType = 'student';
          } else {
            userType = 'faculty';
            studentId = ''; // Clear invalid student ID
          }
        } else {
          // Format: StudentID/Empty, FullName (infer type from Student ID presence)
          // If Student ID is empty or doesn't match pattern, it's faculty
          if (hasValidStudentId) {
            userType = 'student';
          } else {
            userType = 'faculty';
            studentId = ''; // Clear invalid student ID
          }
        }

        if (!fullName.trim()) {
          // Skip empty rows silently (they might be blank lines in CSV)
          continue;
        }

        // Final check: if userType is student but we don't have a valid student ID, treat as faculty
        if (userType === 'student' && !hasValidStudentId) {
          if (__DEV__) {
            console.warn(`Line ${i + 1}: Marked as student but Student ID "${originalStudentId}" is invalid, treating as faculty`);
          }
          userType = 'faculty';
          studentId = '';
        }

        results.push({
          studentId: userType === 'student' ? studentId : undefined,
          fullName: fullName.trim(),
          type: userType
        });
      } catch (lineError: any) {
        errors.push(`Line ${i + 1}: ${lineError.message || 'Parse error'}`);
      }
    }
    
    // If there are errors and no valid results, throw with all errors
    if (errors.length > 0 && results.length === 0) {
      throw new Error(`CSV parsing failed:\n${errors.join('\n')}`);
    }
    
    // If there are some errors but also some valid results, log warnings but continue
    if (errors.length > 0 && results.length > 0) {
      console.warn('CSV parsing warnings:', errors);
    }

    return results;
  }
}

export default new ManageUserAccountService();

