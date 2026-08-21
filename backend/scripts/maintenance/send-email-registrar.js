require('dotenv').config();
const { Resend } = require('resend');

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.EMAIL_FROM || 'notifications@iaoms.dev';
const recipient = '22e51a6903@hitam.org'; // Registrar - Y.Anirudh

console.log('='.repeat(60));
console.log('Sending Test Email to Registrar');
console.log('='.repeat(60));
console.log('');
console.log(`Recipient: ${recipient}`);
console.log(`From: ${fromAddress}`);
console.log('');

const resend = new Resend(apiKey);

async function sendEmail() {
  try {
    const result = await resend.emails.send({
      from: fromAddress,
      to: recipient,
      subject: 'IAOMS - System Notification Test',
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>IAOMS Notification</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f2f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 40px rgba(27,58,107,0.10);">

        <!-- Accent bar -->
        <tr><td style="background-color:#10b981;height:5px;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- Header -->
        <tr><td style="padding:28px 48px 0;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align:middle;padding-right:10px;">
                <div style="width:26px;height:26px;background-color:#1B3A6B;border-radius:6px;display:flex;align-items:center;justify-content:center;">
                  <span style="color:#fff;font-size:16px;font-weight:bold;">I</span>
                </div>
              </td>
              <td style="vertical-align:middle;">
                <span style="font-family:'DM Serif Display', Georgia, serif;font-size:22px;color:#1B3A6B;letter-spacing:1px;font-weight:bold;">IAOMS</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Badge -->
        <tr><td style="padding:28px 48px 0;">
          <span style="display:inline-block;background-color:#d1fae5;color:#065f46;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;padding:4px 14px;border-radius:50px;">System Test</span>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:6px 48px 0;font-size:14px;color:#64748b;">Hello, Registrar —</td></tr>

        <!-- Headline -->
        <tr><td style="padding:8px 48px 0;">
          <h1 style="margin:0;font-family:'DM Serif Display', Georgia, serif;font-size:28px;color:#1a1a2e;line-height:1.25;letter-spacing:-0.3px;font-weight:bold;">Email Service Verification</h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:12px 48px 0;font-size:14px;color:#4a5568;line-height:1.75;">
          This is a test email to verify that the IAOMS notification system is working correctly for your account.
        </td></tr>

        <tr><td style="padding:12px 48px 0;font-size:14px;color:#4a5568;line-height:1.75;">
          <strong>What this confirms:</strong>
        </td></tr>

        <tr><td style="padding:8px 48px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f7fd;border:1px solid #dce8fb;border-radius:10px;">
            <tr>
              <td style="padding:16px 20px;">
                <div style="margin-bottom:8px;">
                  <span style="color:#10b981;font-size:18px;margin-right:8px;">✓</span>
                  <span style="color:#1a1a2e;font-size:14px;">Email delivery to @hitam.org addresses is functional</span>
                </div>
                <div style="margin-bottom:8px;">
                  <span style="color:#10b981;font-size:18px;margin-right:8px;">✓</span>
                  <span style="color:#1a1a2e;font-size:14px;">Resend API integration is working correctly</span>
                </div>
                <div>
                  <span style="color:#10b981;font-size:18px;margin-right:8px;">✓</span>
                  <span style="color:#1a1a2e;font-size:14px;">Notification system is ready for production use</span>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:16px 48px 0;font-size:14px;color:#4a5568;line-height:1.75;">
          You will receive email notifications for:
        </td></tr>

        <tr><td style="padding:8px 48px 0;font-size:14px;color:#4a5568;line-height:1.75;">
          <ul style="margin:0;padding-left:20px;">
            <li style="margin-bottom:6px;">Document submissions requiring your approval</li>
            <li style="margin-bottom:6px;">Approval requests and status updates</li>
            <li style="margin-bottom:6px;">LiveMeet+ meeting invitations</li>
            <li style="margin-bottom:6px;">Emergency notifications and alerts</li>
            <li>System announcements and updates</li>
          </ul>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:24px 48px 0;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0;"></td></tr>

        <!-- Footer Note -->
        <tr><td style="padding:16px 48px 28px;font-size:12px;color:#94a3b8;line-height:1.7;">
          <strong>Account Details:</strong><br>
          Email: ${recipient}<br>
          Role: Registrar<br>
          Employee ID: 22E51A6903<br>
          <br>
          If you did not expect this email or have questions, please contact your system administrator.
        </td></tr>

        <!-- Footer -->
        <tr><td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 48px;text-align:center;">
          <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;line-height:1.7;">
            This is an automated message from IAOMS — The Institutional Activity Oversight &amp; Management System.<br>
            Do not reply to this email.
          </p>
          <p style="margin:0;font-size:12px;">
            <a href="https://app.iaoms.dev/settings/notifications" style="color:#94a3b8;text-decoration:none;margin:0 10px;">Manage Notifications</a>
            <a href="https://app.iaoms.dev/privacy" style="color:#94a3b8;text-decoration:none;margin:0 10px;">Privacy Policy</a>
            <a href="https://app.iaoms.dev/help" style="color:#94a3b8;text-decoration:none;margin:0 10px;">Help Center</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
      `
    });

    console.log('='.repeat(60));
    console.log('✅ EMAIL SENT SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('');
    console.log('Email Details:');
    console.log(`  Email ID: ${result.data.id}`);
    console.log(`  To: ${recipient}`);
    console.log(`  From: ${fromAddress}`);
    console.log(`  Subject: IAOMS - System Notification Test`);
    console.log('');
    console.log('The email should arrive within 1-2 minutes.');
    console.log('Please check the inbox (and spam folder) for:');
    console.log(`  ${recipient}`);
    console.log('');
    console.log('='.repeat(60));

  } catch (error) {
    console.log('='.repeat(60));
    console.log('❌ EMAIL FAILED');
    console.log('='.repeat(60));
    console.log('');
    console.log(`Error: ${error.message}`);
    if (error.response) {
      console.log(`Response: ${JSON.stringify(error.response, null, 2)}`);
    }
    console.log('');
    process.exit(1);
  }
}

sendEmail();
