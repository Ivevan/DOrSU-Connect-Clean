/**
 * Password Reset Service
 * Handles OTP generation, verification, and password reset
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Logger } from '../utils/logger.js';
import { getEmailService } from './email-service.js';

export class PasswordResetService {
  constructor(mongoService) {
    this.mongoService = mongoService;
    this.emailService = getEmailService();
    this.JWT_SECRET = process.env.JWT_SECRET || 'dorsu-connect-secret-key-change-in-production';
    this.OTP_EXPIRY_MINUTES = 10; // OTP valid for 10 minutes
    this.MAX_OTP_ATTEMPTS = 5; // Max verification attempts
    this.RATE_LIMIT_MINUTES = 15; // Rate limit window (15 minutes between requests)
  }

  /**
   * Generate 6-digit OTP
   */
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Request password reset OTP
   */
  async requestPasswordResetOTP(email) {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const isDevMode = process.env.NODE_ENV !== 'production' || process.env.DEV_MODE === 'true';
      
      // Check if user exists in MongoDB
      const user = await this.mongoService.findUser(normalizedEmail);
      if (!user) {
        // In dev mode, still generate OTP for testing
        if (isDevMode) {
          Logger.warn(`⚠️ DEV MODE: User not found, but generating OTP for testing: ${normalizedEmail}`);
        } else {
          // Don't reveal if user exists for security
          Logger.info(`Password reset requested for non-existent email: ${normalizedEmail}`);
          return { 
            success: true, 
            message: 'If an account exists, an OTP has been sent to your email.' 
          };
        }
      }

      // Rate limiting disabled for development/testing
      // Uncomment below to enable rate limiting in production
      /*
      const recentOTP = await this.mongoService.getLatestPasswordResetOTP(normalizedEmail);
      if (recentOTP) {
        const timeSinceLastRequest = Date.now() - recentOTP.createdAt.getTime();
        const rateLimitWindow = this.RATE_LIMIT_MINUTES * 60 * 1000;
        
        if (timeSinceLastRequest < rateLimitWindow) {
          const minutesLeft = Math.ceil((rateLimitWindow - timeSinceLastRequest) / 60000);
          throw new Error(`Please wait ${minutesLeft} minute(s) before requesting another OTP.`);
        }
      }
      */

      // Generate OTP
      const otp = this.generateOTP();
      const hashedOTP = await bcrypt.hash(otp, 10);
      const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

      // Store OTP in MongoDB
      await this.mongoService.createPasswordResetOTP(normalizedEmail, hashedOTP, expiresAt);

      // Send email with OTP via Resend
      // Catch email errors separately - we still want to return success even if email fails
      // (for security, we don't want to reveal if email sending failed)
      try {
        await this.sendOTPEmail(normalizedEmail, otp);
      } catch (emailError) {
        // Log email error but don't fail the request
        // The OTP is still stored in DB and can be verified
        Logger.error('Email sending failed, but OTP was generated:', emailError.message);
        // Still log OTP for debugging in case email fails
        Logger.warn(`⚠️ OTP generated but email failed: ${otp} (for ${normalizedEmail})`);
      }

      // Log OTP prominently in console for testing (always log when email not configured)
      const smtpHost = process.env.SMTP_HOST;
      const smtpUser = process.env.SMTP_USER;
      const smtpPassword = process.env.SMTP_PASSWORD;
      const isSmtpConfigured = smtpHost && smtpUser && smtpPassword;
      
      if (!isSmtpConfigured || isDevMode) {
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📧 PASSWORD RESET OTP (FOR TESTING)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Email: ${normalizedEmail}`);
        console.log(`OTP Code: ${otp}`);
        console.log(`Expires in: ${this.OTP_EXPIRY_MINUTES} minutes`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        
        // Also log via Logger for consistency
        Logger.info('');
        Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        Logger.info('📧 PASSWORD RESET OTP (FOR TESTING)');
        Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        Logger.info(`Email: ${normalizedEmail}`);
        Logger.info(`OTP Code: ${otp}`);
        Logger.info(`Expires in: ${this.OTP_EXPIRY_MINUTES} minutes`);
        Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        Logger.info('');
      }

      Logger.success(`✅ Password reset OTP sent to: ${normalizedEmail}`);
      
      return { 
        success: true, 
        message: 'OTP has been sent to your email. It will expire in 10 minutes.' 
      };
    } catch (error) {
      Logger.error('Request password reset OTP error:', error.message);
      throw error;
    }
  }

  /**
   * Send OTP email via EmailService
   */
  async sendOTPEmail(email, otp) {
    try {
      // Log email service configuration status (for debugging)
      const isConfigured = this.emailService.isEmailConfigured();
      Logger.info(`📧 Email Service Config Check: ${isConfigured ? '✅ Configured' : '❌ Not configured'}`);
      
      // If email service is not configured, log OTP for development
      if (!isConfigured) {
        Logger.warn('⚠️ Email service not configured, skipping email send');
        Logger.info(`📧 OTP for ${email}: ${otp} (Email sending not configured - add RESEND_API_KEY to .env)`);
        
        // Log OTP prominently for testing
        this.emailService.logOTPForTesting(email, otp, this.OTP_EXPIRY_MINUTES);
        return;
      }

      // Use EmailService to send the OTP email
      await this.emailService.sendPasswordResetOTP(email, otp);
      
    } catch (error) {
      // Log detailed error information
      Logger.error('❌ Failed to send OTP email');
      Logger.error(`   Error: ${error.message}`);
      Logger.error(`   Code: ${error.code || 'N/A'}`);
      Logger.error(`   Command: ${error.command || 'N/A'}`);
      Logger.error(`   Response: ${error.response || 'N/A'}`);
      Logger.error(`   Stack: ${error.stack || 'N/A'}`);
      
      // Log full error object for debugging
      console.error('Full error object:', error);
      
      // Re-throw error so it can be caught and logged by the calling function
      // This ensures errors appear in Render logs
      throw new Error(`Failed to send OTP email: ${error.message}`);
    }
  }

  /**
   * Verify OTP and return temporary reset token
   */
  async verifyOTP(email, otp) {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      
      // Get latest OTP for this email
      const otpRecord = await this.mongoService.getLatestPasswordResetOTP(normalizedEmail);
      
      if (!otpRecord) {
        throw new Error('Invalid or expired OTP. Please request a new one.');
      }

      // Check if OTP is expired
      if (new Date() > otpRecord.expiresAt) {
        throw new Error('OTP has expired. Please request a new one.');
      }

      // Check if OTP is already used
      if (otpRecord.used) {
        throw new Error('This OTP has already been used. Please request a new one.');
      }

      // Check attempt limit
      if (otpRecord.attempts >= this.MAX_OTP_ATTEMPTS) {
        throw new Error('Too many failed attempts. Please request a new OTP.');
      }

      // Verify OTP
      const isValid = await bcrypt.compare(otp, otpRecord.hashedOTP);
      
      if (!isValid) {
        // Increment attempts
        await this.mongoService.incrementOTPAttempts(otpRecord._id);
        throw new Error('Invalid OTP. Please check and try again.');
      }

      // Mark OTP as used
      await this.mongoService.markOTPAsUsed(otpRecord._id);

      // Generate temporary reset token (valid for 15 minutes)
      const resetToken = jwt.sign(
        { 
          email: normalizedEmail, 
          type: 'password-reset',
          iat: Math.floor(Date.now() / 1000)
        },
        this.JWT_SECRET,
        { expiresIn: '15m' }
      );

      Logger.success(`✅ OTP verified for: ${normalizedEmail}`);
      
      return { 
        success: true, 
        resetToken,
        message: 'OTP verified successfully. You can now reset your password.' 
      };
    } catch (error) {
      Logger.error('Verify OTP error:', error.message);
      throw error;
    }
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(resetToken, newPassword) {
    try {
      // Verify token
      let decoded;
      try {
        decoded = jwt.verify(resetToken, this.JWT_SECRET);
      } catch (error) {
        throw new Error('Invalid or expired reset token. Please request a new OTP.');
      }

      if (decoded.type !== 'password-reset') {
        throw new Error('Invalid token type.');
      }

      const email = decoded.email;

      // Validate password
      if (!newPassword || newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters long.');
      }

      // Reset password in Firebase (using Firebase Admin SDK)
      const adminModule = await import('firebase-admin');
      const admin = adminModule.default || adminModule;
      
      // Initialize Firebase Admin if not already done
      if (!admin.apps.length) {
        try {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
          if (!serviceAccount.project_id) {
            throw new Error('Firebase service account not configured');
          }
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });
          Logger.info('✅ Firebase Admin initialized');
        } catch (error) {
          Logger.error('Failed to initialize Firebase Admin:', error.message);
          throw new Error('Firebase Admin not configured. Please set FIREBASE_SERVICE_ACCOUNT environment variable.');
        }
      }

      // Get user by email from Firebase
      const auth = admin.auth();
      let firebaseUser;
      try {
        firebaseUser = await auth.getUserByEmail(email);
      } catch (error) {
        Logger.error('Firebase user lookup error:', error.message);
        throw new Error('User not found in Firebase.');
      }

      // Update password in Firebase
      await auth.updateUser(firebaseUser.uid, {
        password: newPassword
      });

      Logger.success(`✅ Password updated in Firebase for: ${email}`);

      // Also update password in MongoDB if user has one stored
      const user = await this.mongoService.findUser(email);
      if (user && user._id) {
        try {
          const hashedPassword = await bcrypt.hash(newPassword, 10);
          await this.mongoService.updateUserPassword(user._id.toString(), hashedPassword);
          Logger.success(`✅ Password updated in MongoDB for: ${email}`);
        } catch (error) {
          Logger.warn('Failed to update password in MongoDB (non-critical):', error.message);
          // Non-critical - Firebase password is the source of truth
        }
      }

      // Invalidate all OTPs for this email
      await this.mongoService.invalidateAllOTPsForEmail(email);

      Logger.success(`✅ Password reset successful for: ${email}`);
      
      return { 
        success: true, 
        message: 'Password has been reset successfully.' 
      };
    } catch (error) {
      Logger.error('Reset password error:', error.message);
      throw error;
    }
  }
}

