import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env
config({ path: resolve(__dirname, '../.env') });

function validateEmailConfig() {
  console.log('🔍 Validating Email Configuration...\n');

  const required = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_FRONTEND_URL: process.env.EMAIL_FRONTEND_URL || process.env.FRONTEND_URL?.split(',')[0] || 'https://app.iaoms.dev'
  };

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!required.RESEND_API_KEY) {
    errors.push('❌ RESEND_API_KEY is missing');
  } else if (!required.RESEND_API_KEY.startsWith('re_')) {
    errors.push('❌ RESEND_API_KEY is invalid (must start with "re_")');
  }

  if (!required.EMAIL_FROM) {
    errors.push('❌ EMAIL_FROM is missing');
  } else if (!required.EMAIL_FROM.includes('@')) {
    errors.push('❌ EMAIL_FROM is invalid (must be an email address)');
  } else if (required.EMAIL_FROM.startsWith('noreply@')) {
    warnings.push('⚠️  EMAIL_FROM uses "noreply" - Consider using "notifications@" instead');
  }

  // Check if using subdomain
  if (required.EMAIL_FROM && !required.EMAIL_FROM.includes('@mail.')) {
    warnings.push('⚠️  Consider using a subdomain (e.g., notifications@mail.iaoms.dev) for better deliverability');
  }

  if (!process.env.EMAIL_FRONTEND_URL) {
    warnings.push('⚠️  EMAIL_FRONTEND_URL is not set — using FRONTEND_URL or default');
  }

  if (errors.length > 0) {
    console.error('🚨 Email Configuration Errors:\n');
    errors.forEach(err => console.error(err));
    console.log('\nPlease fix these issues before proceeding.');
    process.exit(1);
  }

  console.log('✅ Configuration looks good:');
  console.log(`   From:     ${required.EMAIL_FROM}`);
  console.log(`   Frontend: ${required.EMAIL_FRONTEND_URL}`);
  console.log(`   API Key:  ${required.RESEND_API_KEY!.substring(0, 8)}...`);
  
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(warn => console.log(warn));
  }
  
  console.log('\n✅ Ready to send emails');
}

validateEmailConfig();
