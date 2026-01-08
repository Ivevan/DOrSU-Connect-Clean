/**
 * Email Service
 * Handles email sending via Resend API
 * Uses HTTPS instead of SMTP for reliable cloud provider support
 */

import { Logger } from '../utils/logger.js';

export class EmailService {
  constructor() {
    // Resend configuration
    this.resendApiKey = process.env.RESEND_API_KEY;
    // Use custom from email if provided (requires domain verification), otherwise use default
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    this.isConfigured = !!this.resendApiKey;
    
    // Warn if using testing domain (has limitations)
    if (this.fromEmail.includes('@resend.dev')) {
      Logger.warn('⚠️ Using Resend testing domain (onboarding@resend.dev) - can only send to account owner email');
      Logger.info('💡 To send to any email, verify a domain in Resend and set RESEND_FROM_EMAIL to your verified domain email');
    }
  }

  /**
   * Check if email service is configured
   */
  isEmailConfigured() {
    return this.isConfigured;
  }

  /**
   * Send email via Resend API
   */
  async sendEmail({ to, subject, html, text = null }) {
    if (!this.isConfigured) {
      Logger.warn('⚠️ Resend API key not configured, skipping email send');
      return { sent: false, message: 'Resend API key not configured' };
    }

    try {
      const { Resend } = await import('resend');
      const resend = new Resend(this.resendApiKey);

      Logger.info(`📤 Sending email via Resend to: ${to}`);
      
      const emailData = {
        from: this.fromEmail,
        to: [to],
        subject: subject,
        html: html,
        ...(text && { text: text }),
      };

      const { data, error } = await resend.emails.send(emailData);

      if (error) {
        Logger.error(`❌ Resend API error: ${error.message}`);
        
        // Check for 403 Forbidden (testing domain restriction)
        const is403Error = error.message?.includes('403') || 
                          error.message?.includes('Forbidden') ||
                          error.message?.includes('Testing domain restriction') ||
                          (error.statusCode && error.statusCode === 403);
        
        if (is403Error) {
          const helpfulMessage = '❌ Resend 403 Error: The testing domain (onboarding@resend.dev) can ONLY send to your Resend account owner email. ' +
            'To send to ANY email address, you MUST verify a domain in Resend. ' +
            'Steps: 1) Go to https://resend.com/domains 2) Click "Add Domain" 3) Add DNS records (SPF/DKIM) 4) Wait for verification 5) Set RESEND_FROM_EMAIL=noreply@yourdomain.com in Render';
          Logger.error(`   ${helpfulMessage}`);
          throw new Error(`Resend 403 Forbidden: ${error.message}. ${helpfulMessage}`);
        }
        
        throw new Error(`Resend API error: ${error.message}`);
      }

      Logger.success(`✅ Email sent via Resend to: ${to} (Message ID: ${data?.id || 'N/A'})`);
      return { sent: true, messageId: data?.id, method: 'resend' };
      
    } catch (error) {
      Logger.error(`❌ Failed to send email via Resend: ${error.message}`);
      throw error;
    }
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
      Logger.info(`📧 Email service check - Resend: ${this.isConfigured ? '✅ Configured' : '❌ Not configured'}`);
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
