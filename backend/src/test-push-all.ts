import 'dotenv/config';
import { supabaseAdmin } from './config/supabase';
import * as PushService from './services/pushService';

async function testPushToAll() {
  console.log('Fetching all registered devices...');
  const { data: devices, error } = await supabaseAdmin
    .from('user_devices')
    .select('user_id, fcm_token, email');

  if (error) {
    console.error('Failed to fetch devices:', error);
    return;
  }

  if (!devices || devices.length === 0) {
    console.log('No registered devices found.');
    return;
  }

  console.log(`Found ${devices.length} registered devices.`);
  
  // Group by user_id
  const userIds = Array.from(new Set(devices.map(d => d.user_id)));
  
  for (const userId of userIds) {
    console.log(`Sending test push to user: ${userId}`);
    await PushService.sendPushToUser(userId, {
      title: 'Real-time Verification',
      body: 'IAOMS Firebase Push is working! ' + new Date().toLocaleTimeString(),
      actionUrl: '/dashboard'
    });
  }
}

testPushToAll();
