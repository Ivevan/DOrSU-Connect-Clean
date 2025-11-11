import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Logger } from '../utils/logger.js';

/**
 * Authentication Service
 * Handles user registration, login, and JWT token management
 */
export class AuthService {
  constructor(mongoService) {
    this.mongoService = mongoService;
    this.JWT_SECRET = process.env.JWT_SECRET || 'dorsu-connect-secret-key-change-in-production';
    this.JWT_EXPIRES_IN = '7d'; // Token valid for 7 days
  }

  /**
   * Register a new user
   */
  async register(username, email, password) {
    try {
      // Check if user already exists
      const existingUser = await this.mongoService.findUser(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user object
      const user = {
        username,
        email: email.toLowerCase(),
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };

      // Save to database
      const savedUser = await this.mongoService.createUser(user);

      // Generate JWT token
      const token = this.generateToken(savedUser);

      Logger.success(`✅ User registered: ${email}`);

      return {
        success: true,
        user: {
          id: savedUser._id || savedUser.id,
          username: savedUser.username,
          email: savedUser.email,
          createdAt: savedUser.createdAt,
        },
        token,
      };
    } catch (error) {
      Logger.error('Registration error:', error.message);
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(email, password) {
    try {
      // Find user
      const user = await this.mongoService.findUser(email.toLowerCase());
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new Error('Account has been deactivated');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Update last login
      await this.mongoService.updateUserLastLogin(user.email);

      // Generate JWT token
      const token = this.generateToken(user);

      Logger.success(`✅ User logged in: ${email}`);

      return {
        success: true,
        user: {
          id: user._id || user.id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt,
        },
        token,
      };
    } catch (error) {
      Logger.error('Login error:', error.message);
      throw error;
    }
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET);
      return { valid: true, userId: decoded.userId, email: decoded.email };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Generate JWT token
   */
  generateToken(user) {
    const payload = {
      userId: user._id || user.id,
      email: user.email,
      username: user.username,
    };

    return jwt.sign(payload, this.JWT_SECRET, { expiresIn: this.JWT_EXPIRES_IN });
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    try {
      const user = await this.mongoService.findUserById(userId);
      if (!user) {
        return null;
      }

      return {
        id: user._id || user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        isActive: user.isActive,
      };
    } catch (error) {
      Logger.error('Get user error:', error.message);
      return null;
    }
  }
}

/**
 * Authentication Middleware
 * Protects routes by verifying JWT token
 */
export function authMiddleware(authService, mongoService = null) {
  return async (req) => {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
      return { authenticated: false, error: 'No authorization header' };
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;

    // First try backend JWT verification
    const verification = authService.verifyToken(token);
    if (verification.valid) {
      return { authenticated: true, userId: verification.userId, email: verification.email };
    }

    // Fallback: accept Firebase ID token directly (mainly for web) if JWT not present
    try {
      const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        return { authenticated: false, error: 'Invalid token' };
      }
      const info = await res.json();

      // Enforce audience check if configured
      const expectedAud = process.env.GOOGLE_WEB_CLIENT_ID;
      if (expectedAud && info.aud && info.aud !== expectedAud) {
        return { authenticated: false, error: 'Invalid token audience' };
      }

      const email = (info.email || '').toLowerCase();
      if (!email) {
        return { authenticated: false, error: 'Invalid token' };
      }

      // Ensure user exists if we have access to mongoService
      let userId = null;
      if (mongoService) {
        let user = await mongoService.findUser(email);
        if (!user) {
          user = await mongoService.createUser({
            username: info.name || email.split('@')[0],
            email,
            password: '',
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true,
            provider: 'google',
            googleSub: info.sub
          });
        }
        userId = user._id || user.id;
      }

      return { authenticated: true, userId, email };
    } catch {
      return { authenticated: false, error: 'Invalid token' };
    }
  };
}
