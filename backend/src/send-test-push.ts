import 'dotenv/config';
import { supabaseAdmin } from './config/supabase';
import * as PushService from './services/pushService';

async function sendTestPush(email: string) {
  console.log(`\n🚀 IAOMS Premium Push Test — Email: ${email}`);
  
  const { data: devices, error } = await supabaseAdmin
    .from('user_devices')
    .select('*')
    .eq('email', email);

  if (error) {
    console.error('❌ Database Error:', error);
    return;
  }

  if (!devices || devices.length === 0) {
    console.warn(`⚠️  No registered devices found for ${email}. Please open the app and allow notifications first.`);
    return;
  }

  console.log(`📱 Found ${devices.length} device(s). Sending suite...`);

  try {
    // 1. Test Regular Workflow (High Urgency)
    console.log(' - Sending Approval Review request...');
    const approvalPush = PushService.buildReviewNeededPush({
      docTitle: 'Medical Credentialing — Dr. Sarah Smith'
    });
    await PushService.sendToDevices(devices, approvalPush);

    // 2. Test Chat Template
    console.log(' - Sending Direct Message preview...');
    const chatPush = PushService.buildDirectMessagePush({
      senderName: 'Coordinator John',
      message: 'Hello! Please review the latest emergency protocols for the clinical wing.',
      threadId: 'test-thread-123'
    });
    await PushService.sendToDevices(devices, chatPush);

    // 3. Test Emergency (Critical)
    console.log(' - Sending Critical Emergency alert...');
    const emergencyPush = PushService.buildEmergencyPush({
      title: 'Server Maintenance',
      urgency: 'Immediate',
      description: 'System-wide maintenance scheduled for midnight UTC.'
    });
    await PushService.sendToDevices(devices, emergencyPush);

    console.log('\n✅ All test pushes dispatched successfully.');
  } catch (err) {
    console.error('❌ Web Push Error:', err);
  }
}

// Get email from command line
const emailArg = process.argv[2];
if (!emailArg) {
  console.error('Usage: npx ts-node src/send-test-push.ts user@example.com');
  process.exit(1);
}

sendTestPush(emailArg);

