/**
 * Email Service
 * Handles email sending via Resend (preferred) or Nodemailer (SMTP fallback)
 * Resend is recommended for cloud providers as it's more reliable
 */

import { Logger } from '../utils/logger.js';

export class EmailService {
  constructor() {
    // Resend configuration (preferred)
    this.resendApiKey = process.env.RESEND_API_KEY;
    this.resendFromEmail = process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM_EMAIL || 'onboarding@resend.dev';
    
    // SMTP configuration (fallback)
    this.smtpHost = process.env.SMTP_HOST;
    this.smtpPort = process.env.SMTP_PORT || 587;
    this.smtpUser = process.env.SMTP_USER;
    this.smtpPassword = process.env.SMTP_PASSWORD;
    this.smtpFromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@dorsu.edu.ph';
    
    // Check which service is configured
    this.isResendConfigured = !!this.resendApiKey;
    this.isSmtpConfigured = !!(this.smtpHost && this.smtpUser && this.smtpPassword);
    this.isConfigured = this.isResendConfigured || this.isSmtpConfigured;
  }

  /**
   * Check if email service is configured
   */
  isEmailConfigured() {
    return this.isConfigured;
  }

  /**
   * Send email via Resend API (preferred method)
   */
  async sendEmailViaResend({ to, subject, html, text = null }) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(this.resendApiKey);

      Logger.info(`📤 Sending email via Resend to: ${to}`);
      
      const emailData = {
        from: this.resendFromEmail,
        to: [to],
        subject: subject,
        html: html,
        ...(text && { text: text }),
      };

      const { data, error } = await resend.emails.send(emailData);

      if (error) {
        throw new Error(`Resend API error: ${error.message}`);
      }

