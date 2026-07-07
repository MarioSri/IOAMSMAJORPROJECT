require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const users = [
  { email: '22e51a6917@hitam.org', password: 'Principal@123', name: 'D.SriChaitanya', role: 'Principal', employee_id: '22E51A6917' },
  { email: '22e51a6914@hitam.org', password: 'HOD@123', name: 'Ch.Sandeep', role: 'HOD', employee_id: '22E51A6914' },
  { email: '22e51a6903@hitam.org', password: 'Registrar@123', name: 'Y.Anirudh', role: 'Registrar', employee_id: '22E51A6903' },
  { email: 'programhead.cse@hitam.org', password: 'ProgramHead@123', name: 'Dr. C. Priyanka', role: 'Program Department Head', employee_id: '22E51A6922' },
  { email: '22e51a6925@hitam.org', password: 'Employee@123', name: 'G.Srujan', role: 'Employee', employee_id: '22E51A6925' }
];

async function syncUsers() {
  console.log('='.repeat(60));
  console.log('Syncing 5 Users to Supabase Auth');
  console.log('='.repeat(60));
  console.log('');

  let successCount = 0;
  let updateCount = 0;
  let errorCount = 0;

  for (const user of users) {
    try {
      console.log(`Processing: ${user.role} (${user.email})`);
      
      // Check if user exists
      const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (listError) {
        console.log(`  ❌ Error checking user: ${listError.message}`);
        errorCount++;
        continue;
      }

      const existingUser = existingUsers.users.find(u => u.email === user.email);

      if (existingUser) {
        // Update existing user password
        const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          existingUser.id,
          {
            password: user.password,
            email_confirm: true,
            user_metadata: {
              name: user.name,
              employee_id: user.employee_id,
              role: user.role
            }
          }
        );

        if (updateError) {
          console.log(`  ❌ Failed to update: ${updateError.message}`);
          errorCount++;
        } else {
          console.log(`  ✅ Updated password (User ID: ${existingUser.id})`);
          
          // Update role_recipients with supabase_uid
          const { error: linkError } = await supabaseAdmin
            .from('role_recipients')
            .update({ supabase_uid: existingUser.id, updated_at: new Date().toISOString() })
            .eq('email', user.email);

          if (linkError) {
            console.log(`  ⚠️  Warning: Could not link to role_recipients: ${linkError.message}`);
          } else {
            console.log(`  ✅ Linked to role_recipients`);
          }
          
          updateCount++;
        }
      } else {
        // Create new user
        const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: {
            name: user.name,
            employee_id: user.employee_id,
            role: user.role
          }
        });

        if (createError) {
          console.log(`  ❌ Failed to create: ${createError.message}`);
          errorCount++;
        } else {
          console.log(`  ✅ Created user (User ID: ${createData.user.id})`);
          
          // Update role_recipients with supabase_uid
          const { error: linkError } = await supabaseAdmin
            .from('role_recipients')
            .update({ supabase_uid: createData.user.id, updated_at: new Date().toISOString() })
            .eq('email', user.email);

          if (linkError) {
            console.log(`  ⚠️  Warning: Could not link to role_recipients: ${linkError.message}`);
          } else {
            console.log(`  ✅ Linked to role_recipients`);
          }
          
          successCount++;
        }
      }
      
      console.log('');
    } catch (error) {
      console.log(`  ❌ Exception: ${error.message}`);
      console.log('');
      errorCount++;
    }
  }

  console.log('='.repeat(60));
  console.log('Sync Complete');
  console.log('='.repeat(60));
  console.log(`Created: ${successCount} | Updated: ${updateCount} | Errors: ${errorCount}`);
  console.log('');
  
  if (errorCount === 0) {
    console.log('✅ All users synced successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run: node test-login.js');
    console.log('2. Test login via frontend');
  } else {
    console.log('⚠️  Some users failed to sync. Check errors above.');
  }
}

syncUsers();
