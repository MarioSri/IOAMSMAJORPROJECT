require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error, count } = await supabase.from('user_devices').select('*', { count: 'exact' });
  console.log('Error:', error);
  console.log('Count:', count);
  if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
    console.log('First row:', data[0]);
  }
}

check();
