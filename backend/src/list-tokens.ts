import 'dotenv/config';
import { supabaseAdmin } from './config/supabase';

async function listTokens() {
  const { data, error } = await supabaseAdmin.from('user_devices').select('id, user_id, email, fcm_token');
  if (error) console.error('Database Error:', error);
  else console.log('Registered Devices:', JSON.stringify(data, null, 2));
}

listTokens();
