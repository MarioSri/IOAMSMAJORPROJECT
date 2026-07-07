require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('--- Checking Notification Status ---');
  
  // 1. Get failed notifications
  const { data: failed, error: failedError } = await supabase
    .from('notifications')
    .select('id, user_id, title, email_sent, email_failed, email_retry_count, last_email_attempt_at, metadata')
    .eq('email_failed', true)
    .order('last_email_attempt_at', { ascending: false })
    .limit(10);

  if (failedError) {
    console.error('Error fetching failed notifications:', failedError);
  } else {
    console.log(`Found ${failed.length} failed notifications (most recent):`);
    failed.forEach(n => {
      const emailTo = n.metadata?.email_to || 'unknown';
      console.log(`- ID: ${n.id} | To: ${emailTo} | Retries: ${n.email_retry_count} | Last Attempt: ${n.last_email_attempt_at}`);
    });
  }

  // 2. Get successful notifications
  const { data: success, error: successError } = await supabase
    .from('notifications')
    .select('id, user_id, title, email_sent, metadata')
    .eq('email_sent', true)
    .order('created_at', { ascending: false })
    .limit(5);

  if (successError) {
    console.error('Error fetching successful notifications:', successError);
  } else {
    console.log(`\nFound ${success.length} successful notifications (most recent):`);
    success.forEach(n => {
      const emailTo = n.metadata?.email_to || 'unknown';
      console.log(`- ID: ${n.id} | To: ${emailTo}`);
    });
  }

  // 3. Summarize by recipient
  const { data: allNotifs, error: allErr } = await supabase
    .from('notifications')
    .select('metadata->email_to, email_sent, email_failed')
    .not('metadata->email_to', 'is', null);

  if (!allErr && allNotifs) {
    const stats = {};
    allNotifs.forEach(n => {
      const email = n.email_to;
      if (!stats[email]) stats[email] = { sent: 0, failed: 0 };
      if (n.email_sent) stats[email].sent++;
      if (n.email_failed) stats[email].failed++;
    });
    console.log('\n--- Status by Email ---');
    console.table(stats);
  }
}

check();
