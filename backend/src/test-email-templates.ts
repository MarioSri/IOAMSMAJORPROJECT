import { EmailService } from './services/emailService';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

const FRONTEND_URL = process.env.EMAIL_FRONTEND_URL || process.env.FRONTEND_URL?.split(',')[0] || 'https://app.iaoms.dev';

async function testTemplates() {
  const targetEmail = process.argv[2];
  
  if (!targetEmail) {
    console.log('\n🚨 Usage: npx tsx src/test-email-templates.ts <your-email@example.com>\n');
    console.log('Example: npx tsx src/test-email-templates.ts john@example.com\n');
    process.exit(1);
  }

  console.log(`\n🚀 Starting Email Template Test Suite`);
  console.log(`📧 Target: ${targetEmail}`);
  console.log(`🌐 Frontend URL: ${FRONTEND_URL}\n`);

  let successCount = 0;
  let failCount = 0;

  // Test 1: Document Submission
  console.log('📋 [1/7] Testing Document Submission...');
  try {
    const result = await EmailService.sendDocumentSubmissionNotification(targetEmail, {
      docTitle: 'Annual Research Compliance Report — FY 2025',
      submitterName: 'Dr. Ravi Kumar',
      approvalUrl: `${FRONTEND_URL}/approvals`
    });
    if (result.success) {
      console.log('   ✅ Submission email sent successfully\n');
      successCount++;
    } else {
      console.error(`   ❌ Failed: ${result.error}\n`);
      failCount++;
    }
  } catch (err) {
    console.error(`   💥 Error: ${err}\n`);
    failCount++;
  }

  // Test 2: Document Approved
  console.log('✅ [2/7] Testing Document Approved...');
  try {
    const result = await EmailService.sendApprovalResultNotification(targetEmail, {
      docTitle: 'Annual Research Compliance Report — FY 2025',
      status: 'approved',
      approvalUrl: `${FRONTEND_URL}/documents/abc123`
    });
    if (result.success) {
      console.log('   ✅ Approval email sent successfully\n');
      successCount++;
    } else {
      console.error(`   ❌ Failed: ${result.error}\n`);
      failCount++;
    }
  } catch (err) {
    console.error(`   💥 Error: ${err}\n`);
    failCount++;
  }

  // Test 3: Document Rejected
  console.log('❌ [3/7] Testing Document Rejected...');
  try {
    const result = await EmailService.sendApprovalResultNotification(targetEmail, {
      docTitle: 'Annual Research Compliance Report — FY 2025',
      status: 'rejected',
      reason: 'Section 3.2 requires updated budget allocation figures matching Q4 actuals. Please attach the ethics clearance certificate before resubmitting.',
      approvalUrl: `${FRONTEND_URL}/approvals/abc123/revise`
    });
    if (result.success) {
      console.log('   ✅ Rejection email sent successfully\n');
      successCount++;
    } else {
      console.error(`   ❌ Failed: ${result.error}\n`);
      failCount++;
    }
  } catch (err) {
    console.error(`   💥 Error: ${err}\n`);
    failCount++;
  }

  // Test 4: LiveMeet+ Request
  console.log('🟢 [4/7] Testing LiveMeet+ Request...');
  try {
    const result = await EmailService.sendLiveMeetRequestNotification(targetEmail, {
      requesterName: 'Dr. Ravi Kumar',
      documentTitle: 'Annual Research Compliance Report — FY 2025',
      meetUrl: `${FRONTEND_URL}/meetings/requests/456`
    });
    if (result.success) {
      console.log('   ✅ LiveMeet+ request email sent successfully\n');
      successCount++;
    } else {
      console.error(`   ❌ Failed: ${result.error}\n`);
      failCount++;
    }
  } catch (err) {
    console.error(`   💥 Error: ${err}\n`);
    failCount++;
  }

  // Test 5: LiveMeet+ Accepted
  console.log('✅ [5/7] Testing LiveMeet+ Accepted...');
  try {
    const result = await EmailService.sendLiveMeetResponseNotification(targetEmail, {
      submitterName: 'Dr. Meera Sharma',
      status: 'accepted',
      meetUrl: `${FRONTEND_URL}/meetings/789`
    });
    if (result.success) {
      console.log('   ✅ LiveMeet+ accepted email sent successfully\n');
      successCount++;
    } else {
      console.error(`   ❌ Failed: ${result.error}\n`);
      failCount++;
    }
  } catch (err) {
    console.error(`   💥 Error: ${err}\n`);
    failCount++;
  }

  // Test 6: LiveMeet+ Declined
  console.log('❌ [6/7] Testing LiveMeet+ Declined...');
  try {
    const result = await EmailService.sendLiveMeetResponseNotification(targetEmail, {
      submitterName: 'Dr. Meera Sharma',
      status: 'declined'
    });
    if (result.success) {
      console.log('   ✅ LiveMeet+ declined email sent successfully\n');
      successCount++;
    } else {
      console.error(`   ❌ Failed: ${result.error}\n`);
      failCount++;
    }
  } catch (err) {
    console.error(`   💥 Error: ${err}\n`);
    failCount++;
  }

  // Test 7: Emergency Alert
  console.log('🚨 [7/7] Testing Emergency Alert...');
  try {
    const result = await EmailService.sendEmergencyNotification(targetEmail, {
      title: 'Power Outage — Block C & D',
      urgency: 'Critical',
      message: 'A complete power failure has been detected in Blocks C and D. All non-essential operations are suspended. Emergency generators are active. Follow evacuation protocols if required.'
    });
    if (result.success) {
      console.log('   ✅ Emergency email sent successfully\n');
      successCount++;
    } else {
      console.error(`   ❌ Failed: ${result.error}\n`);
      failCount++;
    }
  } catch (err) {
    console.error(`   💥 Error: ${err}\n`);
    failCount++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('🎯 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount}/7`);
  console.log(`❌ Failed: ${failCount}/7`);
  console.log('='.repeat(60));

  if (successCount === 7) {
    console.log('\n✨ All tests passed! Check your inbox (and spam folder).\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.\n');
    process.exit(1);
  }
}

testTemplates().catch(err => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
