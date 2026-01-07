/**
 * Email Service
 * Handles email sending via Nodemailer (SMTP)
 * Supports multiple SMTP providers and automatic port fallback
 */

import { Logger } from '../utils/logger.js';

export class EmailService {
  constructor() {
    this.smtpHost = process.env.SMTP_HOST;
    this.smtpPort = process.env.SMTP_PORT || 587;
    this.smtpUser = process.env.SMTP_USER;
    this.smtpPassword = process.env.SMTP_PASSWORD;
    this.fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@dorsu.edu.ph';
    this.isConfigured = !!(this.smtpHost && this.smtpUser && this.smtpPassword);
  }

  /**
   * Check if email service is configured
   */
  isEmailConfigured() {
    return this.isConfigured;
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
      connectionTimeout: 20000, // 20 seconds
      greetingTimeout: 20000,
      socketTimeout: 20000,
      // Disable pooling for better reliability
      pool: false,
      maxConnections: 1,
      maxMessages: 1,
    });
  }

  /**
   * Send email with automatic port fallback
   * Tries port 465 first if configured port is 587 (better for cloud providers)
   */
  async sendEmail({ to, subject, html, text = null }) {
    if (!this.isConfigured) {
      Logger.warn('⚠️ SMTP not configured, skipping email send');
      return { sent: false, message: 'SMTP not configured' };
    }

    const configuredPort = parseInt(this.smtpPort, 10);
    
    // If port 587 is configured, try 465 first (more reliable from cloud providers)
    // Otherwise, use the configured port
    const portsToTry = configuredPort === 587 ? [465, 587] : [configuredPort];
    
    Logger.info(`📧 Will try ports in order: ${portsToTry.join(', ')} (port 465 is more reliable from cloud providers)`);
    Logger.info(`📤 Sending email to: ${to}`);

    const emailData = {
      from: `"DOrSU Connect" <${this.fromEmail}>`,
      to: to,
      subject: subject,
      html: html,
      ...(text && { text: text }),
    };

    let lastError;
    
    // Try each port configuration
    for (const port of portsToTry) {
      try {
        const isSecure = port === 465;
        Logger.info(`🔌 Attempting connection on port ${port} (${isSecure ? 'SSL' : 'STARTTLS'})...`);
        
        const transporter = await this.createTransporter(port);
        const info = await transporter.sendMail(emailData);
        
        Logger.success(`✅ Email sent via Nodemailer (port ${port}) to: ${to} (Message ID: ${info.messageId})`);
        if (port === 465 && configuredPort !== 465) {
          Logger.info('💡 Tip: Port 465 worked! Consider setting SMTP_PORT=465 for better reliability');
        }
        
        return { sent: true, messageId: info.messageId, port: port };
        
      } catch (portError) {
        lastError = portError;
        Logger.warn(`⚠️ Port ${port} failed: ${portError.message} (${portError.code || 'N/A'})`);
        
        // If this is not the last port to try, continue to next port
        if (port !== portsToTry[portsToTry.length - 1]) {
          Logger.info(`🔄 Trying next port...`);
          continue;
        }
      }
    }
    
    // All ports failed, throw the last error
    throw new Error(`Failed to send email after trying all ports: ${lastError.message}`);
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

