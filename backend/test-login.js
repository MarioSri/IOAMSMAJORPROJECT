require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const testUsers = [
  { email: '22e51a6917@hitam.org', password: 'Principal@123', role: 'Principal' },
  { email: '22e51a6914@hitam.org', password: 'HOD@123', role: 'HOD' },
  { email: '22e51a6903@hitam.org', password: 'Registrar@123', role: 'Registrar' },
  { email: 'programhead.cse@hitam.org', password: 'ProgramHead@123', role: 'Program Head' },
  { email: '22e51a6925@hitam.org', password: 'Employee@123', role: 'Employee' }
];

async function testLogin() {
  console.log('='.repeat(60));
  console.log('Testing Login for 5 HITAM Users');
  console.log('='.repeat(60));
  console.log('');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const user of testUsers) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: user.password
      });
      
      if (error) {
        console.log(`❌ ${user.role.padEnd(20)} (${user.email})`);
        console.log(`   Error: ${error.message}`);
        failCount++;
      } else {
        console.log(`✅ ${user.role.padEnd(20)} (${user.email})`);
        console.log(`   User ID: ${data.user.id}`);
        successCount++;
      }
      console.log('');
    } catch (err) {
      console.log(`❌ ${user.role.padEnd(20)} (${user.email})`);
      console.log(`   Exception: ${err.message}`);
      failCount++;
      console.log('');
    }
  }
  
  console.log('='.repeat(60));
  console.log(`Results: ${successCount} successful, ${failCount} failed`);
  console.log('='.repeat(60));
}

testLogin();
