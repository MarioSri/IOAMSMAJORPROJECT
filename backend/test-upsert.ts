import dotenv from 'dotenv';
dotenv.config();
import { supabaseAdmin } from './src/config/supabase';

async function testInsert() {
  const testUserId = '45a97e73-ba96-4b1b-95a6-f27994209978'; // Use the id I saw in check-devices.js
  const testToken = 'test-token-' + Date.now();

  console.log('Testing upsert with user_id:', testUserId);
  const { data, error } = await supabaseAdmin
    .from('user_devices')
    .upsert(
      { 
        user_id: testUserId, 
        fcm_token: testToken, 
        device_type: 'web', 
        last_seen: new Date().toISOString(), 
        email: 'test@example.com' 
      },
      { onConflict: 'user_id, fcm_token' }
    );

  if (error) {
    console.error('Upsert failed:', error);
  } else {
    console.log('Upsert succeeded:', data);
  }
}

testInsert();
