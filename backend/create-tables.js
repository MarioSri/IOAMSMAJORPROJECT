require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTable() {
  console.log('Creating user_devices table...');
  const { error } = await supabase.rpc('exec_sql', {
    query: `
      CREATE TABLE IF NOT EXISTS public.user_devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        fcm_token TEXT NOT NULL,
        device_type TEXT NOT NULL DEFAULT 'web',
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        email TEXT,
        CONSTRAINT uq_user_fcm_token UNIQUE (user_id, fcm_token)
      );
      CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_devices_email ON public.user_devices(email) WHERE email IS NOT NULL;
      ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
      
      -- RLS Policies
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_devices' AND policyname = 'Users can manage own devices') THEN
          CREATE POLICY "Users can manage own devices" ON public.user_devices FOR ALL USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_devices' AND policyname = 'Service role full access') THEN
          CREATE POLICY "Service role full access" ON public.user_devices FOR ALL TO service_role USING (true);
        END IF;
      END $$;
    `
  });

  if (error) {
    if (error.message.includes('function "exec_sql" does not exist')) {
        console.error('RPC "exec_sql" missing. Please run this SQL manually in the Supabase SQL Editor:');
        console.log(`
        CREATE TABLE IF NOT EXISTS public.user_devices (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          fcm_token TEXT NOT NULL,
          device_type TEXT NOT NULL DEFAULT 'web',
          user_agent TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          email TEXT,
          CONSTRAINT uq_user_fcm_token UNIQUE (user_id, fcm_token)
        );
        CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_devices_email ON public.user_devices(email) WHERE email IS NOT NULL;
        ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
        `);
    } else {
        console.error('Error creating table:', error);
    }
  } else {
    console.log('Successfully created user_devices table!');
  }
}

createTable();
