import { Resend } from 'resend';
import { supabaseAdmin } from '../config/supabase';

let resend: Resend | null = null;
try {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && apiKey.startsWith('re_') && apiKey !== 're_YourApiKeyHere') {
    resend = new Resend(apiKey);
  } else if (apiKey) {
    console.warn('[Email] Invalid RESEND_API_KEY format — must start with "re_" and not be the placeholder.');
  }
} catch (error) {
  console.error('[Email] Failed to initialize Resend:', error);
}

const FROM_ADDRESS = process.env.EMAIL_FROM || 'notifications@iaoms.dev';
const FRONTEND_URL = process.env.EMAIL_FRONTEND_URL || process.env.FRONTEND_URL?.split(',')[0] || 'https://app.iaoms.dev';

// Email configuration for better deliverability
const EMAIL_CONFIG = {
  // Disable tracking to avoid spam filters
  headers: {
    'X-Auto-Response-Suppress': 'OOF, AutoReply',
    'X-Priority': '3',
    'Importance': 'Normal'
  }
};

// Helper to send email with tracking disabled
async function sendWithResend(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  tags?: Array<{ name: string; value: string }>;
}) {
  if (!resend) {
    throw new Error('Resend not initialized');
  }

  return await resend.emails.send({
    ...params,
    headers: EMAIL_CONFIG.headers
  });
}

export { sendWithResend };
