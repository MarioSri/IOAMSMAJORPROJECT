require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('='.repeat(60));
  console.log('Running Migration: 20260414_sync_five_users.sql');
  console.log('='.repeat(60));
  console.log('');

  // Read the migration file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260414_sync_five_users.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.log('❌ Migration file not found:', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('Executing migration...');
  console.log('');

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // Try direct execution via REST API
      console.log('Attempting direct SQL execution...');
      
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ sql_query: sql })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      console.log('✅ Migration executed successfully via REST API');
    } else {
      console.log('✅ Migration executed successfully');
    }
    
    console.log('');
    console.log('Verifying user sync...');
    
    // Verify the users were created/updated
    const { data: users, error: usersError } = await supabase
      .from('role_recipients')
      .select('email, name, role, supabase_uid')
      .in('email', [
        '22e51a6917@hitam.org',
        '22e51a6914@hitam.org',
        '22e51a6903@hitam.org',
        'programhead.cse@hitam.org',
        '22e51a6925@hitam.org'
      ]);

    if (usersError) {
      console.log('⚠️  Could not verify users:', usersError.message);
    } else {
      console.log('');
      console.log('User Sync Status:');
      console.log('-'.repeat(60));
      users.forEach(user => {
        const status = user.supabase_uid ? '✅' : '❌';
        console.log(`${status} ${user.role.padEnd(25)} ${user.email}`);
        if (user.supabase_uid) {
          console.log(`   Supabase UID: ${user.supabase_uid}`);
        }
      });
    }
    
    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Migration Complete');
    console.log('='.repeat(60));
    console.log('');
    console.log('Next steps:');
    console.log('1. Run: node test-login.js');
    console.log('2. Test login via frontend');
    
  } catch (error) {
    console.log('');
    console.log('❌ Migration failed:', error.message);
    console.log('');
    console.log('Manual execution required:');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Copy contents of: supabase/migrations/20260414_sync_five_users.sql');
    console.log('3. Paste and click Run');
    console.log('');
    process.exit(1);
  }
}

runMigration();
