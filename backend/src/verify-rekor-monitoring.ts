// CRITICAL: Load dotenv FIRST before any other imports
import { config } from 'dotenv';
import { resolve } from 'path';

// Load from backend/.env
const envPath = resolve(__dirname, '../.env');
const result = config({ path: envPath });

if (result.error) {
  console.error('⚠️  Failed to load .env file:', result.error.message);
  console.error('   Path:', envPath);
} else {
  console.log('✅ Loaded .env from:', envPath);
  console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');
  console.log('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing');
  console.log('');
}

// NOW import the rest

import { supabaseAdmin, isSupabaseConfigured } from './config/supabase';
import { runDailyMonitoringCheck, getLatestMonitoringResult } from './services/rekorMonitorService';
import { getWorkerStatus } from './services/rekorQueueWorker';

async function verifyRekorMonitoring() {
  console.log('🔍 Verifying Rekor Monitoring System...\n');

  // Step 1: Check Supabase configuration
  console.log('1️⃣  Checking Supabase Configuration...');
  if (!isSupabaseConfigured()) {
    console.error('❌ Supabase is NOT configured');
    console.error('   Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  console.log('✅ Supabase is configured\n');

  // Step 2: Check if table exists
  console.log('2️⃣  Checking rekor_monitoring_log table...');
  try {
    const { data, error } = await supabaseAdmin
      .from('rekor_monitoring_log')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Table check failed:', error.message);
      process.exit(1);
    }
    console.log('✅ Table exists and is accessible\n');
  } catch (err) {
    console.error('❌ Table check error:', err);
    process.exit(1);
  }

  // Step 3: Check current monitoring log entries
  console.log('3️⃣  Checking existing monitoring entries...');
  const { data: entries, error: entriesError } = await supabaseAdmin
    .from('rekor_monitoring_log')
    .select('*')
    .order('check_date', { ascending: false })
    .limit(5);

  if (entriesError) {
    console.error('❌ Failed to query entries:', entriesError.message);
  } else if (!entries || entries.length === 0) {
    console.log('⚠️  No monitoring entries found (table is empty)');
    console.log('   This is NORMAL if monitoring has never run yet\n');
  } else {
    console.log(`✅ Found ${entries.length} monitoring entries:`);
    entries.forEach((entry: any) => {
      console.log(`   - ${entry.check_date}: ${entry.log_consistency_status} (${entry.issues_detected?.length || 0} issues)`);
    });
    console.log('');
  }

  // Step 4: Check worker status
  console.log('4️⃣  Checking Rekor Queue Worker status...');
  const workerStatus = getWorkerStatus();
  console.log(`   Running: ${workerStatus.running ? '✅ Yes' : '❌ No'}`);
  console.log(`   Consecutive Failures: ${workerStatus.consecutiveFailures}`);
  console.log(`   Circuit Breaker: ${workerStatus.circuitBreakerActive ? '🔴 ACTIVE' : '✅ Inactive'}`);
  if (workerStatus.circuitBreakerResetsAt) {
    console.log(`   Resets At: ${workerStatus.circuitBreakerResetsAt}`);
  }
  console.log('');

  // Step 5: Check environment variables
  console.log('5️⃣  Checking environment configuration...');
  const rekorUrl = process.env.REKOR_URL || 'https://rekor.sigstore.dev';
  const rekorDisabled = process.env.REKOR_DISABLED === 'true';
  const monitoredEmails = process.env.REKOR_MONITORED_EMAILS || '';
  
  console.log(`   Rekor URL: ${rekorUrl}`);
  console.log(`   Rekor Disabled: ${rekorDisabled ? '⚠️  YES (dev mode)' : '✅ No'}`);
  console.log(`   Monitored Emails: ${monitoredEmails || '⚠️  None configured'}`);
  console.log('');

  // Step 6: Test Rekor API connectivity
  console.log('6️⃣  Testing Rekor API connectivity...');
  if (rekorDisabled) {
    console.log('⚠️  Skipped (REKOR_DISABLED=true)\n');
  } else {
    try {
      const { getRekorLogInfo } = await import('./services/rekorService');
      const logInfo = await getRekorLogInfo();
      
      if (logInfo) {
        console.log('✅ Rekor API is reachable');
        console.log(`   Tree Size: ${logInfo.treeSize.toLocaleString()}`);
        console.log(`   Tree ID: ${logInfo.treeID}`);
        console.log(`   Root Hash: ${logInfo.rootHash.substring(0, 16)}...\n`);
      } else {
        console.log('❌ Rekor API is not reachable\n');
      }
    } catch (err) {
      console.error('❌ Rekor API test failed:', err);
      console.log('');
    }
  }

  // Step 7: Run a manual monitoring check
  console.log('7️⃣  Running manual monitoring check...');
  console.log('   This may take 10-30 seconds...\n');
  
  try {
    const result = await runDailyMonitoringCheck();
    
    console.log('✅ Monitoring check completed!');
    console.log(`   Check Date: ${result.check_date}`);
    console.log(`   Status: ${result.log_consistency_status}`);
    console.log(`   Tree Head Valid: ${result.tree_head_valid}`);
    console.log(`   Tree Size: ${result.rekor_tree_size?.toLocaleString() || 'N/A'}`);
    console.log(`   Unexpected Entries: ${result.unexpected_entries_found}`);
    console.log(`   Issues Detected: ${result.issues_detected.length}`);
    if (result.issues_detected.length > 0) {
      console.log('   Issues:');
      result.issues_detected.forEach(issue => {
        console.log(`     - ${issue}`);
      });
    }
    console.log(`   Duration: ${result.monitoring_duration_ms}ms\n`);
  } catch (err) {
    console.error('❌ Monitoring check failed:', err);
    console.log('');
  }

  // Step 8: Verify the entry was saved
  console.log('8️⃣  Verifying entry was saved to database...');
  const latestResult = await getLatestMonitoringResult();
  
  if (latestResult) {
    console.log('✅ Latest monitoring result found:');
    console.log(`   ID: ${latestResult.id}`);
    console.log(`   Date: ${latestResult.check_date}`);
    console.log(`   Status: ${latestResult.log_consistency_status}`);
    console.log(`   Created: ${latestResult.created_at}\n`);
  } else {
    console.log('❌ No monitoring result found in database\n');
  }

  // Final summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 VERIFICATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  
  if (latestResult && latestResult.log_consistency_status === 'ok') {
    console.log('✅ Rekor Monitoring System is WORKING CORRECTLY');
    console.log('✅ Table is functional and receiving data');
    console.log('✅ Monitoring checks are executing successfully');
    console.log('\n📅 Scheduled monitoring runs daily at 00:05 UTC');
    console.log('🔗 API Endpoint: /api/blockchain-audit/monitoring/latest');
  } else if (latestResult && latestResult.log_consistency_status === 'skipped') {
    console.log('⚠️  Monitoring is configured but skipped');
    console.log('   Reason: ' + (latestResult.issues_detected[0] || 'Unknown'));
  } else if (latestResult && latestResult.log_consistency_status === 'failed') {
    console.log('❌ Monitoring check FAILED');
    console.log('   Issues detected - review logs above');
  } else {
    console.log('⚠️  Monitoring system needs attention');
    console.log('   Check the errors above for details');
  }
  
  console.log('═══════════════════════════════════════════════════════════\n');
}

// Run verification
verifyRekorMonitoring()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
