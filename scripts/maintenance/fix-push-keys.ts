/**
 * Quick fix script to add push_keys column to user_devices table
 * Run this once to fix the Web Push registration error
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load backend .env
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🔧 Applying migration: add push_keys column to user_devices...');
  
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE public.user_devices
        ADD COLUMN IF NOT EXISTS push_keys JSONB;
      
      COMMENT ON COLUMN public.user_devices.push_keys IS 'Web Push subscription keys: { p256dh: string, auth: string }';
    `
  });

  if (error) {
    // Try direct query if RPC doesn't exist
    console.log('⚠️  RPC method not available, trying direct query...');
    
    const { error: directError } = await supabase
      .from('user_devices')
      .select('push_keys')
      .limit(1);
    
    if (directError && directError.message.includes('column "push_keys" does not exist')) {
      console.error('❌ Migration needed but cannot be applied automatically.');
      console.log('\n📋 Please run this SQL in your Supabase SQL Editor:');
      console.log('\n' + '='.repeat(60));
      console.log(`
ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS push_keys JSONB;

COMMENT ON COLUMN public.user_devices.push_keys IS 'Web Push subscription keys: { p256dh: string, auth: string }';
      `);
      console.log('='.repeat(60) + '\n');
      process.exit(1);
    } else {
      console.log('✅ Column already exists or migration not needed');
    }
  } else {
    console.log('✅ Migration applied successfully!');
  }
}

applyMigration().catch(console.error);
