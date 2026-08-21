const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixDatabase() {
  console.log('🚀 Running database fix for signature_metadata...');
  
  const sql = `
    DO $$
    BEGIN
      -- Add signature_metadata column if missing
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='signature_metadata') THEN
        ALTER TABLE documents ADD COLUMN signature_metadata JSONB DEFAULT '[]';
        RAISE NOTICE 'Added signature_metadata column';
      END IF;

      -- Add signed_by column if missing
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='signed_by') THEN
        ALTER TABLE documents ADD COLUMN signed_by TEXT[] DEFAULT '{}';
        RAISE NOTICE 'Added signed_by column';
      END IF;

      -- Add last_signed_date column if missing
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='last_signed_date') THEN
        ALTER TABLE documents ADD COLUMN last_signed_date DATE;
        RAISE NOTICE 'Added last_signed_date column';
      END IF;

      -- Add signature_count column if missing
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='signature_count') THEN
        ALTER TABLE documents ADD COLUMN signature_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Added signature_count column';
      END IF;
    END $$;
  `;

  try {
    const { error: rpcError } = await supabase.rpc('exec_sql', { query: sql });
    
    if (rpcError) {
      console.warn('⚠️ RPC exec_sql failed or missing. Attempting manual database check...');
      console.error('RPC Error:', rpcError.message);
      process.exit(1);
    } else {
      console.log('✅ Database fix applied successfully via RPC!');
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

fixDatabase();
