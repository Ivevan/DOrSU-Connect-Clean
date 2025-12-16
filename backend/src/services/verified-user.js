/**
 * Verified User Service
 * Service for managing verified students and faculty (superadmin only)
 * Handles CRUD operations for students and faculty collections
 */

import { Logger } from '../utils/logger.js';
import { authMiddleware } from './auth.js';

export class VerifiedUserService {
  constructor(mongoService, authService) {
    this.mongoService = mongoService;
    this.authService = authService;
  }

  /**
   * Helper method to send JSON response
   */
  sendJson(res, status, body) {
    const json = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) });
    res.end(json);
  }

  /**
   * Extract student ID from URL
   */
  extractStudentId(url) {
    let studentId = url.split('/api/admin/students/')[1];
    if (studentId) {
      // Remove query parameters if any
      studentId = studentId.split('?')[0].split('#')[0];
      // Remove trailing slash if any
      studentId = studentId.replace(/\/$/, '');
    }
    return studentId || null;
  }

  /**
   * Extract faculty ID from URL
   */
  extractFacultyId(url) {
    let facultyId = url.split('/api/admin/faculty/')[1];
    if (facultyId) {
      // Remove query parameters if any
      facultyId = facultyId.split('?')[0].split('#')[0];
      // Remove trailing slash if any
      facultyId = facultyId.replace(/\/$/, '');
    }
    return facultyId || null;
  }

  /**
   * Check if user is superadmin
   */
  async checkSuperAdmin(req, res) {
    if (!this.authService || !this.mongoService) {
      this.sendJson(res, 503, { error: 'Services not available' });
      return null;
    }

    const auth = await authMiddleware(this.authService, this.mongoService)(req);
    if (!auth.authenticated) {
      this.sendJson(res, 401, { error: auth.error || 'Unauthorized' });
      return null;
    }

    // Check if user is superadmin (use auth.role from middleware)
    if (!auth.isSuperAdmin && auth.role !== 'superadmin') {
      this.sendJson(res, 403, { error: 'Forbidden: Superadmin access required' });
      return null;
    }

    return auth;
  }

  /**
   * Parse request body
   */
  async parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          resolve(JSON.parse(body || '{}'));
        } catch (error) {
          reject(new Error('Invalid JSON in request body'));
        }
      });
      req.on('error', reject);
    });
  }

  /**
   * Parse query parameters
   */
  parseQueryParams(url) {
    const urlObj = new URL(url, `http://localhost:3000`);
    const limit = parseInt(urlObj.searchParams.get('limit') || '1000', 10);
    const skip = parseInt(urlObj.searchParams.get('skip') || '0', 10);
    return { limit, skip };
  }

  /**
   * Handle route - main entry point for all verified user endpoints
   */
  async handleRoute(req, res, method, url) {
    // Check if this is a verified user route
    const isStudentRoute = url.startsWith('/api/admin/students');
    const isFacultyRoute = url.startsWith('/api/admin/faculty');
    
    if (!isStudentRoute && !isFacultyRoute) {
      return false; // Not a verified user route
    }

    // STUDENT ROUTES
    if (isStudentRoute) {
      // Add student
      if (method === 'POST' && url === '/api/admin/students') {
        return await this.handleAddStudent(req, res);
      }

      // Get all students
      if (method === 'GET' && url.startsWith('/api/admin/students') && !url.includes('/api/admin/students/')) {
        return await this.handleGetAllStudents(req, res, url);
      }

      // Delete student
      if (method === 'DELETE' && url.startsWith('/api/admin/students/') && url !== '/api/admin/students/all') {
        return await this.handleDeleteStudent(req, res, url);
      }

      // Delete all students
      if (method === 'DELETE' && url === '/api/admin/students/all') {
        return await this.handleDeleteAllStudents(req, res);
      }

      // Bulk add students
      if (method === 'POST' && url === '/api/admin/students/bulk') {
        return await this.handleBulkAddStudents(req, res);
      }
    }

    // FACULTY ROUTES
    if (isFacultyRoute) {
      // Add faculty
      if (method === 'POST' && url === '/api/admin/faculty') {
        return await this.handleAddFaculty(req, res);
      }

      // Get all faculty
      if (method === 'GET' && url.startsWith('/api/admin/faculty') && !url.includes('/api/admin/faculty/')) {
        return await this.handleGetAllFaculty(req, res, url);
      }

      // Delete faculty
      if (method === 'DELETE' && url.startsWith('/api/admin/faculty/') && url !== '/api/admin/faculty/all') {
        return await this.handleDeleteFaculty(req, res, url);
      }

      // Delete all faculty
      if (method === 'DELETE' && url === '/api/admin/faculty/all') {
        return await this.handleDeleteAllFaculty(req, res);
      }

      // Bulk add faculty
      if (method === 'POST' && url === '/api/admin/faculty/bulk') {
        return await this.handleBulkAddFaculty(req, res);
      }
    }

    return false; // Route not handled
  }

  // ===== STUDENT HANDLERS =====

  async handleAddStudent(req, res) {
    const auth = await this.checkSuperAdmin(req, res);
    if (!auth) return true;

    try {
      const body = await this.parseBody(req);
      const { studentId, lastName, firstName, middleInitial, extension } = body;

      if (!studentId || !lastName || !firstName) {
        this.sendJson(res, 400, { error: 'Student ID, Last Name, and First Name are required' });
        return true;
      }

      // Validate Student ID format (e.g., 2022-0987)
      const studentIdPattern = /^\d{4}-\d{4}$/;
      if (!studentIdPattern.test(studentId.trim())) {
        this.sendJson(res, 400, { error: 'Invalid Student ID format. Expected format: YYYY-NNNN (e.g., 2022-0987)' });
        return true;
      }

      // Validate name fields
      if (!lastName.trim() || !firstName.trim()) {
        this.sendJson(res, 400, { error: 'Last Name and First Name cannot be empty' });
        return true;
      }

      await this.mongoService.addStudent(
        studentId.trim(), 
        lastName.trim(), 
        firstName.trim(), 
        middleInitial ? middleInitial.trim() : '',
        extension ? extension.trim() : ''
      );
      
      Logger.success(`✅ Student added: ${studentId}`);
      this.sendJson(res, 201, { success: true, message: 'Student added successfully' });
      return true;
    } catch (error) {
      Logger.error('Add student error:', error.message);
      this.sendJson(res, 400, { error: error.message || 'Failed to add student' });
      return true;
    }
  }

  async handleGetAllStudents(req, res, url) {
    const auth = await this.checkSuperAdmin(req, res);
    if (!auth) return true;

    try {
      const { limit, skip } = this.parseQueryParams(req.url);
      const students = await this.mongoService.getAllStudents(limit, skip);
      this.sendJson(res, 200, { success: true, count: students.length, students });
      return true;
    } catch (error) {
      Logger.error('Get students error:', error.message);
      this.sendJson(res, 500, { error: error.message || 'Failed to get students' });
      return true;
    }
  }

  async handleDeleteStudent(req, res, url) {
    const auth = await this.checkSuperAdmin(req, res);
    if (!auth) return true;

    try {
      const studentId = this.extractStudentId(url);
      if (!studentId) {
        this.sendJson(res, 400, { error: 'Student ID is required' });
        return true;
      }

      await this.mongoService.deleteStudent(studentId);
      Logger.success(`✅ Student deleted: ${studentId}`);
      this.sendJson(res, 200, { success: true, message: 'Student deleted successfully' });
      return true;
    } catch (error) {
      Logger.error('Delete student error:', error.message);
      this.sendJson(res, 400, { error: error.message || 'Failed to delete student' });
      return true;
    }
  }

  async handleDeleteAllStudents(req, res) {
    const auth = await this.checkSuperAdmin(req, res);
    if (!auth) return true;

    try {
      const result = await this.mongoService.deleteAllStudents();
      Logger.success(`✅ Deleted all students: ${result.deletedCount} deleted`);
      this.sendJson(res, 200, { 
        success: true, 
        message: `Successfully deleted ${result.deletedCount} students`,
        deletedCount: result.deletedCount
      });
      return true;
    } catch (error) {
      Logger.error('Delete all students error:', error.message);
      this.sendJson(res, 400, { error: error.message || 'Failed to delete all students' });
      return true;
    }
  }

  async handleBulkAddStudents(req, res) {
    const auth = await this.checkSuperAdmin(req, res);
    if (!auth) return true;

    try {
      const body = await this.parseBody(req);
      const { students } = body;

      if (!Array.isArray(students) || students.length === 0) {
        this.sendJson(res, 400, { error: 'Students array is required and must not be empty' });
        return true;
      }

      // Validate each student
      const studentIdPattern = /^\d{4}-\d{4}$/;
      for (const student of students) {
        if (!student.studentId) {
          throw new Error('Each student must have studentId');
        }
        if (!studentIdPattern.test(student.studentId.trim())) {
          throw new Error(`Invalid Student ID format: ${student.studentId}. Expected format: YYYY-NNNN`);
        }
        
        // Support both new format (lastName, firstName, middleInitial) and old format (fullName)
        if (student.lastName && student.firstName) {
          // New format
          if (!student.lastName.trim() || !student.firstName.trim()) {
            throw new Error(`Invalid student data: Last Name and First Name are required`);
          }
        } else if (student.fullName) {
          // Old format (for CSV compatibility) - will be parsed in bulkAddStudents
          const nameParts = student.fullName.trim().split(/\s+/);
          if (nameParts.length < 2) {
            throw new Error(`Invalid full name: ${student.fullName}. Must have at least 2 words`);
          }
        } else {
          throw new Error('Each student must have either (lastName, firstName) or fullName');
        }
      }

      const result = await this.mongoService.bulkAddStudents(students);
      Logger.success(`✅ Bulk added ${result.insertedCount} students`);
      this.sendJson(res, 201, { 
        success: true, 
        message: `Successfully added ${result.insertedCount} students`,
        insertedCount: result.insertedCount
      });
      return true;
    } catch (error) {
      Logger.error('Bulk add students error:', error.message);
      this.sendJson(res, 400, { error: error.message || 'Failed to bulk add students' });
      return true;
    }
  }

  // ===== FACULTY HANDLERS =====

  async handleAddFaculty(req, res) {
    const auth = await this.checkSuperAdmin(req, res);
    if (!auth) return true;

    try {
      const body = await this.parseBody(req);
      const { fullName } = body;

      if (!fullName || !fullName.trim()) {
        this.sendJson(res, 400, { error: 'Full Name is required' });
        return true;
      }

      // Validate name has at least 2 words
      const nameParts = fullName.trim().split(/\s+/);
      if (nameParts.length < 2) {
        this.sendJson(res, 400, { error: 'Please provide full name (Last Name and First Name)' });
        return true;
      }

      await this.mongoService.addFaculty(fullName.trim());
      Logger.success(`✅ Faculty added: ${fullName}`);
      this.sendJson(res, 201, { success: true, message: 'Faculty added successfully' });
      return true;
    } catch (error) {
      Logger.error('Add faculty error:', error.message);
      this.sendJson(res, 400, { error: error.message || 'Failed to add faculty' });
      return true;
    }
  }

  async handleGetAllFaculty(req, res, url) {
    const auth = await this.checkSuperAdmin(req, res);
    if (!auth) return true;

    try {
      const { limit, skip } = this.parseQueryParams(req.url);
      const faculty = await this.mongoService.getAllFaculty(limit, skip);
      this.sendJson(res, 200, { success: true, count: faculty.length, faculty });
      return true;
    } catch (error) {
      Logger.error('Get faculty error:', error.message);
      this.sendJson(res, 500, { error: error.message || 'Failed to get faculty' });
      return true;
    }
  }

  async handleDeleteFaculty(req, res, url) {
    const auth = await this.checkSuperAdmin(req, res);
    if (!auth) return true;

    try {
      const facultyId = this.extractFacultyId(url);
      if (!facultyId) {
        this.sendJson(res, 400, { error: 'Faculty ID is required' });
        return true;
      }

      await this.mongoService.deleteFaculty(facultyId);
      Logger.success(`✅ Faculty deleted: ${facultyId}`);
      this.sendJson(res, 200, { success: true, message: 'Faculty deleted successfully' });
      return true;
    } catch (error) {
      Logger.error('Delete faculty error:', error.message);
      this.sendJson(res, 400, { error: error.message || 'Failed to delete faculty' });
      return true;
    }
  }

  async handleDeleteAllFaculty(req, res) {
    const auth = await this.checkSuperAdmin(req, res);
    if (!auth) return true;

    try {
      const result = await this.mongoService.deleteAllFaculty();
      Logger.success(`✅ Deleted all faculty: ${result.deletedCount} deleted`);
      this.sendJson(res, 200, { 
        success: true, 
        message: `Successfully deleted ${result.deletedCount} faculty`,
        deletedCount: result.deletedCount
      });
      return true;
    } catch (error) {
      Logger.error('Delete all faculty error:', error.message);
      this.sendJson(res, 400, { error: error.message || 'Failed to delete all faculty' });
      return true;
    }
  }

  async handleBulkAddFaculty(req, res) {
    const auth = await this.checkSuperAdmin(req, res);
    if (!auth) return true;

    try {
      const body = await this.parseBody(req);
      const { faculty } = body;

      if (!Array.isArray(faculty) || faculty.length === 0) {
        this.sendJson(res, 400, { error: 'Faculty array is required and must not be empty' });
        return true;
      }

      // Validate each faculty
      for (const f of faculty) {
        if (!f.fullName || !f.fullName.trim()) {
          throw new Error('Each faculty must have fullName');
        }
        const nameParts = f.fullName.trim().split(/\s+/);
        if (nameParts.length < 2) {
          throw new Error(`Invalid full name: ${f.fullName}. Must have at least 2 words`);
        }
      }

      const result = await this.mongoService.bulkAddFaculty(faculty);
      Logger.success(`✅ Bulk added ${result.insertedCount} faculty`);
      this.sendJson(res, 201, { 
        success: true, 
        message: `Successfully added ${result.insertedCount} faculty`,
        insertedCount: result.insertedCount
      });
      return true;
    } catch (error) {
      Logger.error('Bulk add faculty error:', error.message);
      this.sendJson(res, 400, { error: error.message || 'Failed to bulk add faculty' });
      return true;
    }
  }
}

// Singleton instance
let verifiedUserServiceInstance = null;

export function getVerifiedUserService(mongoService, authService) {
  if (!verifiedUserServiceInstance) {
    verifiedUserServiceInstance = new VerifiedUserService(mongoService, authService);
  }
  return verifiedUserServiceInstance;
}

