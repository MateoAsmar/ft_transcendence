import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key from environment
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || process.env.FROM_EMAIL || 'noreply@transcendence.com';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log('✅ SendGrid initialized');
  console.log(`📧 From email: ${FROM_EMAIL}`);
} else {
  console.warn('⚠️  SENDGRID_API_KEY not set - emails will not be sent');
}

export interface SendOTPEmailParams {
  to: string;
  username: string;
  otp: string;
}

/**
 * Send 2FA OTP code via email using SendGrid
 */
export async function sendOTPEmail({ to, username, otp }: SendOTPEmailParams): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.error('SendGrid API key not configured');
    return false;
  }

  const msg = {
    to,
    from: FROM_EMAIL,
    subject: 'Your Transcendence 2FA Code',
    text: `Hello ${username},\n\nYour 2FA verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.\n\nBest regards,\nTranscendence Team`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your 2FA Code</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);">

                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%); padding: 40px 30px; text-align: center;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: -0.5px;">
                        🎮 Transcendence
                      </h1>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h2 style="margin: 0 0 20px; color: #f1f5f9; font-size: 24px; font-weight: 600;">
                        Your 2FA Verification Code
                      </h2>

                      <p style="margin: 0 0 30px; color: #cbd5e1; font-size: 16px; line-height: 1.6;">
                        Hello <strong style="color: #f1f5f9;">${username}</strong>,
                      </p>

                      <p style="margin: 0 0 30px; color: #cbd5e1; font-size: 16px; line-height: 1.6;">
                        You're trying to log in to your Transcendence account. Use the verification code below to complete your login:
                      </p>

                      <!-- OTP Code Box -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                        <tr>
                          <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); border-radius: 12px; padding: 30px; text-align: center;">
                            <div style="font-size: 42px; font-weight: bold; color: #ffffff; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                              ${otp}
                            </div>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 0 0 20px; color: #cbd5e1; font-size: 14px; line-height: 1.6;">
                        <strong style="color: #fbbf24;">⏱️ This code will expire in 10 minutes.</strong>
                      </p>

                      <p style="margin: 0 0 30px; color: #cbd5e1; font-size: 14px; line-height: 1.6;">
                        If you didn't request this code, please ignore this email or contact support if you're concerned about your account security.
                      </p>

                      <div style="border-top: 1px solid #334155; padding-top: 20px; margin-top: 30px;">
                        <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.5;">
                          <strong>Security Tip:</strong> Never share this code with anyone. Transcendence will never ask for your 2FA code via email, phone, or any other method.
                        </p>
                      </div>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #0f172a; padding: 30px; text-align: center; border-top: 1px solid #1e293b;">
                      <p style="margin: 0 0 10px; color: #64748b; font-size: 14px;">
                        Best regards,<br>
                        <strong style="color: #94a3b8;">Transcendence Team</strong>
                      </p>
                      <p style="margin: 0; color: #475569; font-size: 12px;">
                        © 2025 Transcendence. All rights reserved.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log(`2FA OTP email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Error sending 2FA email:', error);
    return false;
  }
}

/**
 * Generate a random 6-digit OTP code
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
