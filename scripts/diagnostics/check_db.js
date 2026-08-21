import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('Checking chat_messages table...');
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error fetching chat_messages:', error.message);
    console.error('Error Details:', JSON.stringify(error, null, 2));
  } else {
    console.log('✅ chat_messages table exists and is accessible.');
    if (data && data.length > 0) {
      console.log('Sample columns:', Object.keys(data[0]).join(', '));
    }
  }

  console.log('\nChecking chat_channels table...');
  const { error: channelError } = await supabase
    .from('chat_channels')
    .select('*')
    .limit(1);

  if (channelError) {
    console.error('❌ Error fetching chat_channels:', channelError.message);
  } else {
    console.log('✅ chat_channels table exists and is accessible.');
  }

  console.log('\nChecking notifications table...');
  const { error: notifError } = await supabase
    .from('notifications')
    .select('*')
    .limit(1);

  if (notifError) {
    console.error('❌ Error fetching notifications:', notifError.message);
  } else {
    console.log('✅ notifications table exists and is accessible.');
  }
}

check();
