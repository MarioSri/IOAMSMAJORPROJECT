require('dotenv').config();
const { Resend } = require('resend');

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.EMAIL_FROM || 'notifications@iaoms.dev';

console.log('='.repeat(60));
console.log('Testing Resend Email Service');
console.log('='.repeat(60));
console.log('');

// Check API key format
console.log('1. Checking API Key Configuration:');
if (!apiKey) {
  console.log('   ❌ RESEND_API_KEY not found in .env');
  process.exit(1);
} else if (!apiKey.startsWith('re_')) {
  console.log(`   ❌ Invalid API key format: ${apiKey.substring(0, 10)}...`);
  console.log('   Expected format: re_...');
  process.exit(1);
} else {
  console.log(`   ✅ API Key format valid: ${apiKey.substring(0, 10)}...`);
}
console.log('');

// Initialize Resend
console.log('2. Initializing Resend Client:');
let resend;
try {
  resend = new Resend(apiKey);
  console.log('   ✅ Resend client initialized');
} catch (error) {
  console.log(`   ❌ Failed to initialize: ${error.message}`);
  process.exit(1);
}
console.log('');

// Test email sending
console.log('3. Sending Test Email:');
const testRecipient = '22e51a6917@hitam.org'; // Principal

async function sendTestEmail() {
  try {
    const result = await resend.emails.send({
      from: fromAddress,
      to: testRecipient,
      subject: 'IAOMS Email Test - System Verification',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>IAOMS Test</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #1B3A6B; margin-top: 0;">✅ Email Service Test Successful</h2>
            <p style="color: #333; line-height: 1.6;">
              This is a test email from the IAOMS notification system.
            </p>
            <p style="color: #333; line-height: 1.6;">
              If you received this email, it means:
            </p>
            <ul style="color: #333; line-height: 1.8;">
              <li>Resend API integration is working correctly</li>
              <li>Email delivery to @hitam.org addresses is functional</li>
              <li>The notification system is ready for production use</li>
            </ul>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
            <p style="color: #666; font-size: 12px; margin-bottom: 0;">
              IAOMS - Institutional Activity Oversight & Management System<br>
              This is an automated test message.
            </p>
          </div>
        </body>
        </html>
      `
    });

    console.log(`   ✅ Email sent successfully!`);
    console.log(`   Email ID: ${result.data.id}`);
    console.log(`   Recipient: ${testRecipient}`);
    console.log(`   From: ${fromAddress}`);
    console.log('');
    console.log('='.repeat(60));
    console.log('✅ All Email Tests Passed');
    console.log('='.repeat(60));
  } catch (error) {
    console.log(`   ❌ Failed to send email`);
    console.log(`   Error: ${error.message}`);
    if (error.response) {
      console.log(`   Response: ${JSON.stringify(error.response, null, 2)}`);
    }
    console.log('');
    console.log('='.repeat(60));
    console.log('❌ Email Test Failed');
    console.log('='.repeat(60));
  }
}

sendTestEmail();
