require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error, count } = await supabase.from('notifications').select('*', { count: 'exact', head: true });
  if (error) {
    console.log('Error checking notifications table:', error);
  } else {
    console.log('Notifications count:', count);
  }
}

check();
