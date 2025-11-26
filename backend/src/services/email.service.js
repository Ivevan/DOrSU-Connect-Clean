import nodemailer from 'nodemailer';
import { Logger } from '../utils/logger.js';

export class EmailService {
  constructor() {
    // Email provider configuration (priority: Resend > Brevo)
    this.provider = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase();
    
    // Resend configuration (Recommended - no phone verification needed)
    this.resendApiKey = process.env.RESEND_API_KEY;
    this.resendFromEmail = process.env.RESEND_FROM_EMAIL;
    
    // Brevo (formerly Sendinblue) configuration
    this.brevoSmtpKey = process.env.BREVO_SMTP_KEY;
    this.brevoSmtpUser = process.env.BREVO_SMTP_USER; // Your Brevo account email
    this.brevoFromEmail = process.env.BREVO_FROM_EMAIL;
    
    // Common settings
    this.appDeepLink =
      process.env.APP_DEEP_LINK_URL?.trim() || 'dorsuconnect://email-confirmation';
    this.publicBackendUrl =
      process.env.PUBLIC_BACKEND_URL?.trim() ||
      process.env.BASE_URL?.trim() ||
      'http://localhost:3000';

    // Determine which provider to use and initialize transporter
    // Priority: Resend > Brevo (with automatic fallback)
    this.transporter = null;
    this.fromEmail = null;
    this.enabled = false;

    // Try providers in priority order, but respect EMAIL_PROVIDER if explicitly set
    if (this.provider === 'resend' && this.resendApiKey) {
      this.initializeResend();
    } else if (this.provider === 'brevo' && this.brevoSmtpKey && this.brevoSmtpUser) {
      this.initializeBrevo();
    } else {
      // Auto-fallback: try providers in priority order if EMAIL_PROVIDER not explicitly set
      if (!process.env.EMAIL_PROVIDER) {
        if (this.resendApiKey) {
          this.provider = 'resend';
          this.initializeResend();
        } else if (this.brevoSmtpKey && this.brevoSmtpUser) {
          this.provider = 'brevo';
          this.initializeBrevo();
        }
      }
    }

    if (!this.enabled) {
      Logger.warn(
        'EmailService: No email provider configured. Email confirmations are disabled.\n' +
        'Please configure one of: RESEND_API_KEY, or BREVO_SMTP_KEY + BREVO_SMTP_USER'
      );
    } else {
      Logger.info(`EmailService: Initialized with provider: ${this.provider.toUpperCase()}`);
    }
  }

  initializeResend() {
    try {
      // Resend uses SMTP with API key
      this.transporter = nodemailer.createTransport({
        host: 'smtp.resend.com',
        port: 587,
        secure: false, // Use TLS
        auth: {
          user: 'resend', // Resend requires 'resend' as username
          pass: this.resendApiKey,
        },
        // Connection timeout settings for cloud environments
        connectionTimeout: 30000, // 30 seconds
        socketTimeout: 30000, // 30 seconds
        greetingTimeout: 10000, // 10 seconds
        pool: false,
        tls: {
          rejectUnauthorized: true, // Resend uses valid certificates
        },
        debug: process.env.EMAIL_DEBUG === 'true',
        logger: process.env.EMAIL_DEBUG === 'true',
      });
      this.fromEmail = this.resendFromEmail || 'onboarding@resend.dev'; // Resend default
      this.enabled = true;
      Logger.success('EmailService: Resend configured successfully');
    } catch (error) {
      Logger.error('EmailService: Failed to initialize Resend:', error.message);
    }
  }

