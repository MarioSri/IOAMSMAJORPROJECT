import { Resend } from 'resend';
import * as dotenv from 'dotenv';

dotenv.config();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const TEST_EMAIL = process.argv[2] || 'test@example.com';

async function testResendEmail() {
  console.log('\n🔍 Testing Resend Email Configuration...\n');
  
  // Check API Key
  if (!RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY not found in .env file');
    process.exit(1);
  }
  
  if (!RESEND_API_KEY.startsWith('re_')) {
    console.error('❌ Invalid RESEND_API_KEY format (must start with "re_")');
    process.exit(1);
  }
  
  console.log('✅ API Key found:', RESEND_API_KEY.substring(0, 10) + '...');
  console.log('✅ From Address:', EMAIL_FROM);
  console.log('✅ Test Email:', TEST_EMAIL);
  console.log('\n📧 Sending test email...\n');
  
  try {
    const resend = new Resend(RESEND_API_KEY);
    
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: TEST_EMAIL,
      subject: '✅ IAOMS Resend Email Test',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Test Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #1B3A6B; margin-bottom: 20px;">✅ Resend Email Test Successful!</h1>
            <p style="color: #333; line-height: 1.6;">
              This is a test email from your IAOMS backend to verify that Resend email integration is working correctly.
            </p>
            <div style="background-color: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong style="color: #1B3A6B;">Configuration Details:</strong>
              <ul style="color: #666; margin: 10px 0;">
                <li>From: ${EMAIL_FROM}</li>
                <li>API Key: ${RESEND_API_KEY.substring(0, 10)}...</li>
                <li>Timestamp: ${new Date().toISOString()}</li>
              </ul>
            </div>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              If you received this email, your Resend integration is working properly! 🎉
            </p>
          </div>
        </body>
        </html>
      `
    });
    
    if (error) {
      console.error('❌ Failed to send email:', error);
      process.exit(1);
    }
    
    console.log('✅ Email sent successfully!');
    console.log('📬 Email ID:', data?.id);
    console.log('\n✨ Check your inbox at:', TEST_EMAIL);
    console.log('📊 View in Resend Dashboard: https://resend.com/emails\n');
    
  } catch (err: any) {
    console.error('❌ Error:', err.message || err);
    process.exit(1);
  }
}

testResendEmail();
