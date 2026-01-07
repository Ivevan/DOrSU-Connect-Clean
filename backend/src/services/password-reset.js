/**
 * Password Reset Service
 * Handles OTP generation, verification, and password reset
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Logger } from '../utils/logger.js';

export class PasswordResetService {
  constructor(mongoService) {
    this.mongoService = mongoService;
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
    const functionStartTime = Date.now();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/380b6d5b-f9a7-4af4-bbc0-60b8657f2a52',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'password-reset.js:29',message:'requestPasswordResetOTP entry',data:{email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const isDevMode = process.env.NODE_ENV !== 'production' || process.env.DEV_MODE === 'true';
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/380b6d5b-f9a7-4af4-bbc0-60b8657f2a52',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'password-reset.js:35',message:'before findUser',data:{normalizedEmail,timeElapsed:Date.now()-functionStartTime},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      // Check if user exists in MongoDB
      const user = await this.mongoService.findUser(normalizedEmail);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/380b6d5b-f9a7-4af4-bbc0-60b8657f2a52',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'password-reset.js:36',message:'after findUser',data:{userFound:!!user,timeElapsed:Date.now()-functionStartTime},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
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

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/380b6d5b-f9a7-4af4-bbc0-60b8657f2a52',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'password-reset.js:71',message:'before createPasswordResetOTP',data:{timeElapsed:Date.now()-functionStartTime},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      // Store OTP in MongoDB
      await this.mongoService.createPasswordResetOTP(normalizedEmail, hashedOTP, expiresAt);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/380b6d5b-f9a7-4af4-bbc0-60b8657f2a52',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'password-reset.js:72',message:'after createPasswordResetOTP, before sendOTPEmail',data:{timeElapsed:Date.now()-functionStartTime},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // Send email with OTP via Nodemailer
      // Catch email errors separately - we still want to return success even if email fails
      // (for security, we don't want to reveal if email sending failed)
      const emailStartTime = Date.now();
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/380b6d5b-f9a7-4af4-bbc0-60b8657f2a52',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'password-reset.js:77',message:'calling sendOTPEmail',data:{email:normalizedEmail,timeElapsed:Date.now()-functionStartTime},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        await this.sendOTPEmail(normalizedEmail, otp);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/380b6d5b-f9a7-4af4-bbc0-60b8657f2a52',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'password-reset.js:78',message:'sendOTPEmail completed',data:{emailTime:Date.now()-emailStartTime,totalTime:Date.now()-functionStartTime},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      } catch (emailError) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/380b6d5b-f9a7-4af4-bbc0-60b8657f2a52',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'password-reset.js:79',message:'sendOTPEmail error caught',data:{error:emailError.message,emailTime:Date.now()-emailStartTime,totalTime:Date.now()-functionStartTime},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
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
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/380b6d5b-f9a7-4af4-bbc0-60b8657f2a52',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'password-reset.js:115',message:'requestPasswordResetOTP returning success',data:{totalTime:Date.now()-functionStartTime},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return { 
        success: true, 
        message: 'OTP has been sent to your email. It will expire in 10 minutes.' 
      };
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/380b6d5b-f9a7-4af4-bbc0-60b8657f2a52',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'password-reset.js:122',message:'requestPasswordResetOTP error',data:{error:error.message,totalTime:Date.now()-functionStartTime},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      Logger.error('Request password reset OTP error:', error.message);
      throw error;
    }
  }

  /**
   * Send OTP email via Nodemailer (SMTP)
   */
  async sendOTPEmail(email, otp) {
    try {
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT || 587;
      const smtpUser = process.env.SMTP_USER;
      const smtpPassword = process.env.SMTP_PASSWORD;
      const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@dorsu.edu.ph';
      
      // Log SMTP configuration status (for debugging)
      Logger.info(`📧 SMTP Config Check - Host: ${smtpHost ? '✅' : '❌'}, User: ${smtpUser ? '✅' : '❌'}, Password: ${smtpPassword ? '✅' : '❌'}`);
      
      // If SMTP is not configured, log OTP for development
      if (!smtpHost || !smtpUser || !smtpPassword) {
        Logger.warn('⚠️ SMTP not configured, skipping email send');
        Logger.info(`📧 OTP for ${email}: ${otp} (Email sending not configured - add SMTP settings to .env)`);
        
        // Log OTP prominently for testing
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📧 PASSWORD RESET OTP (FOR TESTING)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Email: ${email}`);
        console.log(`OTP Code: ${otp}`);
        console.log(`Expires in: ${this.OTP_EXPIRY_MINUTES} minutes`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        return;
      }

      // Import nodemailer
      const nodemailerModule = await import('nodemailer');
      const nodemailer = nodemailerModule.default || nodemailerModule;

      // For Gmail on cloud providers (like Render), port 465 with SSL is more reliable
      // Try port 465 first if configured port is 587
      const configuredPort = parseInt(smtpPort, 10);
      
      // Validate port number
      if (isNaN(configuredPort) || configuredPort < 1 || configuredPort > 65535) {
        throw new Error(`Invalid SMTP_PORT: ${smtpPort}. Must be a number between 1 and 65535.`);
      }
      
      // If port 587 is configured, try 465 first (more reliable from cloud providers)
      // Otherwise, use the configured port
      const portsToTry = configuredPort === 587 ? [465, 587] : [configuredPort];
      
      Logger.info(`📧 Will try ports in order: ${portsToTry.join(', ')} (port 465 is more reliable from cloud providers)`);

      // Email template for password reset OTP
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563EB;">Password Reset Request</h2>
          <p>You have requested to reset your password for DOrSU Connect.</p>
          <p>Your OTP code is:</p>
          <div style="background-color: #F3F4F6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="color: #2563EB; font-size: 32px; letter-spacing: 8px; margin: 0;">${otp}</h1>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
          <p style="color: #6B7280; font-size: 12px;">DOrSU Connect - AI-Powered Academic Assistant</p>
        </div>
      `;

      // Try sending email with different port configurations
      Logger.info(`📤 Sending OTP email to: ${email}`);
      
      let lastError;
      const emailData = {
        from: `"DOrSU Connect" <${fromEmail}>`,
        to: email,
        subject: 'Password Reset OTP - DOrSU Connect',
        html: html,
      };

      // Try each port configuration
      for (const port of portsToTry) {
        try {
          const isSecure = port === 465;
          const portAttemptStart = Date.now();
          Logger.info(`🔌 Attempting connection on port ${port} (${isSecure ? 'SSL' : 'STARTTLS'})...`);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/380b6d5b-f9a7-4af4-bbc0-60b8657f2a52',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'password-reset.js:198',message:'attempting SMTP port',data:{port,isSecure},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          
          // Create transporter for this port
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: port,
            secure: isSecure, // true for 465 (SSL), false for 587 (STARTTLS)
            auth: {
              user: smtpUser,
              pass: smtpPassword,
            },
            // TLS/SSL configuration optimized for cloud providers
            tls: {
              rejectUnauthorized: false, // Needed for cloud providers
              minVersion: 'TLSv1',
            },
            // Connection settings
            requireTLS: !isSecure, // Only require TLS for port 587
            connectionTimeout: 20000, // 20 seconds
            greetingTimeout: 20000,
            socketTimeout: 20000,
            // Disable pooling for better reliability
            pool: false,
            maxConnections: 1,
            maxMessages: 1,
          });

          // Try to send email
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/380b6d5b-f9a7-4af4-bbc0-60b8657f2a52',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'password-reset.js:229',message:'before sendMail',data:{port,timeSincePortStart:Date.now()-portAttemptStart},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          const info = await transporter.sendMail(emailData);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/380b6d5b-f9a7-4af4-bbc0-60b8657f2a52',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'password-reset.js:230',message:'sendMail completed',data:{port,portTime:Date.now()-portAttemptStart,messageId:info.messageId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          
          Logger.success(`✅ Email sent via Nodemailer (port ${port}) to: ${email} (Message ID: ${info.messageId})`);
          if (port === 465 && configuredPort !== 465) {
            Logger.info('💡 Tip: Port 465 worked! Consider setting SMTP_PORT=465 in Render for better reliability');
          }
          return; // Success, exit function
          
        } catch (portError) {
          lastError = portError;
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/380b6d5b-f9a7-4af4-bbc0-60b8657f2a52',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'password-reset.js:237',message:'port sendMail failed',data:{port,error:portError.message,code:portError.code,portTime:Date.now()-portAttemptStart},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          Logger.warn(`⚠️ Port ${port} failed: ${portError.message} (${portError.code || 'N/A'})`);
          
          // If this is not the last port to try, continue to next port
          if (port !== portsToTry[portsToTry.length - 1]) {
            Logger.info(`🔄 Trying next port...`);
            continue;
          }
        }
      }
      
      // All ports failed, throw the last error
      throw lastError;
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

