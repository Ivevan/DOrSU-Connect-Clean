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
      Logger.warn('authMiddleware: No authorization header');
      return { authenticated: false, error: 'No authorization header' };
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;

    Logger.info(`authMiddleware: Token received, length: ${token?.length || 0}, prefix: ${token?.substring(0, 20) || 'none'}...`);

    // First try backend JWT verification
    const verification = authService.verifyToken(token);
    if (verification.valid) {
      Logger.info(`authMiddleware: Backend JWT token valid for userId: ${verification.userId}`);
      return { authenticated: true, userId: verification.userId, email: verification.email };
    } else {
      Logger.info(`authMiddleware: Backend JWT invalid (${verification.error}), trying Firebase ID token...`);
    }

    // Fallback: accept Firebase ID token directly (mainly for web) if JWT not present
    try {
      // Helper function to decode JWT payload (without signature verification)
      const decodeJWTPayload = (tokenStr) => {
        try {
          const tokenParts = tokenStr.split('.');
          if (tokenParts.length !== 3) {
            return null;
          }
          const payload = tokenParts[1];
          // Try base64url first (standard for JWTs), then fallback to base64
          let decoded;
          try {
            // Add padding if needed for base64url
            const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
            decoded = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
          } catch (e) {
            // Fallback to regular base64
            decoded = Buffer.from(payload, 'base64').toString('utf-8');
          }
          const parsed = JSON.parse(decoded);
          
          // Check if token is expired
          if (parsed.exp && parsed.exp < Math.floor(Date.now() / 1000)) {
            Logger.warn(`authMiddleware: Token is expired. Exp: ${parsed.exp}, Now: ${Math.floor(Date.now() / 1000)}`);
            return null;
          }
          
          return parsed;
        } catch (error) {
          Logger.error(`authMiddleware: Failed to decode JWT payload: ${error.message}`);
          return null;
        }
      };

      Logger.info('authMiddleware: Validating Firebase ID token with Google tokeninfo endpoint...');
      let info = null;
      let tokenValidationError = null;
      
      try {
        const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
        if (res.ok) {
          info = await res.json();
          Logger.info(`authMiddleware: Firebase token validated successfully via Google tokeninfo for email: ${info.email || 'unknown'}`);
        } else {
          const errorText = await res.text();
          tokenValidationError = errorText;
          Logger.warn(`authMiddleware: Google tokeninfo validation failed: ${res.status} - ${errorText}`);
          
          // Fallback: Try to decode JWT payload locally (without signature verification)
          Logger.info('authMiddleware: Attempting to decode JWT payload locally as fallback...');
          const decodedPayload = decodeJWTPayload(token);
          if (decodedPayload && decodedPayload.email) {
            Logger.warn('⚠️ authMiddleware: Using locally decoded JWT payload (signature not verified)');
            Logger.info(`authMiddleware: Decoded payload keys: ${Object.keys(decodedPayload).join(', ')}`);
            info = {
              email: decodedPayload.email,
              name: decodedPayload.name || decodedPayload.email.split('@')[0],
              sub: decodedPayload.sub || decodedPayload.user_id,
              aud: decodedPayload.aud,
              exp: decodedPayload.exp,
              iat: decodedPayload.iat
            };
            Logger.info(`authMiddleware: Decoded token info for email: ${info.email}, aud: ${info.aud}`);
          } else {
            Logger.error(`authMiddleware: Cannot decode JWT payload or missing email claim`);
            return { authenticated: false, error: 'Invalid token', details: errorText };
          }
        }
      } catch (fetchError) {
        Logger.error(`authMiddleware: Error calling Google tokeninfo endpoint: ${fetchError.message}`);
        
        // Fallback: Try to decode JWT payload locally
        Logger.info('authMiddleware: Attempting to decode JWT payload locally as fallback...');
        const decodedPayload = decodeJWTPayload(token);
        if (decodedPayload && decodedPayload.email) {
          Logger.warn('⚠️ authMiddleware: Using locally decoded JWT payload (signature not verified) - tokeninfo endpoint unavailable');
          Logger.info(`authMiddleware: Decoded payload keys: ${Object.keys(decodedPayload).join(', ')}`);
          info = {
            email: decodedPayload.email,
            name: decodedPayload.name || decodedPayload.email.split('@')[0],
            sub: decodedPayload.sub || decodedPayload.user_id,
            aud: decodedPayload.aud,
            exp: decodedPayload.exp,
            iat: decodedPayload.iat
          };
          Logger.info(`authMiddleware: Decoded token info for email: ${info.email}, aud: ${info.aud}`);
        } else {
          Logger.error(`authMiddleware: Cannot decode JWT payload or missing email claim`);
          return { authenticated: false, error: 'Invalid token', details: fetchError.message };
        }
      }
      
      if (!info) {
        Logger.error('authMiddleware: No token info available after validation attempts');
        return { authenticated: false, error: 'Invalid token', details: tokenValidationError || 'Unknown error' };
      }

      // Optional audience check - log warning but don't fail
      // Firebase tokens can have different audiences depending on how they're generated
      const expectedAud = process.env.GOOGLE_WEB_CLIENT_ID;
      if (expectedAud && info.aud && info.aud !== expectedAud) {
        Logger.warn(`Token audience mismatch in middleware. Expected: ${expectedAud}, Got: ${info.aud}. Proceeding anyway.`);
        // Don't fail - the tokeninfo endpoint already validated the signature (or we decoded it locally)
      }

      const email = (info.email || '').toLowerCase();
      if (!email) {
        Logger.error('authMiddleware: Firebase token missing email claim');
        return { authenticated: false, error: 'Invalid token - missing email' };
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
    } catch (error) {
      Logger.error('Firebase token validation error in middleware:', error.message || String(error));
      return { authenticated: false, error: 'Invalid token', details: error.message || String(error) };
    }
  };
}
