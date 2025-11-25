import nodemailer from 'nodemailer';
import { Logger } from '../utils/logger.js';

export class EmailService {
  constructor() {
    this.gmailUser = process.env.GMAIL_USER;
    this.gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
    this.enabled = Boolean(this.gmailUser && this.gmailAppPassword);
    this.appDeepLink =
      process.env.APP_DEEP_LINK_URL?.trim() || 'dorsuconnect://email-confirmation';
    this.publicBackendUrl =
      process.env.PUBLIC_BACKEND_URL?.trim() ||
      process.env.BASE_URL?.trim() ||
      'http://localhost:3000';

    if (!this.enabled) {
      Logger.warn(
        'EmailService: Gmail credentials not configured. Email confirmations are disabled.'
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.gmailUser,
        pass: this.gmailAppPassword,
      },
    });
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
        <p>We received a request to confirm this Gmail address for a new DOrSU Connect account.</p>
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

Please confirm your Gmail address for DOrSU Connect.

Confirm via browser: ${browserLink}
Or open the app directly: ${deepLink}

This link expires in ${process.env.EMAIL_VERIFICATION_TTL_MINUTES || 30} minutes.`;

    try {
      await this.transporter.sendMail({
        from: `"DOrSU Connect" <${this.gmailUser}>`,
        to: email,
        subject: 'Confirm your DOrSU Connect email',
        text: textBody,
        html: htmlBody,
      });
    } catch (error) {
      Logger.error('EmailService: Failed to send verification email', error);

      if (
        error?.responseCode === 550 ||
        /5\.1\.1/.test(error?.response) ||
        /Recipient address rejected/i.test(error?.message || '')
      ) {
        const notFoundError = new Error(
          'The Gmail address you entered does not exist or cannot receive mail.'
        );
        notFoundError.code = 'EMAIL_NOT_FOUND';
        throw notFoundError;
      }

      throw error;
    }
  }

  buildDeepLink(email, token) {
    const safeToken = encodeURIComponent(token);
    const safeEmail = encodeURIComponent(email);
    return `${this.appDeepLink}?token=${safeToken}&email=${safeEmail}`;
  }
}

export default EmailService;