  initializeBrevo() {
    try {
      // Brevo (Sendinblue) uses SMTP with SMTP key
      // Get SMTP key from: Brevo Dashboard → Settings → SMTP & API → SMTP
      if (!this.brevoSmtpUser) {
        throw new Error('BREVO_SMTP_USER (your Brevo account email) is required');
      }
      
      this.transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false, // Use TLS
        auth: {
          user: this.brevoSmtpUser, // Your Brevo account email
          pass: this.brevoSmtpKey, // SMTP key from Brevo dashboard
        },
        // Connection timeout settings for cloud environments
        connectionTimeout: 30000, // 30 seconds
        socketTimeout: 30000, // 30 seconds
        greetingTimeout: 10000, // 10 seconds
        pool: false,
        tls: {
          rejectUnauthorized: true, // Brevo uses valid certificates
        },
        debug: process.env.EMAIL_DEBUG === 'true',
        logger: process.env.EMAIL_DEBUG === 'true',
      });
      this.fromEmail = this.brevoFromEmail || this.brevoSmtpUser;
      this.enabled = true;
      Logger.success('EmailService: Brevo configured successfully');
    } catch (error) {
      Logger.error('EmailService: Failed to initialize Brevo:', error.message);
    }
  }


  async sendEmailVerification(email, token) {
    if (!this.enabled) {
      throw new Error('Email service is not configured');
    }

    const safeToken = encodeURIComponent(token);
    const safeEmail = encodeURIComponent(email);
    const browserLink = `${this.publicBackendUrl}/api/auth/confirm-email?token=${safeToken}`;
    const deepLink = `${this.appDeepLink}?token=${safeToken}&email=${safeEmail}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563EB;">DOrSU Connect</h2>
        <p>Hi there,</p>
        <p>We received a request to confirm this email address for a new DOrSU Connect account.</p>
        <p style="margin: 24px 0;">
          <a href="${browserLink}" style="background-color:#2563EB; color:#fff; padding:12px 18px; border-radius:6px; text-decoration:none;">
            Confirm my email
          </a>
        </p>
        <p>If you are on your mobile device, you can also tap this link to open the app directly:</p>
        <p><a href="${deepLink}">${deepLink}</a></p>
        <p style="font-size: 12px; color: #6B7280;">
          This link will expire in ${process.env.EMAIL_VERIFICATION_TTL_MINUTES || 30} minutes.
          If you did not request this, you can safely ignore this email.
        </p>
      </div>
    `;

    const textBody = `Hi!

Please confirm your email address for DOrSU Connect.

Confirm via browser: ${browserLink}
Or open the app directly: ${deepLink}

This link expires in ${process.env.EMAIL_VERIFICATION_TTL_MINUTES || 30} minutes.`;

    const mailOptions = {
      from: `"DOrSU Connect" <${this.fromEmail}>`,
      to: email,
      subject: 'Confirm your DOrSU Connect email',
      text: textBody,
      html: htmlBody,
    };

    // Retry logic with exponential backoff
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Verify connection before sending (only on first attempt)
        if (attempt === 1) {
          try {
            await this.transporter.verify();
            Logger.info('EmailService: SMTP connection verified');
          } catch (verifyError) {
            Logger.warn(`EmailService: SMTP verification failed (attempt ${attempt}):`, verifyError.message);
            // Continue anyway - verification might fail but sending could still work
          }
        }

        await this.transporter.sendMail(mailOptions);
        Logger.success(`EmailService: Verification email sent successfully to ${email}`);
        return; // Success - exit the retry loop
      } catch (error) {
        lastError = error;
        const isTimeoutError = 
          /timeout/i.test(error?.message || '') ||
          /Connection timeout/i.test(error?.message || '') ||
          error?.code === 'ETIMEDOUT' ||
          error?.code === 'ECONNRESET';

        Logger.warn(
          `EmailService: Failed to send verification email (attempt ${attempt}/${maxRetries}):`,
          error.message
        );

        // Check for email not found errors (don't retry these)
        if (
          error?.responseCode === 550 ||
          /5\.1\.1/.test(error?.response) ||
          /Recipient address rejected/i.test(error?.message || '')
        ) {
          const notFoundError = new Error(
            'The email address you entered does not exist or cannot receive mail.'
          );
          notFoundError.code = 'EMAIL_NOT_FOUND';
          throw notFoundError;
        }

        // If it's the last attempt or not a timeout error, throw immediately
        if (attempt === maxRetries || !isTimeoutError) {
          break;
        }

        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
        Logger.info(`EmailService: Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // If we get here, all retries failed
    Logger.error('EmailService: Failed to send verification email after all retries', lastError);

    // Provide a more helpful error message for timeout errors
    if (
      /timeout/i.test(lastError?.message || '') ||
      /Connection timeout/i.test(lastError?.message || '') ||
      lastError?.code === 'ETIMEDOUT'
    ) {
      const timeoutError = new Error(
        'Email service connection timeout. Please try again later or contact support if the issue persists.'
      );
      timeoutError.code = 'EMAIL_TIMEOUT';
      throw timeoutError;
    }

    throw lastError;
  }

  buildDeepLink(email, token) {
    const safeToken = encodeURIComponent(token);
    const safeEmail = encodeURIComponent(email);
    return `${this.appDeepLink}?token=${safeToken}&email=${safeEmail}`;
  }
}

export default EmailService;