      Logger.success(`✅ Email sent via Resend to: ${to} (Message ID: ${data?.id || 'N/A'})`);
      return { sent: true, messageId: data?.id, method: 'resend' };
      
    } catch (error) {
      Logger.error(`❌ Resend email failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create Nodemailer transporter with optimized settings
   */
  async createTransporter(port = null) {
    const nodemailerModule = await import('nodemailer');
    const nodemailer = nodemailerModule.default || nodemailerModule;

    const usePort = port || parseInt(this.smtpPort, 10);
    const isSecure = usePort === 465;

    // Validate port number
    if (isNaN(usePort) || usePort < 1 || usePort > 65535) {
      throw new Error(`Invalid SMTP_PORT: ${usePort}. Must be a number between 1 and 65535.`);
    }

    return nodemailer.createTransport({
      host: this.smtpHost,
      port: usePort,
      secure: isSecure, // true for 465 (SSL), false for 587 (STARTTLS)
      auth: {
        user: this.smtpUser,
        pass: this.smtpPassword,
      },
      // TLS/SSL configuration optimized for cloud providers
      tls: {
        rejectUnauthorized: false, // Needed for cloud providers
        minVersion: 'TLSv1',
      },
      // Connection settings
      requireTLS: !isSecure, // Only require TLS for port 587
      connectionTimeout: 30000, // 30 seconds (increased for cloud providers)
      greetingTimeout: 30000,
      socketTimeout: 30000,
      // Disable pooling for better reliability
      pool: false,
      maxConnections: 1,
      maxMessages: 1,
    });
  }

  /**
   * Send email via SMTP (Nodemailer) - fallback method
   */
  async sendEmailViaSMTP({ to, subject, html, text = null }) {
    if (!this.isSmtpConfigured) {
      throw new Error('SMTP not configured');
    }

    const configuredPort = parseInt(this.smtpPort, 10);
    
    // For Gmail on cloud providers, try both ports regardless of configuration
    // Gmail often blocks cloud provider IPs, so we need to try both
    let portsToTry;
    if (this.smtpHost === 'smtp.gmail.com') {
      // For Gmail, always try both ports (465 first, then 587)
      portsToTry = [465, 587];
      Logger.info(`📧 Gmail detected - will try both ports: ${portsToTry.join(', ')}`);
    } else if (configuredPort === 587) {
      // For other providers with port 587, try 465 first
      portsToTry = [465, 587];
    } else {
      // Use configured port, but also try alternative
      portsToTry = configuredPort === 465 ? [465, 587] : [configuredPort, 587];
    }
    
    Logger.info(`📧 Will try ports in order: ${portsToTry.join(', ')}`);
    Logger.info(`📤 Sending email to: ${to}`);

    const emailData = {
      from: `"DOrSU Connect" <${this.smtpFromEmail}>`,
      to: to,
      subject: subject,
      html: html,
      ...(text && { text: text }),
    };

    let lastError;
    const maxRetries = 2; // Retry each port up to 2 times
    
    // Try each port configuration with retries
    for (const port of portsToTry) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const isSecure = port === 465;
          if (attempt > 1) {
            Logger.info(`🔄 Retry attempt ${attempt}/${maxRetries} on port ${port}...`);
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          } else {
            Logger.info(`🔌 Attempting connection on port ${port} (${isSecure ? 'SSL' : 'STARTTLS'})...`);
          }
          
          const transporter = await this.createTransporter(port);
          const info = await transporter.sendMail(emailData);
          
          Logger.success(`✅ Email sent via Nodemailer (port ${port}) to: ${to} (Message ID: ${info.messageId})`);
          if (port === 465 && configuredPort !== 465) {
            Logger.info('💡 Tip: Port 465 worked! Consider setting SMTP_PORT=465 for better reliability');
          }
          
          return { sent: true, messageId: info.messageId, port: port };
          
        } catch (portError) {
          lastError = portError;
          const errorCode = portError.code || 'N/A';
          Logger.warn(`⚠️ Port ${port} attempt ${attempt} failed: ${portError.message} (${errorCode})`);
          
          // If it's a timeout and we have more retries, continue
          if (errorCode === 'ETIMEDOUT' && attempt < maxRetries) {
            continue;
          }
          
          // If this is not the last port to try, break inner loop and try next port
          if (port !== portsToTry[portsToTry.length - 1]) {
            Logger.info(`🔄 Trying next port...`);
            break; // Break retry loop, continue to next port
          }
          
          // If this is the last port and last attempt, we're done
          if (attempt === maxRetries && port === portsToTry[portsToTry.length - 1]) {
            break; // Exit both loops
          }
        }
      }
    }
    
    // All ports and retries failed
    Logger.error(`❌ Failed to send email via SMTP after trying all ports (${portsToTry.join(', ')}) with ${maxRetries} retries each`);
    throw new Error(`Failed to send email via SMTP: ${lastError.message} (Code: ${lastError.code || 'N/A'})`);
  }

  /**
   * Send email - tries Resend first, falls back to SMTP
   */
  async sendEmail({ to, subject, html, text = null }) {
    if (!this.isConfigured) {
      Logger.warn('⚠️ Email service not configured (neither Resend nor SMTP), skipping email send');
      return { sent: false, message: 'Email service not configured' };
    }

    // Try Resend first (preferred for cloud providers)
    if (this.isResendConfigured) {
      try {
        Logger.info('📧 Using Resend (preferred method for cloud providers)');
        return await this.sendEmailViaResend({ to, subject, html, text });
      } catch (resendError) {
        Logger.warn(`⚠️ Resend failed: ${resendError.message}`);
        
        // If SMTP is also configured, try fallback
        if (this.isSmtpConfigured) {
          Logger.info('🔄 Falling back to SMTP (Nodemailer)...');
          try {
            return await this.sendEmailViaSMTP({ to, subject, html, text });
          } catch (smtpError) {
            Logger.error('❌ Both Resend and SMTP failed');
            throw new Error(`Email sending failed. Resend: ${resendError.message}, SMTP: ${smtpError.message}`);
          }
        } else {
          // Only Resend configured, but it failed
          throw resendError;
        }
      }
    }
    
    // Only SMTP configured, use it directly
    if (this.isSmtpConfigured) {
      Logger.info('📧 Using SMTP (Nodemailer)');
      return await this.sendEmailViaSMTP({ to, subject, html, text });
    }
    
    // Should not reach here, but just in case
    throw new Error('No email service configured');
  }

  /**
   * Send password reset OTP email
   */
  async sendPasswordResetOTP(email, otp) {
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

    try {
      Logger.info(`📧 Email service check - Resend: ${this.isResendConfigured ? '✅' : '❌'}, SMTP: ${this.isSmtpConfigured ? '✅' : '❌'}`);
      return await this.sendEmail({
        to: email,
        subject: 'Password Reset OTP - DOrSU Connect',
        html: html,
      });
    } catch (error) {
      Logger.error('Failed to send password reset OTP email:', error.message);
      throw error;
    }
  }

  /**
   * Log OTP to console for development/testing
   */
  logOTPForTesting(email, otp, expiresInMinutes = 10) {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 PASSWORD RESET OTP (FOR TESTING)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email: ${email}`);
    console.log(`OTP Code: ${otp}`);
    console.log(`Expires in: ${expiresInMinutes} minutes`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
    Logger.info('');
    Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.info('📧 PASSWORD RESET OTP (FOR TESTING)');
    Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.info(`Email: ${email}`);
    Logger.info(`OTP Code: ${otp}`);
    Logger.info(`Expires in: ${expiresInMinutes} minutes`);
    Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.info('');
  }
}

// Export singleton instance
let emailServiceInstance = null;

export function getEmailService() {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService();
  }
  return emailServiceInstance;
}

